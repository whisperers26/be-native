import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import { initEnv } from '../../utils/env';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = {
        __windows: [{ label: 'silent_recognize' }],
        __currentWindow: { label: 'silent_recognize' },
    };
});

import SilentRecognize from './index';

// The Tauri core calls of one module that the window made: `[cmd, payload]`.
function coreCalls(module: string): any[] {
    return fakeTauri.calls
        .filter((call) => call.cmd === 'tauri' && call.args.__tauriModule === module)
        .map((call) => call.args.message);
}

function closed(): boolean {
    return coreCalls('Window').some((message) => message.data?.cmd?.type === 'close');
}

// sendNotification builds a web Notification; record what it was given.
let sent: unknown[] = [];
beforeEach(async () => {
    // System OCR picks its language codes by OS, and detects the language of what it read.
    await initEnv();
    fakeTauri.store.set('translate_detect_engine', 'local');
    fakeTauri.store.set('recognize_service_list', ['system', 'tesseract']);
    sent = [];
    vi.stubGlobal(
        'Notification',
        class {
            static permission = 'granted';
            constructor(_title: string, options: unknown) {
                sent.push(options);
            }
        }
    );
});

describe('SilentRecognize window', () => {
    it('copies the text of the cut image with the first OCR service, shows nothing, and closes', async () => {
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        fakeTauri.command('system_ocr', () => ' Hello\nWorld \n');
        const { container } = render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('Hello\nWorld');
        expect(fakeTauri.calls.find((call) => call.cmd === 'system_ocr')?.args).toEqual({ lang: 'auto' });
        expect(container).toBeEmptyDOMElement();
        expect(sent).toEqual([]);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('uses the recognition language and merges wrapped lines', async () => {
        fakeTauri.store.set('recognize_language', 'en');
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        fakeTauri.command('system_ocr', () => 'trans-\nlated text\nhere');
        render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('translated text here');
        expect(fakeTauri.calls.find((call) => call.cmd === 'system_ocr')?.args).toEqual({ lang: 'en-US' });
    });

    it('leaves the lines as they are when merging is off', async () => {
        fakeTauri.store.set('recognize_merge_lines', false);
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        fakeTauri.command('system_ocr', () => 'trans-\nlated text\nhere');
        render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('trans-\nlated text\nhere');
    });

    it('notifies and leaves the clipboard alone when recognition fails', async () => {
        fakeTauri.clipboard = 'before';
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        fakeTauri.command('system_ocr', () => {
            throw 'Language package not installed!';
        });
        render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('before');
        expect(sent).toEqual([
            { title: 'Text recognition failed', body: 'Language package not installed!' },
        ]);
    });

    it('notifies when the image has no text', async () => {
        fakeTauri.clipboard = 'before';
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        fakeTauri.command('system_ocr', () => '  ');
        render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('before');
        expect(sent).toEqual([
            { title: 'Text recognition failed', body: 'No text found' },
        ]);
    });

    it('notifies when the service does not support the language', async () => {
        fakeTauri.store.set('recognize_service_list', ['qrcode']);
        fakeTauri.store.set('recognize_language', 'uk');
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        render(<SilentRecognize />);

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(sent).toEqual([
            { title: 'Text recognition failed', body: 'Language not supported' },
        ]);
    });

    it('recognizes again when a new image arrives while it is still open', async () => {
        fakeTauri.command('get_base64', () => 'aW1hZ2U=');
        let finishFirst: (text: string) => void = () => {};
        fakeTauri.command('system_ocr', () => new Promise<string>((resolve) => (finishFirst = resolve)));
        render(<SilentRecognize />);
        await vi.waitFor(() => expect(fakeTauri.calls.filter((call) => call.cmd === 'system_ocr')).toHaveLength(1));

        fakeTauri.command('system_ocr', () => 'second');
        fakeTauri.emit('new_image', '');
        finishFirst('first');

        await vi.waitFor(() => expect(closed()).toBe(true));
        expect(fakeTauri.clipboard).toBe('second');
        expect(coreCalls('Window').filter((message) => message.data?.cmd?.type === 'close')).toHaveLength(1);
    });
});
