/**
 * HeroHeader component for displaying the header of the application.
 * @returns {JSX.Element} The HeroHeader component.
 */

export default function HeroHeader() {
  return (
    <header className="mb-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        GitHub Career Assistant (Preview)
      </div>

      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
        Analyze a GitHub profile.
        <span className="block bg-gradient-to-r from-orange-400 to-orange-800 bg-clip-text text-transparent">
          Generate a clean, role-based roadmap.
        </span>
      </h1>

      <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
        Enter a username to fetch profile + repos. The roadmap generation is coming soon — currently, this preview only shows the fetched data in a clean format.
      </p>
    </header>
  );
}
