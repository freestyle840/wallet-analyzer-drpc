"use client";
import { useState } from "react";
import "./globals.css";

export default function Page() {
  const [address, setAddress] = useState("");
  // Comma-separated ERC20 token contract addresses to check
  const [tokensCsv, setTokensCsv] = useState(""); 
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true); setError(null); setData(null);
    const qs = new URLSearchParams({ address, tokens: tokensCsv });
    const res = await fetch(`/api/analyze?${qs.toString()}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) { setError(j.error || "Request failed"); setLoading(false); return; }
    setData(j); setLoading(false);
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Wallet Analyzer (dRPC)</h1>
        <p className="small" style={{ marginTop: 6 }}>
          RPC-only: shows <span className="tag">native balance</span>
          <span className="tag">tx count</span> and 
          <span className="tag">ERC-20 balances</span> for the tokens you list.
        </p>

        <div className="row" style={{ marginTop: 12 }}>
          <input
            className="input"
            placeholder="0x… wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button className="btn" disabled={!address || loading} onClick={analyze}>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>

        <div style={{ marginTop: 8 }}>
          <input
            className="input"
            placeholder="Optional: comma-separated ERC20 contracts (0x...,0x...)"
            value={tokensCsv}
            onChange={(e) => setTokensCsv(e.target.value)}
          />
          <p className="small" style={{ marginTop: 6 }}>
            Tip: paste token contracts you care about (e.g., USDC, AERO on your chain). Leave empty to skip.
          </p>
        </div>

        {error && <p style={{ color: "#b91c1c", marginTop: 10 }}>{error}</p>}
      </div>

      {data && (
        <>
          <div className="grid">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Overview</h3>
              <ul className="small" style={{ lineHeight: 1.8 }}>
                <li><b>Address:</b> {data.address}</li>
                <li><b>Native balance:</b> {data.native_balance} {data.native_symbol}</li>
                <li><b>Tx count (sent):</b> {data.tx_count}</li>
              </ul>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>Notes</h3>
              <ul className="small" style={{ lineHeight: 1.8 }}>
                <li>This is <b>RPC only</b>: no indexer, so no auto “all tokens” or full tx history.</li>
                <li>Add token contracts above to see ERC-20 balances.</li>
              </ul>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>ERC-20 token balances</h3>
            {!data.tokens?.length ? (
              <p className="small">No tokens requested.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr><th>Token</th><th>Contract</th><th>Balance</th></tr>
                  </thead>
                  <tbody>
                    {data.tokens.map((t: any, i: number) => (
                      <tr key={i}>
                        <td>{t.symbol ?? "?"} {t.decimals != null ? `(${t.decimals}d)` : ""}</td>
                        <td>{t.contract}</td>
                        <td>{t.balance_display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
