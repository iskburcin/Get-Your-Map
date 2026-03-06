"use client";

import { useMemo, useState } from "react";

type Profile = {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  location: string | null;
  followers: number;
  following: number;
  public_repos: number;
};

type Repo = {
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
};

type ApiSuccess = { profile: Profile; repos: Repo[] };
type ApiError = { error: string; details?: string };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function Page() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
        <div className="absolute left-[-12rem] top-[-12rem] h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute right-[-14rem] top-[-10rem] h-[30rem] w-[30rem] rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute bottom-[-16rem] left-[20%] h-[34rem] w-[34rem] rounded-full bg-fuchsia-300/10 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        {/* Header */}
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            GitHub Career Assistant (Preview)
          </div>

          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Analyze a GitHub profile.
            <span className="block bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
              Generate a clean, role-based roadmap.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Enter a username to fetch profile + repos. The roadmap generation is coming soon — currently, this preview only shows the fetched data in a clean format.
          </p>
        </header>

        {/* Search card */}
        <section className="rounded-3xl border border-slate-200 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                github.com/
              </span>

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="iskburcin"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-[100px] pr-4 text-[16px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-200/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") getInfo();
                }}
              />
            </div>

            <button
              onClick={getInfo}
              disabled={loading}
              className="h-14 rounded-2xl bg-gradient-to-b from-indigo-600 to-indigo-700 px-7 text-[15px] font-extrabold tracking-tight text-white shadow-sm transition hover:brightness-[1.03] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Loading..." : "Get info"}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-extrabold">Error</div>
              <div className="mt-1 whitespace-pre-wrap">{error}</div>
            </div>
          ) : null}

          {/* Result */}
          {profile ? (
            <div className="mt-7 grid gap-6">
              {/* Profile card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <img
                    src={profile.avatar_url}
                    alt="avatar"
                    className="h-24 w-24 rounded-full border-2 border-indigo-200 shadow-sm"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                      <a
                        href={profile.html_url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-2xl font-black tracking-tight text-slate-900 hover:underline"
                      >
                        {profile.login}
                      </a>

                      {profile.name ? (
                        <span className="text-base font-semibold text-slate-600">({profile.name})</span>
                      ) : null}
                    </div>

                    {profile.bio ? (
                      <p className="mt-2 text-base text-slate-600">{profile.bio}</p>
                    ) : (
                      <p className="mt-2 text-base text-slate-500">
                        No bio found — you can add one on GitHub to clarify your target role.
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {profile.location ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                          <span className="text-slate-400">📍</span> {profile.location}
                        </span>
                      ) : null}

                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        Followers: {profile.followers}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        Following: {profile.following}
                      </span>

                      <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                        Public repos: {profile.public_repos}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Language chips */}
                {topLanguages.length ? (
                  <div className="mt-6">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Top languages (by repo count)
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {topLanguages.map(([lang, count]) => (
                        <span
                          key={lang}
                          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-800"
                        >
                          {lang}
                          <span className="rounded-full bg-indigo-200/70 px-2 py-[2px] text-[11px] font-black text-indigo-900">
                            {count}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Repo list */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-black tracking-tight text-slate-900">
                    Recently updated repos
                  </h2>
                  <span className="text-sm font-semibold text-slate-500">{repos.length} shown</span>
                </div>

                {repos.length ? (
                  <ul className="mt-4 grid gap-3">
                    {repos.map((r) => (
                      <li
                        key={r.html_url}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                      >
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
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">No repos returned.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm backdrop-blur">
              Tip: try <span className="font-extrabold text-slate-900">iskburcin</span> or{" "}
              <span className="font-extrabold text-slate-900">torvalds</span>.
            </div>
          )}
        </section>

        <footer className="mt-10 text-sm text-slate-500">
          Used GitHub REST API v3 in backend. Nextjs + React on frontend. Hosted on Vercel.
        </footer>
      </div>
    </div>
  );
}