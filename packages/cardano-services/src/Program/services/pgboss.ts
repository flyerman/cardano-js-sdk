import {
  BlockEntity,
  PgConnectionConfig,
  PoolMetadataEntity,
  PoolRegistrationEntity,
  PoolRetirementEntity,
  StakePoolEntity,
  createPgBoss,
  isRecoverableTypeormError
} from '@cardano-sdk/projection-typeorm';
import { DataSource } from 'typeorm';
import { HealthCheckResponse } from '@cardano-sdk/core';
import { HttpService } from '../../Http/HttpService';
import { Logger } from 'ts-log';
import {
  Observable,
  Subscription,
  catchError,
  concat,
  finalize,
  firstValueFrom,
  from,
  merge,
  share,
  switchMap,
  tap
} from 'rxjs';
import { PgBossQueue } from '../../PgBoss/types';
import { Pool } from 'pg';
import { Router } from 'express';
import { contextLogger } from '@cardano-sdk/util';
import { createObservableDataSource } from '../../Projection/createTypeormProjection';
import { queueHandlers } from '../../PgBoss/util';
import { retryBackoff } from 'backoff-rxjs';
import PgBoss from 'pg-boss';

/**
 * The entities required by the job handlers
 */
export const pgBossEntities = [
  BlockEntity,
  PoolMetadataEntity,
  PoolRegistrationEntity,
  PoolRetirementEntity,
  StakePoolEntity
];

export const createPgBossDataSource = (connectionConfig$: Observable<PgConnectionConfig>, logger: Logger) =>
  createObservableDataSource({ connectionConfig$, entities: pgBossEntities, extensions: {}, logger });

export interface PgBossServiceConfig {
  parallelJobs: number;
  queues: PgBossQueue[];
}

export interface PgBossServiceDependencies {
  connectionConfig$: Observable<PgConnectionConfig>;
  db: Pool;
  logger: Logger;
}

export class PgBossHttpService extends HttpService {
  #config: PgBossServiceConfig;
  #dataSource$: Observable<DataSource>;
  #subscription?: Subscription;
  #health: HealthCheckResponse = { ok: false, reason: 'PgBossHttpService not started' };

  constructor(cfg: PgBossServiceConfig, deps: PgBossServiceDependencies) {
    const { connectionConfig$, logger } = deps;

    super('pg-boss-service', { healthCheck: async () => this.#health }, Router(), logger);

    this.#config = cfg;
    this.#dataSource$ = createPgBossDataSource(connectionConfig$, this.logger);
  }

  protected async startImpl() {
    await super.startImpl();

    if (this.#subscription) {
      this.logger.warn('Unsubscribing from an observable which should never happen');
      this.#subscription.unsubscribe();
    }

    // Used for later use of firstValueFrom() to avoid it subscribes again
    const sharedWork$ = this.work().pipe(share());

    // Subscribe to work() to create the first DataSource and start pg-boss
    this.#subscription = sharedWork$.subscribe();

    // Used to make startImpl actually await for a first emitted value from work()
    await firstValueFrom(sharedWork$);
  }

  protected async shutdownImpl() {
    await super.shutdownImpl();

    this.#subscription?.unsubscribe();
  }

  private work() {
    return this.#dataSource$.pipe(
      switchMap((dataSource) => {
        const pgBoss = createPgBoss(null, this.logger, dataSource);

        return concat(
          from(pgBoss.start()),
          merge(...this.#config.queues.map((queue) => this.workQueue(dataSource, pgBoss, queue)))
        ).pipe(finalize(() => pgBoss.stop().catch((error) => this.logger.warn('Error stopping pgBoss', error))));
      }),
      tap(() => (this.#health = { ok: true })),
      retryBackoff({
        // TODO: set this in the config
        initialInterval: 10,
        maxInterval: 5000,
        resetOnSuccess: true,
        // This ensures that if an error which can't be retried arrives here is handled as a FATAL error
        shouldRetry: (error: unknown) => {
          const retry = isRecoverableTypeormError(error);

          this.#health = {
            ok: false,
            reason: retry ? 'DataBase error: reconnecting...' : 'Fatal error! Shutting down'
          };

          return retry;
        }
      }),
      catchError((error) => {
        this.logger.error('Fatal worker error', error);
        // eslint-disable-next-line unicorn/no-process-exit
        process.exit(1);
      })
    );
  }

  private workQueue(dataSource: DataSource, pgBoss: PgBoss, queue: PgBossQueue) {
    const logger = contextLogger(this.logger, queue);
    const handler = queueHandlers[queue](dataSource, logger);

    return new Observable((subscriber) => {
      const workOption = {
        teamConcurrency: this.#config.parallelJobs,
        teamRefill: true,
        teamSize: this.#config.parallelJobs
      };

      const baseHandler = async (job: PgBoss.JobWithDoneCallback<unknown, unknown>) => {
        const { id, data } = job;

        try {
          logger.info(`Job ${id} started`, data);

          await handler(data);

          // Emit an unused value just to:
          // - make the tap() in work() to set the healthy state
          // - reset the retryBackoff in work() to reset the counter of its retry strategy
          subscriber.next(null);

          logger.info(`Job ${id} successfully completed`, data);
        } catch (error) {
          // pg-boss may retry the job eventually, but this is opaque,
          // so the error is logged here for more insight
          logger.error(`Job ${id} got error`, error);

          if (isRecoverableTypeormError(error)) {
            logger.info('The error is recoverable: re-creating DB connection');
            // Emit the error so retryBackoff in work() can do its job
            subscriber.error(error);
          }

          throw error;
        }
      };

      pgBoss.work(queue, workOption, baseHandler).catch((error: unknown) => {
        logger.error(`Error while starting worker for queue '${queue}'`, error);
        subscriber.error(error);
      });
    });
  }
}
