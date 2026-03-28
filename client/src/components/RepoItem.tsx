"use client";

import { useState } from "react";
import {
  Repo,
  AnalysisState,
  AnalysisJobPollResponse
} from "../types";
import AnalysisProgressChecklist from "./AnalysisProgressChecklist";

/**
 * Formats a date string to a more readable format.
 * @param iso - The date string to format.
 * @returns The formatted date string.
 */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/**
 * RepoItem component for displaying the repository of the user.
 * @param repo - The repository to display.
 * @param username - The username of the user.
 * @returns The RepoItem component.
 */

export default function RepoItem({ repo: r, username, selectedModel }: { repo: Repo, username: string, selectedModel: string }) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ loading: false });

  const shownData = analysisState.data ?? analysisState.partialData;

  function withFetchPace(prev: AnalysisState, elapsedMs: number) {
    const fetchPaceMs = {
      current: elapsedMs,
      ...(prev.fetchPaceMs?.current != null
        ? {
          previous: prev.fetchPaceMs.current,
          diff: elapsedMs - prev.fetchPaceMs.current
        }
        : {})
    };

    console.log(
      `[client:analysis-pace] ${username}/${r.name} current=${fetchPaceMs.current}ms prev=${fetchPaceMs.previous ?? "none"} diff=${fetchPaceMs.diff ?? "none"}`
    );

    return fetchPaceMs;
  }

  /**
   * Analyzes the repository.
   */
  async function analyzeRepo() {
    const startedAt = performance.now();
    const u = username.trim();
    if (!u) return;

    setAnalysisState((prev) => ({
      ...prev,
      loading: true,
      error: undefined,
      data: undefined,
      partialData: undefined,
      status: "queued",
      progressStep: "queued",
      progressLabel: "Queued",
      progress: 5
    }));

    try {
      const startRes = await fetch(`/api/analysis/${encodeURIComponent(u)}/${encodeURIComponent(r.name)}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: "", model: selectedModel || undefined }),
      });

      if (!startRes.ok) {
        const errorRes = await startRes.json().catch(() => ({}));
        const elapsedMs = Math.round(performance.now() - startedAt);

        setAnalysisState((prev) => {
          const fetchPaceMs = withFetchPace(prev, elapsedMs);
          return {
            loading: false,
            error: errorRes.details || errorRes.error || "Analysis failed",
            partialData: errorRes.analysis ? ({ codeAnalysis: errorRes.analysis } as any) : undefined,
            fetchPaceMs
          };
        });

        return;
      }

      const startData = (await startRes.json()) as { jobId: string };
      const jobId = startData.jobId;

      if (!jobId) {
        throw new Error("Could not create analysis job.");
      }

      setAnalysisState((prev) => ({ ...prev, jobId }));

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 900));

        const pollRes = await fetch(`/api/analysis/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
        const pollBody = (await pollRes.json().catch(() => ({}))) as AnalysisJobPollResponse & { error?: string };

        if (!pollRes.ok) {
          throw new Error(pollBody.error || "Polling failed.");
        }

        setAnalysisState((prev) => {
          const partialData = pollBody.data || prev.partialData;
          const isCompleted = pollBody.status === "completed";

          let finalData = prev.data;
          if (isCompleted && partialData?.codeAnalysis) {
            finalData = {
              repository: partialData.repository || { owner: u, name: r.name },
              codeAnalysis: partialData.codeAnalysis as any,
              ollamaAnalysis: (partialData.ollamaAnalysis as string) || "",
              roadmap: (partialData.roadmap as string | null) ?? null,
              cache: partialData.cache,
              backendPaceMs: partialData.backendPaceMs
            };
          }

          return {
            ...prev,
            loading: pollBody.status === "queued" || pollBody.status === "running",
            status: pollBody.status,
            progress: pollBody.progress,
            progressStep: pollBody.step,
            progressLabel: pollBody.stepLabel,
            error: pollBody.status === "failed" ? pollBody.error || "Analysis failed" : prev.error,
            partialData,
            data: finalData
          };
        });

        if (pollBody.status === "completed" || pollBody.status === "failed") {
          break;
        }
      }

      const elapsedMs = Math.round(performance.now() - startedAt);

      setAnalysisState((prev) => {
        const fetchPaceMs = withFetchPace(prev, elapsedMs);
        return { ...prev, loading: false, fetchPaceMs };
      });
    } catch (err) {
      const elapsedMs = Math.round(performance.now() - startedAt);

      setAnalysisState((prev) => {
        const fetchPaceMs = withFetchPace(prev, elapsedMs);
        return { ...prev, loading: false, error: String(err), fetchPaceMs };
      });
    }
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a
          href={r.html_url}
          target="_blank"
          rel="noreferrer"
          className="font-extrabold tracking-tight text-slate-900 hover:underline"
        >
          {r.name}
        </a>

        {r.language ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-700">
            {r.language}
          </span>
        ) : null}
      </div>

      {r.description ? (
        <p className="mt-2 text-sm text-slate-600">{r.description}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
        <span>⭐ {r.stargazers_count}</span>
        <span className="text-slate-300">•</span>
        <span>Forks {r.forks_count}</span>
        <span className="text-slate-300">•</span>
        <span>Updated {formatDate(r.updated_at)}</span>
      </div>

      {/* Analysis Section */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={analyzeRepo}
          disabled={analysisState.loading}
          className="rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 text-orange-50 px-4 py-2 text-sm font-bold hover:bg-orange-100 disabled:opacity-60 transition"
        >
          {analysisState.loading ? "Analyzing..." : "Analyze Code Quality"}
        </button>

        {(analysisState.loading || analysisState.status) ? (
          <AnalysisProgressChecklist
            status={analysisState.status}
            currentStep={analysisState.progressStep}
            label={analysisState.progressLabel}
            progress={analysisState.progress}
          />
        ) : null}

        {analysisState.error && (
          <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-100">
            <span className="font-bold">Error:</span> {analysisState.error}
          </div>
        )}

        {analysisState.fetchPaceMs && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <span className="font-bold">Analysis Fetch Pace:</span>{" "}
            <span>current {analysisState.fetchPaceMs.current}ms</span>
            {analysisState.fetchPaceMs.previous != null ? (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span>previous {analysisState.fetchPaceMs.previous}ms</span>
              </>
            ) : null}
            {analysisState.fetchPaceMs.diff != null ? (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span>
                  diff {`${analysisState.fetchPaceMs.diff > 0 ? "+" : ""}${analysisState.fetchPaceMs.diff}ms`}
                </span>
              </>
            ) : null}
            {shownData?.cache?.status ? (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span>cache {shownData.cache.status}</span>
              </>
            ) : null}
            {shownData?.backendPaceMs ? (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span>
                  backend {shownData.backendPaceMs.current}ms
                  {shownData.backendPaceMs.previous != null
                    ? ` (prev ${shownData.backendPaceMs.previous}ms)`
                    : ""}
                </span>
              </>
            ) : null}
          </div>
        )}

        {shownData?.codeAnalysis && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Quality</div>
                <div className="text-lg font-black text-orange-600">
                  {(shownData.codeAnalysis as any)?.qualityScore || 0}/100
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Level</div>
                <div className="text-lg font-bold capitalize text-slate-800">
                  {(shownData.codeAnalysis as any)?.developmentLevel || "N/A"}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Functions</div>
                <div className="text-lg font-black text-slate-800">
                  {(shownData.codeAnalysis as any)?.complexity?.functionCount || 0}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Classes</div>
                <div className="text-lg font-black text-slate-800">
                  {(shownData.codeAnalysis as any)?.complexity?.classCount || 0}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Loops</div>
                <div className="text-lg font-black text-slate-800">
                  {(shownData.codeAnalysis as any)?.complexity?.loopCount || 0}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Conditions</div>
                <div className="text-lg font-black text-slate-800">
                  {(shownData.codeAnalysis as any)?.complexity?.conditionCount || 0}
                </div>
              </div>
            </div>

            {/* Detailed Line Counts row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-50/50 p-3 border border-emerald-100">
                <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Lines Of Code</div>
                <div className="text-md font-black text-emerald-700">
                  {(shownData.codeAnalysis as any)?.complexity?.lineCount || 0}
                </div>
              </div>
              <div className="rounded-lg bg-blue-50/50 p-3 border border-blue-100">
                <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Comments</div>
                <div className="text-md font-black text-blue-700">
                  {(shownData.codeAnalysis as any)?.complexity?.commentCount || 0}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Blank Lines</div>
                <div className="text-md font-black text-slate-700">
                  {(shownData.codeAnalysis as any)?.complexity?.blankCount || 0}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(shownData.codeAnalysis as any)?.hasTests && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800">
                  ✓ Tests
                </span>
              )}
              {(shownData.codeAnalysis as any)?.hasCI && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">
                  ✓ CI/CD
                </span>
              )}
              {(shownData.codeAnalysis as any)?.hasTypeScript && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
                  ✓ TypeScript
                </span>
              )}
              {(shownData.codeAnalysis as any)?.hasDocker && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-800">
                  ✓ Docker
                </span>
              )}
            </div>

            {shownData?.ollamaAnalysis ? (
              <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-orange-900 mb-2">AI Analysis</div>
                <div className="whitespace-pre-wrap text-sm text-orange-900/80 leading-relaxed">
                  {shownData.ollamaAnalysis}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
