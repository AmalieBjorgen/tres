import {
    GameState,
    GameStatus,
    Player,
    Card,
    CardColor,
    GameDirection,
    GameAction,
    Lobby,
    LobbyPlayer,
    ClientGameState,
    ClientPlayer,
    TURN_DURATION_SECONDS
} from './types';
import { createDeck, shuffleDeck, canPlayCard, isWildCard } from './cards';

// Generate a random lobby code (6 characters)
export function generateLobbyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Generate a player ID
export function generatePlayerId(): string {
    return 'player_' + Math.random().toString(36).substring(2, 11);
}

// Create a new lobby
export function createLobby(hostName: string): { lobby: Lobby; hostId: string } {
    const hostId = generatePlayerId();
    const lobby: Lobby = {
        code: generateLobbyCode(),
        hostId,
        players: [
            {
                id: hostId,
                name: hostName,
                isHost: true,
                isReady: true,
                joinedAt: Date.now(),
            },
        ],
        createdAt: Date.now(),
        maxPlayers: 15,
    };
    return { lobby, hostId };
}

// Add a player to a lobby
export function addPlayerToLobby(lobby: Lobby, playerName: string): { lobby: Lobby; playerId: string } | null {
    if (lobby.players.length >= lobby.maxPlayers) {
        return null; // Lobby is full
    }

    const playerId = generatePlayerId();
    const newPlayer: LobbyPlayer = {
        id: playerId,
        name: playerName,
        isHost: false,
        isReady: false,
        joinedAt: Date.now(),
    };

    return {
        lobby: {
            ...lobby,
            players: [...lobby.players, newPlayer],
        },
        playerId,
    };
}

// Initialize a new game from a lobby
export function initializeGame(lobby: Lobby): GameState {
    const deck = shuffleDeck(createDeck());

    // Create players from lobby
    const players: Player[] = lobby.players.map((lp) => ({
        id: lp.id,
        name: lp.name,
        hand: [],
        isHost: lp.isHost,
        isConnected: true,
        hasSaidTres: false,
    }));

    // Deal 7 cards to each player
    const cardsPerPlayer = 7;
    let deckIndex = 0;

    for (const player of players) {
        player.hand = deck.slice(deckIndex, deckIndex + cardsPerPlayer);
        deckIndex += cardsPerPlayer;
    }

    // Set up draw pile (remaining cards)
    let drawPile = deck.slice(deckIndex);

    // Find a valid starting card (must be a number card)
    let startingCardIndex = drawPile.findIndex(
        (card) => card.type === 'number'
    );

    if (startingCardIndex === -1) {
        startingCardIndex = 0; // Fallback, shouldn't happen
    }

    const startingCard = drawPile[startingCardIndex];
    drawPile = [
        ...drawPile.slice(0, startingCardIndex),
        ...drawPile.slice(startingCardIndex + 1),
    ];

    // Randomly select starting player
    const startingPlayerIndex = Math.floor(Math.random() * players.length);

    const gameState: GameState = {
        id: lobby.code,
        status: 'playing',
        players,
        currentPlayerIndex: startingPlayerIndex,
        direction: 'clockwise',
        drawPile,
        discardPile: [startingCard],
        currentColor: startingCard.color!,
        winnerId: null,
        lastAction: null,
        createdAt: Date.now(),
        turnStartedAt: Date.now(),
    };

    return gameState;
}

// Get the current player
export function getCurrentPlayer(game: GameState): Player {
    return game.players[game.currentPlayerIndex];
}

// Get top card of discard pile
export function getTopCard(game: GameState): Card {
    return game.discardPile[game.discardPile.length - 1];
}

// Move to next player
export function getNextPlayerIndex(game: GameState, skip: number = 0): number {
    const playerCount = game.players.length;
    const increment = game.direction === 'clockwise' ? 1 : -1;
    let nextIndex = game.currentPlayerIndex + increment * (1 + skip);

    // Handle wrapping
    nextIndex = ((nextIndex % playerCount) + playerCount) % playerCount;

    return nextIndex;
}

// Draw cards from draw pile
export function drawCards(game: GameState, count: number): { cards: Card[]; game: GameState } {
    let { drawPile, discardPile } = game;

    // If draw pile is empty, shuffle discard pile (except top card)
    if (drawPile.length < count) {
        const topCard = discardPile[discardPile.length - 1];
        const cardsToShuffle = discardPile.slice(0, -1);
        drawPile = [...drawPile, ...shuffleDeck(cardsToShuffle)];
        discardPile = [topCard];
    }

    const drawnCards = drawPile.slice(0, count);
    const remainingDraw = drawPile.slice(count);

    return {
        cards: drawnCards,
        game: {
            ...game,
            drawPile: remainingDraw,
            discardPile,
        },
    };
}

// Play a card
export function playCard(
    game: GameState,
    playerId: string,
    cardId: string,
    chosenColor?: CardColor
): { success: boolean; game: GameState; error?: string } {
    // Validate it's the player's turn
    const currentPlayer = getCurrentPlayer(game);
    if (currentPlayer.id !== playerId) {
        return { success: false, game, error: 'Not your turn' };
    }

    // Find the card in player's hand
    const cardIndex = currentPlayer.hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
        return { success: false, game, error: 'Card not in hand' };
    }

    const card = currentPlayer.hand[cardIndex];
    const topCard = getTopCard(game);

    // Validate the card can be played
    if (!canPlayCard(card, topCard, game.currentColor)) {
        return { success: false, game, error: 'Cannot play this card' };
    }

    // For wild cards, require a color choice
    if (isWildCard(card) && !chosenColor) {
        return { success: false, game, error: 'Must choose a color for wild card' };
    }

    // Remove card from player's hand
    const newHand = [...currentPlayer.hand];
    newHand.splice(cardIndex, 1);

    const updatedPlayers = game.players.map((p) =>
        p.id === playerId ? { ...p, hand: newHand, hasSaidTres: false } : p
    );

    // Add card to discard pile
    const newDiscardPile = [...game.discardPile, card];

    // Determine new color
    const newColor = isWildCard(card) ? chosenColor! : card.color!;

    // Apply card effects
    let newGame: GameState = {
        ...game,
        players: updatedPlayers,
        discardPile: newDiscardPile,
        currentColor: newColor,
        lastAction: {
            type: 'play_card',
            playerId,
            cardId,
            chosenColor,
            timestamp: Date.now(),
        },
    };

    // Check for win
    if (newHand.length === 0) {
        newGame.status = 'finished';
        newGame.winnerId = playerId;
        return { success: true, game: newGame };
    }

    // Handle special card effects
    switch (card.type) {
        case 'skip':
            // Skip next player
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            break;

        case 'reverse':
            // Reverse direction
            newGame.direction = newGame.direction === 'clockwise' ? 'counter_clockwise' : 'clockwise';
            // In 2-player game, reverse acts like skip
            if (newGame.players.length === 2) {
                newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            } else {
                newGame.currentPlayerIndex = getNextPlayerIndex(newGame);
            }
            break;

        case 'draw_two': {
            // Next player draws 2 and loses turn
            const nextIndex = getNextPlayerIndex(newGame);
            const { cards: drawnCards, game: afterDraw } = drawCards(newGame, 2);
            newGame = afterDraw;
            newGame.players = newGame.players.map((p, i) =>
                i === nextIndex ? { ...p, hand: [...p.hand, ...drawnCards] } : p
            );
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            break;
        }

        case 'wild_draw_four': {
            // Next player draws 4 and loses turn
            const nextIndex = getNextPlayerIndex(newGame);
            const { cards: drawnCards, game: afterDraw } = drawCards(newGame, 4);
            newGame = afterDraw;
            newGame.players = newGame.players.map((p, i) =>
                i === nextIndex ? { ...p, hand: [...p.hand, ...drawnCards] } : p
            );
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            break;
        }

        default:
            // Normal move to next player
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame);
    }

    // Reset turn timer for next player
    newGame.turnStartedAt = Date.now();

    return { success: true, game: newGame };
}

// Draw cards (when player can't play)
export function drawCardAction(
    game: GameState,
    playerId: string
): { success: boolean; game: GameState; drawnCards?: Card[]; error?: string } {
    const currentPlayer = getCurrentPlayer(game);
    if (currentPlayer.id !== playerId) {
        return { success: false, game, error: 'Not your turn' };
    }

    const topCard = getTopCard(game);
    const { currentColor } = game;

    let currentGameState = game;
    const accumulatedDrawnCards: Card[] = [];

    // Draw up to 3 cards or until a playable one is found
    for (let i = 0; i < 3; i++) {
        const { cards, game: stateAfterDraw } = drawCards(currentGameState, 1);
        if (cards.length === 0) break;

        const drawnCard = cards[0];
        accumulatedDrawnCards.push(drawnCard);
        currentGameState = stateAfterDraw;

        // If the card is playable, we stop drawing
        if (canPlayCard(drawnCard, topCard, currentColor)) {
            break;
        }
    }

    if (accumulatedDrawnCards.length === 0) {
        return { success: false, game, error: 'No cards to draw' };
    }

    // Add cards to player's hand
    const updatedPlayers = currentGameState.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, ...accumulatedDrawnCards], hasSaidTres: false } : p
    );

    // Move to next player and reset turn timer
    const newGame: GameState = {
        ...currentGameState,
        players: updatedPlayers,
        currentPlayerIndex: getNextPlayerIndex(currentGameState),
        turnStartedAt: Date.now(),
        lastAction: {
            type: 'draw_card',
            playerId,
            cardCount: accumulatedDrawnCards.length,
            timestamp: Date.now(),
        },
    };

    return { success: true, game: newGame, drawnCards: accumulatedDrawnCards };
}

// Say "TRES!" when down to one card
export function sayTres(
    game: GameState,
    playerId: string
): { success: boolean; game: GameState; error?: string } {
    const player = game.players.find((p) => p.id === playerId);
    if (!player) {
        return { success: false, game, error: 'Player not found' };
    }

    if (player.hand.length !== 1) {
        return { success: false, game, error: 'Can only say TRES with one card' };
    }

    const updatedPlayers = game.players.map((p) =>
        p.id === playerId ? { ...p, hasSaidTres: true } : p
    );

    return {
        success: true,
        game: {
            ...game,
            players: updatedPlayers,
            lastAction: {
                type: 'say_tres',
                playerId,
                timestamp: Date.now(),
            },
        },
    };
}

// Challenge a player who didn't say TRES (they draw 2 cards)
export function challengeTres(
    game: GameState,
    challengerId: string,
    targetId: string
): { success: boolean; game: GameState; error?: string } {
    const target = game.players.find((p) => p.id === targetId);
    if (!target) {
        return { success: false, game, error: 'Target player not found' };
    }

    if (target.hand.length !== 1 || target.hasSaidTres) {
        return { success: false, game, error: 'Invalid challenge' };
    }

    // Target draws 2 cards as penalty
    const { cards: drawnCards, game: afterDraw } = drawCards(game, 2);

    const updatedPlayers = afterDraw.players.map((p) =>
        p.id === targetId ? { ...p, hand: [...p.hand, ...drawnCards] } : p
    );

    return {
        success: true,
        game: {
            ...afterDraw,
            players: updatedPlayers,
            lastAction: {
                type: 'challenge_tres',
                playerId: challengerId,
                timestamp: Date.now(),
            },
        },
    };
}

// Convert game state to client-visible state (hide other players' cards)
export function getClientGameState(game: GameState, playerId: string): ClientGameState {
    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    const player = game.players[playerIndex];

    const clientPlayers: ClientPlayer[] = game.players.map((p) => ({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        isHost: p.isHost,
        isConnected: p.isConnected,
        hasSaidTres: p.hasSaidTres,
    }));

    return {
        id: game.id,
        status: game.status,
        players: clientPlayers,
        currentPlayerIndex: game.currentPlayerIndex,
        direction: game.direction,
        myHand: player?.hand ?? [],
        topCard: getTopCard(game),
        currentColor: game.currentColor,
        drawPileCount: game.drawPile.length,
        winnerId: game.winnerId,
        lastAction: game.lastAction,
        isMyTurn: game.currentPlayerIndex === playerIndex,
        turnStartedAt: game.turnStartedAt,
        turnDuration: TURN_DURATION_SECONDS,
    };
}

// Handle turn timeout - player draws 5 cards and loses turn
export function handleTurnTimeout(
    game: GameState
): { success: boolean; game: GameState; error?: string } {
    if (game.status !== 'playing') {
        return { success: false, game, error: 'Game is not active' };
    }

    const currentPlayer = getCurrentPlayer(game);

    // Draw 5 cards as penalty
    const { cards: drawnCards, game: afterDraw } = drawCards(game, 5);

    // Add cards to current player's hand
    const updatedPlayers = afterDraw.players.map((p) =>
        p.id === currentPlayer.id
            ? { ...p, hand: [...p.hand, ...drawnCards], hasSaidTres: false }
            : p
    );

    // Move to next player and reset turn timer
    const newGame: GameState = {
        ...afterDraw,
        players: updatedPlayers,
        currentPlayerIndex: getNextPlayerIndex(afterDraw),
        turnStartedAt: Date.now(),
        lastAction: {
            type: 'draw_card',
            playerId: currentPlayer.id,
            cardCount: 5,
            timestamp: Date.now(),
        },
    };

    return { success: true, game: newGame };
}

// Check if current turn has timed out
export function isTurnTimedOut(game: GameState): boolean {
    if (game.status !== 'playing') return false;
    const elapsed = (Date.now() - game.turnStartedAt) / 1000;
    return elapsed >= TURN_DURATION_SECONDS;
}
