// Expose any additional services to be shared with UIs
import { BackgroundServices, adaPriceProperties, logger } from '../util';
import { adaPriceServiceChannel, walletName } from '../const';
import { authenticator } from './authenticator';
import { exposeApi, exposeSupplyDistributionTracker } from '@cardano-sdk/web-extension';
import { of } from 'rxjs';
import { runtime } from 'webextension-polyfill';
import { supplyDistributionTrackerReady } from './supplyDistributionTracker';

const priceService: BackgroundServices = {
  adaUsd$: of(2.99),
  clearAllowList: authenticator.clear.bind(authenticator)
};

exposeApi(
  {
    api$: of(priceService),
    baseChannel: adaPriceServiceChannel,
    properties: adaPriceProperties
  },
  { logger, runtime }
);

/* eslint-disable @typescript-eslint/no-floating-promises */
(async () => {
  const supplyDistributionTracker = await supplyDistributionTrackerReady;
  exposeSupplyDistributionTracker({ supplyDistributionTracker, walletName }, { logger, runtime });
})();
