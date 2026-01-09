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
    cardsDrawnThisTurn?: number;
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
    cardsDrawnThisTurn = 0,
}: HandProps) {
    const [sortMode, setSortMode] = useState<'color' | 'value'>('color');
    const [newCardIds, setNewCardIds] = useState<Set<string>>(new Set());
    const [ghostCards, setGhostCards] = useState<CardType[]>([]);
    const [displayCards, setDisplayCards] = useState<CardType[]>(cards);
    const prevCardIdsRef = useRef<Set<string>>(new Set());

    // Sorting logic
    const colorOrder: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3, null: 4 };
    const typeOrder: Record<string, number> = { number: 0, skip: 1, reverse: 2, draw_two: 3, wild: 4, wild_draw_four: 5 };

    const sortCards = (cardsToSort: CardType[]) => {
        return [...cardsToSort].sort((a, b) => {
            if (sortMode === 'color') {
                const colorA = a.color || 'null';
                const colorB = b.color || 'null';
                if (colorOrder[colorA] !== colorOrder[colorB]) return colorOrder[colorA] - colorOrder[colorB];
                if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
                return (a.value || 0) - (b.value || 0);
            } else {
                if (a.type !== b.type) return typeOrder[a.type] - typeOrder[b.type];
                if (a.value !== b.value) return (a.value || 0) - (b.value || 0);
                const colorA = a.color || 'null';
                const colorB = b.color || 'null';
                return colorOrder[colorA] - colorOrder[colorB];
            }
        });
    };

    // Handle incoming (drawn) cards
    useEffect(() => {
        const currentCardIds = new Set(cards.map(c => c.id));
        const addedCardIds = new Set([...currentCardIds].filter(id => !prevCardIdsRef.current.has(id)));

        if (addedCardIds.size > 0) {
            setNewCardIds(addedCardIds);
            const timer = setTimeout(() => setNewCardIds(new Set()), 600);
            prevCardIdsRef.current = currentCardIds;
            return () => clearTimeout(timer);
        }

        prevCardIdsRef.current = currentCardIds;
    }, [cards]);

    // Handle outgoing (played) cards with ghosting
    useEffect(() => {
        const sortedHand = sortCards(cards);

        // Which cards were just played? (exist in playingCardIds but no longer in cards)
        const ghostIds = playingCardIds.filter(id => !cards.find(c => c.id === id));

        if (ghostIds.length > 0) {
            // We need to find the card objects for these IDs from our previous displayCards
            const ghostObjects = displayCards.filter(c => ghostIds.includes(c.id));

            if (ghostObjects.length > 0) {
                setGhostCards(ghostObjects);
                setDisplayCards([...sortedHand, ...ghostObjects]);

                const timer = setTimeout(() => {
                    setGhostCards([]);
                    setDisplayCards(sortedHand);
                }, 400);
                return () => clearTimeout(timer);
            }
        }

        // If no active ghosting, always sync with sorted hand
        setGhostCards([]);
        setDisplayCards(sortedHand);
    }, [cards, playingCardIds, sortMode]);

    if (displayCards.length === 0) {
        return (
            <div className={styles.handContainer}>
                {isMyTurn && (
                    <button
                        className={`${styles.actionButton} ${styles.drawButton}`}
                        onClick={onDrawAction}
                        title={currentDrawStack > 0 ? `Draw ${currentDrawStack} penalty` : `Draw card (${cardsDrawnThisTurn}/3)`}
                    >
                        <DrawIcon />
                        <span className={styles.buttonLabel}>
                            {currentDrawStack > 0 ? `+${currentDrawStack}` : `${cardsDrawnThisTurn}/3`}
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

    // Dynamic overlap calculation for CSS variable
    const getOverlap = () => {
        const count = finalCards.length;
        if (count <= 1) return 0;
        if (count <= 6) return -20;
        if (count <= 10) return -35;
        if (count <= 15) return -45;
        if (count <= 20) return -55;
        return -60;
    };

    return (
        <div
            className={styles.handContainer}
            style={{ '--card-overlap': `${getOverlap()}px` } as React.CSSProperties}
        >
            {isMyTurn && (
                <button
                    className={`${styles.actionButton} ${styles.drawButton}`}
                    onClick={onDrawAction}
                    title={currentDrawStack > 0 ? `Draw ${currentDrawStack} penalty` : `Draw card (${cardsDrawnThisTurn}/3)`}
                >
                    <DrawIcon />
                    <span className={styles.buttonLabel}>
                        {currentDrawStack > 0 ? `+${currentDrawStack}` : `${cardsDrawnThisTurn}/3`}
                    </span>
                </button>
            )}

            <div className={styles.hand}>
                <div className={styles.handCards}>
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
                <div className={styles.handActions}>
                    <button
                        className={styles.sortButton}
                        onClick={() => setSortMode(sortMode === 'color' ? 'value' : 'color')}
                        title={`Currently sorted by ${sortMode}. Click to sort by ${sortMode === 'color' ? 'value' : 'color'}.`}
                    >
                        {sortMode === 'color' ? '🎨' : '🔢'}
                    </button>
                    <button
                        className={`${styles.actionButton} ${styles.playButton}`}
                        onClick={onPlayAction}
                        disabled={selectedCardIds.length === 0}
                        title="Play Selected"
                    >
                        <PlayIcon />
                        <span className={styles.buttonLabel}>Play</span>
                    </button>
                </div>
            )}
        </div>
    );
}
