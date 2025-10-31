import { Codex } from "@codex-data/sdk";
import { TokenRankingAttribute, RankingDirection, TokenFilterResult } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function NetworkPage() {
  const { networkId } = useParams<{ networkId: string }>();
  const networkIdNum = parseInt(networkId || '', 10);

  const [tokenListItems, setTokenListItems] = useState<TokenFilterResult[]>([]);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isNaN(networkIdNum)) {
      setFetchError("Invalid Network ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const apiKey = import.meta.env.VITE_CODEX_API_KEY;
      if (!apiKey) {
        console.warn("VITE_CODEX_API_KEY environment variable is not set.");
      }
      const codexClient = new Codex(apiKey || '');

      try {
        const [networksResult, tokensResponse] = await Promise.all([
          codexClient.queries.getNetworks({})
            .catch((err: Error) => {
              console.error(`Error fetching all networks:`, err);
              return null;
            }),
          codexClient.queries.filterTokens({
            filters: { network: [networkIdNum] },
            rankings: [{
              attribute: TokenRankingAttribute.TrendingScore,
              direction: RankingDirection.Desc
            }],
            limit: 50,
          }).catch((err: Error) => {
            console.error(`Error fetching tokens for network ${networkIdNum}:`, err);
            throw new Error(`Failed to load tokens for network ${networkIdNum}.`);
          })
        ]);

        if (networksResult?.getNetworks) {
          const currentNetwork = networksResult.getNetworks.find(net => net.id === networkIdNum);
          setNetworkName(currentNetwork?.name || `Network ${networkId}`);
        } else {
          setNetworkName(`Network ${networkId}`);
        }

        const resultsArray = tokensResponse.filterTokens?.results;
        if (resultsArray) {
          const filteredItems = resultsArray
            .filter(item => item != null)
            .filter(item => item.token != null);
          setTokenListItems(filteredItems);
        }

      } catch (err: unknown) {
        console.error("Error loading network page data:", err);
        if (err instanceof Error) {
          setFetchError(err.message);
        } else {
          setFetchError("An unknown error occurred while loading page data.");
        }
        if (!networkName) setNetworkName(`Network ${networkId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [networkIdNum, networkId, networkName]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <p>Loading...</p>
      </main>
    );
  }

  const pageTitle = fetchError && !tokenListItems.length ? `Error loading tokens for ${networkName}` : networkName || `Tokens on Network ${networkId}`;

  return (
    <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
        <Link to="/" className="hover:underline">&lt; Back to Networks</Link>
      </div>

      <div className="w-full max-w-4xl">
        {fetchError && <p className="text-destructive mb-4">{fetchError}</p>}

        {!fetchError || tokenListItems.length > 0 ? (
          <>
            {tokenListItems.length === 0 && !fetchError && <p>Loading tokens or no tokens found...</p>}
            {tokenListItems.length > 0 && (
              <table className="w-full table-fixed border-collapse border border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 text-left font-semibold w-[60px]">Icon</th>
                    <th className="p-2 text-left font-semibold flex-1">Name</th>
                    <th className="p-2 text-left font-semibold w-1/5">Symbol</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenListItems.map((item) => (
                    <tr key={item.token?.address} className="border-b border-dashed border-border/30 hover:bg-muted/30">
                      <td className="p-2 flex items-center justify-center">
                        {item.token?.info?.imageThumbUrl ? (
                          <img
                            src={item.token?.info?.imageThumbUrl}
                            alt={`${item.token?.name || 'Token'} icon`}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            {item.token?.symbol ? item.token.symbol[0] : 'T'}
                          </div>
                        )}
                      </td>
                      <td className="p-2 truncate">
                        <Link to={`/networks/${networkId}/tokens/${item.token?.address}`} className="block w-full h-full">
                          {item.token?.name || "Unknown Name"}
                        </Link>
                      </td>
                      <td className="p-2 truncate">
                         <Link to={`/networks/${networkId}/tokens/${item.token?.address}`} className="block w-full h-full">
                           {item.token?.symbol || "-"}
                         </Link>  
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}