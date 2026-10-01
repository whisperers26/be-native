import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import { initEnv } from '../../../../utils/env';
import Page from './index';

describe('About settings page', () => {
    it('shows the version and links', async () => {
        await initEnv();
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('3.0.7')).toBeInTheDocument();
        expect(await screen.findByText('Website')).toBeInTheDocument();
        expect(await screen.findByText('GitHub')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });
});
