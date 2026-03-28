type AnalysisSettingsBarProps = {
    models: string[];
    selectedModel: string;
    onModelChange: (model: string) => void;
    loading?: boolean;
};

export default function AnalysisSettingsBar({
    models,
    selectedModel,
    onModelChange,
    loading = false
}: AnalysisSettingsBarProps) {
    return (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-bold text-slate-900">Analysis Settings</div>
                    <p className="text-xs text-slate-600">Select model for repository analysis results.</p>
                </div>

                <div className="flex items-center gap-2">
                    <label htmlFor="analysis-model" className="text-xs font-semibold text-slate-700">
                        Model
                    </label>
                    <select
                        id="analysis-model"
                        value={selectedModel}
                        onChange={(event) => onModelChange(event.target.value)}
                        disabled={loading || models.length === 0}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {models.length === 0 ? (
                            <option value="">No model available</option>
                        ) : (
                            models.map((modelName) => (
                                <option key={modelName} value={modelName}>
                                    {modelName}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>
        </div>
    );
}
