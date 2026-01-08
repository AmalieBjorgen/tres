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
    selectedCard?: string;
}

export function Hand({
    cards,
    topCard,
    currentColor,
    isMyTurn,
    onPlayCard,
    selectedCard,
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
                    const isPlayable = isMyTurn && canPlayCard(card, topCard, currentColor);
                    const isSelected = selectedCard === card.id;

                    return (
                        <div key={card.id} className={styles.handCard}>
                            <Card
                                card={card}
                                playable={isPlayable}
                                disabled={!isPlayable && isMyTurn}
                                selected={isSelected}
                                onClick={() => isPlayable && onPlayCard(card.id)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
