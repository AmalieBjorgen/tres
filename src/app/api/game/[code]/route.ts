import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { getClientGameState, playCard, drawCardAction, sayTres, challengeTres, handleTurnTimeout, isTurnTimedOut } from '@/lib/game';
import { broadcastToGame } from '@/lib/pusher';
import { CardColor } from '@/lib/types';

// GET /api/game/[code] - Get game state
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const playerId = request.nextUrl.searchParams.get('playerId');

        if (!playerId) {
            return NextResponse.json(
                { error: 'Player ID is required' },
                { status: 400 }
            );
        }

        const game = await gameStore.getGame(code);

        if (!game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            );
        }

        let currentGame = game;

        // Check if current turn has timed out and handle it
        if (isTurnTimedOut(currentGame)) {
            const timeoutResult = handleTurnTimeout(currentGame);
            if (timeoutResult.success) {
                currentGame = timeoutResult.game;
                await gameStore.setGame(currentGame);
                // Broadcast the timeout
                await broadcastToGame(code, 'game-updated', {
                    action: 'timeout',
                    playerId: currentGame.players[currentGame.currentPlayerIndex]?.id,
                    timestamp: Date.now(),
                });
            }
        }

        // Return client-safe game state (hides other players' cards)
        const clientState = getClientGameState(currentGame, playerId);

        return NextResponse.json({ game: clientState });
    } catch (error) {
        console.error('Error getting game:', error);
        return NextResponse.json(
            { error: 'Failed to get game' },
            { status: 500 }
        );
    }
}

// POST /api/game/[code] - Game action (play card, draw card, etc.)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { action, playerId, cardId, chosenColor, targetId } = body;

        const game = await gameStore.getGame(code);

        if (!game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            );
        }

        if (game.status !== 'playing') {
            return NextResponse.json(
                { error: 'Game is not active' },
                { status: 400 }
            );
        }

        let currentGame = game;

        // Check if current turn has timed out first
        if (isTurnTimedOut(currentGame)) {
            const timeoutResult = handleTurnTimeout(currentGame);
            if (timeoutResult.success) {
                currentGame = timeoutResult.game;
                await gameStore.setGame(currentGame);
                await broadcastToGame(code, 'game-updated', {
                    action: 'timeout',
                    timestamp: Date.now(),
                });
            }
        }

        let result: { success: boolean; game: typeof currentGame; error?: string; drawnCards?: unknown };

        switch (action) {
            case 'play_card':
                result = playCard(currentGame, playerId, cardId, chosenColor as CardColor);
                break;

            case 'draw_card':
                result = drawCardAction(currentGame, playerId);
                break;

            case 'say_tres':
                result = sayTres(currentGame, playerId);
                break;

            case 'challenge_tres':
                result = challengeTres(currentGame, playerId, targetId);
                break;

            case 'force_timeout':
                // Allow any player to trigger timeout check
                if (isTurnTimedOut(currentGame)) {
                    result = handleTurnTimeout(currentGame);
                } else {
                    result = { success: false, game: currentGame, error: 'Turn has not timed out' };
                }
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid action' },
                    { status: 400 }
                );
        }

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // Save updated game state
        await gameStore.setGame(result.game);

        // Broadcast game update to all players
        await broadcastToGame(code, 'game-updated', {
            action,
            playerId,
            timestamp: Date.now(),
        });

        // Return updated state for the requesting player
        const clientState = getClientGameState(result.game, playerId);

        return NextResponse.json({
            success: true,
            game: clientState,
        });
    } catch (error) {
        console.error('Error processing game action:', error);
        return NextResponse.json(
            { error: 'Failed to process action' },
            { status: 500 }
        );
    }
}
