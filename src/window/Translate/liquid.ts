// The shapes the Translate window goes through as it comes out of its progress indicator: a drop that swells around
// the indicator's disc, runs towards the far edges of the window with its sides bowed out, and settles into the
// window's rectangle with a last small wobble. Arithmetic only, in the window's logical pixels.

export interface Disc {
    /** The top left corner of the square around the disc. */
    x: number;
    y: number;
    size: number;
}

// A type and not an interface, so that it is a keyframe of the Web Animations API as it is
export type LiquidFrame = {
    offset: number;
    clipPath: string;
    easing: string;
};

/** How far each side bows out (inwards when negative). */
interface Bow {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

// The control points of a quarter circle lie this far along its radius
const QUARTER = 0.5523;
// The radius the window's corners end with
const CORNER = 8;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A rounded rectangle whose sides are curves, as a path: always a move, eight curves and a close, so that one shape
 * can turn into another.
 */
function blob(left: number, top: number, right: number, bottom: number, radius: number, bow: Bow): string {
    const r = Math.max(0, Math.min(radius, (right - left) / 2, (bottom - top) / 2));
    const k = r * QUARTER;
    // The control points of a side sit a third of the way in from its ends, pushed out by the bow.
    const across = (right - left - 2 * r) / 3;
    const down = (bottom - top - 2 * r) / 3;
    const p = (...numbers: number[]) => numbers.map(round).join(' ');
    return [
        `M ${p(left + r, top)}`,
        `C ${p(left + r + across, top - bow.top, right - r - across, top - bow.top, right - r, top)}`,
        `C ${p(right - r + k, top, right, top + r - k, right, top + r)}`,
        `C ${p(right + bow.right, top + r + down, right + bow.right, bottom - r - down, right, bottom - r)}`,
        `C ${p(right, bottom - r + k, right - r + k, bottom, right - r, bottom)}`,
        `C ${p(right - r - across, bottom + bow.bottom, left + r + across, bottom + bow.bottom, left + r, bottom)}`,
        `C ${p(left + r - k, bottom, left, bottom - r + k, left, bottom - r)}`,
        `C ${p(left - bow.left, bottom - r - down, left - bow.left, top + r + down, left, top + r)}`,
        `C ${p(left, top + r - k, left + r - k, top, left + r, top)}`,
        'Z',
    ].join(' ');
}

// How far each step has got: the sides near the disc are there early, the far ones run behind, bowed out, and
// swing back a little past flat before they come to rest.
const STEPS = [
    { offset: 0, near: 0, far: 0, radius: 1, bowNear: 0, bowFar: 0 },
    { offset: 0.24, near: 0.55, far: 0.2, radius: 1.5, bowNear: 4, bowFar: 10 },
    { offset: 0.56, near: 1, far: 0.86, radius: 1.3, bowNear: 0, bowFar: 16 },
    { offset: 0.8, near: 1, far: 1, radius: 0.6, bowNear: 0, bowFar: -6 },
    { offset: 1, near: 1, far: 1, radius: 0, bowNear: 0, bowFar: 0 },
];

/** The keyframes of the clip path of a window of `width` x `height` as it comes out of `disc`. */
export function liquidFrames(disc: Disc, width: number, height: number): LiquidFrame[] {
    const start = { left: disc.x, top: disc.y, right: disc.x + disc.size, bottom: disc.y + disc.size };
    // The side of each pair with more of the window beyond it is the far one.
    const rightFar = width - start.right >= start.left;
    const bottomFar = height - start.bottom >= start.top;
    return STEPS.map((step) => {
        const part = (far: boolean) => (far ? step.far : step.near);
        const bow = (far: boolean) => (far ? step.bowFar : step.bowNear);
        return {
            offset: step.offset,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            clipPath: `path('${blob(
                start.left * (1 - part(!rightFar)),
                start.top * (1 - part(!bottomFar)),
                start.right + (width - start.right) * part(rightFar),
                start.bottom + (height - start.bottom) * part(bottomFar),
                CORNER + (disc.size / 2 - CORNER) * step.radius,
                { top: bow(!bottomFar), right: bow(rightFar), bottom: bow(bottomFar), left: bow(!rightFar) }
            )}')`,
        };
    });
}
