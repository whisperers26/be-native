import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Page from './index';

describe('Backup settings page', () => {
    it('shows the backup settings', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('Service Type')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
