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

describe('Hotkey settings page', () => {
    it('shows the six global shortcuts', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('Selection Translation')).toBeInTheDocument();
        expect(await screen.findByText('Text Translation')).toBeInTheDocument();
        expect(await screen.findByText('Text Recognition')).toBeInTheDocument();
        expect(await screen.findByText('Screenshot Translation')).toBeInTheDocument();
        expect(await screen.findByText('Silent Text Recognition (copy only)')).toBeInTheDocument();
        expect(await screen.findByText('Writing Improvement')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
