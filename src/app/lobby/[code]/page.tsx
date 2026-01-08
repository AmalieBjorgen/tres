'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Lobby, LobbyPlayer } from '@/lib/types';
import { subscribeToLobby } from '@/lib/pusherClient';
import styles from './page.module.css';

export default function LobbyPage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    const [lobby, setLobby] = useState<Lobby | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [isStarting, setIsStarting] = useState(false);

    const checkGameStarted = useCallback(async () => {
        try {
            // Check if game exists (means it has started)
            const storedPlayerId = sessionStorage.getItem('playerId');
            if (!storedPlayerId) return false;

            const response = await fetch(`/api/game/${code}?playerId=${storedPlayerId}`);
            if (response.ok) {
                // Game exists, redirect to it
                router.push(`/game/${code}`);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [code, router]);

    const fetchLobby = useCallback(async () => {
        try {
            // First check if game has started
            const gameStarted = await checkGameStarted();
            if (gameStarted) return;

            const response = await fetch(`/api/lobby?code=${code}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Lobby not found');
            }

            setLobby(data.lobby);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load lobby');
        } finally {
            setIsLoading(false);
        }
    }, [code, checkGameStarted]);

    useEffect(() => {
        // Get player ID from session
        const storedPlayerId = sessionStorage.getItem('playerId');
        if (!storedPlayerId) {
            router.push('/');
            return;
        }
        setPlayerId(storedPlayerId);

        // Fetch initial lobby state
        fetchLobby();

        // Subscribe to lobby updates
        const unsubscribe = subscribeToLobby(code, (event, data) => {
            if (event === 'player-joined' || event === 'player-left') {
                const eventData = data as { lobby: Lobby };
                setLobby(eventData.lobby);
            } else if (event === 'game-started') {
                router.push(`/game/${code}`);
            }
        });

        // Poll as fallback (in case Pusher isn't configured)
        const pollInterval = setInterval(fetchLobby, 3000);

        return () => {
            unsubscribe();
            clearInterval(pollInterval);
        };
    }, [code, router, fetchLobby]);

    const handleCopyCode = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for browsers without clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLeaveLobby = async () => {
        if (!playerId) return;

        try {
            await fetch(`/api/lobby/${code}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId }),
            });
            router.push('/');
        } catch (err) {
            router.push('/');
        }
    };

    const handleStartGame = async () => {
        if (!lobby || !playerId) return;

        setIsStarting(true);
        setError('');

        try {
            const response = await fetch(`/api/lobby/${code}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start game');
            }

            router.push(`/game/${code}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start game');
            setIsStarting(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Loading lobby...</p>
            </div>
        );
    }

    if (error && !lobby) {
        return (
            <div className={styles.loading}>
                <p className={styles.error}>{error}</p>
                <Link href="/" className="btn btn-secondary">
                    Back to Home
                </Link>
            </div>
        );
    }

    if (!lobby) return null;

    const isHost = lobby.hostId === playerId;
    const canStart = isHost && lobby.players.length >= 2;

    return (
        <main className={styles.lobby}>
            <Link href="/" className={styles.backLink}>
                ← Back to Home
            </Link>

            <div className={styles.lobbyHeader}>
                <h1 className={styles.lobbyTitle}>Game Lobby</h1>
                <p className={styles.lobbySubtitle}>
                    Share the code below with your friends to join!
                </p>
            </div>

            <div className={styles.codeSection}>
                <p className={styles.codeLabel}>Lobby Code</p>
                <div className={styles.codeDisplay}>
                    <span className={styles.code}>{code}</span>
                    <button className={styles.copyButton} onClick={handleCopyCode}>
                        {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                </div>
                {copied && (
                    <p className={styles.copiedMessage}>Code copied to clipboard!</p>
                )}
            </div>

            <div className={styles.playersSection}>
                <h2 className={styles.playersSectionTitle}>
                    Players
                    <span className={styles.playerCount}>
                        ({lobby.players.length}/{lobby.maxPlayers})
                    </span>
                </h2>
                <div className={styles.playersList}>
                    {lobby.players.map((player) => (
                        <div key={player.id} className={styles.playerItem}>
                            <div className={styles.playerAvatar}>
                                {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div className={styles.playerInfo}>
                                <div className={styles.playerName}>
                                    {player.name}
                                    {player.isHost && (
                                        <span className={`${styles.playerBadge} ${styles.badgeHost}`}>
                                            HOST
                                        </span>
                                    )}
                                    {player.id === playerId && (
                                        <span className={`${styles.playerBadge} ${styles.badgeYou}`}>
                                            YOU
                                        </span>
                                    )}
                                </div>
                                <p className={styles.playerJoined}>
                                    Joined {new Date(player.joinedAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.actions}>
                {isHost ? (
                    <>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleStartGame}
                            disabled={!canStart || isStarting}
                        >
                            {isStarting ? 'Starting...' : 'Start Game'}
                        </button>
                        {!canStart && (
                            <p className={styles.startHint}>
                                Need at least 2 players to start
                            </p>
                        )}
                    </>
                ) : (
                    <p className={styles.startHint}>
                        Waiting for the host to start the game...
                    </p>
                )}
                <button
                    className="btn btn-secondary"
                    onClick={handleLeaveLobby}
                >
                    Leave Lobby
                </button>
                {error && <p className={styles.error}>{error}</p>}
            </div>
        </main>
    );
}
