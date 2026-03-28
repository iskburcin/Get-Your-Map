"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiSuccess, ApiError, PaceMs, AnalysisModelsResponse } from "../types";
import HeroHeader from "../components/HeroHeader";
import SearchForm from "../components/SearchForm";
import ProfileCard from "../components/ProfileCard";
import RepoList from "../components/RepoList";
import AnalysisSettingsBar from "../components/AnalysisSettingsBar";

/**
 * Page component for the application.
 * @returns The Page component.
 */

export default function Page() {
  /**
   * State for the username.
   */
  const [username, setUsername] = useState("");
  /**
   * State for the loading.
   */
  const [loading, setLoading] = useState(false);
  /**
   * State for the error.
   */
  const [error, setError] = useState("");
  /**
   * State for the data.
   */
  const [data, setData] = useState<ApiSuccess | null>(null);
  const [profileFetchPaceMs, setProfileFetchPaceMs] = useState<PaceMs | null>(null);
  const [profileFetchPaceByUsername, setProfileFetchPaceByUsername] = useState<Record<string, PaceMs>>({});
  const [analysisModels, setAnalysisModels] = useState<string[]>([]);
  const [selectedAnalysisModel, setSelectedAnalysisModel] = useState("");
  const [analysisModelLoading, setAnalysisModelLoading] = useState(false);

  const repos = data?.repos ?? [];
  const topLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of repos) {
      if (!r.language) continue;
      counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [repos]);

  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      setAnalysisModelLoading(true);
      try {
        const resp = await fetch("/api/analysis/models", { cache: "no-store" });
        const body = (await resp.json().catch(() => ({}))) as Partial<AnalysisModelsResponse>;

        if (!isMounted) return;

        const modelsFromApi = Array.isArray(body.models) ? body.models.filter(Boolean) : [];
        const fallbackModel = body.selectedRepoModel || "qwen2.5:1.5b";
        const models = modelsFromApi.length ? modelsFromApi : [fallbackModel];

        setAnalysisModels(models);

        const savedModel = typeof window !== "undefined" ? localStorage.getItem("analysisRepoModel") : null;
        const selected = savedModel && models.includes(savedModel)
          ? savedModel
          : models.includes(fallbackModel)
            ? fallbackModel
            : models[0];

        setSelectedAnalysisModel(selected || "");
      } catch {
        if (!isMounted) return;
        setAnalysisModels(["qwen2.5:1.5b"]);
        setSelectedAnalysisModel("qwen2.5:1.5b");
      } finally {
        if (isMounted) setAnalysisModelLoading(false);
      }
    }

    void loadModels();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedAnalysisModel) return;
    localStorage.setItem("analysisRepoModel", selectedAnalysisModel);
  }, [selectedAnalysisModel]);

  /**
   * Fetches the user info from the GitHub API.
   * @returns {Promise<void>} The user info.
   */
  async function getInfo() {
    const startedAt = performance.now();
    const u = username.trim();
    setError("");
    setData(null);

    if (!u) {
      setError("Please enter a GitHub username.");
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch(`/api/github/${encodeURIComponent(u)}`, { cache: "no-store" });
      const json = (await resp.json()) as ApiSuccess | ApiError;
      const elapsedMs = Math.round(performance.now() - startedAt);

      setProfileFetchPaceByUsername((prevMap) => {
        const prevForUser = prevMap[u];
        const next: PaceMs = {
          current: elapsedMs,
          ...(prevForUser?.current != null
            ? {
              previous: prevForUser.current,
              diff: elapsedMs - prevForUser.current
            }
            : {})
        };

        console.log(
          `[client:profile-pace] current=${next.current}ms prev=${next.previous ?? "none"} diff=${next.diff ?? "none"}`
        );

        setProfileFetchPaceMs(next);

        return {
          ...prevMap,
          [u]: next
        };
      });

      if (!resp.ok) {
        setError((json as ApiError).error || "Request failed");
        return;
      }

      if (!(json as ApiSuccess).profile?.login) {
        setError("Unexpected response shape.");
        return;
      }

      setData(json as ApiSuccess);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const profile = data?.profile;
  const shouldShowAnalysisSettings = Boolean(profile) && repos.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Background accents */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute right-[-14rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[20%] h-[34rem] w-[34rem] rounded-full bg-fuchsia-300/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <HeroHeader />

        <section className="rounded-3xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-7">
          <SearchForm
            username={username}
            setUsername={setUsername}
            loading={loading}
            getInfo={getInfo}
          />

          {shouldShowAnalysisSettings ? (
            <AnalysisSettingsBar
              models={analysisModels}
              selectedModel={selectedAnalysisModel}
              onModelChange={setSelectedAnalysisModel}
              loading={analysisModelLoading}
            />
          ) : null}

          {profileFetchPaceMs ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <span className="font-bold">Profile Fetch Pace:</span>{" "}
              <span>current {profileFetchPaceMs.current}ms</span>
              {profileFetchPaceMs.previous != null ? (
                <>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>previous {profileFetchPaceMs.previous}ms</span>
                </>
              ) : null}
              {profileFetchPaceMs.diff != null ? (
                <>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>
                    diff {`${profileFetchPaceMs.diff > 0 ? "+" : ""}${profileFetchPaceMs.diff}ms`}
                  </span>
                </>
              ) : null}
              {data?.cache?.status ? (
                <>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>cache {data.cache.status}</span>
                </>
              ) : null}
              {data?.backendPaceMs ? (
                <>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>backend {data.backendPaceMs.current}ms</span>
                  {data.backendPaceMs.previous != null ? (
                    <span> (prev {data.backendPaceMs.previous}ms)</span>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-extrabold">Error</div>
              <div className="mt-1 whitespace-pre-wrap">{error}</div>
            </div>
          ) : null}

          {/* Result */}
          {profile ? (
            <div className="mt-7 grid gap-6">
              <ProfileCard profile={profile} topLanguages={topLanguages} />
              <RepoList repos={repos} username={username} selectedModel={selectedAnalysisModel} />
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
              Tip: try <span className="font-extrabold text-slate-900">iskburcin</span> or{" "}
              <span className="font-extrabold text-slate-900">torvalds</span>.
            </div>
          )}
        </section>

        <footer className="mt-10 text-sm text-slate-500">
          Used GitHub GraphQL API in backend. Nextjs + React on frontend. Hosted on Vercel.
        </footer>
      </div>
    </div>
  );
}