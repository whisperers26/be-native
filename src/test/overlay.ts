import { fireEvent } from '@testing-library/react';

/** Hovers an element as a mouse does, which opens the tooltip of a button. */
export function hover(element: Element) {
    // react-aria takes a hover for a mouse's only once a pointer has moved somewhere. It listens to pointer events
    // where the browser has them and to mouse events where it does not; a mouse sends both.
    fireEvent.pointerMove(document.body, { pointerType: 'mouse' });
    fireEvent.mouseMove(document.body);
    fireEvent.pointerOver(element, { pointerType: 'mouse' });
    fireEvent.mouseOver(element);
}

/**
 * The fade and scale that an overlay (a tooltip, a menu) and the boxes it sits in are drawn with, one entry per box.
 * An overlay that comes in with an animation has some until the animation is over; one drawn at once has none.
 */
export function motionStyles(overlay: HTMLElement): string[] {
    const styles: string[] = [];
    for (let box: HTMLElement | null = overlay; box && box !== document.body; box = box.parentElement) {
        if (box.style.opacity !== '' || box.style.transform !== '') {
            styles.push(`opacity: ${box.style.opacity}; transform: ${box.style.transform}`);
        }
    }
    return styles;
}
