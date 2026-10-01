import { describe, expect, it } from 'vitest';
import { liquidFrames } from './liquid';

const DISC = { x: 12, y: 12, size: 64 };

describe('the shapes the Translate window opens through', () => {
    it('start as the disc', () => {
        const [first] = liquidFrames(DISC, 600, 400);

        expect(first.offset).toBe(0);
        // A circle of radius 32 around (44, 44): its top, right, bottom and left points
        expect(first.clipPath).toContain('M 44 12');
        expect(first.clipPath).toContain('76 44');
        expect(first.clipPath).toContain('44 76');
        expect(first.clipPath).toContain('12 44');
    });

    it('end as the whole window, with its corners rounded', () => {
        const frames = liquidFrames(DISC, 600, 400);
        const last = frames[frames.length - 1];

        expect(last.offset).toBe(1);
        expect(last.clipPath).toBe(
            "path('M 8 0 C 202.7 0 397.3 0 592 0 C 596.4 0 600 3.6 600 8 C 600 136 600 264 600 392 " +
                'C 600 396.4 596.4 400 592 400 C 397.3 400 202.7 400 8 400 C 3.6 400 0 396.4 0 392 ' +
                "C 0 264 0 136 0 8 C 0 3.6 3.6 0 8 0 Z')"
        );
    });

    it('are all drawn with the same commands, so that one can turn into the next', () => {
        const commands = liquidFrames(DISC, 600, 400).map((frame) => frame.clipPath.replace(/[^A-Z]/g, ''));

        expect(new Set(commands)).toEqual(new Set(['MCCCCCCCCZ']));
    });

    it('run ahead on the sides the disc is near', () => {
        // The disc is at the top left, so the left side is home before the right one
        const middle = liquidFrames(DISC, 600, 400)[2];

        expect(middle.clipPath).toMatch(/^path\('M \d+(\.\d+)? 0 /);
        expect(middle.clipPath).not.toContain(' 600 ');
    });

    it('run the other way from a disc at the bottom right', () => {
        const middle = liquidFrames({ x: 524, y: 324, size: 64 }, 600, 400)[2];

        // The right and bottom sides are home, the top one is not
        expect(middle.clipPath).toContain(' 600 ');
        expect(middle.clipPath).not.toMatch(/^path\('M \d+(\.\d+)? 0 /);
    });
});
