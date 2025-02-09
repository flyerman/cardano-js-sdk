import { ActiveStakeModel, CirculatingSupplyModel, EpochModel, ProtocolParamsModel, TotalSupplyModel } from './types';
import { Cardano } from '@cardano-sdk/core';
import { LedgerTipModel, findLedgerTip } from '../../util/DbSyncProvider';
import { Logger } from 'ts-log';
import { Pool, QueryResult } from 'pg';
import Queries from './queries';

export class NetworkInfoBuilder {
  #db: Pool;
  #logger: Logger;
  constructor(db: Pool, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  public async queryCirculatingSupply() {
    this.#logger.debug('About to query circulation supply');
    const result: QueryResult<CirculatingSupplyModel> = await this.#db.query(Queries.findCirculatingSupply);
    return result.rows[0].circulating_supply;
  }

  public async queryTotalSupply(maxLovelaceSupply: Cardano.Lovelace) {
    this.#logger.debug('About to query total supply');
    const result: QueryResult<TotalSupplyModel> = await this.#db.query(Queries.findTotalSupply, [maxLovelaceSupply]);
    return result.rows[0].total_supply;
  }

  public async queryActiveStake() {
    this.#logger.debug('About to query active stake');
    const result: QueryResult<ActiveStakeModel> = await this.#db.query(Queries.findActiveStake);
    return result.rows[0].active_stake;
  }

  public async queryLatestEpoch() {
    this.#logger.debug('About to query the last epoch');
    const result: QueryResult<EpochModel> = await this.#db.query(Queries.findLatestCompleteEpoch);
    return result.rows[0].no;
  }

  public async queryLedgerTip() {
    this.#logger.debug('About to query the ledger tip');
    const result: QueryResult<LedgerTipModel> = await this.#db.query(findLedgerTip);
    return result.rows[0];
  }

  public async queryProtocolParams() {
    this.#logger.debug('About to query protocol params');
    const result: QueryResult<ProtocolParamsModel> = await this.#db.query(Queries.findProtocolParams);
    return result.rows[0];
  }
}
