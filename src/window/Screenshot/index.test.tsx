import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'screenshot' }], __currentWindow: { label: 'screenshot' } };
});

import Screenshot from './index';

const CAPTURE = `asset://localhost/${encodeURIComponent('/fake/AppCache/pot_screenshot.png')}`;

// What the window asked Tauri to do to itself, in order ('hide', 'setPosition', ...), leaving out what it only asked
// about.
function windowCommands(): { type: string; payload: unknown }[] {
    return fakeTauri.calls
        .filter((call) => call.cmd === 'tauri' && call.args.__tauriModule === 'Window')
        .map((call) => call.args.message.data.cmd)
        .filter((cmd) => cmd.type !== 'currentMonitor');
}

describe('Screenshot window', () => {
    it('captures the current monitor and shows the capture', async () => {
        render(<Screenshot />);

        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', `${CAPTURE}?1`));
        expect(fakeTauri.calls.find((call) => call.cmd === 'screenshot')?.args).toEqual({ x: 0, y: 0 });
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('draws a line across the window each way through the pointer', async () => {
        const { container } = render(<Screenshot />);
        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', `${CAPTURE}?1`));

        fireEvent.mouseMove(container.querySelector('.cursor-none')!, { clientX: 120, clientY: 80 });

        expect(screen.getByTestId('crosshair-horizontal')).toHaveStyle({ top: '80px' });
        expect(screen.getByTestId('crosshair-vertical')).toHaveStyle({ left: '120px' });
    });

    it('places the lines at the cursor before the mouse has moved', async () => {
        fakeTauri.command('cursor_position', () => ({ x: 300, y: 200, monitor: { x: 0, y: 0 } }));
        render(<Screenshot />);

        expect(await screen.findByTestId('crosshair-horizontal')).toHaveStyle({ top: '200px' });
        expect(screen.getByTestId('crosshair-vertical')).toHaveStyle({ left: '300px' });
    });

    it('hides the lines when the pointer leaves the window', async () => {
        const { container } = render(<Screenshot />);
        const overlay = container.querySelector('.cursor-none')!;
        fireEvent.mouseMove(overlay, { clientX: 120, clientY: 80 });

        fireEvent.mouseLeave(overlay);

        expect(screen.queryByTestId('crosshair-horizontal')).not.toBeInTheDocument();
    });

    it('follows the cursor to another monitor', async () => {
        render(<Screenshot />);
        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', `${CAPTURE}?1`));

        fakeTauri.command('cursor_position', () => ({ x: 2000, y: 50, monitor: { x: 1920, y: 0 } }));

        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', `${CAPTURE}?2`));
        expect(fakeTauri.calls.filter((call) => call.cmd === 'screenshot').map((call) => call.args)).toEqual([
            { x: 0, y: 0 },
            { x: 1920, y: 0 },
        ]);
        expect(windowCommands()).toEqual([
            { type: 'hide' },
            { type: 'setFullscreen', payload: false },
            { type: 'setPosition', payload: { type: 'Physical', data: { x: 1920, y: 0 } } },
            { type: 'setFullscreen', payload: true },
        ]);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('stays on its monitor while a region is being dragged', async () => {
        const { container } = render(<Screenshot />);
        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', `${CAPTURE}?1`));
        fireEvent.mouseDown(container.querySelector('.cursor-none')!, { buttons: 1, clientX: 10, clientY: 10 });

        let polls = 0;
        fakeTauri.command('cursor_position', () => {
            polls++;
            return { x: 2000, y: 50, monitor: { x: 1920, y: 0 } };
        });

        await waitFor(() => expect(polls).toBeGreaterThan(1));
        expect(fakeTauri.calls.filter((call) => call.cmd === 'screenshot')).toHaveLength(1);
    });
});
