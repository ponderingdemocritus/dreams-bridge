import { useCallback, useMemo, useState } from 'react';
import { useFormikContext } from 'formik';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { getAccountAddressAndPubKey, useAccounts } from '@hyperlane-xyz/widgets';
import { useMultiProvider } from '../chains/hooks';
import { useWarpCore } from '../tokens/hooks';
import { TransferFormValues } from '../transfer/types';
import { logger } from '../../utils/logger';

type IgpKeys = {
  programId?: string;
  igpAccount?: string;
  overheadIgpAccount?: string;
};

type DestGas = { domain: number; gas: string }[];

export function SolanaIgpDebug() {
  const { values } = useFormikContext<TransferFormValues>();
  const multiProvider = useMultiProvider();
  const warpCore = useWarpCore();
  const { accounts } = useAccounts(multiProvider);

  const isSolanaOrigin = useMemo(
    () => multiProvider.tryGetProtocol(values.origin) === ProtocolType.Sealevel,
    [multiProvider, values.origin],
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<{ warpRouter?: string; token?: string; mailbox?: string; programId?: string } | null>(
    null,
  );
  const [igpKeys, setIgpKeys] = useState<IgpKeys | null>(null);
  const [destGas, setDestGas] = useState<DestGas>([]);
  const [quote, setQuote] = useState<string | null>(null);
  const [includeQuote, setIncludeQuote] = useState(false);

  const runDebug = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuote(null);
    try {
      const token = warpCore.tokens[values.tokenIndex ?? -1];
      if (!token) throw new Error('No token selected');
      // Hyp adapter for origin token
      const adapter: any = token.getHypAdapter(multiProvider, values.destination);
      const addr = adapter?.addresses || {};
      const programId = adapter?.warpProgramPubKey?.toBase58?.();
      setAddresses({ warpRouter: addr.warpRouter, token: addr.token, mailbox: addr.mailbox, programId });

      // IGP Keys
      const keys = await adapter?.getIgpKeys?.();
      if (keys) {
        setIgpKeys({
          programId: keys.programId?.toBase58?.() || String(keys.programId || ''),
          igpAccount: keys.igpAccount?.toBase58?.() || String(keys.igpAccount || ''),
          overheadIgpAccount:
            keys.overheadIgpAccount?.toBase58?.() || (keys.overheadIgpAccount ? String(keys.overheadIgpAccount) : undefined),
        });
      } else {
        setIgpKeys(null);
      }

      // Destination gas map
      const data = await adapter?.getTokenAccountData?.();
      const gasEntries: DestGas = [];
      const mapIter = data?.destination_gas?.entries?.();
      if (mapIter) {
        for (const [domain, gas] of Array.from(mapIter)) {
          gasEntries.push({ domain: Number(domain), gas: String(gas) });
        }
      }
      setDestGas(gasEntries);

      // Optional quote
      if (includeQuote) {
        try {
          const { address: sender } = getAccountAddressAndPubKey(multiProvider, values.origin, accounts);
          const destinationDomain = multiProvider.getDomainId(values.destination);
          if (!sender) throw new Error('No Solana wallet connected');
          const q = await adapter?.quoteTransferRemoteGas?.(destinationDomain, sender);
          const amount = q?.amount ?? q;
          if (amount !== undefined) setQuote(String(amount));
        } catch (e: any) {
          setQuote(`quote error: ${e?.message || String(e)}`);
        }
      }
    } catch (e: any) {
      logger.error('SolanaIgpDebug error', e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [accounts, includeQuote, multiProvider, values.destination, values.origin, values.tokenIndex, warpCore]);

  if (!isSolanaOrigin) return null;

  return (
    <div className="mt-3 rounded border p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Solana IGP Debug</span>
        <button
          type="button"
          className="rounded bg-gray-200 px-2 py-1"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <div className="mt-2 whitespace-pre-wrap">
          <div className="mb-2 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeQuote}
                onChange={(e) => setIncludeQuote(e.target.checked)}
              />
              Include quote (extra RPC)
            </label>
            <button
              type="button"
              className="rounded bg-gray-200 px-2 py-1 text-xs"
              onClick={runDebug}
              disabled={loading}
            >
              {loading ? 'Running…' : 'Run Debug'}
            </button>
          </div>
          {loading ? (
            <div>Loading…</div>
          ) : error ? (
            <div className="text-red-600">{error}</div>
          ) : (
            <>
              <div>Origin: {values.origin}</div>
              <div>Destination: {values.destination}</div>
              {addresses && (
                <>
                  <div>Warp Program: {addresses.programId || 'unknown'}</div>
                  <div>Warp Router: {addresses.warpRouter || 'unknown'}</div>
                  <div>Mailbox: {addresses.mailbox || 'unknown'}</div>
                  <div>Collateral/Mint: {addresses.token || 'unknown'}</div>
                </>
              )}
              {igpKeys && (
                <>
                  <div>IGP ProgramId: {igpKeys.programId || 'unknown'}</div>
                  <div>IGP Account: {igpKeys.igpAccount || 'unknown'}</div>
                  {igpKeys.overheadIgpAccount && (
                    <div>Overhead IGP Account: {igpKeys.overheadIgpAccount}</div>
                  )}
                </>
              )}
              <div className="mt-2">Destination Gas Map:</div>
              {destGas.length ? (
                <ul className="list-disc pl-5">
                  {destGas.map((e) => (
                    <li key={e.domain}>
                      domain {e.domain}: gas {e.gas}
                    </li>
                  ))}
                </ul>
              ) : (
                <div>(empty)</div>
              )}
              {quote && <div className="mt-2">Quote: {quote}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
