import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { addPlayerToLobby } from '@/lib/game';
import { broadcastToLobby } from '@/lib/pusher';
import { JoinLobbyRequest } from '@/lib/types';

// POST /api/lobby/[code]/join - Join a lobby
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body: JoinLobbyRequest = await request.json();

        if (!body.playerName || body.playerName.trim().length === 0) {
            return NextResponse.json(
                { error: 'Player name is required' },
                { status: 400 }
            );
        }

        const lobby = await gameStore.getLobby(code);

        if (!lobby) {
            return NextResponse.json(
                { error: 'Lobby not found' },
                { status: 404 }
            );
        }

        // Check if game has already started
        const game = await gameStore.getGame(code);
        if (game) {
            return NextResponse.json(
                { error: 'Game has already started' },
                { status: 400 }
            );
        }

        const playerName = body.playerName.trim().substring(0, 20);
        const result = addPlayerToLobby(lobby, playerName);

        if (!result) {
            return NextResponse.json(
                { error: 'Lobby is full' },
                { status: 400 }
            );
        }

        await gameStore.setLobby(result.lobby);

        // Broadcast player joined event
        await broadcastToLobby(code, 'player-joined', {
            player: result.lobby.players.find((p) => p.id === result.playerId),
            lobby: result.lobby,
        });

        return NextResponse.json({
            lobby: result.lobby,
            playerId: result.playerId,
        });
    } catch (error) {
        console.error('Error joining lobby:', error);
        return NextResponse.json(
            { error: 'Failed to join lobby' },
            { status: 500 }
        );
    }
}
