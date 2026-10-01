import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'translate' }], __currentWindow: { label: 'translate' } };
});

import Translate from './index';

describe('Translate window', () => {
    it('renders the source box and a card per default translate service', async () => {
        // The window detects the language of its (empty) text on open; keep that off the network.
        fakeTauri.store.set('translate_detect_engine', 'local');

        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        for (const title of ['DeepL', 'Bing', 'Lingva', 'Yandex', 'Google', 'ECDict(Online)']) {
            expect(await screen.findByText(title)).toBeInTheDocument();
        }
        const boxes = screen.getAllByRole('textbox');
        expect(boxes.filter((box) => !box.hasAttribute('readonly'))).toHaveLength(1);
        expect(boxes.filter((box) => box.hasAttribute('readonly'))).toHaveLength(6);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('uses Google alone in test mode, whatever services are set', async () => {
        fakeTauri.command('test_mode', () => true);
        fakeTauri.store.set('translate_service_list', ['deepl', 'bing']);
        fakeTauri.store.set('translate_detect_engine', 'local');

        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        expect(await screen.findByText('Google')).toBeInTheDocument();
        expect(screen.queryByText('DeepL')).not.toBeInTheDocument();
        expect(screen.queryByText('Bing')).not.toBeInTheDocument();
        expect(fakeTauri.store.get('translate_service_list')).toEqual(['deepl', 'bing']);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('shows text that arrives from Rust in the source box', async () => {
        fakeTauri.command('get_text', () => 'hello world');
        fakeTauri.command('lang_detect', () => 'en');
        fakeTauri.store.set('translate_detect_engine', 'local');

        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        expect(await screen.findByDisplayValue('hello world')).toBeInTheDocument();
    });
});
