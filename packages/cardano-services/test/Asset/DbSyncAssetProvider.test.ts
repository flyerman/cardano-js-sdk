/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-shadow */
import { AssetFixtureBuilder, AssetWith } from './fixtures/FixtureBuilder';
import { Cardano, ProviderError, ProviderFailure } from '@cardano-sdk/core';
import {
  CardanoTokenRegistry,
  DEFAULT_TOKEN_METADATA_REQUEST_TIMEOUT,
  DbSyncAssetProvider,
  DbSyncNftMetadataService,
  InMemoryCache,
  NftMetadataService,
  PAGINATION_PAGE_SIZE_LIMIT_ASSETS,
  TokenMetadataService,
  UNLIMITED_CACHE_TTL
} from '../../src';
import { DbPools } from '../../src/util/DbSyncProvider';
import { OgmiosCardanoNode } from '@cardano-sdk/ogmios';
import { Pool } from 'pg';
import { clearDbPools, sleep } from '../util';
import { createDbSyncMetadataService } from '../../src/Metadata';
import { logger } from '@cardano-sdk/util-dev';
import { mockCardanoNode } from '../../../core/test/CardanoNode/mocks';
import { mockTokenRegistry } from './fixtures/mocks';

export const notValidAssetId = Cardano.AssetId('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
const defaultTimeout = DEFAULT_TOKEN_METADATA_REQUEST_TIMEOUT;

describe('DbSyncAssetProvider', () => {
  let closeMock: () => Promise<void> = jest.fn();
  let dbPools: DbPools;
  let ntfMetadataService: NftMetadataService;
  let provider: DbSyncAssetProvider;
  let serverUrl = '';
  let tokenMetadataService: TokenMetadataService;
  let cardanoNode: OgmiosCardanoNode;
  let fixtureBuilder: AssetFixtureBuilder;
  const cache = { db: new InMemoryCache(UNLIMITED_CACHE_TTL), healthCheck: new InMemoryCache(UNLIMITED_CACHE_TTL) };

  beforeAll(async () => {
    ({ closeMock, serverUrl } = await mockTokenRegistry(async () => ({})));
    dbPools = {
      healthCheck: new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING_DB_SYNC }),
      main: new Pool({ connectionString: process.env.POSTGRES_CONNECTION_STRING_DB_SYNC })
    };
    cardanoNode = mockCardanoNode() as unknown as OgmiosCardanoNode;
    ntfMetadataService = new DbSyncNftMetadataService({
      db: dbPools.main,
      logger,
      metadataService: createDbSyncMetadataService(dbPools.main, logger)
    });
    tokenMetadataService = new CardanoTokenRegistry(
      { logger },
      { tokenMetadataRequestTimeout: defaultTimeout, tokenMetadataServerUrl: serverUrl }
    );
    provider = new DbSyncAssetProvider(
      { paginationPageSizeLimit: PAGINATION_PAGE_SIZE_LIMIT_ASSETS },
      {
        cache,
        cardanoNode,
        dbPools,
        logger,
        ntfMetadataService,
        tokenMetadataService
      }
    );
    fixtureBuilder = new AssetFixtureBuilder(dbPools.main, logger);
  });

  afterAll(async () => {
    tokenMetadataService.shutdown();
    await clearDbPools(dbPools);
    await closeMock();
  });
  it('rejects for not found assetId', async () => {
    await expect(provider.getAsset({ assetId: notValidAssetId })).rejects.toThrow(
      new ProviderError(ProviderFailure.NotFound, undefined, 'No entries found in multi_asset table')
    );
  });
  it('returns an AssetInfo without extra data', async () => {
    const assets = await fixtureBuilder.getAssets(1, { with: [AssetWith.CIP25Metadata] });
    expect(await provider.getAsset({ assetId: assets[0].id })).toMatchShapeOf({
      assetId: '50fdcdbfa3154db86a87e4b5697ae30d272e0bbcfa8122efd3e301cb6d616361726f6e2d63616b65',
      fingerprint: 'asset1f0azzptnr8dghzjh7egqvdjmt33e3lz5uy59th',
      mintOrBurnCount: 1,
      name: '6d616361726f6e2d63616b65',
      policyId: '50fdcdbfa3154db86a87e4b5697ae30d272e0bbcfa8122efd3e301cb',
      quantity: 1n,
      supply: 1n
    });
  });
  it('returns an AssetInfo with extra data', async () => {
    const assets = await fixtureBuilder.getAssets(1, { with: [AssetWith.CIP25Metadata] });
    const asset = await provider.getAsset({
      assetId: assets[0].id,
      extraData: { history: true, nftMetadata: true, tokenMetadata: true }
    });
    const history = await fixtureBuilder.getHistory(assets[0].policyId, assets[0].name);

    expect(asset.history).toEqual(history);
    expect(asset.nftMetadata).toStrictEqual(assets[0].metadata);
    expect(asset.tokenMetadata).toStrictEqual({
      assetId: '728847c7898b06f180de05c80b37d38bf77a9ea22bd1e222b8014d964e46542d66696c6573',
      desc: 'This is my second NFT',
      name: 'Bored Ape'
    });
  });
  it('returns undefined asset token metadata if the token registry throws a server internal error', async () => {
    const { serverUrl, closeMock } = await mockTokenRegistry(async () => ({ body: {}, code: 500 }));
    const tokenMetadataService = new CardanoTokenRegistry(
      { logger },
      { tokenMetadataRequestTimeout: defaultTimeout, tokenMetadataServerUrl: serverUrl }
    );

    provider = new DbSyncAssetProvider(
      { paginationPageSizeLimit: PAGINATION_PAGE_SIZE_LIMIT_ASSETS },
      {
        cache,
        cardanoNode,
        dbPools,
        logger,
        ntfMetadataService,
        tokenMetadataService
      }
    );

    const assets = await fixtureBuilder.getAssets(1, { with: [AssetWith.CIP25Metadata] });
    const asset = await provider.getAsset({
      assetId: assets[0].id,
      extraData: { tokenMetadata: true }
    });
    expect(asset.tokenMetadata).toBeUndefined();
    tokenMetadataService.shutdown();
    await closeMock();
  });

  it('returns undefined asset token metadata and load it internally if the token registry throws a timeout error', async () => {
    const exceededTimeout = DEFAULT_TOKEN_METADATA_REQUEST_TIMEOUT + 1000;
    const handler = async () => {
      await sleep(exceededTimeout);
      return { body: { subjects: [] } };
    };

    const { serverUrl, closeMock } = await mockTokenRegistry(handler);
    const tokenMetadataService = new CardanoTokenRegistry(
      { logger },
      { tokenMetadataRequestTimeout: defaultTimeout, tokenMetadataServerUrl: serverUrl }
    );
    provider = new DbSyncAssetProvider(
      { paginationPageSizeLimit: PAGINATION_PAGE_SIZE_LIMIT_ASSETS },
      {
        cache,
        cardanoNode,
        dbPools,
        logger,
        ntfMetadataService,
        tokenMetadataService
      }
    );

    const assets = await fixtureBuilder.getAssets(1, { with: [AssetWith.CIP25Metadata] });
    const asset = await provider.getAsset({
      assetId: assets[0].id,
      extraData: { tokenMetadata: true }
    });
    expect(asset.tokenMetadata).toBeUndefined();
    tokenMetadataService.shutdown();
    await closeMock();
  });
});
