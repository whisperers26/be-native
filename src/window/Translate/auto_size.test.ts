import { describe, expect, it } from 'vitest';
import { fitSize, limitsFor } from './auto_size';

const LIMITS = { minWidth: 420, maxWidth: 900, maxHeight: 720 };
const LINE = 24;

describe('the size the Translate window gives itself', () => {
    it('takes the height of what it shows', () => {
        const size = fitSize({ width: 420, height: 270, textHeights: [50, 24], lineHeight: LINE, sourceHeight: 62 }, LIMITS);

        expect(size).toEqual({ width: 420, height: 270, sourceHeight: null });
    });

    it('gets wider instead of taller than wide when its text wraps', () => {
        // 230 px of buttons and headers, and two texts of 9 lines each
        const size = fitSize({ width: 420, height: 662, textHeights: [216, 216], lineHeight: LINE, sourceHeight: 228 }, LIMITS);

        expect(size.width).toBeGreaterThan(420);
        expect(size.width).toBeLessThan(900);
        expect(size.height).toBeLessThanOrEqual(0.7 * size.width);
    });

    it('stays narrow when nothing wraps, however many cards there are', () => {
        const size = fitSize(
            { width: 420, height: 650, textHeights: [50, 24, 24, 24, 24, 24, 24], lineHeight: LINE, sourceHeight: 62 },
            LIMITS
        );

        expect(size).toEqual({ width: 420, height: 650, sourceHeight: null });
    });

    it('stops at the widest and tallest it may be, and the rest scrolls', () => {
        const size = fitSize({ width: 420, height: 3302, textHeights: [1536, 1536], lineHeight: LINE, sourceHeight: 1548 }, LIMITS);

        expect(size).toEqual({ width: 900, height: 720 });
    });

    it('shortens the source text, not the translation, when it is as tall as it may be', () => {
        // At its widest: 230 px of buttons and headers, a source text of 20 lines and a translation of 15
        const size = fitSize(
            { width: 900, height: 1070, textHeights: [480, 360], lineHeight: LINE, sourceHeight: 492 },
            LIMITS
        );

        // 350 px too tall: the source text gives them up, and a little more to end on a whole line
        expect(size).toEqual({ width: 900, height: 710, sourceHeight: 132 });
    });

    it('leaves the source text three lines, and then the window scrolls', () => {
        const size = fitSize(
            { width: 900, height: 2030, textHeights: [480, 1320], lineHeight: LINE, sourceHeight: 492 },
            LIMITS
        );

        expect(size).toEqual({ width: 900, height: 720, sourceHeight: 84 });
    });

    it('works the width out anew for new text', () => {
        const size = fitSize(
            { width: 900, height: 270, textHeights: [50, 24], lineHeight: LINE, sourceHeight: 62 },
            LIMITS,
            true
        );

        expect(size.width).toBe(420);
    });

    it('gets no wider than its longest text needs for one line', () => {
        // Six cards of three lines: wider than 3 x 380 + 40 would only add empty room
        const limits = { minWidth: 420, maxWidth: 2000, maxHeight: 720 };
        const size = fitSize(
            { width: 420, height: 1100, textHeights: [72, 72, 72, 72, 72, 72, 72], lineHeight: LINE, sourceHeight: 84 },
            limits
        );

        expect(size.width).toBe(1180);
    });

    it('keeps a width the user made wider', () => {
        const size = fitSize({ width: 1000, height: 300, textHeights: [50, 24], lineHeight: LINE, sourceHeight: 62 }, LIMITS);

        expect(size).toEqual({ width: 1000, height: 300, sourceHeight: null });
    });

    it('is never narrower than the least width', () => {
        const size = fitSize({ width: 300, height: 300, textHeights: [50, 24], lineHeight: LINE, sourceHeight: 62 }, LIMITS);

        expect(size.width).toBe(420);
    });

    it('may take most of a small screen but only part of a large one', () => {
        expect(limitsFor({ availWidth: 1280, availHeight: 720 })).toEqual({
            minWidth: 420,
            maxWidth: 768,
            maxHeight: 540,
        });
        expect(limitsFor({ availWidth: 3840, availHeight: 2160 })).toEqual({
            minWidth: 420,
            maxWidth: 900,
            maxHeight: 800,
        });
    });
});
