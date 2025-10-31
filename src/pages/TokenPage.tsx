import { Codex } from "@codex-data/sdk";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState, Suspense } from "react";
import { TokenChart, ChartDataPoint } from "@/components/TokenChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TokenDetails = {
  id: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  networkId?: number | null;
  description?: string | null;
  decimals?: number | null;
  info?: {
    imageThumbUrl?: string | null;
  } | null;
};

type TokenEvent = {
  id: string;
  timestamp: number;
  transactionHash: string;
  eventDisplayType?: string | null;
  amountUsd?: number | null;
  uniqueId?: string;
};

export default function TokenPage() {
  const { networkId, tokenId } = useParams<{ networkId: string; tokenId: string }>();
  const networkIdNum = parseInt(networkId || '', 10);

  const [details, setDetails] = useState<TokenDetails | null>(null);
  const [bars, setBars] = useState<ChartDataPoint[]>([]);
  const [events, setEvents] = useState<TokenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(networkIdNum) || !tokenId) {
      setError("Invalid Network or Token ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const apiKey = import.meta.env.VITE_CODEX_API_KEY;
      if (!apiKey) {
        console.warn("VITE_CODEX_API_KEY not set.");
      }
      const codexClient = new Codex(apiKey || '');

      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 1 * 24 * 60 * 60;
      const symbolId = `${tokenId}:${networkIdNum}`;

      try {
        const results = await Promise.allSettled([
          codexClient.queries.token({ input: { networkId: networkIdNum, address: tokenId } }),
          codexClient.queries.getBars({
            symbol: symbolId,
            from: oneDayAgo,
            to: now,
            resolution: '30'
          }),
          codexClient.queries.getTokenEvents({ query: { networkId: networkIdNum, address: tokenId }, limit: 50 }),
        ]);

        const detailsResult = results[0];
        const barsResult = results[1];
        const eventsResult = results[2];

        if (detailsResult.status === 'fulfilled') {
          setDetails(detailsResult.value.token as TokenDetails);
        }

        if (barsResult.status === 'fulfilled') {
          const b = barsResult.value.getBars;
          if (b?.t && b?.c) {
            const chartData = b.t.map((time: number, index: number) => ({
              time: time,
              open: b.o?.[index],
              high: b.h?.[index],
              low: b.l?.[index],
              close: b.c?.[index],
            }));
            setBars(chartData);
          }
        }

        if (eventsResult.status === 'fulfilled' && eventsResult.value.getTokenEvents?.items) {
          const tokenEvents = eventsResult.value.getTokenEvents.items
            .filter(ev => ev != null)
            .map((ev) => {
              const decimals = details?.decimals ?? 18;
              const swapValue = parseFloat(ev.token0SwapValueUsd || '0');
              const amount0 = parseFloat(ev.data?.amount0 || '0');
              const calculatedAmountUsd = swapValue * Math.abs(amount0 / (10 ** decimals));

              return {
                id: ev.id,
                timestamp: ev.timestamp,
                uniqueId: `${ev.id}-${ev.blockNumber}-${ev.transactionIndex}-${ev.logIndex}`,
                transactionHash: ev.transactionHash,
                eventDisplayType: ev.eventDisplayType,
                amountUsd: calculatedAmountUsd,
              };
            });
          setEvents(tokenEvents);
        }
      } catch (err) {
        console.error("Error fetching token data:", err);
        setError("Failed to load token data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [networkIdNum, tokenId]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-6 md:p-12">
        <p>Loading token data...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <h1 className="text-2xl font-bold text-destructive">{error}</h1>
        <Link to="/" className="mt-4 hover:underline">Go back home</Link>
      </main>
    );
  }

  const tokenName = details?.name || tokenId;
  const tokenSymbol = details?.symbol ? `(${details.symbol})` : '';

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 space-y-6">
      <div className="w-full max-w-6xl flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold truncate pr-4">
          {tokenName} {tokenSymbol}
        </h1>
        <Link to={`/networks/${networkId}`} className="text-sm hover:underline whitespace-nowrap">
          &lt; Back to Network
        </Link>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Suspense fallback={<Card><CardHeader><CardTitle>Price Chart</CardTitle></CardHeader><CardContent><p>Loading chart...</p></CardContent></Card>}>
            <TokenChart data={bars} title={`${tokenSymbol || 'Token'} Price Chart`} />
          </Suspense>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Value (USD)</TableHead>
                      <TableHead>Tx Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.uniqueId || event.id}>
                        <TableCell>{event.eventDisplayType || 'N/A'}</TableCell>
                        <TableCell>{new Date(event.timestamp * 1000).toLocaleString()}</TableCell>
                        <TableCell>{event.amountUsd ? `$${event.amountUsd.toFixed(2)}` : 'N/A'}</TableCell>
                        <TableCell className="truncate">
                          <span title={event.transactionHash}>{event.transactionHash.substring(0, 8)}...</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No recent transaction data available.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center space-x-4">
              {details?.info?.imageThumbUrl ? (
                <img
                  src={details.info.imageThumbUrl}
                  alt={`${details.name || 'Token'} icon`}
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg font-semibold">
                  {details?.symbol ? details.symbol[0] : 'T'}
                </div>
              )}
              <div>
                <CardTitle>Information</CardTitle>
                {details?.symbol && <CardDescription>{details.symbol}</CardDescription>}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {details ? (
                <>
                  <p className="text-sm">
                    <strong className="text-muted-foreground">Address:</strong>
                    <span className="font-mono block break-all" title={details.address}>{details.address}</span>
                  </p>
                  {details.description && (
                    <p className="text-sm">
                      <strong className="text-muted-foreground">Description:</strong> {details.description}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Token details could not be loaded.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}