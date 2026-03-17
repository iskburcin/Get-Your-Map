import path from "path";

/**
 * Complexity metrics interface
 * @property functionCount - Number of functions
 * @property classCount - Number of classes
 * @property methodCount - Number of methods
 * @property averageCyclomaticComplexity - Average cyclomatic complexity
 * @property maxNestingLevel - Maximum nesting level
 * @property fileCount - Number of files
 * @property lineCount - Number of lines
 * @property commentCount - Number of comments
 * @property blankCount - Number of blank lines
 * @property loopCount - Number of loops
 * @property conditionCount - Number of conditions
 */
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

/**
 * Regex-based function and class detector for multiple languages.
 * Provides a highly reliable fallback when Tree-sitter WASM fails.
 * @param filePath - File path
 * @param content - Code content
 * @returns Promise<ComplexityMetrics>
 */
export async function analyzeCodeWithRegex(
    filePath: string,
    content: string
): Promise<ComplexityMetrics> {
    const ext = path.extname(filePath).toLowerCase();
    const lines = content.split("\n");

    let functionCount = 0;
    let classCount = 0;
    let commentCount = 0;
    let blankCount = 0;
    let lineCount = lines.length;

    // Line by line analysis for comments and blanks
    let inBlockComment = false;
    for (let line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            blankCount++;
            continue;
        }

        // Check for block comments
        if (inBlockComment) {
            commentCount++;
            if (trimmed.includes("*/")) inBlockComment = false;
            continue;
        }

        if (trimmed.startsWith("/*")) {
            commentCount++;
            if (!trimmed.includes("*/")) inBlockComment = true;
            continue;
        }

        // Single line comments
        if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("///")) {
            commentCount++;
            continue;
        }
    }

    // Clean content for structural analysis
    // Remove block comments, single-line comments, and docstrings
    const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")
        .replace(/#.*/g, "")
        .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, "");

    // Language specific patterns
    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        functionCount += (cleanContent.match(/\bfunction\s+[\w$]*\s*\(|(\bconst|\blet|\bvar)\s+[\w$]+\s*=\s*(\([^)]*\)|[\w$]+)\s*=>/g) || []).length;
        functionCount += (cleanContent.match(/\b\w+\s*\([^)]*\)\s*\{/g) || []).length;
        classCount += (cleanContent.match(/\bclass\s+\w+/g) || []).length;
    }
    else if (ext === ".py") {
        functionCount += (cleanContent.match(/^\s*def\s+\w+\s*\(/gm) || []).length;
        classCount += (cleanContent.match(/^\s*class\s+\w+/gm) || []).length;
    }
    else if (ext === ".dart") {
        // Dart: void name(), Type name(), class Name, class Name extends
        functionCount += (cleanContent.match(/\b(void|Future|[\w<>?]+)\s+[\w$]+\s*\([^)]*\)\s*(\{|\basync)/g) || []).length;
        classCount += (cleanContent.match(/\bclass\s+\w+(\s+extends\s+\w+)?/g) || []).length;
    }
    else if ([".java", ".cs", ".cpp", ".c", ".rs", ".go"].includes(ext)) {
        functionCount += (cleanContent.match(/\b\w+\s*\([^)]*\)\s*(\{|=)/g) || []).length;
        classCount += (cleanContent.match(/\b(class|struct|interface|enum)\s+\w+/g) || []).length;

        if (ext === ".go") {
            functionCount = (cleanContent.match(/\bfunc\s+[^(]*\(/g) || []).length;
        }
    }

    const conditions = (cleanContent.match(/\b(if|switch|case|catch|&&|\|\|)\b|\?/g) || []).length;
    const loops = (cleanContent.match(/\b(for|while|do)\b/g) || []).length;
    const branches = conditions + loops;
    const cyclomaticComplexity = 1 + (branches / (functionCount || 1));

    return {
        functionCount,
        classCount,
        methodCount: 0,
        averageCyclomaticComplexity: Math.min(10, cyclomaticComplexity),
        maxNestingLevel: 0,
        fileCount: 1,
        lineCount,
        commentCount,
        blankCount,
        loopCount: loops,
        conditionCount: conditions
    };
}

/**
 * Analyze multiple files using regex
 * @param files - Array of files to analyze
 * @returns Promise<ComplexityMetrics>
 */
export async function analyzeMultipleFilesWithRegex(
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
        conditionCount: 0
    };

    let totalComplexity = 0;
    let successfulParses = 0;

    for (const file of files) {
        const metrics = await analyzeCodeWithRegex(file.path, file.content);
        aggregated.functionCount += metrics.functionCount;
        aggregated.classCount += metrics.classCount;
        aggregated.lineCount += metrics.lineCount;
        aggregated.commentCount += metrics.commentCount;
        aggregated.blankCount += metrics.blankCount;
        aggregated.loopCount += metrics.loopCount;
        aggregated.conditionCount += metrics.conditionCount;
        totalComplexity += metrics.averageCyclomaticComplexity;
        successfulParses++;
    }

    if (successfulParses > 0) {
        aggregated.averageCyclomaticComplexity = totalComplexity / successfulParses;
    }

    return aggregated;
}
