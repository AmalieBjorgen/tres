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
    drawing?: boolean;
    playing?: boolean;
    onClick?: () => void;
    className?: string;
    colorOverride?: import('@/lib/types').CardColor;
}

export function Card({
    card,
    faceDown = false,
    small = false,
    playable = false,
    disabled = false,
    selected = false,
    drawing = false,
    playing = false,
    onClick,
    className = '',
    colorOverride,
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

    const effectiveColor = colorOverride || card.color;
    let colorClass = effectiveColor
        ? styles[`card${effectiveColor.charAt(0).toUpperCase()}${effectiveColor.slice(1)}`]
        : styles.cardWild;

    if (!effectiveColor) {
        if (card.type === 'communism') colorClass = styles.cardCommunism;
        if (card.type === 'revolution') colorClass = styles.cardRevolution;
    }

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
        ${drawing ? styles.cardDrawing : ''}
        ${playing ? styles.cardPlaying : ''}
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
