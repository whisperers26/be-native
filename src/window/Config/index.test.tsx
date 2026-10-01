import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Config from './index';

const PAGES = ['General', 'Translate', 'Recognize', 'Hotkey', 'Service', 'History', 'About'];

describe('Config window', () => {
    it('shows the sidebar and opens on the General page', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter initialEntries={['/']}>
                    <Config />
                </MemoryRouter>
            </NextUIProvider>
        );

        for (const page of PAGES) {
            expect(await screen.findByRole('button', { name: new RegExp(`^${page}$`) })).toBeInTheDocument();
        }
        expect(await screen.findByText('General Settings')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
