import fetch from "node-fetch";

/**
 * Ollama request interface
 * @param model - Model name
 * @param prompt - Prompt to send to the model
 * @param temperature - Temperature for the model
 * @param stream - Whether to stream the response
 * @param top_p - Top-p sampling parameter
 * @param top_k - Top-k sampling parameter
 */
export interface OllamaRequest {
    model: string;
    prompt: string;
    temperature?: number;
    stream?: boolean;
    top_p?: number;
    top_k?: number;
}

/**
 * Ollama response interface
 * @param model - Model name
 * @param created_at - Creation timestamp
 * @param response - Response from the model
 * @param done - Whether the response is complete
 * @param total_duration - Total duration of the response
 * @param load_duration - Load duration of the response
 * @param prompt_eval_duration - Prompt evaluation duration of the response
 * @param eval_duration - Evaluation duration of the response
 * @param eval_count - Evaluation count of the response
 */
export interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
    eval_count?: number;
}

/**
 * Call Ollama server
 * @param req - Ollama request
 * @returns Promise<string>
 */
export async function callOllama(
    req: OllamaRequest
): Promise<string> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    try {
        console.log(`Calling Ollama (${req.model}) at ${ollamaUrl}...`);

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: req.model,
                prompt: req.prompt,
                stream: false,
                temperature: req.temperature || 0.7,
                top_p: req.top_p || 0.95,
                top_k: req.top_k || 40
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = (await response.json()) as OllamaResponse;
        return data.response;
    } catch (err) {
        console.error("Ollama call failed:", err);
        throw err;
    }
}

/**
 * Check Ollama server health
 * @returns Promise<boolean>
 */
export async function checkOllamaHealth(): Promise<boolean> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * List available models on Ollama server
 * @returns Promise<string[]>
 */
export async function listOllamaModels(): Promise<string[]> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    try {
        const response = await fetch(`${ollamaUrl}/api/tags`);
        const data = (await response.json()) as { models: Array<{ name: string }> };
        return data.models.map((m) => m.name);
    } catch (err) {
        console.error("Error listing models:", err);
        return [];
    }
}