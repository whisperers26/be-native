import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'recognize' }], __currentWindow: { label: 'recognize' } };
});

import Recognize from './index';

describe('Recognize window', () => {
    it('renders its controls with the default OCR service', async () => {
        render(
            <NextUIProvider>
                <Recognize />
            </NextUIProvider>
        );

        expect(await screen.findByRole('button', { name: /Recognize/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Translate/ })).toBeInTheDocument();
        expect(await screen.findByText('RapidOCR')).toBeInTheDocument();
        await vi.waitFor(() => expect(fakeTauri.calls.some((call) => call.cmd === 'get_base64')).toBe(true));
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
