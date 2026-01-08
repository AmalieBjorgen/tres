import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { createLobby, addPlayerToLobby } from '@/lib/game';
import { broadcastToLobby } from '@/lib/pusher';
import { CreateLobbyRequest, JoinLobbyRequest } from '@/lib/types';

// POST /api/lobby - Create a new lobby
export async function POST(request: NextRequest) {
    try {
        const body: CreateLobbyRequest = await request.json();

        if (!body.playerName || body.playerName.trim().length === 0) {
            return NextResponse.json(
                { error: 'Player name is required' },
                { status: 400 }
            );
        }

        const playerName = body.playerName.trim().substring(0, 20); // Limit name length
        const { lobby, hostId } = createLobby(playerName);

        gameStore.setLobby(lobby);

        return NextResponse.json({
            lobby,
            playerId: hostId,
        });
    } catch (error) {
        console.error('Error creating lobby:', error);
        return NextResponse.json(
            { error: 'Failed to create lobby' },
            { status: 500 }
        );
    }
}

// GET /api/lobby?code=XXXXX - Get lobby info
export async function GET(request: NextRequest) {
    try {
        const code = request.nextUrl.searchParams.get('code');

        if (!code) {
            return NextResponse.json(
                { error: 'Lobby code is required' },
                { status: 400 }
            );
        }

        const lobby = gameStore.getLobby(code);

        if (!lobby) {
            return NextResponse.json(
                { error: 'Lobby not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ lobby });
    } catch (error) {
        console.error('Error getting lobby:', error);
        return NextResponse.json(
            { error: 'Failed to get lobby' },
            { status: 500 }
        );
    }
}
