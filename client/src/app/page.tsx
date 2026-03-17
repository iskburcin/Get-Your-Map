"use client";

import { useMemo, useState } from "react";
import { ApiSuccess, ApiError } from "../types";
import HeroHeader from "../components/HeroHeader";
import SearchForm from "../components/SearchForm";
import ProfileCard from "../components/ProfileCard";
import RepoList from "../components/RepoList";

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

  const repos = data?.repos ?? [];
  const topLanguages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of repos) {
      if (!r.language) continue;
      counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [repos]);

  /**
   * Fetches the user info from the GitHub API.
   * @returns {Promise<void>} The user info.
   */
  async function getInfo() {
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
              <RepoList repos={repos} username={username} />
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