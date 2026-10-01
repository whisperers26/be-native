import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'next-themes';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from './test/fake-tauri';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import App from './App';

describe('App', () => {
    it('renders the window that matches its label', async () => {
        render(
            <NextUIProvider>
                <ThemeProvider attribute='class'>
                    <App />
                </ThemeProvider>
            </NextUIProvider>
        );

        expect(await screen.findByText('General Settings')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('applies the font size setting to the page', async () => {
        fakeTauri.store.set('app_font_size', 18);

        render(
            <NextUIProvider>
                <ThemeProvider attribute='class'>
                    <App />
                </ThemeProvider>
            </NextUIProvider>
        );

        await vi.waitFor(() => expect(document.documentElement.style.fontSize).toBe('18px'));
    });
});
