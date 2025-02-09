import { Cardano } from '@cardano-sdk/core';
import { CustomError } from 'ts-custom-error';

import { InputSelectionError, InputSelector, SelectionSkeleton } from '@cardano-sdk/input-selection';

import { AsyncKeyAgent, GroupedAddress, SignTransactionOptions, TransactionSigner } from '@cardano-sdk/key-management';
import { Hash32ByteBase16 } from '@cardano-sdk/crypto';
import { InitializeTxWitness, TxBuilderProviders } from '../types';
import { Logger } from 'ts-log';
import { OutputBuilderValidator } from './OutputBuilder';
import { OutputValidation } from '../output-validation';

export type PartialTxOut = Partial<
  Pick<Cardano.TxOut, 'address' | 'datumHash' | 'datum' | 'scriptReference'> & { value: Partial<Cardano.Value> }
>;

export enum TxOutputFailure {
  MinimumCoin = 'Minimum coin not met',
  TokenBundleSizeExceedsLimit = 'Token Bundle Exceeds Limit',
  MissingRequiredFields = 'Mandatory fields address or coin are missing'
}

export class OutputValidationMissingRequiredError extends CustomError {
  public constructor(public txOut: PartialTxOut) {
    super(TxOutputFailure.MissingRequiredFields);
  }
}

export class OutputValidationMinimumCoinError extends CustomError {
  public constructor(public txOut: PartialTxOut, public outputValidation: OutputValidation) {
    super(TxOutputFailure.MinimumCoin);
  }
}

export class OutputValidationTokenBundleSizeError extends CustomError {
  public constructor(public txOut: PartialTxOut, public outputValidation: OutputValidation) {
    super(TxOutputFailure.TokenBundleSizeExceedsLimit);
  }
}

export class RewardAccountMissingError extends CustomError {}

export type TxOutValidationError =
  | OutputValidationMissingRequiredError
  | OutputValidationMinimumCoinError
  | OutputValidationTokenBundleSizeError;
export type TxBodyValidationError = TxOutValidationError | InputSelectionError | RewardAccountMissingError;

/**
 * Helps build transaction outputs from its constituent parts.
 * Usage examples are in the unit/integration tests from `TxBuilder.test.ts`.
 */
export interface OutputBuilder {
  /**
   * @returns a partial output that has properties set by calling other TxBuilder methods. Does not validate the output.
   */
  inspect(): Promise<PartialTxOut>;
  /** Sets transaction output `value` field. Preexisting `value` is overwritten. */
  value(value: Cardano.Value): OutputBuilder;
  /** Sets transaction output value `coins` field. */
  coin(coin: Cardano.Lovelace): OutputBuilder;
  /** Sets transaction output value `assets` field. Preexisting assets are overwritten */
  assets(assets: Cardano.TokenMap): OutputBuilder;
  /**
   * Add/Remove/Update asset.
   * - If `assetId` is new, the asset is created and added to assets.
   * - If `assetId` is already added, the asset quantity is updated.
   * - If `quantity` is 0, the the asset is removed.
   *
   * @param assetId id
   * @param quantity To remove an asset, set quantity to 0
   */
  asset(assetId: Cardano.AssetId, quantity: bigint): OutputBuilder;
  /** Sets transaction output `address` field. */
  address(address: Cardano.PaymentAddress): OutputBuilder;
  /** Sets transaction output `datum` field. */
  datum(datum: Hash32ByteBase16): OutputBuilder;
  /**
   * Checks if the transaction output is complete and valid
   *
   * @returns {Promise<Cardano.TxOut>} Promise<Cardano.TxOut> which can be used as input in `TxBuilder.addOutput()`.
   * @throws {TxOutValidationError} TxOutValidationError
   */
  build(): Promise<Cardano.TxOut>;
}

export interface TxContext {
  ownAddresses: GroupedAddress[];
  signingOptions?: SignTransactionOptions;
  auxiliaryData?: Cardano.AuxiliaryData;
  witness?: InitializeTxWitness;
  isValid?: boolean;
}

export type TxInspection = Cardano.TxBodyWithHash &
  Pick<TxContext, 'ownAddresses' | 'auxiliaryData'> & {
    inputSelection: SelectionSkeleton;
  };

export interface SignedTx {
  tx: Cardano.Tx;
}

/**
 * Transaction body built with {@link TxBuilder.build}
 * `const unsignedTx = await txBuilder.build().sign();`
 * At the same time it allows inspecting the built transaction before signing it:
 * `const signedTx = await txBuilder.build().inspect();`
 * Transaction is built lazily: only when inspect() or sign() is called.
 */
export interface UnsignedTx {
  inspect(): Promise<TxInspection>;
  sign(): Promise<SignedTx>;
}

export interface PartialTx {
  /**
   * Transaction body that is updated by {@link TxBuilder} methods.
   */
  body: Partial<Cardano.TxBody>;
  /**
   * TxMetadata to be added in the transaction auxiliary data body blob, after {@link TxBuilder.build}.
   * Configured using {@link TxBuilder.metadata} method.
   */
  auxiliaryData?: Cardano.AuxiliaryData;
  extraSigners?: TransactionSigner[];
  signingOptions?: SignTransactionOptions;
}
export interface TxBuilder {
  /**
   * @returns a partial transaction that has properties set by calling other TxBuilder methods. Does not validate the transaction.
   */
  inspect(): Promise<PartialTx>;

  /** @param txOut transaction output to add to {@link partialTxBody} outputs. */
  addOutput(txOut: Cardano.TxOut): TxBuilder;
  /**
   * @param txOut transaction output to be removed from {@link partialTxBody} outputs.
   * It must be in partialTxBody.outputs (===)
   */
  removeOutput(txOut: Cardano.TxOut): TxBuilder;
  /**
   * Does *not* addOutput.
   *
   * @param txOut optional partial transaction output to use for initialization.
   * @returns {OutputBuilder} {@link OutputBuilder} util for building transaction outputs.
   */
  buildOutput(txOut?: PartialTxOut): OutputBuilder;
  /**
   * Configure transaction to include delegation.
   * - On `build()`, StakeKeyDeregistration or StakeDelegation and (if needed)
   *   StakeKeyRegistration certificates are added in the transaction body.
   * - Stake key deregister is done by not providing the `poolId` parameter: `delegate()`.
   * - If wallet contains multiple reward accounts, it will create certificates for all of them.
   *
   * @param poolId Pool Id to delegate to. If undefined, stake key deregistration will be done.
   */
  delegate(poolId?: Cardano.PoolId): TxBuilder;
  /** Sets TxMetadata in {@link auxiliaryData} */
  metadata(metadata: Cardano.TxMetadata): TxBuilder;
  /** Sets extra signers in {@link extraSigners} */
  extraSigners(signers: TransactionSigner[]): TxBuilder;
  /** Sets signing options in {@link signingOptions} */
  signingOptions(options: SignTransactionOptions): TxBuilder;

  /**
   * Create a snapshot of current transaction properties.
   * All positive balance found in reward accounts is included in the transaction withdrawal.
   * Performs multiple validations to make sure the transaction body is correct.
   *
   * @returns {UnsignedTx}
   * Can be used to build and sign directly: `const signedTx = await txBuilder.build().sign()`,
   * or inspect the transaction before signing:
   * ```
   * const tx = await txBuilder.build();
   * const unsignedTx = await tx.inspect();
   * const signedTx = await tx.sign()
   * ```
   *
   * This is a snapshot of transaction. Further changes done via TxBuilder, will not update this snapshot.
   * @throws {TxBodyValidationError[]} TxBodyValidationError[]
   */
  build(): UnsignedTx;

  // TODO:
  // - setMint
  // - setMetadatum(label: bigint, metadatum: Cardano.Metadatum | null);
  // - burn
  // TODO: maybe this, or maybe datum should be added together with an output?
  //  collaterals should be automatically computed and added to tx when you add scripts
  // - setScripts(scripts: Array<{script, datum, redeemer}>)
  // - setValidityInterval
  // TODO: figure out what script_data_hash is used for
  // - setScriptIntegrityHash(hash: Cardano.util.Hash32ByteBase16 | null);
  // - setRequiredExtraSignatures(keyHashes: Cardano.Ed25519KeyHash[]);
}

export interface TxBuilderDependencies {
  inputSelector?: InputSelector;
  inputResolver: Cardano.InputResolver;
  keyAgent: AsyncKeyAgent;
  txBuilderProviders: TxBuilderProviders;
  logger: Logger;
  outputValidator?: OutputBuilderValidator;
}

export type FinalizeTxDependencies = Pick<TxBuilderDependencies, 'inputResolver' | 'keyAgent'>;
