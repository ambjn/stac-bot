// Simple in-memory cache with TTL
interface CacheEntry<T> {
    data: T;
    expiry: number;
}

class Cache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private defaultTTL: number = 30000; // 30 seconds default

    set<T>(key: string, data: T, ttl?: number): void {
        const expiry = Date.now() + (ttl || this.defaultTTL);
        this.cache.set(key, { data, expiry });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        return entry.data as T;
    }

    delete(key: string): void {
        this.cache.delete(key);
    }

    clear(): void {
        this.cache.clear();
    }

    // Clear expired entries
    cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiry) {
                this.cache.delete(key);
            }
        }
    }
}

export const cache = new Cache();

// Run cleanup every 60 seconds
setInterval(() => cache.cleanup(), 60000);
