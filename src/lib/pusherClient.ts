'use client';

import Pusher from 'pusher-js';

// Client-side Pusher instance (singleton)
let pusherClient: Pusher | null = null;

export function getPusherClient(): Pusher | null {
    if (typeof window === 'undefined') {
        return null;
    }

    if (!pusherClient) {
        const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

        if (!key || !cluster) {
            console.warn('Pusher client credentials not configured');
            return null;
        }

        pusherClient = new Pusher(key, {
            cluster,
        });
    }

    return pusherClient;
}

// Subscribe to a game channel
export function subscribeToGame(
    gameCode: string,
    onEvent: (event: string, data: unknown) => void
): () => void {
    const pusher = getPusherClient();
    if (!pusher) {
        console.warn('Pusher not available, using polling fallback');
        return () => { };
    }

    const channel = pusher.subscribe(`game-${gameCode}`);

    // Bind to common game events
    const events = ['game-updated', 'card-played', 'card-drawn', 'tres-called', 'game-ended'];
    events.forEach((event) => {
        channel.bind(event, (data: unknown) => onEvent(event, data));
    });

    // Return unsubscribe function
    return () => {
        channel.unbind_all();
        pusher.unsubscribe(`game-${gameCode}`);
    };
}

// Subscribe to a lobby channel
export function subscribeToLobby(
    lobbyCode: string,
    onEvent: (event: string, data: unknown) => void
): () => void {
    const pusher = getPusherClient();
    if (!pusher) {
        console.warn('Pusher not available, using polling fallback');
        return () => { };
    }

    const channel = pusher.subscribe(`lobby-${lobbyCode}`);

    // Bind to lobby events
    const events = ['player-joined', 'player-left', 'player-ready', 'game-started'];
    events.forEach((event) => {
        channel.bind(event, (data: unknown) => onEvent(event, data));
    });

    // Return unsubscribe function
    return () => {
        channel.unbind_all();
        pusher.unsubscribe(`lobby-${lobbyCode}`);
    };
}
