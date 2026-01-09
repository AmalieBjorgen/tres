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
        const { settings, playerId } = body as { settings: GameSettings; playerId: string };

        const lobby = await gameStore.getLobby(code);
        if (!lobby) {
            return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
        }

        if (lobby.hostId !== playerId) {
            return NextResponse.json({ error: 'Only host can change settings' }, { status: 403 });
        }

        lobby.settings = settings;
        await gameStore.setLobby(lobby);

        await broadcastToLobby(code, 'lobby-updated', { lobby });

        return NextResponse.json({ success: true, lobby });
    } catch (error) {
        console.error('Error updating lobby settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
