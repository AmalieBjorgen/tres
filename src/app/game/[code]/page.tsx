'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ClientGameState, CardColor, Card as CardType } from '@/lib/types';
import { isWildCard } from '@/lib/cards';
import { subscribeToGame } from '@/lib/pusherClient';
import { GameBoard } from '@/components/GameBoard';
import { Hand } from '@/components/Hand';
import { TurnTimer } from '@/components/TurnTimer';
import { PlayerList } from '@/components/PlayerList';
import { ColorPicker } from '@/components/ColorPicker';
import { TresButton } from '@/components/TresButton';
import { ActionLog } from '@/components/ActionLog';
import { PlayerPicker } from '@/components/PlayerPicker';
import { ActiveRules } from '@/components/ActiveRules';
import { getNextPlayerIndex } from '@/lib/game';
import styles from './page.module.css';

export default function GamePage() {
    const router = useRouter();
    const params = useParams();
    const code = params.code as string;

    const [game, setGame] = useState<ClientGameState | null>(null);
    const [playerId, setPlayerId] = useState<string | null>(null);
    const [playerToken, setPlayerToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [playingCardIds, setPlayingCardIds] = useState<string[]>([]);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [currentEffect, setCurrentEffect] = useState<string | null>(null);
    const [isShaking, setIsShaking] = useState(false);
    const [showPlayerPicker, setShowPlayerPicker] = useState(false);
    const timeoutTriggeredRef = useRef<number | null>(null);
    const prevIsMyTurnRef = useRef(false);

    const fetchGame = useCallback(async (pid: string, ptoken: string) => {
        try {
            const response = await fetch(`/api/game/${code}?playerId=${pid}`, {
                headers: {
                    'x-player-token': ptoken
                }
            });
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
        const storedPlayerToken = sessionStorage.getItem('playerToken');
        if (!storedPlayerId || !storedPlayerToken) {
            router.push('/');
            return;
        }
        setPlayerId(storedPlayerId);
        setPlayerToken(storedPlayerToken);

        fetchGame(storedPlayerId, storedPlayerToken);

        // Subscribe to game updates
        const unsubscribe = subscribeToGame(code, (event, data) => {
            if (event === 'game-updated') {
                const update = data as { action: string, playerId: string, game?: any, timestamp: number };

                // Smart update: if we received the partial state, merge it
                if (update.game && storedPlayerId) {
                    setGame(prev => {
                        if (!prev) return null;

                        // If the action was ours, we likely already have the full state from the POST response
                        // but Pusher might arrive later. If it was someone else's, we definitely want the update.
                        // We only skip the merge if the update is older than what we have.
                        if (prev.lastAction && prev.lastAction.timestamp > update.timestamp) {
                            return prev;
                        }

                        return {
                            ...prev,
                            ...update.game,
                            // Preserve our private fields
                            playerId: prev.playerId,
                            playerToken: prev.playerToken,
                            myHand: prev.myHand,
                            // Recalculate isMyTurn from the new currentPlayerIndex
                            isMyTurn: update.game.currentPlayerIndex === prev.players.findIndex(p => p.id === prev.playerId),
                        };
                    });

                    // If it was a swap or we were skipped, we might still want to fetch full state to be sure
                    // especially for Rule 7 trades which change our hand.
                    const isPrivateChange = update.action === 'leave' || (update.game.lastAction && update.game.lastAction.swapTargetId === storedPlayerId);
                    if (isPrivateChange || update.playerId === storedPlayerId) {
                        fetchGame(storedPlayerId, storedPlayerToken);
                    }
                } else {
                    fetchGame(storedPlayerId, storedPlayerToken);
                }
            }
        });

        return () => unsubscribe();
    }, [code, router, fetchGame]);

    // Polling fallback - significantly reduced frequency (10s)
    useEffect(() => {
        if (!playerId || !playerToken || game?.status === 'finished') return;

        const pollInterval = setInterval(() => {
            fetchGame(playerId, playerToken);
        }, 10000);

        return () => clearInterval(pollInterval);
    }, [playerId, playerToken, game?.status, fetchGame]);

    // Action effects handler
    useEffect(() => {
        if (!game?.lastAction) return;

        const action = game.lastAction;
        const now = Date.now();
        // Only react to "fresh" actions (within last 3 seconds)
        if (now - action.timestamp > 3000) return;

        if (action.type === 'play_card') {
            if (game.topCard.type === 'reverse') {
                setCurrentEffect('REVERSE!');
                setTimeout(() => setCurrentEffect(null), 1500);
            } else if (game.topCard.type === 'skip') {
                setCurrentEffect('SKIPPED!');
                setTimeout(() => setCurrentEffect(null), 1500);
            } else if (game.topCard.type === 'wild_draw_four' || game.topCard.type === 'draw_two') {
                setIsShaking(true);
                setTimeout(() => setIsShaking(false), 500);
            }

            // Rule 0/7 effects
            if (action.wasSwapAll) {
                setCurrentEffect('HAND SWAP!');
                setTimeout(() => setCurrentEffect(null), 2000);
            } else if (action.swapTargetId) {
                setCurrentEffect('TRADE!');
                setTimeout(() => setCurrentEffect(null), 2000);
            }
        } else if (action.type === 'draw_card' && (action.cardCount || 0) > 1) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
        } else if (action.type === 'challenge_tres') {
            setCurrentEffect('CHALLENGED!');
            setIsShaking(true);
            setTimeout(() => {
                setCurrentEffect(null);
                setIsShaking(false);
            }, 1000);
        }
    }, [game?.lastAction?.timestamp]);

    // Turn change toast
    useEffect(() => {
        if (game?.isMyTurn && !prevIsMyTurnRef.current) {
            setCurrentEffect('YOUR TURN');
            setTimeout(() => setCurrentEffect(null), 2000);
        }
        prevIsMyTurnRef.current = !!game?.isMyTurn;
    }, [game?.isMyTurn]);

    const showActionMessage = (message: string) => {
        setActionMessage(message);
        setTimeout(() => setActionMessage(null), 1500);
    };

    const handleToggleCard = (cardId: string) => {
        if (!game || !playerId) return;
        const canJumpIn = game.settings.jumpInRule;
        if (!game.isMyTurn && !canJumpIn) return;

        const card = game.myHand.find((c) => c.id === cardId);
        if (!card) return;

        setSelectedCardIds((prev) => {
            if (prev.includes(cardId)) {
                return prev.filter(id => id !== cardId);
            }

            // Logic for multi-card selection
            if (prev.length > 0) {
                const firstId = prev[0];
                const firstCard = game.myHand.find(c => c.id === firstId);

                // Only numeric cards of the same value can be multi-selected
                if (firstCard?.type === 'number' && card.type === 'number' && firstCard.value === card.value) {
                    return [...prev, cardId];
                }

                // If not same number or not numeric, replace selection
                return [cardId];
            }

            return [cardId];
        });
    };

    const handlePlaySelected = async () => {
        if (!game || !playerId || selectedCardIds.length === 0) return;

        const firstId = selectedCardIds[0];
        const firstCard = game.myHand.find((c) => c.id === firstId);
        if (!firstCard) return;

        // If it's a wild card, show color picker
        if (isWildCard(firstCard)) {
            setShowColorPicker(true);
            return;
        }

        // If it's a 7 and trade is active, show player picker
        if (game.settings.swapOnSeven && firstCard.type === 'number' && firstCard.value === 7) {
            setShowPlayerPicker(true);
            return;
        }

        // Play the cards
        await executePlayCards(selectedCardIds);
    };

    const handlePlayerSelected = async (targetId: string) => {
        setShowPlayerPicker(false);
        if (selectedCardIds.length > 0) {
            executePlayCards(selectedCardIds, undefined, targetId);
        }
    };

    const executePlayCards = async (cardIds: string[], chosenColor?: CardColor, swapTargetId?: string) => {
        if (!playerId) return;

        try {
            setPlayingCardIds(cardIds);
            const response = await fetch(`/api/game/${code}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'play_card',
                    playerId,
                    playerToken,
                    cardIds,
                    chosenColor,
                    swapTargetId,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setPlayingCardIds([]);
                showActionMessage(data.error || 'Cannot play these cards');
                return;
            }

            setGame(data.game);
            setSelectedCardIds([]);

            // Clear playing cards after animation duration
            setTimeout(() => setPlayingCardIds([]), 400);
        } catch (err) {
            showActionMessage('Failed to play cards');
        }
    };

    const handleColorSelected = (color: CardColor) => {
        setShowColorPicker(false);
        if (selectedCardIds.length > 0) {
            executePlayCards(selectedCardIds, color);
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
                    playerToken,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                showActionMessage(data.error || 'Cannot draw card');
                return;
            }

            setGame(data.game);
            const action = data.game.lastAction;
            const count = action?.cardCount || 1;

            if (game.currentDrawStack > 0) {
                showActionMessage(`Ouch! Drew ${count} stacked cards.`);
            } else {
                showActionMessage(`Drew ${count} card${count !== 1 ? 's' : ''}`);
            }
            setSelectedCardIds([]);
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
                    playerToken,
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
                    playerToken,
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

    const handleLeaveGame = async () => {
        if (!playerId) return;

        try {
            await fetch(`/api/game/${code}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerId, playerToken }),
            });
            router.push('/');
        } catch (err) {
            router.push('/');
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
                playerToken,
            }),
        }).then(response => response.json())
            .then(data => {
                if (data.game) {
                    setGame(data.game);
                    const count = 5 + (game.currentDrawStack || 0);
                    showActionMessage(`Time ran out! Drew ${count} penalty cards.`);
                }
            })
            .catch(() => {
                // Fallback: just refetch
                if (playerId && playerToken) {
                    fetchGame(playerId, playerToken);
                }
            });
    }, [game, playerId, playerToken, code, fetchGame]);

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

    const targetCount = game.settings.tresRuleset ? 3 : 1;
    const canSayTres = myPlayer?.cardCount !== undefined && myPlayer.cardCount <= targetCount && !myPlayer.hasSaidTres;
    const hasSaidTres = myPlayer?.hasSaidTres ?? false;

    const nextPlayerIndex = game ? getNextPlayerIndex(game as any) : -1;

    return (
        <div className={`
            ${styles.game} 
            ${game.isMyTurn ? styles.isMyTurn : ''}
            ${isShaking ? styles.shaking : ''}
        `}>
            {currentEffect && (
                <div className={styles.effectOverlay}>
                    <div className={styles.effectText}>{currentEffect}</div>
                </div>
            )}
            <header className={styles.gameHeader}>
                <div className={styles.headerLeft}>
                    <span className={styles.gameLogo}>TRES</span>
                    <span className={styles.gameCode}>Code: {code}</span>
                </div>
                <TurnTimer
                    turnStartedAt={game.turnStartedAt}
                    turnDuration={game.turnDuration}
                    isMyTurn={game.isMyTurn}
                    onTimeout={handleTimeout}
                />
                <div className={styles.headerRight}>
                    <button
                        className={`${styles.historyToggle} ${showHistory ? styles.historyToggleActive : ''}`}
                        onClick={() => setShowHistory(!showHistory)}
                        title="Action History"
                    >
                        📜
                    </button>
                    <TresButton
                        canSayTres={canSayTres}
                        hasSaidTres={hasSaidTres}
                        onClick={handleSayTres}
                    />
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleLeaveGame}
                    >
                        Leave Game
                    </button>
                </div>
            </header>

            <main className={styles.gameMain}>
                <div className={styles.gameLayout}>
                    <div className={styles.gameContent}>
                        <div className={styles.playersArea}>
                            <PlayerList
                                players={game.players}
                                currentPlayerIndex={game.currentPlayerIndex}
                                nextPlayerIndex={nextPlayerIndex}
                                myId={playerId}
                                settings={game.settings}
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
                                currentDrawStack={game.currentDrawStack}
                            />
                        </div>
                    </div>

                    <aside className={`${styles.gameSidebar} ${showHistory ? styles.sidebarOpen : ''}`}>
                        <div className={styles.sidebarOverlay} onClick={() => setShowHistory(false)} />
                        <div className={styles.sidebarContent}>
                            <div className={styles.sidebarRules}>
                                <ActiveRules settings={game.settings} />
                            </div>
                            <ActionLog
                                history={game.actionHistory || []}
                                players={game.players}
                                settings={game.settings}
                            />
                        </div>
                    </aside>
                </div>

                <div className={styles.handArea}>
                    <Hand
                        cards={game.myHand}
                        topCard={game.topCard}
                        currentColor={game.currentColor}
                        isMyTurn={game.isMyTurn}
                        onToggleCard={handleToggleCard}
                        onPlayAction={handlePlaySelected}
                        onDrawAction={handleDrawCard}
                        selectedCardIds={selectedCardIds}
                        currentDrawStack={game.currentDrawStack}
                        playingCardIds={playingCardIds}
                        cardsDrawnThisTurn={game.cardsDrawnThisTurn}
                        jumpInRule={game.settings.jumpInRule}
                    />
                </div>
            </main>


            {showColorPicker && (
                <ColorPicker onSelect={handleColorSelected} />
            )}

            {showPlayerPicker && (
                <PlayerPicker
                    players={game.players}
                    myId={playerId}
                    onSelect={handlePlayerSelected}
                    onCancel={() => setShowPlayerPicker(false)}
                />
            )}

            {actionMessage && (
                <div className={styles.actionMessage}>{actionMessage}</div>
            )}

            {game.status === 'finished' && (
                <div className={styles.winnerOverlay}>
                    <div className={styles.winnerContent}>
                        <div className={styles.winnerEmoji}>🏆</div>
                        <h2 className={styles.winnerTitle}>Game Over!</h2>
                        <div className={styles.podiumList}>
                            {game.podium.map((pId, index) => {
                                const p = game.players.find((player) => player.id === pId);
                                return (
                                    <div key={pId} className={`${styles.podiumItem} ${pId === playerId ? styles.podiumMe : ''}`}>
                                        <span className={styles.podiumRank}>
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                        </span>
                                        <span className={styles.podiumName}>{p?.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className={styles.winnerActions}>
                            <Link href="/" className="btn btn-primary btn-lg">
                                Back to Main Menu
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
