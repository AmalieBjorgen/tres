'use client';

import { ClientPlayer } from '@/lib/types';
import styles from './PlayerPicker.module.css';

interface PlayerPickerProps {
    players: ClientPlayer[];
    myId: string;
    onSelect: (playerId: string) => void;
    onCancel: () => void;
}

export function PlayerPicker({ players, myId, onSelect, onCancel }: PlayerPickerProps) {
    const targets = players.filter(p => p.id !== myId && !p.rank);

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <h3 className={styles.title}>Trade Hands</h3>
                <p className={styles.subtitle}>Pick a player to swap your hand with:</p>
                <div className={styles.playerList}>
                    {targets.length > 0 ? (
                        targets.map(player => (
                            <button
                                key={player.id}
                                className={styles.playerButton}
                                onClick={() => onSelect(player.id)}
                            >
                                <div className={styles.playerAvatar}>
                                    {player.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={styles.playerInfo}>
                                    <span className={styles.playerName}>{player.name}</span>
                                    <span className={styles.cardCount}>{player.cardCount} cards</span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <p className={styles.noPlayers}>No other active players to trade with.</p>
                    )}
                </div>
                <button className={styles.cancelButton} onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}
