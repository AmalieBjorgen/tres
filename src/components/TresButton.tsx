'use client';

import styles from './TresButton.module.css';

interface TresButtonProps {
    canSayTres: boolean;
    hasSaidTres: boolean;
    onClick: () => void;
}

export function TresButton({ canSayTres, hasSaidTres, onClick }: TresButtonProps) {
    const shouldShow = canSayTres || hasSaidTres;

    if (!shouldShow) {
        return null;
    }

    return (
        <button
            className={`${styles.tresButton} ${canSayTres && !hasSaidTres ? styles.tresButtonActive : ''}`}
            onClick={onClick}
            disabled={hasSaidTres}
            aria-label="Say TRES"
        >
            <span className={styles.tresButtonText}>
                {hasSaidTres ? '✓' : 'TRES!'}
            </span>
        </button>
    );
}
