import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'screenshot' }], __currentWindow: { label: 'screenshot' } };
});

import Screenshot from './index';

const CAPTURE = `asset://localhost/${encodeURIComponent('/fake/AppCache/pot_screenshot.png')}`;

describe('Screenshot window', () => {
    it('captures the current monitor and shows the capture', async () => {
        render(<Screenshot />);

        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', CAPTURE));
        expect(fakeTauri.calls.find((call) => call.cmd === 'screenshot')?.args).toEqual({ x: 0, y: 0 });
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('draws a line across the window each way through the pointer', async () => {
        const { container } = render(<Screenshot />);
        await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', CAPTURE));

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
});
