import crypto from "crypto";

/**
 * Recursively sorts the values of an object or array to ensure consistent hashing. This function is used to create a stable hash from an object by sorting its keys and values, which is important for caching and comparison purposes. It handles nested objects and arrays, ensuring that the order of keys does not affect the resulting hash.
 * @param value - The value to be sorted, which can be an object, array, or primitive type.
 * @returns The sorted value, with objects having their keys sorted and arrays having their elements sorted recursively.
 */
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

/**
 * Creates a SHA-256 hash from a given value by first normalizing it (sorting keys and values) and then serializing it to a JSON string. This function is useful for generating consistent hashes for objects, which can be used for caching or change detection. The resulting hash is a hexadecimal string representation of the SHA-256 digest.
 * @param value - The value to be hashed, which can be an object, array, or primitive type.
 * @returns A hexadecimal string representing the SHA-256 hash of the normalized and serialized value.
 */

export function createHashFromObject(value: unknown): string {
    const normalized = sortValue(value);
    const serialized = JSON.stringify(normalized);

    return crypto
        .createHash("sha256")
        .update(serialized)
        .digest("hex");
}
