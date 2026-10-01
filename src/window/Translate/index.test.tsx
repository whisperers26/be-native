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

    it('does not save the window size or position in test mode', async () => {
        fakeTauri.command('test_mode', () => true);
        fakeTauri.store.set('translate_remember_window_size', true);
        fakeTauri.store.set('translate_window_position', 'pre_state');
        fakeTauri.store.set('translate_detect_engine', 'local');
        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );
        await screen.findByText('Google');

        fakeTauri.emit('tauri://resize', null);
        fakeTauri.emit('tauri://move', null);
        // Both are saved 100 ms after the event.
        await new Promise((done) => setTimeout(done, 300));

        expect(fakeTauri.store.has('translate_window_width')).toBe(false);
        expect(fakeTauri.store.has('translate_window_position_x')).toBe(false);
    });

    it('saves the size in logical pixels, rounded, by the scale of the window', async () => {
        fakeTauri.store.set('translate_remember_window_size', true);
        fakeTauri.store.set('translate_detect_engine', 'local');
        // 350 x 528 logical pixels at 125%: Windows rounds 437.5 up
        fakeTauri.window = { size: { width: 438, height: 660 }, scaleFactor: 1.25 };
        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );
        await screen.findByText('Google');

        fakeTauri.emit('tauri://resize', null);

        await vi.waitFor(() => expect(fakeTauri.store.get('translate_window_width')).toBe(350));
        expect(fakeTauri.store.get('translate_window_height')).toBe(528);
    });

    it('asks for the size of what it shows when the size is not remembered', async () => {
        fakeTauri.store.set('translate_detect_engine', 'local');
        // jsdom lays nothing out and has no screen: the content is 500 px tall, in a part of the window 35 px
        // shorter than the window.
        const observed: { target: Element; changed: () => void }[] = [];
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(private changed: () => void) {}
                observe(target: Element) {
                    observed.push({ target, changed: this.changed });
                }
                unobserve() {}
                disconnect() {}
            }
        );
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
            return this.tagName === 'TEXTAREA' ? 24 : 500;
        });
        vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(window.innerHeight - 35);
        vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1080 });
        try {
            render(
                <NextUIProvider>
                    <Translate />
                </NextUIProvider>
            );
            await screen.findByText('Google');

            const content = observed.find(({ target }) => target.parentElement?.className.includes('overflow-y-auto'));
            content!.changed();

            await vi.waitFor(() =>
                expect(fakeTauri.calls.find((call) => call.cmd === 'fit_translate_window')?.args).toEqual({
                    width: window.innerWidth,
                    height: 535,
                })
            );
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });

    it('keeps the size it has when the size is remembered', async () => {
        fakeTauri.store.set('translate_remember_window_size', true);
        fakeTauri.store.set('translate_detect_engine', 'local');
        fakeTauri.command('get_text', () => 'hello world');
        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        await screen.findByDisplayValue('hello world');

        expect(fakeTauri.calls.filter((call) => call.cmd === 'fit_translate_window')).toEqual([]);
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
