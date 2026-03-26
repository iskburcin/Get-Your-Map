import mongoose from "mongoose";

let isConnectionReady = false;

export async function connectMongoDB(): Promise<boolean> {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        console.warn("MONGODB_URI is not defined. MongoDB cache is disabled.");
        return false;
    }

    if (isConnectionReady) return true;

    try {
        await mongoose.connect(mongoUri, {
            dbName: process.env.MONGODB_DB_NAME || "github_info_ui"
        });

        isConnectionReady = true;
        console.log("MongoDB connection established.");
        return true;
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        isConnectionReady = false;
        return false;
    }
}

export function isMongoConnected(): boolean {
    return isConnectionReady;
}
