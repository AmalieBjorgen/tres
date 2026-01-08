import { GameState, Lobby } from './types';

// In-memory store for lobbies and games
// In production, you'd want to use Redis or a database

class GameStore {
    private lobbies: Map<string, Lobby> = new Map();
    private games: Map<string, GameState> = new Map();

    // Lobby operations
    getLobby(code: string): Lobby | undefined {
        return this.lobbies.get(code.toUpperCase());
    }

    setLobby(lobby: Lobby): void {
        this.lobbies.set(lobby.code.toUpperCase(), lobby);
    }

    deleteLobby(code: string): void {
        this.lobbies.delete(code.toUpperCase());
    }

    // Game operations
    getGame(code: string): GameState | undefined {
        return this.games.get(code.toUpperCase());
    }

    setGame(game: GameState): void {
        this.games.set(game.id.toUpperCase(), game);
    }

    deleteGame(code: string): void {
        this.games.delete(code.toUpperCase());
    }

    // Clean up old lobbies and games (call periodically)
    cleanup(maxAgeMs: number = 3600000): void { // 1 hour default
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

    // Get stats
    getStats(): { lobbies: number; games: number } {
        return {
            lobbies: this.lobbies.size,
            games: this.games.size,
        };
    }
}

// Singleton instance
export const gameStore = new GameStore();
