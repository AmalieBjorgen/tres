import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { leaveGame, getPublicGameState } from '@/lib/game';
import { broadcastToGame } from '@/lib/pusher';

// POST /api/game/[code]/leave - Leave a game
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { playerId, playerToken } = body;

        const game = await gameStore.getGame(code);

        if (!game) {
            return NextResponse.json(
                { error: 'Game not found' },
                { status: 404 }
            );
        }

        // Validate player token
        const player = game.players.find(p => p.id === playerId);
        if (!player || player.token !== playerToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }
        const updatedGame = leaveGame(game, playerId);

        if (!updatedGame) {
            await gameStore.deleteGame(code);
            return NextResponse.json({ success: true, dissolved: true });
        }

        await gameStore.setGame(updatedGame);

        // Broadcast game update (with public state)
        const publicState = getPublicGameState(updatedGame);
        await broadcastToGame(code, 'game-updated', {
            action: 'leave',
            playerId,
            timestamp: Date.now(),
            game: publicState,
        });

        return NextResponse.json({
            success: true,
            game: updatedGame,
        });
    } catch (error) {
        console.error('Error leaving game:', error);
        return NextResponse.json(
            { error: 'Failed to leave game' },
            { status: 500 }
        );
    }
}
