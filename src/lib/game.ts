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
    TURN_DURATION_SECONDS,
    TRES_GRACE_PERIOD_MS
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
    const playerCount = lobby.players.length;
    let numDecks = 1;

    if (playerCount > 10) {
        numDecks = 3;
    } else if (playerCount > 6) {
        numDecks = 2;
    }

    const deck = shuffleDeck(createDeck(numDecks));

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
        currentDrawStack: 0,
        podium: [],
        actionHistory: [],
        cardsDrawnThisTurn: 0,
    };

    return gameState;
}

/**
 * Adds an action to the game history and keeps it within limits
 */
function recordAction(game: GameState, action: GameAction): GameState {
    const actionHistory = [action, ...(game.actionHistory || [])].slice(0, 5);
    return {
        ...game,
        lastAction: action,
        actionHistory,
    };
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
    let nextIndex = game.currentPlayerIndex;

    let activePlayersToSkip = 1 + skip;
    let iterations = 0;

    while (activePlayersToSkip > 0 && iterations < playerCount) {
        nextIndex = ((nextIndex + increment) % playerCount + playerCount) % playerCount;
        const player = game.players[nextIndex];
        if (!player.rank && !game.podium.includes(player.id)) {
            activePlayersToSkip--;
        }
        iterations++;
    }

    return nextIndex;
}

// Draw cards from draw pile
export function drawCards(game: GameState, count: number): { cards: Card[]; game: GameState } {
    let { drawPile, discardPile } = game;

    // If draw pile doesn't have enough cards, reshuffle discard pile
    if (drawPile.length < count) {
        const topCard = discardPile[discardPile.length - 1];
        // Take all but the top card
        const cardsToShuffle = discardPile.slice(0, -1);

        if (cardsToShuffle.length > 0) {
            const shuffled = shuffleDeck(cardsToShuffle);
            drawPile = [...drawPile, ...shuffled];
            discardPile = [topCard];
        }
    }

    const actualDrawCount = Math.min(count, drawPile.length);
    const drawnCards = drawPile.slice(0, actualDrawCount);
    const remainingDraw = drawPile.slice(actualDrawCount);

    return {
        cards: drawnCards,
        game: {
            ...game,
            drawPile: remainingDraw,
            discardPile,
        },
    };
}

// Play one or more cards
export function playCards(
    game: GameState,
    playerId: string,
    cardIds: string[],
    chosenColor?: CardColor
): { success: boolean; game: GameState; error?: string } {
    if (cardIds.length === 0) {
        return { success: false, game, error: 'No cards selected' };
    }

    // Validate it's the player's turn
    const currentPlayer = getCurrentPlayer(game);
    if (currentPlayer.id !== playerId) {
        return { success: false, game, error: 'Not your turn' };
    }

    // Find all cards in player's hand
    const cardsToPlay: Card[] = [];
    const cardPool = [...currentPlayer.hand];

    for (const cardId of cardIds) {
        const index = cardPool.findIndex(c => c.id === cardId);
        if (index === -1) {
            return { success: false, game, error: 'Card not in hand' };
        }
        cardsToPlay.push(cardPool[index]);
        cardPool.splice(index, 1);
    }

    const firstCard = cardsToPlay[0];
    const topCard = getTopCard(game);

    // 1. Handle Stacking Logic
    if (game.currentDrawStack > 0) {
        // Must stack either +2 on +2 or +4 on +4
        if (topCard.type === 'draw_two') {
            if (firstCard.type !== 'draw_two' || cardsToPlay.length > 1) {
                return { success: false, game, error: 'Must play a single +2 to stack' };
            }
        } else if (topCard.type === 'wild_draw_four') {
            if (firstCard.type !== 'wild_draw_four' || cardsToPlay.length > 1) {
                return { success: false, game, error: 'Must play a single +4 to stack' };
            }
        }
    }

    // 2. Handle Multi-Card Play Logic
    if (cardsToPlay.length > 1) {
        // Can only multi-play numeric cards of same value
        if (!cardsToPlay.every(c => c.type === 'number' && c.value === firstCard.value)) {
            return { success: false, game, error: 'Can only play multiple cards of the same number' };
        }
    }

    // 3. Validate first card is playable normally (if not stacking)
    if (game.currentDrawStack === 0) {
        if (!canPlayCard(firstCard, topCard, game.currentColor)) {
            return { success: false, game, error: 'First card is not playable' };
        }
    }

    // For wild cards, require a color choice
    if (isWildCard(firstCard) && !chosenColor) {
        return { success: false, game, error: 'Must choose a color for wild card' };
    }

    // Remove cards from player's hand and handle Tres grace period
    const updatedPlayers = game.players.map((p) => {
        if (p.id === playerId) {
            const hasOneCard = cardPool.length === 1;
            return {
                ...p,
                hand: cardPool,
                hasSaidTres: false,
                tresGraceExpiresAt: hasOneCard ? Date.now() + TRES_GRACE_PERIOD_MS : null
            };
        }
        return p;
    });

    // Add cards to discard pile (in order played)
    const newDiscardPile = [...game.discardPile, ...cardsToPlay];

    // Determine new color from the LAST card played
    const lastCard = cardsToPlay[cardsToPlay.length - 1];
    const newColor = isWildCard(lastCard) ? chosenColor! : lastCard.color!;

    // Accumulate draw stack
    let newDrawStack = game.currentDrawStack;
    for (const card of cardsToPlay) {
        if (card.type === 'draw_two') newDrawStack += 2;
        if (card.type === 'wild_draw_four') newDrawStack += 4;
    }

    // Apply card effects
    let newGame: GameState = {
        ...game,
        players: updatedPlayers,
        discardPile: newDiscardPile,
        currentColor: newColor,
        currentDrawStack: newDrawStack,
        cardsDrawnThisTurn: 0, // Reset draw count on play
    };

    const action: GameAction = {
        type: 'play_card',
        playerId,
        cardIds,
        chosenColor,
        timestamp: Date.now(),
    };

    newGame = recordAction(newGame, action);

    // Check for win/finish
    if (cardPool.length === 0) {
        if (!newGame.podium.includes(playerId)) {
            newGame.podium.push(playerId);
            const rank = newGame.podium.length;
            newGame.players[game.currentPlayerIndex].rank = rank;
            if (rank === 1) newGame.winnerId = playerId;
        }

        // Check if game should end
        const initialPlayerCount = newGame.players.length;
        let shouldEnd = false;
        if (initialPlayerCount <= 2) {
            shouldEnd = newGame.podium.length >= 1;
        } else if (initialPlayerCount === 3) {
            shouldEnd = newGame.podium.length >= 2;
        } else {
            // 4 or more players: end when 3 players have finished
            shouldEnd = newGame.podium.length >= 3;
        }

        if (shouldEnd) {
            newGame.status = 'finished';
            return { success: true, game: newGame };
        }
    }

    // Handle special card effects (only of the LAST card played if multiple)
    switch (lastCard.type) {
        case 'skip':
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            break;

        case 'reverse':
            newGame.direction = newGame.direction === 'clockwise' ? 'counter_clockwise' : 'clockwise';
            if (newGame.players.length === 2) {
                newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            } else {
                newGame.currentPlayerIndex = getNextPlayerIndex(newGame);
            }
            break;

        case 'draw_two':
        case 'wild_draw_four':
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame);
            break;

        default:
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame);
    }

    newGame.turnStartedAt = Date.now();
    return { success: true, game: newGame };
}

// Keeping playCard for backward compatibility if needed, but routing to playCards
export function playCard(
    game: GameState,
    playerId: string,
    cardId: string,
    chosenColor?: CardColor
): { success: boolean; game: GameState; error?: string } {
    return playCards(game, playerId, [cardId], chosenColor);
}

// Draw cards (when player can't play or chooses to draw)
export function drawCardAction(
    game: GameState,
    playerId: string
): { success: boolean; game: GameState; drawnCards?: Card[]; error?: string } {
    const currentPlayer = getCurrentPlayer(game);
    if (currentPlayer.id !== playerId) {
        return { success: false, game, error: 'Not your turn' };
    }

    // 1. If there's a stacking penalty, the player MUST draw the stack
    if (game.currentDrawStack > 0) {
        const { cards, game: stateAfterDraw } = drawCards(game, game.currentDrawStack);
        const accumulatedDrawnCards = cards;

        const updatedPlayers = stateAfterDraw.players.map((p) =>
            p.id === playerId ? { ...p, hand: [...p.hand, ...accumulatedDrawnCards], hasSaidTres: false, tresGraceExpiresAt: null } : p
        );

        const newGame: GameState = {
            ...stateAfterDraw,
            players: updatedPlayers,
            currentDrawStack: 0, // Reset stack
            cardsDrawnThisTurn: 0, // Reset draw count
            currentPlayerIndex: getNextPlayerIndex(stateAfterDraw),
            turnStartedAt: Date.now(),
        };

        const action: GameAction = {
            type: 'draw_card',
            playerId,
            cardCount: accumulatedDrawnCards.length,
            timestamp: Date.now(),
        };

        return { success: true, game: recordAction(newGame, action), drawnCards: accumulatedDrawnCards };
    }

    // 2. Normal draw (draw 1 card, up to 3 times)
    if (game.cardsDrawnThisTurn >= 3) {
        return { success: false, game, error: 'Already drawn 3 cards this turn' };
    }

    const { cards: drawnCards, game: stateAfterDraw } = drawCards(game, 1);
    if (drawnCards.length === 0) {
        return { success: false, game, error: 'No cards left in draw pile' };
    }

    const drawnCard = drawnCards[0];
    const newCardsDrawnCount = game.cardsDrawnThisTurn + 1;

    const updatedPlayers = stateAfterDraw.players.map((p) =>
        p.id === playerId ? { ...p, hand: [...p.hand, drawnCard], hasSaidTres: false, tresGraceExpiresAt: null } : p
    );

    // If it was the 3rd draw, the turn is skipped automatically
    const shouldSkip = newCardsDrawnCount >= 3;

    const newGame: GameState = {
        ...stateAfterDraw,
        players: updatedPlayers,
        cardsDrawnThisTurn: shouldSkip ? 0 : newCardsDrawnCount,
        currentPlayerIndex: shouldSkip ? getNextPlayerIndex(stateAfterDraw) : game.currentPlayerIndex,
        turnStartedAt: shouldSkip ? Date.now() : game.turnStartedAt,
    };

    const action: GameAction = {
        type: 'draw_card',
        playerId,
        cardCount: 1,
        timestamp: Date.now(),
    };

    return { success: true, game: recordAction(newGame, action), drawnCards: [drawnCard] };
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
        p.id === playerId ? { ...p, hasSaidTres: true, tresGraceExpiresAt: null } : p
    );

    const action: GameAction = {
        type: 'say_tres',
        playerId,
        timestamp: Date.now(),
    };

    return {
        success: true,
        game: recordAction({ ...game, players: updatedPlayers }, action),
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

    const now = Date.now();
    const isGraceActive = target.tresGraceExpiresAt && now < target.tresGraceExpiresAt;

    if (target.hand.length !== 1 || target.hasSaidTres || isGraceActive) {
        return { success: false, game, error: isGraceActive ? 'Grace period active' : 'Invalid challenge' };
    }

    // Target draws 2 cards as penalty
    const { cards: drawnCards, game: afterDraw } = drawCards(game, 2);

    const updatedPlayers = afterDraw.players.map((p) =>
        p.id === targetId ? { ...p, hand: [...p.hand, ...drawnCards], tresGraceExpiresAt: null } : p
    );

    const action: GameAction = {
        type: 'challenge_tres',
        playerId: challengerId,
        timestamp: Date.now(),
    };

    return {
        success: true,
        game: recordAction({ ...afterDraw, players: updatedPlayers }, action),
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
        tresGraceExpiresAt: p.tresGraceExpiresAt,
        rank: p.rank,
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
        currentDrawStack: game.currentDrawStack,
        podium: game.podium,
        actionHistory: game.actionHistory || [],
        cardsDrawnThisTurn: game.cardsDrawnThisTurn,
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
    const penaltyCount = 5 + game.currentDrawStack;

    // Draw penalty cards
    const { cards: drawnCards, game: afterDraw } = drawCards(game, penaltyCount);

    // Add cards to current player's hand
    const updatedPlayers = afterDraw.players.map((p) =>
        p.id === currentPlayer.id
            ? { ...p, hand: [...p.hand, ...drawnCards], hasSaidTres: false, tresGraceExpiresAt: null }
            : p
    );

    // Move to next player, reset turn timer and draw tracking
    const newGameState: GameState = {
        ...afterDraw,
        players: updatedPlayers,
        currentPlayerIndex: getNextPlayerIndex(afterDraw),
        turnStartedAt: Date.now(),
        currentDrawStack: 0,
        cardsDrawnThisTurn: 0,
    };

    const action: GameAction = {
        type: 'draw_card',
        playerId: currentPlayer.id,
        cardCount: penaltyCount,
        timestamp: Date.now(),
    };

    return { success: true, game: recordAction(newGameState, action) };
}

// Check if current turn has timed out
export function isTurnTimedOut(game: GameState): boolean {
    if (game.status !== 'playing') return false;
    const elapsed = (Date.now() - game.turnStartedAt) / 1000;
    return elapsed >= TURN_DURATION_SECONDS;
}

// Remove player from lobby
export function leaveLobby(lobby: Lobby, playerId: string): Lobby | null {
    const updatedPlayers = lobby.players.filter((p) => p.id !== playerId);

    if (updatedPlayers.length === 0) {
        return null; // Signal to delete lobby
    }

    // If host left, assign new host
    let newHostId = lobby.hostId;
    if (lobby.hostId === playerId) {
        newHostId = updatedPlayers[0].id;
        const playersWithNewHost = updatedPlayers.map(p =>
            p.id === newHostId ? { ...p, isHost: true } : p
        );
        return {
            ...lobby,
            players: playersWithNewHost,
            hostId: newHostId,
        };
    }

    return {
        ...lobby,
        players: updatedPlayers,
    };
}

// Remove player from game
export function leaveGame(game: GameState, playerId: string): GameState | null {
    const playerIndex = game.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return game;

    const updatedPlayers = game.players.filter((p) => p.id !== playerId);

    if (updatedPlayers.length === 0) {
        return null; // Signal to delete game
    }

    let newCurrentPlayerIndex = game.currentPlayerIndex;
    let turnReset = false;

    // If it was the leaving player's turn
    if (game.currentPlayerIndex === playerIndex) {
        newCurrentPlayerIndex = game.currentPlayerIndex % updatedPlayers.length;
        turnReset = true;
    } else if (game.currentPlayerIndex > playerIndex) {
        newCurrentPlayerIndex = game.currentPlayerIndex - 1;
    }

    // Ensure there's a host
    const hasHost = updatedPlayers.some(p => p.isHost);
    const playersWithHost = hasHost ? updatedPlayers : updatedPlayers.map((p, i) =>
        i === 0 ? { ...p, isHost: true } : p
    );

    return {
        ...game,
        players: playersWithHost,
        currentPlayerIndex: newCurrentPlayerIndex,
        turnStartedAt: turnReset ? Date.now() : game.turnStartedAt,
        lastAction: {
            type: 'draw_card',
            playerId,
            timestamp: Date.now(),
        },
    };
}
