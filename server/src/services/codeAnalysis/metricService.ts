/**
 * Detect signals from file contents
 * @param fileContents - Array of files to analyze
 * @returns Object with signal flags
 */
export function detectSignals(fileContents: Array<{ path: string; content: string }>) {
    const hasTests = fileContents.some((f) => /\.(test|spec)\.(ts|js|py|go|java|cpp|c|cs|rb|php)$/.test(f.path));
    const hasCI = fileContents.some((f) => /\.github\/workflows|\.gitlab-ci\.yml|\.travis\.yml/.test(f.path));
    const hasTypeScript = fileContents.some((f) => /\.ts$|\.tsx$/.test(f.path));
    const hasDocker = fileContents.some((f) => /Dockerfile/.test(f.path));

    return { hasTests, hasCI, hasTypeScript, hasDocker };
}

/**
 * Aggregate languages by file content
 * @param fileContents - Array of files to analyze
 * @param detectLanguageByExtension - Function to detect language by extension
 * @returns Array of languages with their statistics
 */
export function aggregateLanguages(
    fileContents: Array<{ path: string; content: string }>,
    detectLanguageByExtension: (path: string) => string | null
) {
    // Aggregate languages by file content
    const languages = fileContents.reduce((acc, file) => {
        const lang = detectLanguageByExtension(file.path);
        if (lang) {
            const existing = acc.find((l) => l.name === lang);
            if (existing) {
                existing.bytes += file.content.length;
            } else {
                acc.push({ name: lang, bytes: file.content.length, percent: 0 });
            }
        }
        return acc;
    }, [] as Array<{ name: string; bytes: number; percent: number }>);

    const totalBytes = languages.reduce((sum, l) => sum + l.bytes, 0);
    languages.forEach((l) => {
        l.percent = totalBytes > 0 ? (l.bytes / totalBytes) * 100 : 0;
    });
    languages.sort((a, b) => b.percent - a.percent);

    return languages;
}

/**
 * Calculate quality score based on various metrics
 * @param locAnalysis - LOC analysis results
 * @param languages - Array of languages with their statistics
 * @param complexity - Complexity analysis results
 * @param signals - Signal flags
 * @param fileContents - Array of files to analyze
 * @returns Quality score
 */
export function calculateQualityScore(
    locAnalysis: any,
    languages: Array<{ name: string; percent: number; bytes: number }>,
    complexity: any,
    signals: ReturnType<typeof detectSignals>,
    fileContents: Array<{ path: string; content: string }>
): number {
    let qualityScore = 0;

    // LOC (more = more serious projects)
    if (locAnalysis?.total?.code > 5000) qualityScore += 15;
    else if (locAnalysis?.total?.code > 2000) qualityScore += 10;
    else if (locAnalysis?.total?.code > 500) qualityScore += 5;

    // Documentation & Comments (healthy ratio is 10-30%)
    if (complexity.lineCount > 0) {
        const commentRatio = complexity.commentCount / complexity.lineCount;
        if (commentRatio > 0.15) qualityScore += 10;
        else if (commentRatio > 0.05) qualityScore += 5;
    }

    // TypeScript coverage
    const tsPercent = languages.find((l) => l.name === "TypeScript")?.percent || 0;
    qualityScore += Math.min(20, Math.floor(tsPercent / 5));

    // Complexity (low = good)
    if (complexity.averageCyclomaticComplexity < 5) qualityScore += 15;
    else if (complexity.averageCyclomaticComplexity < 10) qualityScore += 10;
    else qualityScore += 5;

    // Branches and Loops (too many relative to logic is complex)
    const branchesAndLoops = complexity.loopCount + complexity.conditionCount;
    if (branchesAndLoops === 0) {
        // trivial code, neutral
    } else if (branchesAndLoops < complexity.lineCount * 0.1) {
        qualityScore += 5; // Good balance
    } else if (branchesAndLoops > complexity.lineCount * 0.3) {
        qualityScore -= 5; // Too heavily nested/conditional
    }

    // Organization (class/module count)
    if (complexity.classCount > 10) qualityScore += 15;
    else if (complexity.classCount > 5) qualityScore += 10;

    // Tests & CI
    if (signals.hasTests) qualityScore += 12;
    if (signals.hasCI) qualityScore += 8;

    // Documentation
    const hasReadme = fileContents.some((f) => /README/i.test(f.path));
    if (hasReadme) qualityScore += 5;

    return Math.min(100, Math.max(0, qualityScore));
}

export function determineDevelopmentLevel(qualityScore: number): "beginner" | "intermediate" | "advanced" {
    if (qualityScore >= 70) return "advanced";
    if (qualityScore >= 40) return "intermediate";
    return "beginner";
}
