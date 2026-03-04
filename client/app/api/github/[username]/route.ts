import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  const backend = process.env.BACKEND_BASE_URL || "http://localhost:4000";
  const url = `${backend}/api/github/${encodeURIComponent(username)}`;

  try {
    const resp = await fetch(url, { cache: "no-store" });

    const contentType = resp.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson ? await resp.json() : await resp.text();

    // Always respond JSON to the browser
    return NextResponse.json(body, { status: resp.status });
  } catch (e) {
    return NextResponse.json(
      { error: "Could not reach backend", details: String(e) },
      { status: 502 }
    );
  }
}