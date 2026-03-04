"use client";

import { useState } from "react";

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

export default function Home() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ApiSuccess | null>(null);

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
      const resp = await fetch(`/api/github/${encodeURIComponent(u)}`, {
        cache: "no-store"
      });
      const json = (await resp.json()) as ApiSuccess | ApiError;

      if (!resp.ok) {
        setError((json as ApiError).error || "Request failed");
        return;
      }

      // runtime shape guard
      const ok = (json as ApiSuccess)?.profile?.avatar_url;
      if (!ok) {
        setError("Unexpected API response shape (no profile.avatar_url).");
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
  const repos = data?.repos || [];

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>GitHub Profile + Repos</h1>

      <div style={{ display: "flex", gap: 12 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter GitHub username (e.g. iskburcin)"
          style={{ flex: 1, padding: "10px 12px", fontSize: 16 }}
        />
        <button
          onClick={getInfo}
          disabled={loading}
          style={{ padding: "10px 14px", fontSize: 16, cursor: "pointer" }}
        >
          {loading ? "Loading..." : "Get the info"}
        </button>
      </div>

      {error ? <p style={{ color: "#b00020", marginTop: 12 }}>{error}</p> : null}

      {profile ? (
        <section style={{ marginTop: 20, borderTop: "1px solid #eee", paddingTop: 16 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <img
              src={profile.avatar_url}
              alt="avatar"
              width={88}
              height={88}
              style={{ borderRadius: "50%" }}
            />
            <div>
              <h2 style={{ margin: 0 }}>
                <a href={profile.html_url} target="_blank" rel="noreferrer">
                  {profile.login}
                </a>
                {profile.name ? ` (${profile.name})` : ""}
              </h2>
              {profile.bio ? <p>{profile.bio}</p> : null}
              {profile.location ? <p style={{ margin: "6px 0" }}>Location: {profile.location}</p> : null}
              <p style={{ color: "#555" }}>
                Followers: {profile.followers} · Following: {profile.following} · Public repos:{" "}
                {profile.public_repos}
              </p>
            </div>
          </div>

          <h3 style={{ marginTop: 18 }}>Recently updated repos</h3>
          {repos.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {repos.map((r) => (
                <li key={r.html_url} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <a href={r.html_url} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                  {r.language ? (
                    <span
                      style={{
                        marginLeft: 10,
                        fontSize: 12,
                        padding: "2px 8px",
                        background: "#f3f3f3",
                        borderRadius: 999
                      }}
                    >
                      {r.language}
                    </span>
                  ) : null}
                  <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                    ⭐ {r.stargazers_count} · Forks {r.forks_count} · Updated{" "}
                    {new Date(r.updated_at).toLocaleString()}
                  </div>
                  {r.description ? <div style={{ marginTop: 6 }}>{r.description}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p>No repos returned.</p>
          )}
        </section>
      ) : null}
    </main>
  );
}