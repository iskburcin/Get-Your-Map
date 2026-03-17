/**
 * AnalysisResponse type for storing the analysis response of the API.
 * @property {object} repository - The repository of the user.
 * @property {string} repository.owner - The owner of the repository.
 * @property {string} repository.name - The name of the repository.
 * @property {object} codeAnalysis - The code analysis of the repository.
 * @property {number} codeAnalysis.qualityScore - The quality score of the repository.
 * @property {string} codeAnalysis.developmentLevel - The development level of the repository.
 * @property {object} codeAnalysis.complexity - The complexity of the repository.
 * @property {object} codeAnalysis.lineOfCode - The line of code of the repository.
 * @property {Array} codeAnalysis.languages - The languages of the repository.
 * @property {boolean} codeAnalysis.hasTests - Whether the repository has tests.
 * @property {boolean} codeAnalysis.hasCI - Whether the repository has CI.
 * @property {boolean} codeAnalysis.hasTypeScript - Whether the repository has TypeScript.
 * @property {boolean} codeAnalysis.hasDocker - Whether the repository has Docker.
 * @property {string} ollamaAnalysis - The Ollama analysis of the repository.
 * @property {string | null} roadmap - The roadmap of the repository.
 */
export type AnalysisResponse = {
  repository: { owner: string; name: string };
  codeAnalysis: {
    qualityScore: number;
    developmentLevel: string;
    complexity: any;
    lineOfCode: any;
    languages: any[];
    hasTests: boolean;
    hasCI: boolean;
    hasTypeScript: boolean;
    hasDocker: boolean;
  };
  ollamaAnalysis: string;
  roadmap: string | null;
};

/**
 * AnalysisState type for storing the analysis state of the API.
 * @property {boolean} loading - Whether the analysis is loading.
 * @property {AnalysisResponse} data - The analysis data.
 * @property {string} error - The error message.
 */
export type AnalysisState = {
  loading: boolean;
  data?: AnalysisResponse;
  error?: string;
};
