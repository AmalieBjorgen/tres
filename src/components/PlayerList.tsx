'use client';

import { useState, useEffect } from 'react';
import { ClientPlayer } from '@/lib/types';
import styles from './PlayerList.module.css';

interface PlayerListProps {
    players: ClientPlayer[];
    currentPlayerIndex: number;
    myId: string;
    onChallenge?: (playerId: string) => void;
}

export function PlayerList({
    players,
    currentPlayerIndex,
    myId,
    onChallenge,
}: PlayerListProps) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className={styles.playerList}>
            {players.map((player, index) => {
                const isActive = index === currentPlayerIndex;
                const isMe = player.id === myId;

                const isGraceActive = player.tresGraceExpiresAt && now < player.tresGraceExpiresAt;

                const canChallenge =
                    !isMe &&
                    player.cardCount === 1 &&
                    !player.hasSaidTres &&
                    !isGraceActive &&
                    onChallenge;

                return (
                    <div
                        key={player.id}
                        className={`
              ${styles.player}
              ${isActive ? styles.playerActive : ''}
              ${!player.isConnected ? styles.playerDisconnected : ''}
            `}
                    >
                        <div className={`${styles.playerAvatar} ${isActive ? styles.playerActiveAvatar : ''}`}>
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                        <div className={styles.playerInfo}>
                            <div className={styles.playerName}>
                                {player.name}
                                {isMe && ' (You)'}
                                {player.isHost && <span className={styles.playerHost}>HOST</span>}
                            </div>
                            <div className={styles.playerCardCount}>
                                <span className={styles.playerCardIcon}>🃏</span>
                                {player.cardCount} card{player.cardCount !== 1 ? 's' : ''}
                                {player.hasSaidTres && player.cardCount === 1 && (
                                    <span className={styles.tresBadge}>TRES!</span>
                                )}
                                {player.rank && (
                                    <span className={styles.rankBadge}>
                                        {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
                                        Rank {player.rank}
                                    </span>
                                )}
                                {canChallenge && (
                                    <button
                                        className={styles.challengeButton}
                                        onClick={() => onChallenge?.(player.id)}
                                    >
                                        CHALLENGE
                                    </button>
                                )}
                            </div>
                            <div className={styles.playerStatus}>
                                {isActive && !player.rank && (
                                    <span className={styles.thinking}>Thinking...</span>
                                )}
                                {player.rank && (
                                    <span className={styles.spectating}>Spectating</span>
                                )}
                                {!isActive && !player.rank && !isMe && (
                                    <span className={styles.waiting}>Waiting</span>
                                )}
                                {isMe && !isActive && !player.rank && (
                                    <span className={styles.waiting}>Your turn soon</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
