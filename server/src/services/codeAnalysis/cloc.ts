import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execPromise = promisify(exec);

/**
 * CLOC result interface
 * @property language - Language name
 * @property blank - Blank lines
 * @property comment - Comment lines
 * @property code - Code lines
 * @property total - Total lines
 */
interface ClocResult {
    language: string;
    blank: number;
    comment: number;
    code: number;
    total: number;
}

/**
 * CLOC output interface
 * @property languages - Array of CLOC results per language
 * @property total - Total CLOC results
 */
interface ClocOutput {
    languages: ClocResult[];
    total: ClocResult;
}

/**
 * Write files to a cross-platform temp directory and run cloc to analyze them.
 * Uses `npx cloc` since cloc is an npm package dependency (not a global CLI).
 * @param files - Array of files to analyze
 * @returns Promise<ClocOutput>
 */
export async function analyzeClocFromFiles(
    files: Array<{ path: string; content: string }>
): Promise<ClocOutput> {
    // os.tmpdir() is cross-platform: /tmp on Linux/Mac, C:\Users\...\AppData\Local\Temp on Windows
    const tempDir = path.join(os.tmpdir(), `cloc-${Date.now()}`);

    try {
        // Create temp directory
        fs.mkdirSync(tempDir, { recursive: true });

        // Write each file into the temp directory, preserving its sub-path
        for (const file of files) {
            const filePath = path.join(tempDir, file.path);
            const dir = path.dirname(filePath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, file.content, "utf-8");
        }

        // Use npx cloc — works on all platforms since cloc is an npm dependency
        const { stdout, stderr } = await execPromise(
            `npx cloc "${tempDir}" --json --quiet --exclude-dir=node_modules`,
            { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer for large repos
        );

        if (!stdout || stdout.trim() === "") {
            console.warn("CLOC returned empty output.", stderr);
            return emptyResult();
        }

        const parsed = JSON.parse(stdout) as Record<string, any>;

        // Build per-language results (skip the "header" and "SUM"/"total" keys)
        const languages: ClocResult[] = [];
        for (const [lang, stats] of Object.entries(parsed)) {
            if (lang === "header" || lang === "SUM" || typeof stats !== "object") continue;
            const s = stats as any;
            languages.push({
                language: lang,
                blank: s.blank ?? 0,
                comment: s.comment ?? 0,
                code: s.code ?? 0,
                // total = blank + comment + code  (all physical lines)
                total: (s.blank ?? 0) + (s.comment ?? 0) + (s.code ?? 0),
            });
        }

        // cloc outputs "SUM" as the totals key (not "total")
        const sum = (parsed["SUM"] ?? parsed["total"] ?? {}) as any;

        console.log("CLOC Languages:", languages);
        console.log("CLOC Total:", sum);

        return {
            languages,
            total: {
                language: "Total",
                blank: sum.blank ?? 0,
                comment: sum.comment ?? 0,
                code: sum.code ?? 0,
                total: (sum.blank ?? 0) + (sum.comment ?? 0) + (sum.code ?? 0),
            },
        };
    } catch (err) {
        console.error("CLOC error:", err);
        return emptyResult();
    } finally {
        // Always clean up the temp directory
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch {
            // ignore cleanup errors
        }
    }
}

function emptyResult(): ClocOutput {
    return {
        languages: [],
        total: { language: "Total", blank: 0, comment: 0, code: 0, total: 0 },
    };
}