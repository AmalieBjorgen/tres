'use client';

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
    return (
        <div className={styles.playerList}>
            {players.map((player, index) => {
                const isActive = index === currentPlayerIndex;
                const isMe = player.id === myId;
                const canChallenge =
                    !isMe &&
                    player.cardCount === 1 &&
                    !player.hasSaidTres &&
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
                                {canChallenge && (
                                    <button
                                        className={styles.challengeButton}
                                        onClick={() => onChallenge?.(player.id)}
                                    >
                                        CHALLENGE
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
