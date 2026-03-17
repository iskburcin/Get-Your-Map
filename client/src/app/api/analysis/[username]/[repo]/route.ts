import { NextResponse } from "next/server";

/**
 * POST request handler for the analysis endpoint.
 * @param req - The request.
 * @param params - The parameters.
 * @returns The response.
 */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ username: string; repo: string }> }
) {
  const { username, repo } = await params;

  const bodyData = await req.json().catch(() => ({}));

  const backend = process.env.BACKEND_BASE_URL || "http://localhost:4000";
  const url = `${backend}/api/analysis/${encodeURIComponent(username)}/${encodeURIComponent(repo)}`;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
      cache: "no-store",
    });

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
