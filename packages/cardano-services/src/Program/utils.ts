import { Logger } from 'ts-log';
import { Programs } from './programs';
import { WrongOption } from './errors';
import dns, { SrvRecord } from 'dns';
import pRetry, { FailedAttemptError } from 'p-retry';

export const SERVICE_DISCOVERY_BACKOFF_FACTOR_DEFAULT = 1.1;
export const SERVICE_DISCOVERY_TIMEOUT_DEFAULT = 60 * 1000;

export type RetryBackoffConfig = {
  factor?: number;
  maxRetryTime?: number;
};
export const onFailedAttemptFor =
  <ServiceNames>(serviceName: ServiceNames, logger: Logger) =>
  async ({ attemptNumber, message, retriesLeft }: FailedAttemptError) => {
    const nextAction = retriesLeft > 0 ? 'retrying...' : 'exiting';
    logger.trace(message);
    logger.debug(
      `Establishing connection to ${serviceName}: Attempt ${attemptNumber} of ${
        attemptNumber + retriesLeft
      }, ${nextAction}`
    );
    if (retriesLeft === 0) {
      logger.error(message);
      // will be caught by onDeath() to server.shutdown() and process.exit(1)
      process.kill(process.pid, 'SIGTERM');
    }
  };
// Select the first random record from the DNS server resolved list
export const resolveSrvRecord = async (serviceName: string): Promise<SrvRecord> => {
  const [srvRecord] = await dns.promises.resolveSrv(serviceName);
  return srvRecord;
};
export const createDnsResolver = (config: RetryBackoffConfig, logger: Logger) => async (serviceName: string) =>
  await pRetry(async () => await resolveSrvRecord(serviceName), {
    factor: config.factor,
    maxRetryTime: config.maxRetryTime,
    onFailedAttempt: onFailedAttemptFor(serviceName, logger)
  });
export type DnsResolver = ReturnType<typeof createDnsResolver>;

export const serviceSetHas = <ServiceNames>(serviceNames: ServiceNames[], services: Set<ServiceNames>) =>
  serviceNames.some((name) => services.has(name));

export const stringOptionToBoolean = (value: string, program: Programs, option: string) => {
  if (['0', 'f', 'false'].includes(value)) return false;
  if (['1', 't', 'true'].includes(value)) return true;
  throw new WrongOption(program, option, ['false', 'true']);
};
