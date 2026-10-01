import { NextUIProvider } from '@nextui-org/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Page from './index';

describe('General settings page', () => {
    it('shows the app-wide settings', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );

        expect(await screen.findByText('Auto Startup')).toBeInTheDocument();
        expect(await screen.findByText('Check Update')).toBeInTheDocument();
        expect(await screen.findByText('Listening Port')).toBeInTheDocument();
        expect(await screen.findByText('Display Language')).toBeInTheDocument();
        expect(await screen.findByText('Theme')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('turns the window animations off for every window', async () => {
        render(
            <NextUIProvider>
                <MemoryRouter>
                    <Page />
                </MemoryRouter>
            </NextUIProvider>
        );
        const label = await screen.findByText('Window Animations');
        // The switch comes once the setting has been read: on, unless it was turned off.
        const toggle = await vi.waitFor(() => {
            const input = label.parentElement!.querySelector('input');
            expect(input).not.toBeNull();
            return input!;
        });
        expect(toggle).toBeChecked();

        fireEvent.click(toggle);

        await vi.waitFor(() => expect(fakeTauri.store.get('window_animation')).toBe(false));
    });
});
