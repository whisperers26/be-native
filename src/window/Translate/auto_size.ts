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
    /** The height of the box around the source text when it shows all of it. */
    sourceHeight: number;
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

export interface Fit extends Size {
    /**
     * The height to keep the box around the source text to, which then scrolls: `null` to show all of it, and
     * `undefined` while the width is changing, when the next measurement decides.
     */
    sourceHeight?: number | null;
}

export const MIN_WIDTH = 420;
// The window is at most this many times as tall as it is wide, while it can still get wider
const TALLEST = 0.7;
const WIDTH_STEP = 40;
// What lies between the window's edges and its text, left and right together
const TEXT_MARGIN = 40;
// A text of fewer lines is not worth a wider window
const WRAPPED_LINES = 3;
// The source text keeps this many lines when it gives its room to the translations
const SOURCE_LINES = 3;
// What the box around the source text adds to the text's height
const SOURCE_PADDING = 12;

/** The limits on a screen with this much room (`window.screen`): part of it, and never more than a readable size. */
export function limitsFor(screen: { availWidth: number; availHeight: number }): Limits {
    return {
        minWidth: MIN_WIDTH,
        maxWidth: Math.max(MIN_WIDTH, Math.min(900, Math.round(screen.availWidth * 0.6))),
        maxHeight: Math.min(800, Math.round(screen.availHeight * 0.75)),
    };
}

/**
 * The size for the window. The width only grows, unless `fromLeastWidth` says to work it out anew, which the caller
 * does when the source text has changed. After a change of width the text wraps differently, so the caller measures
 * again and the height then comes from the real layout.
 *
 * A window that would be taller than it may be shows the translations in full before the source text: the box around
 * the source text gives up the height that is missing, down to a few lines.
 */
export function fitSize(measured: Measured, limits: Limits, fromLeastWidth = false): Fit {
    const { lineHeight } = measured;
    const lines = measured.textHeights.map((height) => Math.round(height / lineHeight));
    const longest = Math.max(0, ...lines);
    const fixed = measured.height - measured.textHeights.reduce((sum, height) => sum + height, 0);
    const textWidth = measured.width - TEXT_MARGIN;
    const heightAt = (width: number) =>
        fixed + lines.reduce((sum, n) => sum + Math.ceil((n * textWidth) / (width - TEXT_MARGIN)) * lineHeight, 0);

    let width = fromLeastWidth ? limits.minWidth : Math.max(measured.width, limits.minWidth);
    let height = width === measured.width ? measured.height : heightAt(width);
    if (longest >= WRAPPED_LINES) {
        // Wider than this, the longest text is on one line already
        const widest = Math.min(limits.maxWidth, textWidth * longest + TEXT_MARGIN);
        while (height > TALLEST * width && width < widest) {
            width = Math.min(width + WIDTH_STEP, widest);
            height = heightAt(width);
        }
    }
    width = Math.round(width);
    if (width !== measured.width) {
        return { width, height: Math.round(Math.min(height, limits.maxHeight)) };
    }
    const least = Math.min(measured.sourceHeight, SOURCE_LINES * lineHeight + SOURCE_PADDING);
    const sourceHeight = Math.max(least, measured.sourceHeight - Math.max(0, height - limits.maxHeight));
    height -= measured.sourceHeight - sourceHeight;
    return {
        width,
        height: Math.round(Math.min(height, limits.maxHeight)),
        sourceHeight: sourceHeight < measured.sourceHeight ? sourceHeight : null,
    };
}
