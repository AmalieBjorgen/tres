'use client';

import { useState, useEffect, useRef } from 'react';
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
    playingCardIds?: string[];
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
    playingCardIds = [],
}: HandProps) {
    const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
    const [ghostCards, setGhostCards] = useState<CardType[]>([]);
    const [displayCards, setDisplayCards] = useState<CardType[]>(cards);
    const prevCardIdsRef = useRef<Set<string>>(new Set());

    // Handle incoming (drawn) cards
    useEffect(() => {
        const currentCardIds = new Set(cards.map(c => c.id));
        const addedCardIds = new Set([...currentCardIds].filter(id => !prevCardIdsRef.current.has(id)));

        if (addedCardIds.size > 0) {
            setNewCardIds(addedCardIds);
            const timer = setTimeout(() => setNewCardIds(new Set()), 600);
            prevCardIdsRef.current = currentCardIds; // Update here too
            return () => clearTimeout(timer);
        }

        prevCardIdsRef.current = currentCardIds;
    }, [cards]);

    // Handle outgoing (played) cards with ghosting
    useEffect(() => {
        // If cards were in our display list but are now gone and are in playingCardIds, keep them as ghosts
        const removedButPlaying = displayCards.filter(c =>
            !cards.find(nc => nc.id === c.id) &&
            playingCardIds.includes(c.id) &&
            !ghostCards.find(gc => gc.id === c.id)
        );

        if (removedButPlaying.length > 0) {
            const nextGhosts = [...ghostCards, ...removedButPlaying];
            setGhostCards(nextGhosts);
            setDisplayCards([...cards, ...nextGhosts]);

            const timer = setTimeout(() => {
                setGhostCards([]);
                setDisplayCards(cards);
            }, 400);
            return () => clearTimeout(timer);
        } else {
            // Sync displayCards with cards if no new ghosts
            if (ghostCards.length === 0) {
                setDisplayCards(cards);
            }
        }
    }, [cards, playingCardIds]);

    if (displayCards.length === 0) {
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
                    <div className={styles.handEmpty}>No cards in hand</div>
                </div>
            </div>
        );
    }

    const finalCards = displayCards;
    const handClass = finalCards.length > 10
        ? styles.handManyCards
        : finalCards.length > 7
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
                    {finalCards.map((card) => {
                        const isSelected = selectedCardIds.includes(card.id);
                        const isNew = newCardIds.has(card.id);
                        const isPlaying = playingCardIds.includes(card.id) || ghostCards.some(gc => gc.id === card.id);
                        let isPlayable = isMyTurn && canPlayCard(card, topCard, currentColor);

                        if (isMyTurn && selectedCardIds.length > 0) {
                            const firstSelectedId = selectedCardIds[0];
                            const firstSelectedCard = cards.find(c => c.id === firstSelectedId);
                            if (firstSelectedCard?.type === 'number' && card.type === 'number' && firstSelectedCard.value === card.value) {
                                isPlayable = true;
                            }
                        }

                        if (isMyTurn && currentDrawStack > 0) {
                            if (topCard.type === 'draw_two') isPlayable = card.type === 'draw_two';
                            else if (topCard.type === 'wild_draw_four') isPlayable = card.type === 'wild_draw_four';
                        }

                        return (
                            <div key={card.id} className={styles.handCard}>
                                <Card
                                    card={card}
                                    playable={isPlayable}
                                    disabled={!isPlayable && isMyTurn}
                                    selected={isSelected}
                                    drawing={isNew}
                                    playing={isPlaying}
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
