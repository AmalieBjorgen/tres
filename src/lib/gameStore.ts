import { Redis } from '@upstash/redis';
import { GameState, Lobby } from './types';

// Store for lobbies and games
// Uses Redis if environment variables are present, otherwise fallbacks to in-memory Map
class GameStore {
    private lobbies: Map<string, Lobby> = new Map();
    private games: Map<string, GameState> = new Map();
    private redis: Redis | null = null;

    constructor() {
        if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
            this.redis = new Redis({
                url: process.env.UPSTASH_REDIS_REST_URL,
                token: process.env.UPSTASH_REDIS_REST_TOKEN,
            });
            console.log('Using Upstash Redis for state persistence');
        } else {
            console.log('Using in-memory store (state will be lost on serverless restarts)');
        }
    }

    // Lobby operations
    async getLobby(code: string): Promise<Lobby | undefined> {
        const key = `lobby:${code.toUpperCase()}`;
        if (this.redis) {
            return (await this.redis.get<Lobby>(key)) || undefined;
        }
        return this.lobbies.get(code.toUpperCase());
    }

    async setLobby(lobby: Lobby): Promise<void> {
        const code = lobby.code.toUpperCase();
        if (this.redis) {
            await this.redis.set(`lobby:${code}`, lobby, { ex: 3600 }); // 1 hour TTL
            return;
        }
        this.lobbies.set(code, lobby);
    }

    async deleteLobby(code: string): Promise<void> {
        if (this.redis) {
            await this.redis.del(`lobby:${code.toUpperCase()}`);
            return;
        }
        this.lobbies.delete(code.toUpperCase());
    }

    // Game operations
    async getGame(code: string): Promise<GameState | undefined> {
        const key = `game:${code.toUpperCase()}`;
        if (this.redis) {
            return (await this.redis.get<GameState>(key)) || undefined;
        }
        return this.games.get(code.toUpperCase());
    }

    async setGame(game: GameState): Promise<void> {
        const code = game.id.toUpperCase();
        if (this.redis) {
            await this.redis.set(`game:${code}`, game, { ex: 3600 }); // 1 hour TTL
            return;
        }
        this.games.set(code, game);
    }

    async deleteGame(code: string): Promise<void> {
        if (this.redis) {
            await this.redis.del(`game:${code.toUpperCase()}`);
            return;
        }
        this.games.delete(code.toUpperCase());
    }

    // Clean up old lobbies and games (only relevant for in-memory)
    cleanup(maxAgeMs: number = 3600000): void {
        if (this.redis) return; // Redis handles TTL automatically

        const now = Date.now();
        for (const [code, lobby] of this.lobbies.entries()) {
            if (now - lobby.createdAt > maxAgeMs) {
                this.lobbies.delete(code);
            }
        }

        for (const [code, game] of this.games.entries()) {
            if (now - game.createdAt > maxAgeMs) {
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
