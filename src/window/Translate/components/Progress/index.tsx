import React, { useEffect, useState } from 'react';

import { DISC_SIZE, WAITING_SIZE } from '../../progress';

interface ProgressProps {
    /** The icons of the services at work. More than one take turns. */
    icons: string[];
    /** Where the indicator is in the window, which matters once the window has grown around it. */
    origin: { x: number; y: number };
    /** Whether the window is opening: it comes out of the indicator, which fades into it. */
    leaving: boolean;
    onPress: () => void;
}

const TURN = 1400;
const DISC = DISC_SIZE;
const RING = 29;
const ROUND = 2 * Math.PI * RING;

/** A round progress indicator with the icon of the service at work in it: all there is of the window while it waits. */
export default function Progress(props: ProgressProps) {
    const { icons, origin, leaving, onPress } = props;
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
                transition: 'transform 200ms ease-out, opacity 160ms ease-out',
                transform: leaving ? 'scale(0.82)' : 'scale(1)',
                opacity: leaving ? 0 : 1,
                pointerEvents: leaving ? 'none' : 'auto',
            }}
            onClick={onPress}
        >
            <div className='translate-progress-appear'>
                <div
                    className='relative rounded-full bg-content1 shadow-md translate-progress-breathe'
                    style={{ width: DISC, height: DISC }}
                >
                    <svg
                        className='absolute inset-0'
                        width={DISC}
                        height={DISC}
                        viewBox={`0 0 ${DISC} ${DISC}`}
                        fill='none'
                        strokeWidth={3}
                        strokeLinecap='round'
                    >
                        <circle
                            className='text-default-200'
                            cx={DISC / 2}
                            cy={DISC / 2}
                            r={RING}
                            stroke='currentColor'
                        />
                        <circle
                            className='text-secondary translate-progress-back'
                            cx={DISC / 2}
                            cy={DISC / 2}
                            r={RING}
                            stroke='currentColor'
                            strokeOpacity={0.45}
                            strokeDasharray={`${ROUND * 0.16} ${ROUND * 0.84}`}
                        />
                        <circle
                            className='text-primary translate-progress-arc'
                            cx={DISC / 2}
                            cy={DISC / 2}
                            r={RING}
                            stroke='currentColor'
                        />
                    </svg>
                    {icon !== undefined && (
                        <img
                            // A new key makes a new element, which plays the entry animation: the icons take turns.
                            key={icon}
                            src={icon}
                            draggable={false}
                            className='absolute inset-0 m-auto h-[30px] w-[30px] object-contain translate-progress-icon'
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
