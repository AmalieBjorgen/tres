'use client';

import { GameSettings } from '@/lib/types';
import styles from './ActiveRules.module.css';

interface ActiveRulesProps {
    settings: GameSettings;
}

export function ActiveRules({ settings }: ActiveRulesProps) {
    const rules = [
        { key: 'tresRuleset', label: 'Tres Ruleset', icon: '3️⃣', description: 'Finish with 3+ cards, call TRES at 3 cards' },
        { key: 'jumpInRule', label: 'Jump-in', icon: '💨', description: 'Play out of turn with exact match' },
        { key: 'swapOnZero', label: '0: Swap All', icon: '🔄', description: 'Play 0 to swap all hands' },
        { key: 'swapOnSeven', label: '7: Trade', icon: '🤝', description: 'Play 7 to trade hand with someone' },
        { key: 'drawUntilPlay', label: 'Draw Until Play', icon: '🎴', description: 'Keep drawing until playable card found' },
        { key: 'forcedMatch', label: 'Forced Match', icon: '⚠️', description: 'Must play if you have a playable card' },
    ];

    const activeRules = rules.filter(rule => settings[rule.key as keyof GameSettings]);

    if (activeRules.length === 0) return null;

    return (
        <div className={styles.activeRules}>
            <div className={styles.title}>
                <span>Active Rules</span>
            </div>
            <div className={styles.ruleList}>
                {activeRules.map(rule => (
                    <div key={rule.key} className={styles.ruleItem} title={rule.description}>
                        <span className={styles.icon}>{rule.icon}</span>
                        <span className={styles.label}>{rule.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
