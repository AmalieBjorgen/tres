import { Card, CardColor, CardType } from './types';

// Generate a unique card ID
function generateCardId(): string {
    return Math.random().toString(36).substring(2, 11);
}

// Create a single card
function createCard(type: CardType, color: CardColor | null, value: number | null): Card {
    return {
        id: generateCardId(),
        type,
        color,
        value,
    };
}

// Create a standard Tres deck (108 cards like Uno)
export function createDeck(): Card[] {
    const deck: Card[] = [];
    const colors: CardColor[] = ['red', 'blue', 'green', 'yellow'];

    for (const color of colors) {
        // One 0 card per color
        deck.push(createCard('number', color, 0));

        // Two of each 1-9 per color
        for (let value = 1; value <= 9; value++) {
            deck.push(createCard('number', color, value));
            deck.push(createCard('number', color, value));
        }

        // Two Skip cards per color
        deck.push(createCard('skip', color, null));
        deck.push(createCard('skip', color, null));

        // Two Reverse cards per color
        deck.push(createCard('reverse', color, null));
        deck.push(createCard('reverse', color, null));

        // Two Draw Two cards per color
        deck.push(createCard('draw_two', color, null));
        deck.push(createCard('draw_two', color, null));
    }

    // Four Wild cards
    for (let i = 0; i < 4; i++) {
        deck.push(createCard('wild', null, null));
    }

    // Four Wild Draw Four cards
    for (let i = 0; i < 4; i++) {
        deck.push(createCard('wild_draw_four', null, null));
    }

    return deck;
}

// Fisher-Yates shuffle algorithm
export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Check if a card can be played on top of another
export function canPlayCard(card: Card, topCard: Card, currentColor: CardColor): boolean {
    // Wild cards can always be played
    if (card.type === 'wild' || card.type === 'wild_draw_four') {
        return true;
    }

    // Match by color
    if (card.color === currentColor) {
        return true;
    }

    // Match by number (for number cards)
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
        return true;
    }

    // Match by type (for action cards)
    if (card.type !== 'number' && card.type === topCard.type) {
        return true;
    }

    return false;
}

// Get the display name of a card
export function getCardDisplayName(card: Card): string {
    if (card.type === 'wild') {
        return 'Wild';
    }
    if (card.type === 'wild_draw_four') {
        return 'Wild +4';
    }
    if (card.type === 'number') {
        return `${card.value}`;
    }
    if (card.type === 'skip') {
        return 'Skip';
    }
    if (card.type === 'reverse') {
        return 'Reverse';
    }
    if (card.type === 'draw_two') {
        return '+2';
    }
    return '';
}

// Get card symbol for display
export function getCardSymbol(card: Card): string {
    switch (card.type) {
        case 'number':
            return card.value?.toString() ?? '';
        case 'skip':
            return '⊘';
        case 'reverse':
            return '⟲';
        case 'draw_two':
            return '+2';
        case 'wild':
            return '★';
        case 'wild_draw_four':
            return '+4';
        default:
            return '';
    }
}

// Check if card is a wild card
export function isWildCard(card: Card): boolean {
    return card.type === 'wild' || card.type === 'wild_draw_four';
}

// Check if card is an action card
export function isActionCard(card: Card): boolean {
    return card.type === 'skip' || card.type === 'reverse' || card.type === 'draw_two';
}
