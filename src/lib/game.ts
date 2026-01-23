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
    TRES_GRACE_PERIOD_MS,
    GameSettings,
    PublicGameState
} from './types';
import { createDeck, shuffleDeck, canPlayCard, isWildCard } from './cards';

export const DEFAULT_SETTINGS: GameSettings = {
    tresRuleset: false,
    swapOnZero: false,
    swapOnSeven: false,
    jumpInRule: false,
    drawUntilPlay: false,
    forcedMatch: false,
};

// Generate a random lobby code (6 characters)
export function generateLobbyCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Generate a player ID (Public)
export function generatePlayerId(): string {
    return 'p_' + Math.random().toString(36).substring(2, 8);
}

// Generate a secret token (Secure)
export function generateToken(): string {
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

// Create a new lobby
export function createLobby(hostName: string): { lobby: Lobby; hostId: string; hostToken: string } {
    const hostId = generatePlayerId();
    const hostToken = generateToken();
    const lobby: Lobby = {
        code: generateLobbyCode(),
        hostId,
        players: [
            {
                id: hostId,
                token: hostToken,
                name: hostName,
                isHost: true,
                isReady: true,
                joinedAt: Date.now(),
            },
        ],
        createdAt: Date.now(),
        maxPlayers: 100,
        settings: { ...DEFAULT_SETTINGS },
    };
    return { lobby, hostId, hostToken };
}

// Add a player to a lobby
export function addPlayerToLobby(lobby: Lobby, playerName: string): { lobby: Lobby; playerId: string; playerToken: string } | null {
    if (lobby.players.length >= lobby.maxPlayers) {
        return null; // Lobby is full
    }

    const playerId = generatePlayerId();
    const playerToken = generateToken();
    const newPlayer: LobbyPlayer = {
        id: playerId,
        token: playerToken,
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
        playerToken,
    };
}

// Initialize a new game from a lobby
export function initializeGame(lobby: Lobby): GameState {
    const playerCount = lobby.players.length;
    const numDecks = Math.max(1, Math.ceil(playerCount / 5));

    const deck = shuffleDeck(createDeck(numDecks));

    // Create players from lobby
    const players: Player[] = lobby.players.map((lp) => ({
        id: lp.id,
        token: lp.token,
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

    // Ensure we don't start with a 0 or 7 if those rules are active (to keep it simple)
    // Actually, following standard Uno, we can just let it be, but Rule 0/7 usually only trigger on PLAY.

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
        settings: { ...lobby.settings },
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

/**
 * Update a player's hand and manage their Tres status.
 * Resets Tres status if they go above the threshold.
 * Sets a grace period if they enter the threshold.
 */
function updatePlayerHand(
    players: Player[],
    playerId: string,
    newHand: Card[],
    settings: GameSettings
): Player[] {
    const threshold = settings.tresRuleset ? 3 : 1;
    return players.map((p) => {
        if (p.id !== playerId) return p;

        const enteringDangerZone = p.hand.length > threshold && newHand.length <= threshold;
        const leavingDangerZone = newHand.length > threshold;

        return {
            ...p,
            hand: newHand,
            hasSaidTres: leavingDangerZone ? false : p.hasSaidTres,
            tresGraceExpiresAt: enteringDangerZone
                ? Date.now() + TRES_GRACE_PERIOD_MS
                : (leavingDangerZone ? null : p.tresGraceExpiresAt),
        };
    });
}

/**
 * Get the current player
 */
export function getCurrentPlayer(game: GameState): Player {
    return game.players[game.currentPlayerIndex];
}

/**
 * Calculate the turn duration in seconds based on the current player's hand size.
 */
export function calculateTurnDuration(game: GameState): number {
    const player = getCurrentPlayer(game);
    const handSize = player.hand.length;
    // Scale: 10s base for <= 10 cards, then +1s per card up to 30s.
    // User requested: "like 10 seconds, and if you have more than 10 cards it scales with each card up to 30 seconds"
    // "20 cards means 20 second timer, 5 cards means 5 seconds timer, 40 cards means 30 seconds timer"
    // So: duration = handSize, clamped between [min_requested?, 30]
    // If 5 cards means 5s, then it seems strictly handSize up to max 30.
    // If < 10 cards means 10s, that contradicts "5 cards means 5s".
    // I will use: Math.min(Math.max(handSize, 5), 30) or just Math.min(Math.max(handSize, 5), 30)
    // Wait, the prompt says: "Make the round timer shorter, like 10 seconds, and if you have more than 10 cards it scales with each card up to 30 seconds"
    // "E.g. 20 cards means 20 second timer, 5 cards means 5 seconds timer, 40 cards means 30 seconds timer"
    // This implies duration = handSize, capped at 30.
    let duration = Math.min(Math.max(handSize, 15), 35);

    // Add grace period (5s) if the last action was a mass hand redistribution
    const lastAction = game.lastAction;
    if (lastAction?.wasCommunism || lastAction?.wasRevolution || lastAction?.wasSwapAll) {
        duration += 5;
    }

    return duration;
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

        // Fresh deck fallback: If it's STILL insufficient (e.g., everyone has huge hands), inject a fresh deck
        if (drawPile.length < count) {
            const freshDeck = shuffleDeck(createDeck(1));
            drawPile = [...drawPile, ...freshDeck];
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

// Check if a player has any playable cards
export function hasPlayableCard(game: GameState, playerId: string): boolean {
    const player = game.players.find(p => p.id === playerId);
    if (!player) return false;

    const topCard = getTopCard(game);
    return player.hand.some(card => {
        // Normal move validation matches logic in playCards/validatePlay
        if (game.currentDrawStack > 0) {
            if (topCard.type === 'draw_two') return card.type === 'draw_two';
            if (topCard.type === 'wild_draw_four') return card.type === 'wild_draw_four';
            return false;
        }
        return canPlayCard(card, topCard, game.currentColor);
    });
}

// Helper to validate a play attempt
function validatePlay(
    game: GameState,
    playerId: string,
    cardsToPlay: Card[],
    chosenColor?: CardColor,
    swapTargetId?: string
): { success: boolean; error?: string } {
    if (cardsToPlay.length === 0) return { success: false, error: 'No cards selected' };

    const firstCard = cardsToPlay[0];
    const topCard = getTopCard(game);
    const currentPlayer = getCurrentPlayer(game);
    const isMyTurn = currentPlayer.id === playerId;

    // 1. Check Turn (Jump-in allowed)
    if (!isMyTurn) {
        if (!game.settings.jumpInRule) return { success: false, error: 'Not your turn' };

        // Jump-in: Exact match (color AND value/type)
        // Note: Wilds can't usually jump-in because they don't have a color in hand
        const topColor = topCard.color || game.currentColor;
        const isExactMatch =
            firstCard.type === topCard.type &&
            firstCard.color === topColor &&
            (firstCard.type !== 'number' || firstCard.value === topCard.value);

        if (!isExactMatch || cardsToPlay.length > 1) {
            return { success: false, error: 'Jump-in requires single exact match' };
        }
    }

    // 2. Handle Stacking Logic
    if (game.currentDrawStack > 0) {
        if (topCard.type === 'draw_two') {
            if (firstCard.type !== 'draw_two' || cardsToPlay.length > 1) {
                return { success: false, error: 'Must play a single +2 to stack' };
            }
        } else if (topCard.type === 'wild_draw_four') {
            if (firstCard.type !== 'wild_draw_four' || cardsToPlay.length > 1) {
                return { success: false, error: 'Must play a single +4 to stack' };
            }
        }
    }

    // 3. Handle Multi-Card Play Logic
    if (cardsToPlay.length > 1) {
        if (!cardsToPlay.every(c => c.type === 'number' && c.value === firstCard.value)) {
            return { success: false, error: 'Can only play multiple cards of the same number' };
        }
    }

    // 4. Validate first card is playable normally (if not stacking)
    if (game.currentDrawStack === 0 && isMyTurn) { // normal match check
        if (!canPlayCard(firstCard, topCard, game.currentColor)) {
            return { success: false, error: 'First card is not playable' };
        }
    }

    // For wild cards, require a color choice
    if (isWildCard(firstCard) && !chosenColor) {
        return { success: false, error: 'Must choose a color for wild card' };
    }

    // 5. Tres Ruleset Finish Validation
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const cardPoolLength = player.hand.length - cardsToPlay.length;
    if (game.settings.tresRuleset && cardPoolLength === 0) {
        if (cardsToPlay.length < 3) {
            return { success: false, error: 'Tres ruleset: Must play at least 3 cards to win' };
        }
    }

    // 6. Rule 7 Validation
    if (game.settings.swapOnSeven && firstCard.type === 'number' && firstCard.value === 7) {
        if (!swapTargetId) {
            return { success: false, error: 'Must select a player to swap hands with' };
        }
        if (swapTargetId === playerId) {
            return { success: false, error: 'Cannot swap hands with yourself' };
        }
        const target = game.players.find(p => p.id === swapTargetId);
        if (!target) {
            return { success: false, error: 'Target player not found' };
        }
        if (target.rank) {
            return { success: false, error: 'Cannot trade with a player who has already finished' };
        }
    }

    return { success: true };
}

// Play one or more cards
export function playCards(
    game: GameState,
    playerId: string,
    cardIds: string[],
    chosenColor?: CardColor,
    swapTargetId?: string
): { success: boolean; game: GameState; error?: string } {
    // Find all cards in player's hand
    const player = game.players.find(p => p.id === playerId);
    if (!player) return { success: false, game, error: 'Player not found' };

    const cardsToPlay: Card[] = [];
    const playerHand = [...player.hand];

    for (const cardId of cardIds) {
        const index = playerHand.findIndex(c => c.id === cardId);
        if (index === -1) {
            return { success: false, game, error: 'Card not in hand' };
        }
        cardsToPlay.push(playerHand[index]);
        playerHand.splice(index, 1);
    }

    // Validate play
    const validation = validatePlay(game, playerId, cardsToPlay, chosenColor, swapTargetId);
    if (!validation.success) {
        return { success: false, game, error: validation.error };
    }

    const firstCard = cardsToPlay[0];
    const topCard = getTopCard(game);
    const playerIndex = game.players.findIndex(p => p.id === playerId);
    const isJumpIn = game.currentPlayerIndex !== playerIndex;

    // Remove cards from player's hand and handle Tres grace period
    let updatedPlayers = updatePlayerHand(game.players, playerId, playerHand, game.settings);

    // Reset timeout counter on successful action
    updatedPlayers = updatedPlayers.map(p =>
        p.id === playerId ? { ...p, consecutiveTimeouts: 0 } : p
    );

    // Add cards to discard pile
    const newDiscardPile = [...game.discardPile, ...cardsToPlay];
    const lastCard = cardsToPlay[cardsToPlay.length - 1];
    const newColor = isWildCard(lastCard) ? chosenColor! : lastCard.color!;

    // Accumulate draw stack
    let newDrawStack = game.currentDrawStack;
    for (const card of cardsToPlay) {
        if (card.type === 'draw_two') newDrawStack += 2;
        if (card.type === 'wild_draw_four') newDrawStack += 4;
    }

    // Handle Rule 0 (Swap All)
    let finalPlayers = [...updatedPlayers];
    let wasSwapAll = false;
    const isWinning = playerHand.length === 0;

    if (!isWinning && game.settings.swapOnZero && firstCard.type === 'number' && firstCard.value === 0) {
        // Only rotate among ACTIVE players
        const activeIndices = finalPlayers
            .map((p, i) => (!p.rank ? i : -1))
            .filter(i => i !== -1);

        if (activeIndices.length > 1) {
            wasSwapAll = true;
            const activeHands = activeIndices.map(i => finalPlayers[i].hand);
            const step = game.direction === 'clockwise' ? 1 : -1;

            activeIndices.forEach((targetIdx, i) => {
                const sourceIdxInActive = (i - step + activeIndices.length) % activeIndices.length;
                finalPlayers[targetIdx] = {
                    ...finalPlayers[targetIdx],
                    hand: activeHands[sourceIdxInActive]
                };
            });
        }
    }

    // Handle Rule 7 (Trade Hands)
    if (!isWinning && game.settings.swapOnSeven && firstCard.type === 'number' && firstCard.value === 7 && swapTargetId) {
        const pIdx = finalPlayers.findIndex(p => p.id === playerId);
        const tIdx = finalPlayers.findIndex(p => p.id === swapTargetId);

        if (pIdx !== -1 && tIdx !== -1 && !finalPlayers[tIdx].rank) {
            const pHand = [...finalPlayers[pIdx].hand];
            const tHand = [...finalPlayers[tIdx].hand];

            finalPlayers[pIdx] = { ...finalPlayers[pIdx], hand: tHand };
            finalPlayers[tIdx] = { ...finalPlayers[tIdx], hand: pHand };
        }
    }

    // Handle Communism / Revolution
    let wasCommunism = false;
    let wasRevolution = false;

    if (!isWinning && (firstCard.type === 'communism' || firstCard.type === 'revolution')) {
        const activeIndices = finalPlayers
            .map((p, i) => (!p.rank ? i : -1))
            .filter(i => i !== -1);

        if (activeIndices.length > 1) {
            let allCards = activeIndices.flatMap(i => finalPlayers[i].hand);
            allCards = shuffleDeck(allCards); // Shuffle collected cards

            if (firstCard.type === 'communism') {
                wasCommunism = true;
                const newHands: Card[][] = activeIndices.map(() => []);
                allCards.forEach((card, i) => {
                    newHands[i % activeIndices.length].push(card);
                });

                activeIndices.forEach((idx, i) => {
                    finalPlayers = updatePlayerHand(finalPlayers, finalPlayers[idx].id, newHands[i], game.settings);
                });
            } else if (firstCard.type === 'revolution') {
                wasRevolution = true;
                // Sort players by hand size (ascending)
                const playerStats = activeIndices.map(idx => ({
                    idx,
                    count: finalPlayers[idx].hand.length
                })).sort((a, b) => a.count - b.count);

                const originalHands = playerStats.map(s => finalPlayers[s.idx].hand);
                const reversedHands = [...originalHands].reverse();

                playerStats.forEach((stat, i) => {
                    finalPlayers = updatePlayerHand(finalPlayers, finalPlayers[stat.idx].id, reversedHands[i], game.settings);
                });
            }
        }
    }

    // Apply card effects
    let newGame: GameState = {
        ...game,
        players: finalPlayers,
        discardPile: newDiscardPile,
        currentColor: newColor,
        currentDrawStack: newDrawStack,
        cardsDrawnThisTurn: 0,
        currentPlayerIndex: isJumpIn ? playerIndex : game.currentPlayerIndex, // update turn to Jump-in player
    };

    const action: GameAction = {
        type: 'play_card',
        playerId,
        cardIds,
        chosenColor,
        swapTargetId,
        wasSwapAll,
        wasJumpIn: isJumpIn,
        wasCommunism,
        wasRevolution,
        timestamp: Date.now(),
    };

    newGame = recordAction(newGame, action);

    // Winner check
    if (playerHand.length === 0) {
        if (!newGame.podium.includes(playerId)) {
            newGame.podium.push(playerId);
            const rank = newGame.podium.length;
            newGame.players[playerIndex].rank = rank;
            if (rank === 1) newGame.winnerId = playerId;
        }

        const shouldEnd =
            newGame.players.length <= 2 ? newGame.podium.length >= 1 :
                newGame.players.length === 3 ? newGame.podium.length >= 2 :
                    newGame.podium.length >= 3;

        if (shouldEnd) {
            newGame.status = 'finished';
            return { success: true, game: newGame };
        }
    }

    // Special effects
    switch (lastCard.type) {
        case 'skip':
            newGame.currentPlayerIndex = getNextPlayerIndex(newGame, 1);
            break;
        case 'reverse':
            newGame.direction = newGame.direction === 'clockwise' ? 'counter_clockwise' : 'clockwise';
            newGame.currentPlayerIndex = (newGame.players.length === 2 || isJumpIn) ? getNextPlayerIndex(newGame, 1) : getNextPlayerIndex(newGame);
            // If jump-in and reverse, it's a bit tricky. Usually jump-in just steals the turn and then play continues.
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
    chosenColor?: CardColor,
    swapTargetId?: string
): { success: boolean; game: GameState; error?: string } {
    return playCards(game, playerId, [cardId], chosenColor, swapTargetId);
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

        const updatedPlayers = updatePlayerHand(stateAfterDraw.players, playerId, [...currentPlayer.hand, ...accumulatedDrawnCards], game.settings)
            .map(p => p.id === playerId ? { ...p, consecutiveTimeouts: 0 } : p);

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

    // 2. Forced Match: Cannot draw if you have a playable card
    if (game.settings.forcedMatch && hasPlayableCard(game, playerId)) {
        return { success: false, game, error: 'Forced Match: You must play a card since you have one' };
    }

    // 3. Draw Until Play
    if (game.settings.drawUntilPlay) {
        const drawnCards: Card[] = [];
        let currentState = game;
        let foundPlayable = false;
        const player = game.players.find(p => p.id === playerId)!; // Player must exist

        while (!foundPlayable) {
            const { cards, game: nextState } = drawCards(currentState, 1);
            if (cards.length === 0) break; // Deck empty

            const card = cards[0];
            drawnCards.push(card);
            currentState = nextState;

            // Update player hand in temporary state for canPlayCard check
            const tempPlayers = currentState.players.map(p =>
                p.id === playerId ? { ...p, hand: [...p.hand, card] } : p
            );
            const tempState = { ...currentState, players: tempPlayers };

            if (canPlayCard(card, getTopCard(tempState), tempState.currentColor)) {
                foundPlayable = true;
            }
        }

        const updatedPlayers = updatePlayerHand(currentState.players, playerId, [...player.hand, ...drawnCards], game.settings)
            .map(p => p.id === playerId ? { ...p, consecutiveTimeouts: 0 } : p);

        const newGame: GameState = {
            ...currentState,
            players: updatedPlayers,
            cardsDrawnThisTurn: 0,
            // In Draw Until Play, usually drawing ends your turn unless you want to play what you just drew?
            // Standard Uno rules vary. Lets assume for now it stays your turn so you can play it.
            turnStartedAt: Date.now(),
        };

        const action: GameAction = {
            type: 'draw_card',
            playerId,
            cardCount: drawnCards.length,
            timestamp: Date.now(),
        };

        return { success: true, game: recordAction(newGame, action), drawnCards };
    }

    // 4. Normal draw (draw 1 card, up to 3 times)
    if (game.cardsDrawnThisTurn >= 3) {
        return { success: false, game, error: 'Already drawn 3 cards this turn' };
    }

    const { cards: drawnCards, game: stateAfterDraw } = drawCards(game, 1);
    if (drawnCards.length === 0) {
        return { success: false, game, error: 'No cards left in draw pile' };
    }

    const drawnCard = drawnCards[0];
    const newCardsDrawnCount = game.cardsDrawnThisTurn + 1;

    const updatedPlayers = updatePlayerHand(stateAfterDraw.players, playerId, [...currentPlayer.hand, drawnCard], game.settings)
        .map(p => p.id === playerId ? { ...p, consecutiveTimeouts: 0 } : p);

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

    const targetCount = game.settings.tresRuleset ? 3 : 1;
    if (player.hand.length > targetCount) {
        return { success: false, game, error: `Can only say TRES with ${targetCount} or fewer card(s)` };
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

    const targetCount = game.settings.tresRuleset ? 3 : 1;
    const now = Date.now();
    const isGraceActive = target.tresGraceExpiresAt && now < target.tresGraceExpiresAt;

    if (target.hand.length > targetCount || target.hasSaidTres || isGraceActive) {
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
        playerId: player.id,
        playerToken: player.token,
        players: clientPlayers,
        currentPlayerIndex: game.currentPlayerIndex,
        direction: game.direction,
        myHand: player.hand,
        topCard: getTopCard(game),
        currentColor: game.currentColor,
        drawPileCount: game.drawPile.length,
        winnerId: game.winnerId,
        lastAction: game.lastAction,
        isMyTurn: playerIndex === game.currentPlayerIndex,
        turnStartedAt: game.turnStartedAt,
        turnDuration: calculateTurnDuration(game),
        currentDrawStack: game.currentDrawStack,
        podium: game.podium,
        actionHistory: game.actionHistory,
        cardsDrawnThisTurn: game.cardsDrawnThisTurn,
        settings: game.settings,
    };
}

/**
 * Convert game state to a public version safe for broadcasting to all players.
 * This version hides all secret tokens and private hand data.
 */
export function getPublicGameState(game: GameState): PublicGameState {
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
        topCard: getTopCard(game),
        currentColor: game.currentColor,
        drawPileCount: game.drawPile.length,
        winnerId: game.winnerId,
        lastAction: game.lastAction,
        turnStartedAt: game.turnStartedAt,
        turnDuration: calculateTurnDuration(game),
        currentDrawStack: game.currentDrawStack,
        podium: game.podium,
        actionHistory: game.actionHistory,
        cardsDrawnThisTurn: game.cardsDrawnThisTurn,
        settings: game.settings,
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
    const handSize = currentPlayer.hand.length;
    // Penalty is half the hand size (min 2, max 5) + stack
    const basePenalty = Math.max(2, Math.min(5, Math.floor(handSize / 2)));
    const penaltyCount = basePenalty + game.currentDrawStack;

    // Draw penalty cards
    const { cards: drawnCards, game: afterDraw } = drawCards(game, penaltyCount);

    // Add cards to current player's hand and increment timeout counter
    let updatedPlayers = updatePlayerHand(afterDraw.players, currentPlayer.id, [...currentPlayer.hand, ...drawnCards], game.settings);

    // Increment consecutive timeout counter
    updatedPlayers = updatedPlayers.map(p => {
        if (p.id === currentPlayer.id) {
            const timeouts = (p.consecutiveTimeouts || 0) + 1;
            return { ...p, consecutiveTimeouts: timeouts };
        }
        return p;
    });

    // Check if player should be auto-kicked (4 consecutive timeouts)
    const currentPlayerAfterUpdate = updatedPlayers.find(p => p.id === currentPlayer.id);
    if (currentPlayerAfterUpdate && (currentPlayerAfterUpdate.consecutiveTimeouts || 0) >= 4) {
        // Auto-kick the player
        const kickResult = leaveGame({ ...afterDraw, players: updatedPlayers }, currentPlayer.id);
        if (kickResult) {
            const action: GameAction = {
                type: 'draw_card',
                playerId: currentPlayer.id,
                cardCount: penaltyCount,
                timestamp: Date.now(),
            };
            return { success: true, game: recordAction(kickResult, action) };
        }
    }

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
    return elapsed >= calculateTurnDuration(game);
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
