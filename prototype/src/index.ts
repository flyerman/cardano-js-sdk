import Transaction, { TransactionInput, TransactionOutput } from './Transaction'
import { Wallet } from './Wallet'
import { Provider, ProviderType, CardanoProvider, WalletProvider } from './Provider'
import * as Utils from './Utils'
import { InMemoryKeyManager, LedgerKeyManager, RustCardano, ClientHttpProvider, CardanoWalletProvider } from './lib'
import { FeeAlgorithm, ChainSettings } from './Cardano'

export default function CardanoSDK (cardano = RustCardano) {
  return {
    Transaction (inputs: TransactionInput[], outputs: TransactionOutput[], feeAlgorithm = FeeAlgorithm.default) {
      return Transaction(cardano, inputs, outputs, feeAlgorithm)
    },
    InMemoryKeyManager (keyArgs: { password: string, accountIndex?: number, mnemonic: string }) {
      return InMemoryKeyManager(cardano, keyArgs)
    },
    LedgerKeyManager,
    Utils: {
      generateMnemonic: Utils.generateMnemonic,
      addressDiscoveryWithinBounds: (addressDiscoveryArgs: Utils.AddressDiscoveryArgs, chainSettings = ChainSettings.mainnet) => {
        return Utils.addressDiscoveryWithinBounds(cardano, addressDiscoveryArgs, chainSettings)
      },
      verifyMessage: cardano.verifyMessage
    },
    connect (provider: Provider) {
      const clientConnection = {
        wallet: Wallet(cardano, provider),
        submitTransaction: (<CardanoProvider>provider).submitTransaction,
        createWallet: () => { throw new Error('Unsupported client connection operation. Create a new key with the KeyManager instead.') },
        listWallets: () => { throw new Error('Unsupported client connection operation. Keys generated by the client are not persisted.') }
      }

      const remoteConnection = {
        wallet: Wallet(cardano, provider),
        submitTransaction: () => { throw new Error('Unsupported remote connection operation. Use the createAndSignTransaction method on the Wallet interface instead') },
        createWallet: (<WalletProvider>provider).createWallet,
        listWallets: (<WalletProvider>provider).wallets
      }

      return provider.type === ProviderType.cardano ? clientConnection : remoteConnection
    }
  }
}

export { RustCardano, ClientHttpProvider, CardanoWalletProvider }