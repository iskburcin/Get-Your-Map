import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

/**
 * Interface for language statistics.
 * @param name - The name of the language.
 * @param percent - The percentage of the language.
 * @param bytes - The number of bytes of the language.
 * @param color - The color of the language.
 */
interface LanguageStats {
    name: string;
    percent: number;
    bytes: number;
    color?: string;
}

/**
 * Linguist is a library that is used to analyze the code of a repository.
 * It is used to determine the programming language of the code.
 * @param repoPath - The path to the repository.
 * @returns A promise that resolves to an array of LanguageStats objects.
 */
export async function analyzeLanguagesWithLinguist(
    repoPath: string
): Promise<LanguageStats[]> {
    try {
        const { stdout } = await execPromise(`github-linguist ${repoPath} --json`, {
            maxBuffer: 10 * 1024 * 1024
        });

        const parsed = JSON.parse(stdout) as Record<string, any>;

        const languages: LanguageStats[] = [];
        let totalBytes = 0;

        for (const [lang, bytes] of Object.entries(parsed)) {
            if (lang !== "total") {
                totalBytes += (bytes as number) || 0;
            }
        }

        for (const [lang, bytes] of Object.entries(parsed)) {
            if (lang !== "total" && (bytes as number) > 0) {
                languages.push({
                    name: lang,
                    bytes: bytes as number,
                    percent: totalBytes > 0 ? ((bytes as number) / totalBytes) * 100 : 0
                });
            }
        }

        // Sort by percentage
        languages.sort((a, b) => b.percent - a.percent);

        return languages;
    } catch (err) {
        console.error("Linguist error:", err);
        return [];
    }
}

/**
 * Detect language by extension. If Linguist is not installed, this function will be used as fallback
 * @param filePath - The path to the file.
 * @returns The language of the file.
 */
export function detectLanguageByExtension(
    filePath: string
): string | null {
    const extensionMap: Record<string, string> = {
        ".ts": "TypeScript",
        ".tsx": "TypeScript",
        ".js": "JavaScript",
        ".jsx": "JavaScript",
        ".py": "Python",
        ".go": "Go",
        ".rs": "Rust",
        ".java": "Java",
        ".cpp": "C++",
        ".c": "C",
        ".php": "PHP",
        ".rb": "Ruby",
        ".css": "CSS",
        ".scss": "SCSS",
        ".html": "HTML",
        ".sql": "SQL",
        ".json": "JSON",
        ".yaml": "YAML",
        ".yml": "YAML"
    };

    const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
    return extensionMap[ext] || null;
}