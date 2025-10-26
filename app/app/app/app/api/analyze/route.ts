import { NextRequest, NextResponse } from "next/server";

// Your dRPC HTTPS endpoint, set in Vercel → Environment Variables
const DRPC_HTTP_URL = process.env.DRPC_HTTP_URL || "";

// minimal hex helpers
const strip0x = (s: string) => (s.startsWith("0x") ? s.slice(2) : s);
const pad64 = (hex: string) => hex.padStart(64, "0");
const toHex = (n: bigint) => "0x" + n.toString(16);

function hexToBigInt(hex: string): bigint {
  if (!hex) return 0n as unknown as bigint;
  return BigInt(hex);
}

function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  let s = (neg ? -value : value).toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const head = s.slice(0, i);
  const tail = s.slice(i).replace(/0+$/, "");
  return `${neg ? "-" : ""}${head}${tail ? "." + tail : ""}`;
}

async function rpc(method: string, params: any[]) {
  if (!DRPC_HTTP_URL) throw new Error("Server missing DRPC_HTTP_URL");
  const res = await fetch(DRPC_HTTP_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

// encode function calls
function encodeBalanceOf(address: string) {
  // function balanceOf(address) -> selector 0x70a08231 + 32-byte padded address
  const selector = "0x70a08231";
  const arg = pad64(strip0x(address).toLowerCase());
  return selector + arg;
}
const SELECTOR_SYMBOL = "0x95d89b41";
const SELECTOR_DECIMALS = "0x313ce567";

async function erc20Symbol(contract: string): Promise<string | null> {
  try {
    const data = SELECTOR_SYMBOL;
    const res = await rpc("eth_call", [{ to: contract, data }, "latest"]);
    if (!res || res === "0x") return null;
    // ABI-encoded string; simple best-effort decode
    // res: 0x + offset(32) + len(32) + bytes...
    const hex = strip0x(res);
    // locate length at position 64..128
    const lenHex = "0x" + hex.slice(64, 128);
    const len = Number(BigInt(lenHex));
    const strHex = hex.slice(128, 128 + len * 2);
    const bytes = new Uint8Array(strHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder().decode(bytes).replace(/\0/g, "");
  } catch {
    return null;
  }
}

async function erc20Decimals(contract: string): Promise<number | null> {
  try {
    const res = await rpc("eth_call", [{ to: contract, data: SELECTOR_DECIMALS }, "latest"]);
    if (!res || res === "0x") return null;
    return Number(hexToBigInt(res));
  } catch {
    return null;
  }
}

async function erc20BalanceOf(contract: string, wallet: string, decimalsFallback = 18) {
  const data = encodeBalanceOf(wallet);
  const raw = await rpc("eth_call", [{ to: contract, data }, "latest"]);
  const bal = hexToBigInt(raw || "0x0");
  const decimals = (await erc20Decimals(contract)) ?? decimalsFallback;
  const symbol = await erc20Symbol(contract);
  const display = formatUnits(bal, decimals);
  return { contract, balance: bal.toString(), balance_display: display, decimals, symbol };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = (searchParams.get("address") || "").trim();
    const tokensCsv = (searchParams.get("tokens") || "").trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address (use 0x…)" }, { status: 400 });
    }
    if (!DRPC_HTTP_URL) {
      return NextResponse.json({ error: "Server missing DRPC_HTTP_URL" }, { status: 500 });
    }

    // native balance
    const balHex = await rpc("eth_getBalance", [address, "latest"]);
    const txCountHex = await rpc("eth_getTransactionCount", [address, "latest"]);

    const nativeBalanceEth = formatUnits(hexToBigInt(balHex || "0x0"), 18);
    const txCount = Number(hexToBigInt(txCountHex || "0x0"));
    const nativeSymbol = "ETH"; // For Base/Ethereum/Avalanche C-Chain gas asset shown in ETH units

    // optional ERC-20 list
    const tokenContracts = tokensCsv
      ? tokensCsv.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    const tokens: any[] = [];
    for (const c of tokenContracts) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(c)) continue;
      try {
        const t = await erc20BalanceOf(c, address);
        tokens.push(t);
      } catch (e) {
        tokens.push({ contract: c, error: "Failed to fetch balance" });
      }
    }

    return NextResponse.json({
      address,
      native_balance: nativeBalanceEth,
      native_symbol: nativeSymbol,
      tx_count: txCount,
      tokens
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
