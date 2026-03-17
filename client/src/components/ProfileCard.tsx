import { Profile } from "../types";

/**
 * ProfileCard component for displaying the profile of the user.
 * @param {Profile} profile - The profile of the user.
 * @param {[string, number][]} topLanguages - The top languages of the user.
 * @returns {JSX.Element} The ProfileCard component.
 */

export default function ProfileCard({
  profile,
  topLanguages
}: {
  profile: Profile;
  topLanguages: [string, number][];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          src={profile.avatar_url}
          alt="avatar"
          className="h-24 w-24 rounded-full border-2 border-orange-200 shadow-sm"
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
      {topLanguages.length > 0 ? (
        <div className="mt-6">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            Top languages (by repo count)
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {topLanguages.map(([lang, count]) => (
              <span
                key={lang}
                className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-extrabold text-orange-800"
              >
                {lang}
                <span className="rounded-full bg-orange-200/70 px-2 py-[2px] text-[11px] font-black text-orange-900">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
