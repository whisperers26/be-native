import { NextUIProvider } from '@nextui-org/react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import { httpMock } from '../../test/http';
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
        // jsdom lays nothing out and has no screen: the content is 500 px tall, 35 px below the top of the
        // window.
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
        vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (this: Element) {
            return this.tagName === 'TEXTAREA' ? 24 : 0;
        });
        vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) {
            return this.className.includes('h-full overflow-y-auto') ? 35 : 0;
        });
        vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1080 });
        // The least width, so that the window has no reason to change it.
        vi.stubGlobal('innerWidth', 420);
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
                    width: 420,
                    // 35 px above the content, its 500 px, and a pixel to spare
                    height: 536,
                    glide: true,
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

    it('opens from its progress indicator to the remembered size once there is nothing to wait for', async () => {
        fakeTauri.command('translate_window_waiting', () => true);
        fakeTauri.store.set('translate_remember_window_size', true);
        fakeTauri.store.set('translate_window_width', 598);
        fakeTauri.store.set('translate_window_height', 528);
        fakeTauri.store.set('translate_detect_engine', 'local');
        render(
            <Provider>
                <NextUIProvider>
                    <Translate />
                </NextUIProvider>
            </Provider>
        );

        // No text came, so no translation is on its way.
        await vi.waitFor(() =>
            expect(fakeTauri.calls.find((call) => call.cmd === 'fit_translate_window')?.args).toEqual({
                width: 598,
                height: 528,
                glide: false,
            })
        );
    });

    it('waits as a progress indicator while the text is on its way', async () => {
        fakeTauri.command('translate_window_waiting', () => true);
        fakeTauri.command('test_mode', () => true);
        fakeTauri.command('get_text', () => 'hello world');
        fakeTauri.store.set('translate_remember_window_size', true);
        fakeTauri.store.set('translate_detect_engine', 'local');
        // The language of the text is never detected, so the text never gets to the card.
        fakeTauri.command('lang_detect', () => new Promise(() => {}));
        render(
            <Provider>
                <NextUIProvider>
                    <Translate />
                </NextUIProvider>
            </Provider>
        );

        await screen.findByDisplayValue('hello world');
        await vi.waitFor(() =>
            expect(document.querySelector('img[src="logo/google.svg"].translate-progress-icon')).not.toBeNull()
        );
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

    it('says so beside the language when the web detection engine fails', async () => {
        fakeTauri.command('get_text', () => 'hello world');
        fakeTauri.command('test_mode', () => true);
        fakeTauri.store.set('translate_detect_engine', 'baidu');
        // The detection fails; then Google, the one card of test mode, translates
        httpMock.queue({ status: 500, data: {} }, { data: [[['你好世界', 'hello world']], null, 'en'] });

        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        expect(await screen.findByText('Detection failed (English)')).toBeInTheDocument();
    });

    it('shows a detected language as it is', async () => {
        fakeTauri.command('get_text', () => 'hello world');
        fakeTauri.command('test_mode', () => true);
        fakeTauri.store.set('translate_detect_engine', 'baidu');
        httpMock.queue({ data: { lan: 'en' } }, { data: [[['你好世界', 'hello world']], null, 'en'] });

        render(
            <NextUIProvider>
                <Translate />
            </NextUIProvider>
        );

        expect(await screen.findByText('English')).toBeInTheDocument();
        expect(screen.queryByText(/Detection failed/)).not.toBeInTheDocument();
    });
});
