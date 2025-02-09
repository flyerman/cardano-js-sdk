import * as Ledger from '@cardano-foundation/ledgerjs-hw-app-cardano';
import { CONTEXT_WITHOUT_KNOWN_ADDRESSES, CONTEXT_WITH_KNOWN_ADDRESSES, stakeKeyHash } from '../testData';
import { CardanoKeyConst, util } from '@cardano-sdk/key-management';
import { mapRequiredSigners, toRequiredSigner } from '../../src/transformers';

describe('requiredSigners', () => {
  describe('mapRequiredSigners', () => {
    it('return null if given an undefined object as required signer', async () => {
      const txIns = await mapRequiredSigners(undefined, CONTEXT_WITH_KNOWN_ADDRESSES);
      expect(txIns).toEqual(null);
    });

    it('can map a a set of required signers', async () => {
      const signers = await mapRequiredSigners(
        [stakeKeyHash, stakeKeyHash, stakeKeyHash],
        CONTEXT_WITH_KNOWN_ADDRESSES
      );

      expect(signers!.length).toEqual(3);

      for (const signer of signers!) {
        expect(signer).toEqual({
          path: [util.harden(CardanoKeyConst.PURPOSE), util.harden(CardanoKeyConst.COIN_TYPE), util.harden(0), 1, 0],
          type: Ledger.TxRequiredSignerType.PATH
        });
      }

      expect.assertions(4);
    });
  });
  describe('toRequiredSigner', () => {
    it('can map a known Ed25519KeyHashHex to a ledger required signer', async () => {
      const requiredSigner = toRequiredSigner(stakeKeyHash, CONTEXT_WITH_KNOWN_ADDRESSES);

      expect(requiredSigner).toEqual({
        path: [util.harden(CardanoKeyConst.PURPOSE), util.harden(CardanoKeyConst.COIN_TYPE), util.harden(0), 1, 0],
        type: Ledger.TxRequiredSignerType.PATH
      });
    });

    it('can map a unknown Ed25519KeyHashHex to a ledger required signer', async () => {
      const requiredSigner = toRequiredSigner(stakeKeyHash, CONTEXT_WITHOUT_KNOWN_ADDRESSES);

      expect(requiredSigner).toEqual({
        hashHex: stakeKeyHash,
        type: Ledger.TxRequiredSignerType.HASH
      });
    });
  });
});
