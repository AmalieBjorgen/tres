'use client';

import { CardColor } from '@/lib/types';
import styles from './ColorPicker.module.css';

interface ColorPickerProps {
    onSelect: (color: CardColor) => void;
}

export function ColorPicker({ onSelect }: ColorPickerProps) {
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];

    return (
        <div className={styles.colorPicker}>
            <div className={styles.colorPickerContent}>
                <h3 className={styles.colorPickerTitle}>Choose a color</h3>
                <div className={styles.colorPickerGrid}>
                    {colors.map((color) => (
                        <button
                            key={color}
                            className={`${styles.colorButton} ${styles[`colorButton${color.charAt(0).toUpperCase()}${color.slice(1)}`]}`}
                            onClick={() => onSelect(color)}
                            aria-label={`Select ${color}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
