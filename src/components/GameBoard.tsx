'use client';

import { useState, useEffect, useRef } from 'react';
import { Card as CardType, CardColor, GameDirection } from '@/lib/types';
import { Card } from './Card';
import styles from './GameBoard.module.css';

interface GameBoardProps {
    topCard: CardType;
    currentColor: CardColor;
    drawPileCount: number;
    direction: GameDirection;
    currentPlayerName: string;
    isMyTurn: boolean;
    onDrawCard: () => void;
    currentDrawStack: number;
}

export function GameBoard({
    topCard,
    currentColor,
    drawPileCount,
    direction,
    currentPlayerName,
    isMyTurn,
    onDrawCard,
    currentDrawStack,
}: GameBoardProps) {
    const [animateTop, setAnimateTop] = useState(false);
    const lastTopRef = useRef<string | null>(null);

    useEffect(() => {
        if (lastTopRef.current && lastTopRef.current !== topCard.id) {
            setAnimateTop(true);
            const timer = setTimeout(() => setAnimateTop(false), 400);
            return () => clearTimeout(timer);
        }
        lastTopRef.current = topCard.id;
    }, [topCard.id]);

    return (
        <div className={styles.gameBoard}>
            <div className={`${styles.turnIndicator} ${isMyTurn ? styles.turnIndicatorActive : ''}`}>
                {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
            </div>

            <div className={styles.boardCenter}>
                {/* Direction indicators */}

                {/* Discard pile */}
                <div className={styles.discardPile}>
                    <Card card={topCard} drawing={animateTop} />
                </div>

                {/* Draw pile */}
                <div
                    className={styles.drawPile}
                    onClick={isMyTurn ? onDrawCard : undefined}
                    role={isMyTurn ? 'button' : undefined}
                    tabIndex={isMyTurn ? 0 : undefined}
                    title={isMyTurn ? (currentDrawStack > 0 ? `Draw ${currentDrawStack} cards penalty` : 'Click to draw a card') : undefined}
                >
                    <div className={styles.drawPileStack}>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileBadge}>{drawPileCount}</div>
                    </div>
                </div>

                {currentDrawStack > 0 && (
                    <div className={styles.stackWarning}>
                        +{currentDrawStack} stack!
                    </div>
                )}

                <div className={styles.directionIndicators}>
                    <div className={`${styles.directionInfo} ${direction === 'clockwise' ? styles.directionActive : ''}`}>
                        <span>⟳ Clockwise</span>
                    </div>
                    <div className={`${styles.directionInfo} ${direction === 'counter_clockwise' ? styles.directionActive : ''}`}>
                        <span>⟲ Counter-clockwise</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
