import Pusher from 'pusher';

// Server-side Pusher instance
// This will be undefined if env vars are not set (for local development without Pusher)
let pusherServer: Pusher | null = null;

if (
    process.env.PUSHER_APP_ID &&
    process.env.PUSHER_KEY &&
    process.env.PUSHER_SECRET &&
    process.env.PUSHER_CLUSTER
) {
    pusherServer = new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
    });
}

// Broadcast an event to a game channel
export async function broadcastToGame(
    gameCode: string,
    event: string,
    data: Record<string, unknown>
): Promise<void> {
    if (!pusherServer) {
        console.log(`[Pusher Mock] Broadcasting to game-${gameCode}: ${event}`, data);
        return;
    }

    try {
        await pusherServer.trigger(`game-${gameCode}`, event, data);
    } catch (error) {
        console.error('Pusher broadcast error:', error);
    }
}

// Broadcast to lobby channel
export async function broadcastToLobby(
    lobbyCode: string,
    event: string,
    data: Record<string, unknown>
): Promise<void> {
    if (!pusherServer) {
        console.log(`[Pusher Mock] Broadcasting to lobby-${lobbyCode}: ${event}`, data);
        return;
    }

    try {
        await pusherServer.trigger(`lobby-${lobbyCode}`, event, data);
    } catch (error) {
        console.error('Pusher broadcast error:', error);
    }
}

export { pusherServer };
