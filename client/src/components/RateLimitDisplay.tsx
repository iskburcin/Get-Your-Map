"use client";

import { useEffect, useState } from "react";

/**
 * RateLimit type for storing the rate limit of the user.
 * @property {number} limit - The limit of the rate limit.
 * @property {number} remaining - The remaining of the rate limit.
 * @property {number} reset - The reset of the rate limit.
 * @property {number} used - The used of the rate limit.
 */

type RateLimit = {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
};

/**
 * RateLimitDisplay component for displaying the rate limit of the user.
 * @returns {JSX.Element} The RateLimitDisplay component.
 */

export default function RateLimitDisplay() {
  const [rate, setRate] = useState<RateLimit | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches the rate limit of the user.
   */
  async function fetchRateLimit() {
    setLoading(true);
    try {
      const res = await fetch("/api/github/rate-limit");
      if (res.ok) {
        const data = await res.json();
        setRate(data);
      }
    } catch (e) {
      console.error("Failed to load rate limit", e);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetches the rate limit of the user periodically.
   */
  useEffect(() => {
    fetchRateLimit();
    // also refresh periodically
    const interval = setInterval(fetchRateLimit, 30 * 60000); // 30 minutes
    return () => clearInterval(interval);
  }, []);

  if (!rate && !loading) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl border border-slate-200 bg-white/80 p-3 shadow-md backdrop-blur-md transition-all">
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between gap-4 font-bold text-slate-700">
          <span>GitHub API Limits</span>
          <button onClick={fetchRateLimit} className="text-orange-600 hover:text-orange-800" title="Refresh">
            <svg className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        {rate ? (
          <>
            <div className="flex items-center justify-between text-slate-600 mt-1">
              <span>Remaining:</span>
              <span className={`font-black ${rate.remaining < 10 ? 'text-red-600' : 'text-emerald-600'}`}>
                {rate.remaining} <span className="text-slate-400 font-semibold">/ {rate.limit}</span>
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500 text-[10px]">
              <span>Resets at:</span>
              <span>{new Date(rate.reset * 1000).toLocaleTimeString()}</span>
            </div>
          </>
        ) : (
          <div className="text-slate-500 text-[11px] mt-1">Loading limits...</div>
        )}
      </div>
    </div>
  );
}
