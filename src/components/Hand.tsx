'use client';

import { Card as CardType, CardColor } from '@/lib/types';
import { canPlayCard } from '@/lib/cards';
import { Card } from './Card';
import styles from './Hand.module.css';

interface HandProps {
    cards: CardType[];
    topCard: CardType;
    currentColor: CardColor;
    isMyTurn: boolean;
    onToggleCard: (cardId: string) => void;
    onPlayAction: () => void;
    onDrawAction: () => void;
    selectedCardIds?: string[];
    currentDrawStack?: number;
}

const PlayIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
);

const DrawIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>
);

export function Hand({
    cards,
    topCard,
    currentColor,
    isMyTurn,
    onToggleCard,
    onPlayAction,
    onDrawAction,
    selectedCardIds = [],
    currentDrawStack = 0,
}: HandProps) {
    if (cards.length === 0) {
        return (
            <div className={styles.hand}>
                <div className={styles.handEmpty}>No cards in hand</div>
            </div>
        );
    }

    const handClass = cards.length > 10
        ? styles.handManyCards
        : cards.length > 7
            ? styles.handFanned
            : '';

    return (
        <div className={styles.handContainer}>
            {isMyTurn && (
                <button
                    className={`${styles.actionButton} ${styles.drawButton}`}
                    onClick={onDrawAction}
                    title={currentDrawStack > 0 ? `Draw ${currentDrawStack} penalty` : "Draw 3 & Skip"}
                >
                    <DrawIcon />
                    <span className={styles.buttonLabel}>
                        {currentDrawStack > 0 ? `+${currentDrawStack}` : 'Skip'}
                    </span>
                </button>
            )}

            <div className={styles.hand}>
                <div className={`${styles.handCards} ${handClass}`}>
                    {cards.map((card) => {
                        let isPlayable = isMyTurn && canPlayCard(card, topCard, currentColor);

                        // If stacking, refine playable status
                        if (isMyTurn && currentDrawStack > 0) {
                            if (topCard.type === 'draw_two') {
                                isPlayable = card.type === 'draw_two';
                            } else if (topCard.type === 'wild_draw_four') {
                                isPlayable = card.type === 'wild_draw_four';
                            }
                        }

                        const isSelected = selectedCardIds.includes(card.id);

                        return (
                            <div key={card.id} className={styles.handCard}>
                                <Card
                                    card={card}
                                    playable={isPlayable}
                                    disabled={!isPlayable && isMyTurn}
                                    selected={isSelected}
                                    onClick={() => onToggleCard(card.id)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {isMyTurn && (
                <button
                    className={`${styles.actionButton} ${styles.playButton}`}
                    onClick={onPlayAction}
                    disabled={selectedCardIds.length === 0}
                    title="Play Selected"
                >
                    <PlayIcon />
                    <span className={styles.buttonLabel}>Play</span>
                </button>
            )}
        </div>
    );
}
