'use client';

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
    return (
        <div className={styles.gameBoard}>
            <div className={`${styles.turnIndicator} ${isMyTurn ? styles.turnIndicatorActive : ''}`}>
                {isMyTurn ? "Your turn!" : `${currentPlayerName}'s turn`}
            </div>

            <div className={styles.boardCenter}>
                {/* Direction indicators */}
                <span className={`${styles.directionIndicator} ${styles.directionLeft}`}>
                    {direction === 'counter_clockwise' ? '←' : ''}
                </span>

                {/* Discard pile */}
                <div className={styles.discardPile}>
                    <Card card={topCard} />
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
                        <div className={styles.drawPileBadge}>{drawPileCount}</div>
                    </div>
                </div>

                {currentDrawStack > 0 && (
                    <div className={styles.stackWarning}>
                        +{currentDrawStack} stack!
                    </div>
                )}

                <span className={`${styles.directionIndicator} ${styles.directionRight}`}>
                    {direction === 'clockwise' ? '→' : ''}
                </span>
            </div>
        </div>
    );
}
