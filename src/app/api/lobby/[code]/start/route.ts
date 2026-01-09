import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { initializeGame } from '@/lib/game';
import { broadcastToLobby, broadcastToGame } from '@/lib/pusher';

// POST /api/lobby/[code]/start - Start the game (host only)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { playerId, playerToken } = body;

        const lobby = await gameStore.getLobby(code);

        if (!lobby) {
            return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
        }

        // Verify player is the host and has valid token
        const host = lobby.players.find(p => p.id === lobby.hostId);
        if (lobby.hostId !== playerId || !host || host.token !== playerToken) {
            return NextResponse.json(
                { error: 'Only the host can start the game' },
                { status: 403 }
            );
        }

        // Need at least 2 players
        if (lobby.players.length < 2) {
            return NextResponse.json(
                { error: 'Need at least 2 players to start' },
                { status: 400 }
            );
        }

        // Initialize the game
        const game = initializeGame(lobby);
        await gameStore.setGame(game);

        // Broadcast game started event
        await broadcastToLobby(code, 'game-started', {
            gameId: game.id,
        });

        return NextResponse.json({
            success: true,
            gameId: game.id,
        });
    } catch (error) {
        console.error('Error starting game:', error);
        return NextResponse.json(
            { error: 'Failed to start game' },
            { status: 500 }
        );
    }
}
