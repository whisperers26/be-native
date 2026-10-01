// The size the Translate window gives itself when its size is not remembered: as tall as what it shows, and wider
// rather than taller than wide when its text wraps. Arithmetic only, in logical pixels.

/** What the window measures of itself. */
export interface Measured {
    width: number;
    /** The height the window needs to show everything at this width. */
    height: number;
    /** The height of each text box. */
    textHeights: number[];
    lineHeight: number;
}

export interface Limits {
    minWidth: number;
    maxWidth: number;
    maxHeight: number;
}

export interface Size {
    width: number;
    height: number;
}

export const MIN_WIDTH = 420;
// The window is at most this many times as tall as it is wide, while it can still get wider
const TALLEST = 0.7;
const WIDTH_STEP = 40;
// What lies between the window's edges and its text, left and right together
const TEXT_MARGIN = 40;
// A text of fewer lines is not worth a wider window
const WRAPPED_LINES = 3;

/** The limits on a screen with this much room (`window.screen`): part of it, and never more than a readable size. */
export function limitsFor(screen: { availWidth: number; availHeight: number }): Limits {
    return {
        minWidth: MIN_WIDTH,
        maxWidth: Math.max(MIN_WIDTH, Math.min(900, Math.round(screen.availWidth * 0.6))),
        maxHeight: Math.min(800, Math.round(screen.availHeight * 0.75)),
    };
}

/**
 * The size for the window. The width only grows: the caller narrows the window when its text changes. After a change
 * of width the text wraps differently, so the caller measures again and the height then comes from the real layout.
 */
export function fitSize(measured: Measured, limits: Limits): Size {
    const { lineHeight } = measured;
    const lines = measured.textHeights.map((height) => Math.round(height / lineHeight));
    const longest = Math.max(0, ...lines);
    const fixed = measured.height - measured.textHeights.reduce((sum, height) => sum + height, 0);
    const textWidth = measured.width - TEXT_MARGIN;
    const heightAt = (width: number) =>
        fixed + lines.reduce((sum, n) => sum + Math.ceil((n * textWidth) / (width - TEXT_MARGIN)) * lineHeight, 0);

    let width = Math.max(measured.width, limits.minWidth);
    let height = width === measured.width ? measured.height : heightAt(width);
    if (longest >= WRAPPED_LINES) {
        // Wider than this, the longest text is on one line already
        const widest = Math.min(limits.maxWidth, textWidth * longest + TEXT_MARGIN);
        while (height > TALLEST * width && width < widest) {
            width = Math.min(width + WIDTH_STEP, widest);
            height = heightAt(width);
        }
    }
    return { width: Math.round(width), height: Math.round(Math.min(height, limits.maxHeight)) };
}
