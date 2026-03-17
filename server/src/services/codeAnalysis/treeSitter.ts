/**
 * AST-based code analysis using native `tree-sitter` binaries.
 *
 * Replaces @babel/parser and web-tree-sitter with native C++ bindings for Node.
 * Dynamic loading is used so the server won't crash if packages are still installing.
 */

import path from "path";
import { analyzeCodeWithRegex } from "./regexMetricService";

// We use dynamic imports to prevent the server from crashing if you don't install all of these.
let ParserClass: any = null;

export interface ComplexityMetrics {
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
}

// ──────────────────────────────────────────────────────────────
// Language Mappings & Lazy Loading
// ──────────────────────────────────────────────────────────────

/**
 * Maps file extensions to the npm package name for the tree-sitter language.
 */
const EXTENSION_TO_MODULE: Record<string, string> = {
    ".ts": "tree-sitter-typescript",
    ".tsx": "tree-sitter-typescript",
    ".js": "tree-sitter-javascript",
    ".jsx": "tree-sitter-javascript",
    ".py": "tree-sitter-python",
    ".java": "tree-sitter-java",
    ".go": "tree-sitter-go",
    ".cpp": "tree-sitter-cpp",
    ".hpp": "tree-sitter-cpp",
    ".c": "tree-sitter-c",
    ".h": "tree-sitter-c",
    ".cs": "tree-sitter-c-sharp",
    ".rs": "tree-sitter-rust",
    ".rb": "tree-sitter-ruby",
    ".php": "tree-sitter-php",
    ".dart": "tree-sitter-dart",
};

// Cache for loaded languages
const languageCache: Map<string, any> = new Map();

/**
 * Attempts to load the native Tree-Sitter parser + the specific language module.
 */
async function getParserForExt(ext: string): Promise<any | null> {
    const moduleName = EXTENSION_TO_MODULE[ext];
    if (!moduleName) return null;

    try {
        // Load the main tree-sitter parser class if not loaded yet
        if (!ParserClass) {
            const mod = await import("tree-sitter");
            ParserClass = mod.default || mod;
        }

        // Return from cache if we already loaded this specific language
        if (languageCache.has(ext)) {
            const parser = new ParserClass();
            parser.setLanguage(languageCache.get(ext));
            return parser;
        }

        // Dynamically import the language package
        const langModule = await import(moduleName);
        let lang = langModule.default || langModule;

        // tree-sitter-typescript is a special case: it exports an object like { typescript, tsx }
        if (moduleName === "tree-sitter-typescript") {
            lang = ext === ".tsx" ? lang.tsx : lang.typescript;
        }

        languageCache.set(ext, lang);

        const parser = new ParserClass();
        parser.setLanguage(lang);
        return parser;
    } catch (err: any) {
        // If the module fails to load (not installed yet, node-gyp failed, etc.), fail gracefully
        console.warn(`[Tree-Sitter] Native module for ${ext} ('${moduleName}') failed to load. Will fallback to regex.`);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function countBlankAndCommentLines(
    code: string,
    ext: string
): { blankCount: number; commentCount: number } {
    const lines = code.split("\n");
    let blankCount = 0;
    let commentCount = 0;
    let inBlock = false;

    for (const raw of lines) {
        const t = raw.trim();
        if (!t) { blankCount++; continue; }

        if (inBlock) {
            commentCount++;
            if (t.includes("*/")) inBlock = false;
            continue;
        }

        if (t.startsWith("/*")) {
            commentCount++;
            if (!t.includes("*/")) inBlock = true;
            continue;
        }

        if (
            t.startsWith("//") ||
            t.startsWith("///") ||
            (ext === ".py" || ext === ".rb" ? t.startsWith("#") : false)
        ) {
            commentCount++;
        }
    }

    return { blankCount, commentCount };
}

// ──────────────────────────────────────────────────────────────
// Native Tree-Sitter Analysis
// ──────────────────────────────────────────────────────────────

function calculateCyclomaticComplexity(node: any): number {
    let complexity = 1;

    function countBranches(n: any) {
        const type = n.type || "";

        // This relies on common AST nodes across multiple language grammars
        if (
            type === "if_statement" ||
            type === "ternary_expression" ||
            type === "switch_statement" ||
            type === "for_statement" ||
            type === "while_statement" ||
            type === "catch_clause" ||
            type === "elif_clause" || // Python
            type === "for_in_statement" // JS/TS
        ) {
            complexity++;
        }

        // Visit children
        if (n.children && n.children.length > 0) {
            for (const child of n.children) {
                countBranches(child);
            }
        }
    }

    countBranches(node);
    return complexity;
}

async function analyzeWithTreeSitterNative(
    filePath: string,
    code: string,
    parser: any
): Promise<ComplexityMetrics> {
    const ext = path.extname(filePath).toLowerCase();
    const tree = parser.parse(code);
    const lines = code.split("\n");
    const { blankCount, commentCount } = countBlankAndCommentLines(code, ext);

    const metrics: ComplexityMetrics = {
        functionCount: 0,
        classCount: 0,
        methodCount: 0,
        averageCyclomaticComplexity: 0,
        maxNestingLevel: 0,
        fileCount: 1,
        lineCount: lines.length,
        commentCount,
        blankCount,
        loopCount: 0,
        conditionCount: 0
    };

    let totalComplexity = 0;
    const complexities: number[] = [];

    function walk(node: any, depth: number = 0) {
        const type = node.type || "";

        // Functions
        if (
            type === "function_declaration" ||
            type === "function_definition" || // Python / C / C++
            type === "method_declaration" || // Java / Go
            type === "arrow_function" ||
            type === "function_expression" ||
            type === "function_item" // Rust
        ) {
            metrics.functionCount++;
            const comp = calculateCyclomaticComplexity(node);
            complexities.push(comp);
            totalComplexity += comp;
        }

        // Classes
        if (
            type === "class_declaration" ||
            type === "class_definition" || // Python / Ruby 
            type === "struct_item" || // Rust
            type === "type_declaration" || // Go structs
            type === "class_specifier" // C++
        ) {
            metrics.classCount++;
        }

        // Methods within classes
        if (
            type === "method_definition" ||
            type === "method_declaration" ||
            type === "function_definition" && depth > 2 // Python methods in classes
        ) {
            metrics.methodCount++;
        }

        // Max Nesting level proxy (depth of AST is much deeper than typical scope depth, 
        // but it gives an accurate relative heuristic of complexity).
        metrics.maxNestingLevel = Math.max(metrics.maxNestingLevel, depth);

        // Loops
        if (
            type === "for_statement" ||
            type === "while_statement" ||
            type === "do_statement" ||
            type === "for_in_statement"
        ) {
            metrics.loopCount++;
        }

        // Conditions
        if (
            type === "if_statement" ||
            type === "switch_statement" ||
            type === "ternary_expression"
        ) {
            metrics.conditionCount++;
        }

        // Recursive tree walking
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                // Some wrappers add scope; to avoid huge numbers, we mostly care about block depth
                const isBlock = child.type === "block" || child.type === "statement_block";
                walk(child, isBlock ? depth + 1 : depth);
            }
        }
    }

    walk(tree.rootNode);

    if (complexities.length > 0) {
        metrics.averageCyclomaticComplexity = Math.round((totalComplexity / complexities.length) * 100) / 100;
    } else {
        metrics.averageCyclomaticComplexity = 1;
    }

    return metrics;
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

/**
 * Analyze a single source file.
 */
export async function analyzeCodeFile(
    filePath: string,
    code: string
): Promise<ComplexityMetrics | null> {
    const ext = path.extname(filePath).toLowerCase();

    // Attempt native Tree-Sitter parser
    const parser = await getParserForExt(ext);

    if (parser) {
        try {
            const metrics = await analyzeWithTreeSitterNative(filePath, code, parser);
            console.log(`[Tree-Sitter] Native AST parsed successfully for: ${filePath} and metrics: ${metrics}`);
            return metrics;
        } catch (err) {
            console.warn(`[Tree-Sitter] Native AST threw an error while parsing ${filePath}. Falling back to Regex...`);
            // fall through to regex
        }
    } else {
        console.log(`[Tree-Sitter] Using Regex fallback for: ${filePath} (no native module available)`);
    }

    // Either the language isn't matched, the tree-sitter package isn't installed, 
    // or the native parsing threw an error — Regex is our hero fallback.
    return analyzeCodeWithRegex(filePath, code);
}

/**
 * Analyze multiple files and aggregate the metrics.
 * @param files - Array of files to analyze
 * @returns Promise<ComplexityMetrics>
 */
export async function analyzeMultipleFiles(
    files: Array<{ path: string; content: string }>
): Promise<ComplexityMetrics> {
    const aggregated: ComplexityMetrics = {
        functionCount: 0,
        classCount: 0,
        methodCount: 0,
        averageCyclomaticComplexity: 0,
        maxNestingLevel: 0,
        fileCount: files.length,
        lineCount: 0,
        commentCount: 0,
        blankCount: 0,
        loopCount: 0,
        conditionCount: 0,
    };

    const allComplexities: number[] = [];

    for (const file of files) {
        const metrics = await analyzeCodeFile(file.path, file.content);
        if (!metrics) continue;

        aggregated.functionCount += metrics.functionCount;
        aggregated.classCount += metrics.classCount;
        aggregated.methodCount += metrics.methodCount;
        aggregated.lineCount += metrics.lineCount;
        aggregated.commentCount += metrics.commentCount;
        aggregated.blankCount += metrics.blankCount;
        aggregated.loopCount += metrics.loopCount;
        aggregated.conditionCount += metrics.conditionCount;
        aggregated.maxNestingLevel = Math.max(
            aggregated.maxNestingLevel,
            metrics.maxNestingLevel
        );

        if (metrics.averageCyclomaticComplexity > 0) {
            allComplexities.push(metrics.averageCyclomaticComplexity);
        }
    }

    if (allComplexities.length > 0) {
        aggregated.averageCyclomaticComplexity =
            Math.round((allComplexities.reduce((a, b) => a + b, 0) / allComplexities.length) * 100) / 100;
    }

    return aggregated;
}