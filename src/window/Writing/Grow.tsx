import React from 'react';
import useMeasure from 'react-use-measure';
import type { ReactNode } from 'react';

/** How long a box takes to get to a new height. */
export const GROW_MS = 260;

interface GrowProps {
    /** Off: the box has the height of what it holds, at once. */
    animated: boolean;
    /** Closed: the box has no height, and what it holds is kept. */
    open?: boolean;
    children: ReactNode;
}

/**
 * A box that moves to the height of what it holds instead of jumping there: from nothing when it first shows, and from
 * its old height when what it holds changes. What lies below it moves with it, and the window follows through its
 * own fit (`index.tsx`), so nothing on the way is seen to jump.
 */
export default function Grow(props: GrowProps) {
    const { animated, open = true, children } = props;
    // The size as laid out, which is what the height is set to.
    const [ref, bounds] = useMeasure({ offsetSize: true });

    if (!animated) {
        return <div className={open ? undefined : 'hidden'}>{children}</div>;
    }
    return (
        <div
            style={{
                height: open ? bounds.height : 0,
                opacity: open && bounds.height > 0 ? 1 : 0,
                overflow: 'hidden',
                transition: `height ${GROW_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${GROW_MS}ms ease-out`,
            }}
        >
            <div ref={ref}>{children}</div>
        </div>
    );
}
