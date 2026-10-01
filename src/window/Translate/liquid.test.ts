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

    // The x of the right side: where the second curve, the top right corner, ends
    const right = (clipPath: string) => (clipPath.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)[12];

    it('run ahead on the sides the disc is near', () => {
        // The disc is at the top left, so the left side is home before the right one
        const frames = liquidFrames(DISC, 600, 400);
        const middle = frames[Math.floor(frames.length / 2)];

        expect(middle.clipPath).toMatch(/^path\('M \d+(\.\d+)? 0 /);
        expect(right(middle.clipPath)).toBeLessThan(600);
    });

    it('run the other way from a disc at the bottom right', () => {
        const frames = liquidFrames({ x: 524, y: 324, size: 64 }, 600, 400);
        const middle = frames[Math.floor(frames.length / 2)];

        // The right and bottom sides are home, the top one is not
        expect(right(middle.clipPath)).toBe(600);
        expect(middle.clipPath).not.toMatch(/^path\('M \d+(\.\d+)? 0 /);
    });

    it('never stand still on the way: the far side moves at every step, a little less each time', () => {
        const frames = liquidFrames(DISC, 600, 400);
        const steps = frames.slice(1).map((frame, i) => right(frame.clipPath) - right(frames[i].clipPath));
        // Until it is within a pixel of home: the path is written to a tenth of a pixel
        const moving = steps.filter((step, i) => right(frames[i].clipPath) < 599);

        expect(frames.length).toBeGreaterThanOrEqual(20);
        expect(new Set(frames.map((frame) => frame.easing))).toEqual(new Set(['linear']));
        expect(Math.min(...moving)).toBeGreaterThan(0);
        // The side only slows down: no stop and go.
        moving.slice(1).forEach((step, i) => expect(step).toBeLessThanOrEqual(moving[i] + 0.2));
    });
});
