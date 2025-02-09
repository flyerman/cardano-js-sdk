/* eslint-disable brace-style */
import { BigIntColumnOptions, DeleteCascadeRelationOptions } from './util';
import { BlockEntity } from './Block.entity';
import { Cardano } from '@cardano-sdk/core';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StakePoolEntity } from './StakePool.entity';

@Entity()
export class PoolRegistrationEntity {
  /**
   * Computed from certificate pointer.
   * Can be used to sort pool updates.
   */
  @PrimaryColumn(BigIntColumnOptions)
  id?: bigint;
  @Column()
  rewardAccount?: Cardano.RewardAccount;
  @Column(BigIntColumnOptions)
  pledge?: bigint;
  @Column(BigIntColumnOptions)
  cost?: bigint;
  // Review: should we store this as 'double' instead?
  // Maybe both formats? If we'll need to do computations with this
  // then it's best to keep the lossless format
  @Column({ type: 'jsonb' })
  margin?: Cardano.Fraction;
  @Column({ type: 'float4' })
  marginPercent?: Cardano.Percent;
  @Column('jsonb')
  relays?: Cardano.Relay[];
  @Column('jsonb')
  owners?: Cardano.RewardAccount[];
  @Column({ length: 64, type: 'char' })
  vrf?: Cardano.VrfVkHex;
  @Column('varchar', { nullable: true })
  metadataUrl?: string | null;
  @Column({ length: 64, nullable: true, type: 'char' })
  metadataHash?: string | null;
  @JoinColumn()
  @ManyToOne(() => StakePoolEntity, (stakePool) => stakePool.registrations, DeleteCascadeRelationOptions)
  stakePool?: StakePoolEntity;
  @ManyToOne(() => BlockEntity, DeleteCascadeRelationOptions)
  @JoinColumn()
  block?: BlockEntity;
}
