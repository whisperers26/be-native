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

describe('Recognize settings page', () => {
    it('shows the recognition settings', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('Recognition Language')).toBeInTheDocument();
        expect(await screen.findByText('Merge Wrapped Lines')).toBeInTheDocument();
        expect(await screen.findByText('Close window when focus lost')).toBeInTheDocument();
        expect(await screen.findByText('Hide Recognition Window')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
