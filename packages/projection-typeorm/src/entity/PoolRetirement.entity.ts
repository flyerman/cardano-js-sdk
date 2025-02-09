import { BigIntColumnOptions, DeleteCascadeRelationOptions } from './util';
import { BlockEntity } from './Block.entity';
import { Cardano } from '@cardano-sdk/core';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StakePoolEntity } from './StakePool.entity';

@Entity()
export class PoolRetirementEntity {
  /**
   * Computed from certificate pointer.
   * Can be used to sort pool retirements.
   */
  @PrimaryColumn(BigIntColumnOptions)
  id?: bigint;
  @Column()
  retireAtEpoch?: Cardano.EpochNo;
  @ManyToOne(() => StakePoolEntity, (stakePool) => stakePool.retirements, DeleteCascadeRelationOptions)
  @JoinColumn()
  stakePool?: StakePoolEntity;
  @ManyToOne(() => BlockEntity, DeleteCascadeRelationOptions)
  @JoinColumn()
  block?: BlockEntity;
}
