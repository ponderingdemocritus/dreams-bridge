import { SnapWalletAdapter } from '@drift-labs/snap-wallet-adapter';
import { WalletError } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  BackpackWalletAdapter,
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SalmonWalletAdapter,
  SolflareWalletAdapter,
  TrustWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { PropsWithChildren, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { logger } from '../../../utils/logger';
import { useMultiProvider } from '../../chains/hooks';
import { useStore } from '../../store';
import { ProtocolType } from '@hyperlane-xyz/utils';

export function SolanaWalletContext({ children }: PropsWithChildren<unknown>) {
  const multiProvider = useMultiProvider();
  const originChainName = useStore((s) => s.originChainName);

  // Prefer an RPC from a configured Sealevel chain (respects NEXT_PUBLIC_RPC_OVERRIDES),
  // fall back to Solana mainnet cluster if none found
  const endpoint = useMemo(() => {
    try {
      const preferredChain =
        originChainName && multiProvider.tryGetProtocol(originChainName) === ProtocolType.Sealevel
          ? originChainName
          : multiProvider.getKnownChainNames().find(
              (c) => multiProvider.tryGetProtocol(c) === ProtocolType.Sealevel,
            );
      if (preferredChain) {
        const md = multiProvider.tryGetChainMetadata(preferredChain);
        const url = md?.rpcUrls?.[0]?.http;
        if (url) return url;
      }
    } catch (e) {
      logger.warn('Falling back to default Solana RPC endpoint', e);
    }
    // Default public Solana mainnet RPC
    return 'https://api.mainnet-beta.solana.com';
  }, [multiProvider, originChainName]);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new SalmonWalletAdapter(),
      new SnapWalletAdapter(),
      new TrustWalletAdapter(),
      new LedgerWalletAdapter(),
    ],
    [],
  );

  const onError = useCallback((error: WalletError) => {
    logger.error('Error initializing Solana wallet provider', error);
    toast.error('Error preparing Solana wallet');
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
