import { NextRequest, NextResponse } from 'next/server';
import { gameStore } from '@/lib/gameStore';
import { leaveLobby } from '@/lib/game';
import { broadcastToLobby } from '@/lib/pusher';

// POST /api/lobby/[code]/leave - Leave a lobby
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;
        const body = await request.json();
        const { playerId } = body;

        const lobby = await gameStore.getLobby(code);

        if (!lobby) {
            return NextResponse.json(
                { error: 'Lobby not found' },
                { status: 404 }
            );
        }

        const updatedLobby = leaveLobby(lobby, playerId);

        if (!updatedLobby) {
            await gameStore.deleteLobby(code);
            return NextResponse.json({ success: true, dissolved: true });
        }

        await gameStore.setLobby(updatedLobby);

        // Broadcast player left event
        await broadcastToLobby(code, 'player-left', {
            playerId,
            lobby: updatedLobby,
        });

        return NextResponse.json({
            success: true,
            lobby: updatedLobby,
        });
    } catch (error) {
        console.error('Error leaving lobby:', error);
        return NextResponse.json(
            { error: 'Failed to leave lobby' },
            { status: 500 }
        );
    }
}
