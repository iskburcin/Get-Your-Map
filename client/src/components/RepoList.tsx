import { Repo } from "../types";
import RepoItem from "./RepoItem";

/**
 * RepoList component for displaying the list of repositories.
 * @param repos - The list of repositories.
 * @param username - The username of the user.
 * @returns The RepoList component.
 */

export default function RepoList({ repos, username }: { repos: Repo[], username: string }) {
  return (
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
            <RepoItem key={r.html_url} repo={r} username={username} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">No repos returned.</p>
      )}
    </div>
  );
}
