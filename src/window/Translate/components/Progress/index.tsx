import React, { useEffect, useState } from 'react';

import { DISC_SIZE, WAITING_SIZE } from '../../progress';

interface ProgressProps {
    /** The icons of the services at work. More than one take turns. */
    icons: string[];
    /** Where the indicator is in the window, which matters once the window has grown around it. */
    origin: { x: number; y: number };
    /** Whether the window is opening: it comes out of the indicator, which fades into it. */
    leaving: boolean;
    /** Whether the indicator comes, goes and changes its icon with an animation. The ring turns either way. */
    animated: boolean;
    onPress: () => void;
}

const TURN = 1400;
const DISC = DISC_SIZE;
const RING = 29;
const ROUND = 2 * Math.PI * RING;
const ring = {
    width: DISC,
    height: DISC,
    viewBox: `0 0 ${DISC} ${DISC}`,
    fill: 'none',
    strokeWidth: 3,
    strokeLinecap: 'round',
} as const;
const circle = { cx: DISC / 2, cy: DISC / 2, r: RING };

/** A round progress indicator with the icon of the service at work in it: all there is of the window while it waits. */
export default function Progress(props: ProgressProps) {
    const { icons, origin, leaving, animated, onPress } = props;
    const [turn, setTurn] = useState(0);
    useEffect(() => {
        if (icons.length < 2) return;
        const timer = setInterval(() => setTurn((n) => n + 1), TURN);
        return () => clearInterval(timer);
    }, [icons.length]);
    const icon = icons.length > 0 ? icons[turn % icons.length] : undefined;

    return (
        <div
            className='fixed flex items-center justify-center cursor-pointer select-none z-50'
            style={{
                left: origin.x,
                top: origin.y,
                width: WAITING_SIZE,
                height: WAITING_SIZE,
                transition: animated ? 'transform 200ms ease-out, opacity 160ms ease-out' : undefined,
                transform: leaving ? 'scale(0.82)' : 'scale(1)',
                opacity: leaving ? 0 : 1,
                pointerEvents: leaving ? 'none' : 'auto',
            }}
            onClick={onPress}
        >
            <div className={animated ? 'translate-progress-appear' : undefined}>
                <div
                    className={`relative rounded-full bg-content1 shadow-md ${animated && 'translate-progress-breathe'}`}
                    style={{ width: DISC, height: DISC }}
                >
                    {/* Each arc is a picture in a box of its own, and the box turns. The compositor turns a box
                        without the page's thread, which recognition in the window (RapidOCR) keeps busy for as long
                        as it takes. It does not do that for an svg element itself, let alone for an arc inside
                        one: animated there, the ring stood still until the text was recognized. */}
                    <svg
                        className='absolute inset-0 text-default-200'
                        {...ring}
                    >
                        <circle
                            {...circle}
                            stroke='currentColor'
                        />
                    </svg>
                    <div className='absolute inset-0 translate-progress-back'>
                        <svg
                            className='absolute inset-0 text-secondary'
                            {...ring}
                        >
                            <circle
                                {...circle}
                                stroke='currentColor'
                                strokeOpacity={0.45}
                                strokeDasharray={`${ROUND * 0.16} ${ROUND * 0.84}`}
                            />
                        </svg>
                    </div>
                    <div className='absolute inset-0 translate-progress-arc'>
                        <svg
                            className='absolute inset-0 text-primary'
                            {...ring}
                        >
                            <circle
                                {...circle}
                                stroke='currentColor'
                                strokeDasharray={`${ROUND * 0.3} ${ROUND * 0.7}`}
                            />
                        </svg>
                    </div>
                    {icon !== undefined && (
                        <img
                            // A new key makes a new element, which plays the entry animation: the icons take turns.
                            key={icon}
                            src={icon}
                            draggable={false}
                            className={`absolute inset-0 m-auto h-[30px] w-[30px] object-contain ${animated && 'translate-progress-icon'}`}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
