'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ClientGameState, CardColor, Card as CardType } from '@/lib/types';
import { isWildCard } from '@/lib/cards';
import { subscribeToGame } from '@/lib/pusherClient';
import { GameBoard } from '@/components/GameBoard';
import { Hand } from '@/components/Hand';
import { PlayerList } from '@/components/PlayerList';
import { ColorPicker } from '@/components/ColorPicker';
import { TresButton } from '@/components/TresButton';
import { TurnTimer } from '@/components/TurnTimer';
import styles from './page.module.css';

export default function GamePage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    const [game, setGame] = useState<ClientGameState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [pendingCard, setPendingCard] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const timeoutTriggeredRef = useRef<number | null>(null);

    const fetchGame = useCallback(async (pid: string) => {
        try {
            const response = await fetch(`/api/game/${code}?playerId=${pid}`);
            const data = await response.json();

            if (!response.ok) {
                // Game might not have started yet
                if (response.status === 404) {
                    router.push(`/lobby/${code}`);
                    return;
                }
                throw new Error(data.error || 'Failed to load game');
            }

            setGame(data.game);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load game');
        } finally {
            setIsLoading(false);
        }
    }, [code, router]);

    useEffect(() => {
        const storedPlayerId = sessionStorage.getItem('playerId');
        if (!storedPlayerId) {
            router.push('/');
            return;
        }
        setPlayerId(storedPlayerId);

        fetchGame(storedPlayerId);

        // Subscribe to game updates
        const unsubscribe = subscribeToGame(code, (event, data) => {
            if (event === 'game-updated') {
                // Refetch game state
                fetchGame(storedPlayerId);
            }
        });

        // Poll as fallback
        const pollInterval = setInterval(() => {
            if (storedPlayerId) {
                fetchGame(storedPlayerId);
            }
        }, 2000);

        return () => {
            unsubscribe();
            clearInterval(pollInterval);
        };
    }, [code, router, fetchGame]);

    const showActionMessage = (message: string) => {
        setActionMessage(message);
        setTimeout(() => setActionMessage(null), 1500);
    };

    const handlePlayCard = async (cardId: string) => {
        if (!game || !playerId) return;

        // Find the card
        const card = game.myHand.find((c) => c.id === cardId);
        if (!card) return;

        // If it's a wild card, show color picker
        if (isWildCard(card)) {
            setPendingCard(cardId);
            setShowColorPicker(true);
            return;
        }

        // Play the card
        await executePlayCard(cardId);
    };

    const executePlayCard = async (cardId: string, chosenColor?: CardColor) => {
        if (!playerId) return;

        try {
            const response = await fetch(`/api/game/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'play_card',
                    playerId,
                    cardId,
                    chosenColor,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                showActionMessage(data.error || 'Cannot play this card');
                return;
            }

            setGame(data.game);
        } catch (err) {
            showActionMessage('Failed to play card');
        }
    };

    const handleColorSelected = (color: CardColor) => {
        setShowColorPicker(false);
        if (pendingCard) {
            executePlayCard(pendingCard, color);
            setPendingCard(null);
        }
    };

    const handleDrawCard = async () => {
        if (!game || !playerId || !game.isMyTurn) return;

        try {
            const response = await fetch(`/api/game/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'draw_card',
                    playerId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                showActionMessage(data.error || 'Cannot draw card');
                return;
            }

            setGame(data.game);
            const count = data.game.lastAction?.cardCount || 1;
            showActionMessage(`Drew ${count} card${count !== 1 ? 's' : ''}`);
        } catch (err) {
            showActionMessage('Failed to draw card');
        }
    };

    const handleSayTres = async () => {
        if (!game || !playerId) return;

        try {
            const response = await fetch(`/api/game/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'say_tres',
                    playerId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                showActionMessage(data.error || 'Cannot say TRES');
                return;
            }

            setGame(data.game);
            showActionMessage('TRES!');
        } catch (err) {
            showActionMessage('Failed to say TRES');
        }
    };

    const handleChallenge = async (targetId: string) => {
        if (!playerId) return;

        try {
            const response = await fetch(`/api/game/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'challenge_tres',
                    playerId,
                    targetId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                showActionMessage(data.error || 'Invalid challenge');
                return;
            }

            setGame(data.game);
            showActionMessage('Challenge successful!');
        } catch (err) {
            showActionMessage('Failed to challenge');
        }
    };

    const handleTimeout = useCallback(() => {
        // Prevent triggering multiple times for the same turn
        if (!game || !playerId) return;
        if (timeoutTriggeredRef.current === game.turnStartedAt) return;

        timeoutTriggeredRef.current = game.turnStartedAt;

        // Trigger a force timeout action to update the server
        fetch(`/api/game/${code}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'force_timeout',
                playerId,
            }),
        }).then(response => response.json())
            .then(data => {
                if (data.game) {
                    setGame(data.game);
                    showActionMessage('Time ran out! Drew 5 penalty cards.');
                }
            })
            .catch(() => {
                // Fallback: just refetch
                fetchGame(playerId);
            });
    }, [game, playerId, code, fetchGame]);

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Loading game...</p>
            </div>
        );
    }

    if (error && !game) {
        return (
            <div className={styles.loading}>
                <p className={styles.error}>{error}</p>
                <Link href="/" className="btn btn-secondary">
                    Back to Home
                </Link>
            </div>
        );
    }

    if (!game || !playerId) return null;

    const currentPlayer = game.players[game.currentPlayerIndex];
    const myPlayer = game.players.find((p) => p.id === playerId);
    const winner = game.winnerId ? game.players.find((p) => p.id === game.winnerId) : null;

    const canSayTres = myPlayer?.cardCount === 1 && !myPlayer?.hasSaidTres;
    const hasSaidTres = myPlayer?.hasSaidTres ?? false;

    return (
        <div className={styles.game}>
            <header className={styles.gameHeader}>
                <span className={styles.gameLogo}>TRES</span>
                <TurnTimer
                    turnStartedAt={game.turnStartedAt}
                    turnDuration={game.turnDuration}
                    isMyTurn={game.isMyTurn}
                    onTimeout={handleTimeout}
                />
                <span className={styles.gameCode}>Code: {code}</span>
            </header>

            <main className={styles.gameMain}>
                <div className={styles.playersArea}>
                    <PlayerList
                        players={game.players}
                        currentPlayerIndex={game.currentPlayerIndex}
                        myId={playerId}
                        onChallenge={handleChallenge}
                    />
                </div>

                <div className={styles.boardArea}>
                    <GameBoard
                        topCard={game.topCard}
                        currentColor={game.currentColor}
                        drawPileCount={game.drawPileCount}
                        direction={game.direction}
                        currentPlayerName={currentPlayer.name}
                        isMyTurn={game.isMyTurn}
                        onDrawCard={handleDrawCard}
                    />
                </div>

                <div className={styles.handArea}>
                    <Hand
                        cards={game.myHand}
                        topCard={game.topCard}
                        currentColor={game.currentColor}
                        isMyTurn={game.isMyTurn}
                        onPlayCard={handlePlayCard}
                    />
                </div>
            </main>

            <TresButton
                canSayTres={canSayTres}
                hasSaidTres={hasSaidTres}
                onClick={handleSayTres}
            />

            {showColorPicker && (
                <ColorPicker onSelect={handleColorSelected} />
            )}

            {actionMessage && (
                <div className={styles.actionMessage}>{actionMessage}</div>
            )}

            {winner && (
                <div className={styles.winnerOverlay}>
                    <div className={styles.winnerContent}>
                        <div className={styles.winnerEmoji}>🎉</div>
                        <h2 className={styles.winnerTitle}>
                            {winner.id === playerId ? 'You Win!' : 'Game Over!'}
                        </h2>
                        <p className={styles.winnerName}>
                            {winner.name} wins the game!
                        </p>
                        <div className={styles.winnerActions}>
                            <Link href="/" className="btn btn-primary btn-lg">
                                Play Again
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
