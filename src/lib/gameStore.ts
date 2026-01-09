import { Redis } from '@upstash/redis';
import { GameState, Lobby } from './types';

// Store for lobbies and games
// Uses Redis if environment variables are present, otherwise fallbacks to in-memory Map
class GameStore {
    private lobbies: Map<string, Lobby> = new Map();
    private games: Map<string, GameState> = new Map();
    private redis: Redis | null = null;

    // Tiny in-memory cache to handle bursts (especially useful for serverless Redis)
    private lobbyCache: Map<string, { data: Lobby, expiresAt: number }> = new Map();
    private gameCache: Map<string, { data: GameState, expiresAt: number }> = new Map();
    private readonly CACHE_TTL = 1000; // 1 second cache

    constructor() {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            this.redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });
            console.log('Using Upstash Redis for state persistence');
        } else {
            console.log('Using in-memory store (state will be lost on serverless restarts)');
            // Start background cleanup for in-memory store
            if (typeof window === 'undefined') {
                setInterval(() => this.cleanup(), 600000); // Clean up every 10 minutes
            }
        }
    }

    // Lobby operations
    async getLobby(code: string): Promise<Lobby | undefined> {
        const key = code.toUpperCase();

        // Check cache first
        const cached = this.lobbyCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }

        let lobby: Lobby | undefined;
        if (this.redis) {
            lobby = (await this.redis.get<Lobby>(`lobby:${key}`)) || undefined;
        } else {
            lobby = this.lobbies.get(key);
        }

        // Update cache
        if (lobby) {
            this.lobbyCache.set(key, { data: lobby, expiresAt: Date.now() + this.CACHE_TTL });
        }

        return lobby;
    }
    async setLobby(lobby: Lobby): Promise<void> {
        const code = lobby.code.toUpperCase();

        // Update cache immediately
        this.lobbyCache.set(code, { data: lobby, expiresAt: Date.now() + this.CACHE_TTL });

        if (this.redis) {
            await this.redis.set(`lobby:${code}`, lobby, { ex: 3600 }); // 1 hour TTL
            return;
        }
        this.lobbies.set(code, { ...lobby, updatedAt: Date.now() } as any);
    }

    async deleteLobby(code: string): Promise<void> {
        const key = code.toUpperCase();
        this.lobbyCache.delete(key);
        if (this.redis) {
            await this.redis.del(`lobby:${key}`);
            return;
        }
        this.lobbies.delete(key);
    }

    // Game operations
    async getGame(code: string): Promise<GameState | undefined> {
        const key = code.toUpperCase();

        // Check cache first
        const cached = this.gameCache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }

        let game: GameState | undefined;
        if (this.redis) {
            game = (await this.redis.get<GameState>(`game:${key}`)) || undefined;
        } else {
            game = this.games.get(key);
        }

        // Update cache
        if (game) {
            this.gameCache.set(key, { data: game, expiresAt: Date.now() + this.CACHE_TTL });
        }

        return game;
    }

    async setGame(game: GameState): Promise<void> {
        const code = game.id.toUpperCase();

        // Update cache immediately
        this.gameCache.set(code, { data: game, expiresAt: Date.now() + this.CACHE_TTL });

        if (this.redis) {
            await this.redis.set(`game:${code}`, game, { ex: 3600 }); // 1 hour TTL
            return;
        }
        this.games.set(code, { ...game, updatedAt: Date.now() } as any);
    }

    async deleteGame(code: string): Promise<void> {
        const key = code.toUpperCase();
        this.gameCache.delete(key);
        if (this.redis) {
            await this.redis.del(`game:${key}`);
            return;
        }
        this.games.delete(key);
    }

    // Clean up old lobbies and games (only relevant for in-memory)
    cleanup(maxAgeMs: number = 3600000): void {
        if (this.redis) return; // Redis handles TTL automatically

        const now = Date.now();
        console.log(`Running GameStore cleanup... (Current size: ${this.lobbies.size} lobbies, ${this.games.size} games)`);

        for (const [code, lobby] of this.lobbies.entries()) {
            const lastActivity = (lobby as any).updatedAt || lobby.createdAt;
            if (now - lastActivity > maxAgeMs) {
                this.lobbies.delete(code);
            }
        }

        for (const [code, game] of this.games.entries()) {
            const lastActivity = (game as any).updatedAt || game.createdAt;
            if (now - lastActivity > maxAgeMs) {
                this.games.delete(code);
            }
        }
    }
}

// Singleton instance with HMR support
const globalForStore = global as unknown as { gameStore: GameStore };
export const gameStore = globalForStore.gameStore || new GameStore();

if (process.env.NODE_ENV !== 'production') {
    globalForStore.gameStore = gameStore;
}
