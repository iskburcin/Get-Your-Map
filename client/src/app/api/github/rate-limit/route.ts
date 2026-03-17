import { NextResponse } from "next/server";

/**
 * GET request handler for the rate limit endpoint.
 * @returns The rate limit response.
 */

export async function GET() {
  const backend = process.env.BACKEND_BASE_URL || "http://localhost:4000";
  const url = `${backend}/api/github/rate-limit`;

  try {
    const resp = await fetch(url, { cache: "no-store" });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await resp.json() : await resp.text();

    return NextResponse.json(body, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach backend", details: String(e) },
      { status: 502 }
    );
  }
}
