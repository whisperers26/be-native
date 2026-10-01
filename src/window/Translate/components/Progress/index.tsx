import React, { useEffect, useState } from 'react';

import { WAITING_SIZE } from '../../progress';

interface ProgressProps {
    /** The icons of the services at work. More than one take turns. */
    icons: string[];
    /** Whether the window is opening: the indicator then grows into it and fades. */
    leaving: boolean;
    onPress: () => void;
}

const TURN = 1400;
const DISC = 64;
const RING = 29;
const ROUND = 2 * Math.PI * RING;

/** A round progress indicator with the icon of the service at work in it: all there is of the window while it waits. */
export default function Progress(props: ProgressProps) {
    const { icons, leaving, onPress } = props;
    const [turn, setTurn] = useState(0);
    useEffect(() => {
        if (icons.length < 2) return;
        const timer = setInterval(() => setTurn((n) => n + 1), TURN);
        return () => clearInterval(timer);
    }, [icons.length]);
    const icon = icons.length > 0 ? icons[turn % icons.length] : undefined;

    return (
        <div
            className='fixed top-0 left-0 flex items-center justify-center cursor-pointer select-none'
            style={{
                width: WAITING_SIZE,
                height: WAITING_SIZE,
                transition: 'transform 220ms ease-in, opacity 180ms ease-in',
                transform: leaving ? 'scale(2.4)' : 'scale(1)',
                opacity: leaving ? 0 : 1,
                pointerEvents: leaving ? 'none' : 'auto',
            }}
            onClick={onPress}
        >
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
    );
}
