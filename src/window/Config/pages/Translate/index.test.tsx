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

describe('Translate settings page', () => {
    it('shows the translation settings', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('Source Language')).toBeInTheDocument();
        expect(await screen.findByText('Target Language')).toBeInTheDocument();
        expect(await screen.findByText('Secondary Target Language')).toBeInTheDocument();
        expect(await screen.findByText('Auto Copy')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
