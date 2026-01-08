'use client';

import { Card as CardType } from '@/lib/types';
import { getCardSymbol } from '@/lib/cards';
import styles from './Card.module.css';

interface CardProps {
    card?: CardType;
    faceDown?: boolean;
    small?: boolean;
    playable?: boolean;
    disabled?: boolean;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
}

export function Card({
    card,
    faceDown = false,
    small = false,
    playable = false,
    disabled = false,
    selected = false,
    onClick,
    className = '',
}: CardProps) {
    if (faceDown || !card) {
        return (
            <div
                className={`${styles.card} ${styles.cardBack} ${small ? styles.cardSmall : ''} ${className}`}
            >
                <div className={styles.cardInner}>
                    <div className={styles.cardBackPattern}>
                        <span className={styles.cardBackLogo}>TRES</span>
                    </div>
                </div>
            </div>
        );
    }

    const colorClass = card.color
        ? styles[`card${card.color.charAt(0).toUpperCase()}${card.color.slice(1)}`]
        : styles.cardWild;

    const symbol = getCardSymbol(card);

    return (
        <div
            className={`
        ${styles.card}
        ${colorClass}
        ${small ? styles.cardSmall : ''}
        ${playable ? styles.cardPlayable : ''}
        ${disabled ? styles.cardDisabled : ''}
        ${selected ? styles.cardSelected : ''}
        ${className}
      `}
            onClick={disabled ? undefined : onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick && !disabled ? 0 : undefined}
        >
            <div className={styles.cardInner}>
                <div className={styles.cardOval} />
                <span className={`${styles.cardCorner} ${styles.cardCornerTop}`}>
                    {symbol}
                </span>
                <span className={styles.cardValue}>{symbol}</span>
                <span className={`${styles.cardCorner} ${styles.cardCornerBottom}`}>
                    {symbol}
                </span>
            </div>
        </div>
    );
}
