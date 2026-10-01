import { NextUIProvider } from '@nextui-org/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../../../test/fake-tauri';
import { DEFAULT_TONES } from '../../../../utils/writing_tones';
import '../../../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'config' }], __currentWindow: { label: 'config' } };
});

import Page from './index';

function open() {
    render(
        <NextUIProvider>
            <MemoryRouter>
                <Page />
            </MemoryRouter>
        </NextUIProvider>
    );
}

describe('Writing settings page', () => {
    it('shows the five default tones and the window settings', async () => {
        open();

        for (const tone of DEFAULT_TONES) {
            expect(await screen.findByDisplayValue(tone.name)).toBeInTheDocument();
            expect(screen.getByDisplayValue(tone.instruction)).toBeInTheDocument();
        }
        expect(DEFAULT_TONES).toHaveLength(5);
        expect(screen.getByText('Window Animations')).toBeInTheDocument();
        expect(screen.getByText('Close window when focus lost')).toBeInTheDocument();
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('saves a tone that is changed', async () => {
        open();

        fireEvent.change(await screen.findByDisplayValue('Casual'), { target: { value: 'Chatty' } });

        await vi.waitFor(() =>
            expect((fakeTauri.store.get('writing_tones') as { name: string }[]).map((tone) => tone.name)).toEqual([
                'Professional',
                'Chatty',
                'Friendly',
                'Confident',
                'Concise',
            ])
        );
    });

    it('removes a tone, adds one, and resets to the defaults', async () => {
        fakeTauri.store.set('writing_tones', [{ name: 'Pirate', instruction: 'Like a pirate.' }]);
        open();
        await screen.findByDisplayValue('Pirate');

        fireEvent.click(screen.getByRole('button', { name: 'Add Tone' }));
        expect(await screen.findAllByRole('textbox', { name: 'Name' })).toHaveLength(2);

        fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
        await vi.waitFor(() => expect(screen.queryByDisplayValue('Pirate')).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'Reset to Defaults' }));
        expect(await screen.findByDisplayValue('Professional')).toBeInTheDocument();
        await vi.waitFor(() => expect(fakeTauri.store.get('writing_tones')).toEqual(DEFAULT_TONES));
    });

    it('turns the window animations off', async () => {
        open();
        const label = await screen.findByText('Window Animations');
        const toggle = await vi.waitFor(() => {
            const input = label.parentElement!.querySelector('input');
            expect(input).not.toBeNull();
            return input!;
        });
        expect(toggle).toBeChecked();

        fireEvent.click(toggle);

        await vi.waitFor(() => expect(fakeTauri.store.get('writing_window_animation')).toBe(false));
    });
});
