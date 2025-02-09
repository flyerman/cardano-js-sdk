import { Cardano, ChainSyncEvent, ChainSyncEventType } from '@cardano-sdk/core';
import { ExtChainSyncOperator, StabilityWindowBuffer, WithBlock } from '../types';
import { Observable, concatMap, finalize, map, noop, of, takeWhile } from 'rxjs';

/**
 * Transforms rollback event into a stream of granular rollback events, each containing a single rolled back block.
 * Intended to be used as the 1st projection operator.
 */
export const withRolledBackBlock =
  (buffer: StabilityWindowBuffer): ExtChainSyncOperator<{}, {}, {}, WithBlock> =>
  (evt$: Observable<ChainSyncEvent>) =>
    evt$.pipe(
      concatMap((chainSyncEvent) => {
        switch (chainSyncEvent.eventType) {
          case ChainSyncEventType.RollForward:
            return of(chainSyncEvent);
          case ChainSyncEventType.RollBackward:
            return buffer.tip$.pipe(
              takeWhile(
                (block): block is Cardano.Block =>
                  block !== 'origin' &&
                  (chainSyncEvent.point === 'origin' || chainSyncEvent.point.hash !== block.header.hash)
              ),
              map((block) => ({
                ...chainSyncEvent,
                block,
                requestNext: noop
              })),
              // Call requestNext() once all rolled back blocks are processed
              finalize(chainSyncEvent.requestNext)
            );
        }
      })
    );
