import { atom } from 'jotai';

// What the Translate window is waiting for. A window that opens for a text waits, as a round progress indicator, until
// the text has been recognized and every card has its translation, and then opens to show them.

/** What the source area is doing with new text: recognizing an image, getting text ready, or nothing. */
export const sourceBusyAtom = atom<'image' | 'text' | null>('text');

export interface CardProgress {
    /** The service instance the card shows. */
    service: string;
    state: 'idle' | 'loading' | 'done';
}

/** Each card on show, by its place in the service list. */
export const cardProgressAtom = atom<Record<string, CardProgress>>({});

/** The window Rust opens to wait in: only large enough for the indicator. */
export const WAITING_SIZE = 88;

/**
 * `waiting`: the indicator alone. `opening`: the window is on its way to its size. `shown`: the window as it always
 * was. Rust opens a window that has nothing to wait for (the input window) at its size already.
 */
export const stageAtom = atom<'waiting' | 'opening' | 'shown'>(
    window.innerWidth <= WAITING_SIZE * 2 ? 'waiting' : 'shown'
);

/** Whether the window has everything it waits for before it opens. */
export function isReady(
    sourceBusy: 'image' | 'text' | null,
    sourceText: string,
    cards: Record<string, CardProgress>,
    cardCount: number | null
): boolean {
    if (sourceBusy !== null || cardCount === null) return false;
    if (sourceText.trim() === '') return true;
    const states = Object.values(cards).map((card) => card.state);
    return states.length >= cardCount && states.every((state) => state === 'done');
}

/** The services to show in the indicator: those translating, or all the cards' while none has started. */
export function servicesInProgress(cards: Record<string, CardProgress>): string[] {
    const all = Object.values(cards);
    const loading = all.filter((card) => card.state === 'loading');
    return (loading.length > 0 ? loading : all.filter((card) => card.state === 'idle')).map((card) => card.service);
}
