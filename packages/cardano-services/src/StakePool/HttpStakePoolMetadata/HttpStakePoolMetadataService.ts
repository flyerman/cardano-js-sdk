/* eslint-disable max-len */
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable max-depth */

import * as Crypto from '@cardano-sdk/crypto';
import { CML, Cardano } from '@cardano-sdk/core';
import { CustomError } from 'ts-custom-error';
import { HexBlob } from '@cardano-sdk/util';
import { Logger } from 'ts-log';
import { StakePoolExtMetadataResponse, StakePoolMetadataService } from '../types';
import { StakePoolMetadataServiceError, StakePoolMetadataServiceFailure } from './errors';
import { ValidationError, validate } from 'jsonschema';
import { getExtMetadataUrl, getSchemaFormat, loadJsonSchema } from './util';
import { mapToExtendedMetadata } from './mappers';
import axios, { AxiosInstance } from 'axios';

const HTTP_CLIENT_TIMEOUT = 2 * 1000;
const HTTP_CLIENT_MAX_CONTENT_LENGTH = 5000;
const SERVICE_NAME = 'StakePoolMetadataService';

export const createHttpStakePoolMetadataService = (
  logger: Logger,
  axiosClient: AxiosInstance = axios.create({
    maxContentLength: HTTP_CLIENT_MAX_CONTENT_LENGTH,
    timeout: HTTP_CLIENT_TIMEOUT
  })
): StakePoolMetadataService => ({
  async getStakePoolExtendedMetadata(metadata, config = {}) {
    const url = getExtMetadataUrl(metadata);
    try {
      logger.debug('About to fetch stake pool extended metadata');
      const { data } = await axiosClient.get<StakePoolExtMetadataResponse>(url, config);
      const schema = loadJsonSchema(getSchemaFormat(metadata));
      validate(data, schema, { throwError: true });
      return mapToExtendedMetadata(data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new StakePoolMetadataServiceError(
            StakePoolMetadataServiceFailure.FailedToFetchExtendedMetadata,
            error,
            `${SERVICE_NAME} failed to fetch extended metadata from ${url} due to resource not found`
          );
        }

        throw new StakePoolMetadataServiceError(
          StakePoolMetadataServiceFailure.FailedToFetchExtendedMetadata,
          error,
          `${SERVICE_NAME} failed to fetch extended metadata from ${url} due to connection error`
        );
      }

      if (error instanceof ValidationError) {
        throw new StakePoolMetadataServiceError(
          StakePoolMetadataServiceFailure.InvalidExtendedMetadataFormat,
          error,
          'Extended metadata JSON format validation failed against the corresponding schema for correctness'
        );
      }

      throw error;
    }
  },

  async getStakePoolMetadata(hash, url) {
    const errors: CustomError[] = [];
    let metadata: Cardano.StakePoolMetadata | undefined;
    let extMetadata: Cardano.ExtendedStakePoolMetadata | undefined;

    try {
      logger.debug(`About to fetch stake pool metadata JSON from ${url}`);

      // Fetch metadata as byte array
      const { data } = await axiosClient.get<Uint8Array>(url, { responseType: 'arraybuffer' });

      // Produce metadata hash
      const metadataHash = Crypto.blake2b(Crypto.blake2b.BYTES).update(data).digest('hex');

      // Verify base hashes
      if (metadataHash !== hash) {
        return {
          errors: [
            new StakePoolMetadataServiceError(
              StakePoolMetadataServiceFailure.InvalidStakePoolHash,
              null,
              `Invalid stake pool hash. Computed '${metadataHash}', expected '${hash}'`
            )
          ],
          metadata
        };
      }

      // Transform fetched metadata from bytes array to JSON
      metadata = JSON.parse(data.toString());

      extMetadata = await this.validateStakePoolExtendedMetadata(errors, metadata);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        errors.push(
          new StakePoolMetadataServiceError(
            StakePoolMetadataServiceFailure.FailedToFetchMetadata,
            error.toJSON(),
            `${SERVICE_NAME} failed to fetch metadata JSON from ${url} due to ${error.message}`
          )
        );
      } else if (error instanceof StakePoolMetadataServiceError) {
        errors.push(error);
      } else {
        errors.push(
          new StakePoolMetadataServiceError(
            StakePoolMetadataServiceFailure.Unknown,
            JSON.stringify(error),
            `${SERVICE_NAME} failed to fetch metadata JSON from ${url} due to ${
              error instanceof Error ? error.message : 'unknown error'
            }`
          )
        );
      }
    }

    return { errors, metadata: { ...metadata!, ext: extMetadata } };
  },

  async validateStakePoolExtendedMetadata(errors, metadata) {
    if (!metadata?.extDataUrl && !metadata?.extended) return;

    // Validate CIP-6 ext metadata fields
    if (metadata.extDataUrl && (!metadata.extSigUrl || !metadata.extVkey)) {
      errors.push(
        new StakePoolMetadataServiceError(
          StakePoolMetadataServiceFailure.InvalidMetadata,
          null,
          'Missing ext signature or public key'
        )
      );

      return;
    }

    // Fetch extended metadata (supports both cip-6 and ada pools formats already)
    let extMetadata: Cardano.ExtendedStakePoolMetadata | undefined = await this.getStakePoolExtendedMetadata(metadata);

    // In case of CIP-6 standard -> perform signature verification
    if (metadata.extDataUrl && metadata.extSigUrl && metadata.extVkey) {
      // Based on the CIP-6, we have `extSigUrl` (A URL with the extended metadata signature), so we need to make another HTTP request to get the actual signature
      try {
        const signature = (await axiosClient.get<Crypto.Ed25519SignatureHex>(metadata.extSigUrl)).data;
        const message = HexBlob.fromBytes(Buffer.from(JSON.stringify(extMetadata)));
        const publicKey = Crypto.Ed25519PublicKeyHex(metadata.extVkey);
        const bip32Ed25519 = new Crypto.CmlBip32Ed25519(CML);

        // Verify the signature
        const isSignatureValid = await bip32Ed25519.verify(signature, message, publicKey);

        // If not valid -> omit extended metadata from response and add specific error
        if (!isSignatureValid) {
          extMetadata = undefined;
          errors.push(
            new StakePoolMetadataServiceError(
              StakePoolMetadataServiceFailure.InvalidExtendedMetadataSignature,
              null,
              'Invalid extended metadata signature'
            )
          );
        }

        // If signature url failed -> omit extended metadata from response and add specific error
      } catch (error) {
        extMetadata = undefined;
        errors.push(
          new StakePoolMetadataServiceError(
            StakePoolMetadataServiceFailure.FailedToFetchExtendedSignature,
            error,
            `${SERVICE_NAME} failed to fetch extended signature from ${metadata.extSigUrl} due to connection error`
          )
        );
      }
    }

    return extMetadata;
  }
});
