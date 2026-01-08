// Turn timer duration in seconds
export const TURN_DURATION_SECONDS = 30;

// Card colors
export type CardColor = 'red' | 'blue' | 'green' | 'yellow';

// Card types
export type CardType = 'number' | 'skip' | 'reverse' | 'draw_two' | 'wild' | 'wild_draw_four';

// Card interface
export interface Card {
    id: string;
    type: CardType;
    color: CardColor | null; // null for wild cards (until played)
    value: number | null; // 0-9 for number cards, null for action cards
}

// Player interface
export interface Player {
    id: string;
    name: string;
    hand: Card[];
    isHost: boolean;
    isConnected: boolean;
    hasSaidTres: boolean;
}

// Game direction
export type GameDirection = 'clockwise' | 'counter_clockwise';

// Game status
export type GameStatus = 'waiting' | 'playing' | 'finished';

// Game state
export interface GameState {
    id: string;
    status: GameStatus;
    players: Player[];
    currentPlayerIndex: number;
    direction: GameDirection;
    drawPile: Card[];
    discardPile: Card[];
    currentColor: CardColor; // The active color (important for wild cards)
    winnerId: string | null;
    lastAction: GameAction | null;
    createdAt: number;
    turnStartedAt: number; // Timestamp when current turn started
}

// Lobby (waiting room before game starts)
export interface Lobby {
    code: string;
    hostId: string;
    players: LobbyPlayer[];
    createdAt: number;
    maxPlayers: number;
}

export interface LobbyPlayer {
    id: string;
    name: string;
    isHost: boolean;
    isReady: boolean;
    joinedAt: number;
}

// Game actions
export type GameActionType =
    | 'play_card'
    | 'draw_card'
    | 'say_tres'
    | 'challenge_tres'
    | 'choose_color';

export interface GameAction {
    type: GameActionType;
    playerId: string;
    cardId?: string;
    chosenColor?: CardColor;
    timestamp: number;
}

// API Request/Response types
export interface CreateLobbyRequest {
    playerName: string;
}

export interface CreateLobbyResponse {
    lobby: Lobby;
    playerId: string;
}

export interface JoinLobbyRequest {
    playerName: string;
}

export interface JoinLobbyResponse {
    lobby: Lobby;
    playerId: string;
}

export interface PlayCardRequest {
    playerId: string;
    cardId: string;
    chosenColor?: CardColor;
}

export interface DrawCardRequest {
    playerId: string;
}

export interface SayTresRequest {
    playerId: string;
}

// Pusher Events
export type PusherEventType =
    | 'player-joined'
    | 'player-left'
    | 'player-ready'
    | 'game-started'
    | 'game-updated'
    | 'card-played'
    | 'card-drawn'
    | 'tres-called'
    | 'game-ended';

export interface PusherEvent {
    type: PusherEventType;
    data: Record<string, unknown>;
    timestamp: number;
}

// Client-side game state (what each player sees)
export interface ClientGameState {
    id: string;
    status: GameStatus;
    players: ClientPlayer[];
    currentPlayerIndex: number;
    direction: GameDirection;
    myHand: Card[];
    topCard: Card;
    currentColor: CardColor;
    drawPileCount: number;
    winnerId: string | null;
    lastAction: GameAction | null;
    isMyTurn: boolean;
    turnStartedAt: number; // Timestamp when current turn started
    turnDuration: number; // Turn duration in seconds
}

export interface ClientPlayer {
    id: string;
    name: string;
    cardCount: number;
    isHost: boolean;
    isConnected: boolean;
    hasSaidTres: boolean;
}
