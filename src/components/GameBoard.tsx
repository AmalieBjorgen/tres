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
}

export function GameBoard({
    topCard,
    currentColor,
    drawPileCount,
    direction,
    currentPlayerName,
    isMyTurn,
    onDrawCard,
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
                    title={isMyTurn ? 'Click to draw a card' : undefined}
                >
                    <span className={styles.drawLabel}>Draw</span>
                    <div className={styles.drawPileStack}>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                        <div className={styles.drawPileCard}><Card faceDown /></div>
                    </div>
                    <span className={styles.drawPileCount}>{drawPileCount} cards</span>
                </div>

                <span className={`${styles.directionIndicator} ${styles.directionRight}`}>
                    {direction === 'clockwise' ? '→' : ''}
                </span>
            </div>
        </div>
    );
}
