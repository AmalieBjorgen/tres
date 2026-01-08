'use client';

import { useState, useEffect } from 'react';
import styles from './TurnTimer.module.css';

interface TurnTimerProps {
    turnStartedAt: number;
    turnDuration: number;
    isMyTurn: boolean;
    onTimeout?: () => void;
}

export function TurnTimer({
    turnStartedAt,
    turnDuration,
    isMyTurn,
    onTimeout
}: TurnTimerProps) {
    const [timeLeft, setTimeLeft] = useState(turnDuration);

    useEffect(() => {
        const updateTimer = () => {
            const elapsed = (Date.now() - turnStartedAt) / 1000;
            const remaining = Math.max(0, Math.ceil(turnDuration - elapsed));
            setTimeLeft(remaining);

            // Trigger timeout callback when time runs out
            if (remaining === 0 && onTimeout) {
                onTimeout();
            }
        };

        // Update immediately
        updateTimer();

        // Update every 100ms for smooth countdown
        const interval = setInterval(updateTimer, 100);

        return () => clearInterval(interval);
    }, [turnStartedAt, turnDuration, onTimeout]);

    // Determine timer state
    let timerClass = styles.timerNormal;
    if (timeLeft <= 5) {
        timerClass = styles.timerCritical;
    } else if (timeLeft <= 10) {
        timerClass = styles.timerWarning;
    }

    return (
        <div className={styles.timerContainer}>
            <div className={`${styles.timer} ${timerClass} ${isMyTurn ? styles.timerMyTurn : ''}`}>
                {isMyTurn && <div className={styles.timerRing} />}
                {timeLeft}
            </div>
            <span className={styles.timerLabel}>
                {isMyTurn ? 'Your time' : 'Time left'}
            </span>
        </div>
    );
}
