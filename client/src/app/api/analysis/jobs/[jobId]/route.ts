import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const backend = process.env.BACKEND_BASE_URL || "http://localhost:4000";
  const url = `${backend}/api/analysis/jobs/${encodeURIComponent(jobId)}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      cache: "no-store"
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
