import { connection, NextResponse } from "next/server";

import { fetchApiHealth } from "@/lib/api";

/**
 * Runtime proxy endpoint so browser clients can query FastAPI over Railway Private Networking.
 */
export async function GET() {
  await connection();
  const result = await fetchApiHealth();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
