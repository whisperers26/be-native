import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'screenshot' }], __currentWindow: { label: 'screenshot' } };
});

import Screenshot from './index';

describe('Screenshot window', () => {
    it('captures the current monitor and shows the capture', async () => {
        render(<Screenshot />);

        await waitFor(() =>
            expect(screen.getByRole('img')).toHaveAttribute(
                'src',
                `asset://localhost/${encodeURIComponent('/fake/AppCache/pot_screenshot.png')}`
            )
        );
        expect(fakeTauri.calls.find((call) => call.cmd === 'screenshot')?.args).toEqual({ x: 0, y: 0 });
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
