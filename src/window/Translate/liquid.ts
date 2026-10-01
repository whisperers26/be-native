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

// How many steps the way is cut into. The shape is worked out anew for each, from curves that run through the whole
// way, and between two steps so close a straight line will do. Keyframes that each ease in and out, however few,
// bring the shape to rest at every one of them, which shows as a stutter.
const FRAMES = 30;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
// Fast at first and ever slower: the way of something let go
const settle = (n: number) => 1 - (1 - clamp(n)) ** 3;
// Up from nothing and back to nothing
const swell = (n: number) => Math.sin(Math.PI * clamp(n));

// Where the shape is at `t`, from 0 to 1. The sides near the disc are home by half way. The far ones are home at
// four fifths, bowed out on the way, and then swing in a little and back.
function shapeAt(t: number) {
    return {
        near: settle(t / 0.5),
        far: settle(t / 0.8),
        // A drop is rounder than the disc it comes from, and the window's corners are sharper
        radius: (1 + 0.5 * swell(t / 0.5)) * (1 - settle(t / 0.85)),
        bowNear: 4 * swell(t / 0.5),
        bowFar: t < 0.8 ? 16 * swell(t / 0.8) : -6 * swell((t - 0.8) / 0.2),
    };
}

/** The keyframes of the clip path of a window of `width` x `height` as it comes out of `disc`. */
export function liquidFrames(disc: Disc, width: number, height: number): LiquidFrame[] {
    const start = { left: disc.x, top: disc.y, right: disc.x + disc.size, bottom: disc.y + disc.size };
    // The side of each pair with more of the window beyond it is the far one.
    const rightFar = width - start.right >= start.left;
    const bottomFar = height - start.bottom >= start.top;
    return Array.from({ length: FRAMES + 1 }, (_, i) => {
        const offset = i / FRAMES;
        const step = shapeAt(offset);
        const part = (far: boolean) => (far ? step.far : step.near);
        const bow = (far: boolean) => (far ? step.bowFar : step.bowNear);
        return {
            offset,
            easing: 'linear',
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
