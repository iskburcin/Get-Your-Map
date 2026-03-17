/**
 * SearchForm component for searching the user.
 * @param username - The username of the user.
 * @param setUsername - The function to set the username.
 * @param loading - Whether the user is loading.
 * @param getInfo - The function to get the user info.
 * @returns The SearchForm component.
 */

export default function SearchForm({
  username,
  setUsername,
  loading,
  getInfo
}: {
  username: string;
  setUsername: (val: string) => void;
  loading: boolean;
  getInfo: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          github.com/
        </span>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="iskburcin"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-[100px] pr-4 text-[16px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-200/60"
          onKeyDown={(e) => {
            if (e.key === "Enter") getInfo();
          }}
        />
      </div>

      <button
        onClick={getInfo}
        disabled={loading}
        className="h-14 rounded-2xl bg-gradient-to-b from-orange-600 to-orange-700 px-7 text-[15px] font-extrabold tracking-tight text-white shadow-sm transition hover:brightness-[1.03] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Loading..." : "Get info"}
      </button>
    </div>
  );
}
