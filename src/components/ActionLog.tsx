'use client';

import { GameAction, ClientPlayer } from '@/lib/types';
import styles from './ActionLog.module.css';

interface ActionLogProps {
    history: GameAction[];
    players: ClientPlayer[];
    settings?: import('@/lib/types').GameSettings;
}

export function ActionLog({ history, players, settings }: ActionLogProps) {
    const getPlayerName = (id: string) => {
        const player = players.find(p => p.id === id);
        return player ? player.name : 'Unknown';
    };

    const formatTimestamp = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const renderActionMessage = (action: GameAction) => {
        const playerName = getPlayerName(action.playerId);

        switch (action.type) {
            case 'play_card':
                const count = action.cardIds?.length || 1;
                return (
                    <span>
                        <strong>{playerName}</strong> played {count > 1 ? `${count} cards` : 'a card'}
                        {action.chosenColor && <span> (changed to <span className={styles[`color${action.chosenColor}`]}>{action.chosenColor}</span>)</span>}
                        {action.swapTargetId && <span> (traded with <strong>{getPlayerName(action.swapTargetId)}</strong>)</span>}
                        {action.wasSwapAll && <span> (all hands swapped)</span>}
                    </span>
                );
            case 'draw_card':
                return (
                    <span>
                        <strong>{playerName}</strong> drew {action.cardCount || 1} {action.cardCount === 1 ? 'card' : 'cards'}
                    </span>
                );
            case 'draw_three_skip':
                return (
                    <span>
                        <strong>{playerName}</strong> drew 3 and skipped
                    </span>
                );
            case 'say_tres':
                return (
                    <span className={styles.shout}>
                        <strong>{playerName}</strong> shouted TRES!
                    </span>
                );
            case 'challenge_tres':
                return (
                    <span>
                        <strong>{playerName}</strong> challenged!
                    </span>
                );
            default:
                return <span>Unknown action</span>;
        }
    };

    return (
        <div className={styles.actionLog}>
            <h3 className={styles.title}>Action History</h3>
            <div className={styles.list}>
                {history.length === 0 ? (
                    <div className={styles.empty}>No actions recorded yet.</div>
                ) : (
                    [...history].reverse().map((action, index) => (
                        <div key={`${action.timestamp}-${index}`} className={styles.item}>
                            <span className={styles.time}>{formatTimestamp(action.timestamp)}</span>
                            <span className={styles.message}>{renderActionMessage(action)}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
