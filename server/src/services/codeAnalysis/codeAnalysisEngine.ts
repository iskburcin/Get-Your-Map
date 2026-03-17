import {
    fetchRepoFiles,
    fetchFileContent,
    filterSourceFiles
} from "../github/githubFileServices";
import { analyzeMultipleFiles } from "./treeSitter";
import { analyzeMultipleFilesWithRegex } from "./regexMetricService";
import { analyzeClocFromFiles } from "./cloc";
import { detectLanguageByExtension } from "./linguist";
import {
    detectSignals,
    aggregateLanguages,
    calculateQualityScore,
    determineDevelopmentLevel
} from "./metricService";

/**
 * Code analysis result interface
 * @property repositoryName - Repository name
 * @property owner - Repository owner
 * @property complexity - Code complexity metrics
 * @property lineOfCode - Line of code metrics
 * @property languages - Language metrics
 * @property sonarQube - SonarQube metrics
 * @property qualityScore - Quality score (0-100)
 * @property developmentLevel - Development level
 * @property hasTests - Has tests
 * @property hasCI - Has CI
 * @property hasTypeScript - Has TypeScript
 * @property hasDocker - Has Docker
 * @property timestamp - Timestamp
 */
export interface CodeAnalysisResult {
    repositoryName: string;
    owner: string;

    // Tree-Sitter metrics
    complexity: {
        functionCount: number;
        classCount: number;
        methodCount: number;
        averageCyclomaticComplexity: number;
        maxNestingLevel: number;
        fileCount: number;
        lineCount: number;
        commentCount: number;
        blankCount: number;
        loopCount: number;
        conditionCount: number;
    };

    // CLOC metrics
    lineOfCode: {
        languages: Array<{ language: string; blank: number; comment: number; code: number; total: number }>;
        total: { blank: number; comment: number; code: number; total: number };
    };

    // Linguist metrics
    languages: Array<{ name: string; percent: number; bytes: number }>;

    // SonarQube metrics
    sonarQube: any; // Optional, if SonarQube is available

    // Quality score (0-100)
    qualityScore: number;
    developmentLevel: "beginner" | "intermediate" | "advanced";

    // Signals
    hasTests: boolean;
    hasCI: boolean;
    hasTypeScript: boolean;
    hasDocker: boolean;

    timestamp: string;
}

/**
 * Full code analysis pipeline
 * @param owner - GitHub username
 * @param repo - Repository name
 * @param targetRepos - Number of target repositories (default: 5)
 * @returns Promise<CodeAnalysisResult[]>
 */
export async function analyzeRepository(
    owner: string,
    repo: string,
    targetRepos: number = 5
): Promise<CodeAnalysisResult[]> {
    console.log(`Starting analysis for ${owner}/${repo}...`);

    const results: CodeAnalysisResult[] = [];

    try {
        // 1) get repo files
        const files = await fetchRepoFiles(owner, repo);
        console.log(`Found ${files.length} files`);

        // 2) filter source files
        const sourceFiles = filterSourceFiles(files);
        console.log(`Filtered to ${sourceFiles.length} source files`);

        // 3) get file contents (first N files)
        const fileContents: Array<{ path: string; content: string }> = [];

        for (const file of sourceFiles.slice(0, 100)) {
            // first 100 files (performance)
            const content = await fetchFileContent(owner, repo, file.path);
            if (content) {
                fileContents.push({
                    path: file.path,
                    content
                });
            }
        }

        console.log(`Retrieved content for ${fileContents.length} files`);

        // 4) Tree-Sitter analaysis
        console.log("Running Tree-Sitter analysis...");
        let complexity = await analyzeMultipleFiles(fileContents);

        // FALLBACK: If 0 functions/classes found (WASM error, etc.), try again with Regex
        if (complexity.functionCount === 0 && complexity.classCount === 0 && fileContents.length > 0) {
            console.log("Tree-Sitter failed to detect code structures. Falling back to Regex metrics...");
            const regexComplexity = await analyzeMultipleFilesWithRegex(fileContents);
            // Merge results
            complexity = { ...complexity, ...regexComplexity };
        }

        // 5) CLOC analysis
        console.log("Running CLOC analysis...");
        const locAnalysis = await analyzeClocFromFiles(fileContents);

        // 6) Linguist analysis
        console.log("Detecting languages with Linguist...");
        const languages = aggregateLanguages(fileContents, detectLanguageByExtension);

        // 7) Signals algıla
        const signals = detectSignals(fileContents);

        // 8) Quality score hesapla
        const qualityScore = calculateQualityScore(locAnalysis, languages, complexity, signals, fileContents);

        // Development level
        const developmentLevel = determineDevelopmentLevel(qualityScore);

        const result: CodeAnalysisResult = {
            repositoryName: repo,
            owner,
            complexity,
            lineOfCode: locAnalysis,
            languages,
            sonarQube: null, // Optional
            qualityScore,
            developmentLevel,
            hasTests: signals.hasTests,
            hasCI: signals.hasCI,
            hasTypeScript: signals.hasTypeScript,
            hasDocker: signals.hasDocker,
            timestamp: new Date().toISOString()
        };

        results.push(result);

    } catch (err) {
        console.error("Error analyzing repository:", err);
    }

    return results;
}