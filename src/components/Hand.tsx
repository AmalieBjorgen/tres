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
    onPlayCard: (cardId: string) => void;
    selectedCardIds?: string[];
    onToggleCard?: (cardId: string) => void;
    currentDrawStack?: number;
}

export function Hand({
    cards,
    topCard,
    currentColor,
    isMyTurn,
    onPlayCard,
    selectedCardIds = [],
    onToggleCard,
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
                                onClick={() => onToggleCard ? onToggleCard(card.id) : onPlayCard(card.id)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
