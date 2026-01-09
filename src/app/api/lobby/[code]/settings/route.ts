import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { broadcastToLobby } from '@/lib/pusher';
import { GameSettings } from '@/lib/types';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { settings, playerId, playerToken } = body as { settings: GameSettings; playerId: string; playerToken: string };

        const lobby = await gameStore.getLobby(code);
        if (!lobby) {
            return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
        }

        // Validate host token
        const host = lobby.players.find(p => p.id === lobby.hostId);
        if (lobby.hostId !== playerId || !host || host.token !== playerToken) {
            return NextResponse.json({ error: 'Only host can change settings' }, { status: 403 });
        }

        lobby.settings = settings;
        await gameStore.setLobby(lobby);

        // Redact tokens for broadcast
        const publicLobby = {
            ...lobby,
            players: lobby.players.map(p => {
                const { token, ...rest } = p;
                return rest;
            })
        };

        await broadcastToLobby(code, 'lobby-updated', { lobby: publicLobby });

        return NextResponse.json({ success: true, lobby });
    } catch (error) {
        console.error('Error updating lobby settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
