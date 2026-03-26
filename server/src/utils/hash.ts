import crypto from "crypto";

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(sortValue);
    }

    if (value && typeof value === "object") {
        const sortedEntries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, nestedValue]) => [key, sortValue(nestedValue)] as const);

        return Object.fromEntries(sortedEntries);
    }

    return value;
}

export function createHashFromObject(value: unknown): string {
    const normalized = sortValue(value);
    const serialized = JSON.stringify(normalized);

    return crypto
        .createHash("sha256")
        .update(serialized)
        .digest("hex");
}
