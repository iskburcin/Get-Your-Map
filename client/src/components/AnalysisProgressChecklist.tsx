import { AnalysisJobStep, AnalysisJobStatus } from "../types";

type ProgressItem = {
    step: AnalysisJobStep;
    label: string;
};

const CHECKLIST: ProgressItem[] = [
    { step: "queued", label: "Job queued" },
    { step: "metrics", label: "Repository metrics analysis" },
    { step: "ollama", label: "Connecting to Ollama" },
    { step: "roadmap", label: "Roadmap generation" },
    { step: "completed", label: "Final result ready" }
];

function stepOrder(step: AnalysisJobStep): number {
    return CHECKLIST.findIndex((item) => item.step === step);
}

export default function AnalysisProgressChecklist({
    status,
    currentStep,
    label,
    progress
}: {
    status?: AnalysisJobStatus;
    currentStep?: AnalysisJobStep;
    label?: string;
    progress?: number;
}) {
    if (!status || !currentStep) return null;

    const currentIndex = stepOrder(currentStep);

    return (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
                <span>{label || "Processing"}</span>
                <span>{Math.max(0, Math.min(100, progress ?? 0))}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                    className="h-full rounded-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, progress ?? 0))}%` }}
                />
            </div>

            <ul className="mt-3 space-y-1.5 text-xs">
                {CHECKLIST.map((item, index) => {
                    const done = index < currentIndex || status === "completed";
                    const active = index === currentIndex && status !== "completed";

                    return (
                        <li key={item.step} className="flex items-center gap-2">
                            <span
                                className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold ${done
                                    ? "border-green-300 bg-green-100 text-green-700"
                                    : active
                                        ? "border-orange-300 bg-orange-100 text-orange-700"
                                        : "border-slate-300 bg-white text-slate-500"
                                    }`}
                            >
                                {done ? "✓" : active ? "•" : ""}
                            </span>
                            <span className={done ? "text-slate-800" : active ? "text-slate-700 font-semibold" : "text-slate-500"}>
                                {item.label}
                            </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
