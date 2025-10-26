import { NextRequest, NextResponse } from "next/server";

// IMPORTANT:
// In Vercel → Settings → Environment Variables → add:
// NAME: DRPC_HTTP_URL
// VALUE: <your Base Mainnet HTTPS RPC from dRPC>
// Example: https://lb.drpc.org/..., or https://base.drpc.org/... with your key

const DRPC_HTTP_URL = process.env.DRPC_HTTP_URL || "";

// ---------- helpers ----------
const strip0x = (s: string) => (s.startsWith("0x") ? s.slice(2) : s);
const pad64 = (hex: string) => hex.padStart(64, "0");
function hexToBigInt(hex: string): bigint {
  try { return BigInt(hex || "0x0"); } catch { return 0n; }
}
function formatUnits(value: bigint, decimals: number): string {
  const neg = value < 0n;
  let s = (neg ? -value : value).toString().padStart(decimals + 1, "0");
  const i = s.length - decimals;
  const head = s.slice(0, i);
  const tail = s.slice(i).replace(/0+$/, "");
  return `${neg ? "-" : ""}${head}${tail ? "." + tail : ""}`;
}

// Timeout + safe error for RPC
async function rpc(method: string, params: any[]) {
  if (!DR
