import { Token, TokenAmount, WarpCore } from '@hyperlane-xyz/sdk';
import { HexString, ProtocolType } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts } from '@hyperlane-xyz/widgets';
import { useQuery } from '@tanstack/react-query';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getTokenByIndex, useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from './types';

// Reduce polling to avoid spamming RPCs, especially on Solana where
// quotes trigger transaction simulations and priority fee lookups.
const FEE_QUOTE_REFRESH_INTERVAL = 60_000; // 60s

export function useFeeQuotes(
  { origin, destination, tokenIndex }: TransferFormValues,
  enabled: boolean,
) {
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();

  const { accounts } = useAccounts(multiProvider);
  const { address: sender, publicKey: senderPubKey } = getAccountAddressAndPubKey(
    multiProvider,
    origin,
    accounts,
  );

  const isSealevelOrigin =
    multiProvider.tryGetProtocol(origin) === ProtocolType.Sealevel;

  const { isLoading, isError, data, refetch } = useQuery({
    // The WarpCore class is not serializable, so we can't use it as a key
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['useFeeQuotes', destination, tokenIndex, sender, senderPubKey],
    queryFn: () => fetchFeeQuotes(warpCore, destination, tokenIndex, sender, senderPubKey),
    enabled,
    // Avoid periodic refetches on Solana to prevent RPC rate limits
    refetchInterval: isSealevelOrigin ? false : FEE_QUOTE_REFRESH_INTERVAL,
    staleTime: isSealevelOrigin ? Infinity : 0,
  });

  return { isLoading, isError, fees: data, refetch };
}

async function fetchFeeQuotes(
  warpCore: WarpCore,
  destination?: ChainName,
  tokenIndex?: number,
  sender?: Address,
  senderPubKey?: Promise<HexString>,
): Promise<{ interchainQuote: TokenAmount; localQuote: TokenAmount } | null> {
  const originToken = getTokenByIndex(warpCore, tokenIndex);
  if (!destination || !sender || !originToken) return null;
  logger.debug('Fetching fee quotes');
  // On Sealevel origins, avoid simulating local gas fees to reduce RPC load.
  if (originToken.protocol === ProtocolType.Sealevel) {
    const interchainQuote = await warpCore.getInterchainTransferFee({
      originToken,
      destination,
      sender,
    });
    const originMetadata = warpCore.multiProvider.getChainMetadata(originToken.chainName);
    const localGasToken = Token.FromChainMetadataNativeToken(originMetadata);
    const localQuote = localGasToken.amount(0);
    return { interchainQuote, localQuote };
  }

  return warpCore.estimateTransferRemoteFees({
    originToken,
    destination,
    sender,
    senderPubKey: await senderPubKey,
  });
}
