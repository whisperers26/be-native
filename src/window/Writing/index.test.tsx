import { NextUIProvider } from '@nextui-org/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import { httpMock } from '../../test/http';
import '../../i18n';

vi.hoisted(() => {
    (window as any).__TAURI_METADATA__ = { __windows: [{ label: 'writing' }], __currentWindow: { label: 'writing' } };
});

import Writing from './index';

function answer(content: string) {
    return { data: { choices: [{ message: { content } }] } };
}

/** The user message of each request made, in order. */
function messages(): string[] {
    return httpMock.calls.map((call) => (call.options!.body as { payload: any }).payload.messages[1].content);
}

function open(text = 'me and him goes') {
    fakeTauri.command('get_writing_text', () => text);
    render(
        <NextUIProvider>
            <Writing />
        </NextUIProvider>
    );
}

describe('Writing window', () => {
    it('shows the default improvement of the free service, and the two buttons', async () => {
        httpMock.queue(answer('He and I go.'));

        open();

        expect(await screen.findByText('He and I go.')).toBeInTheDocument();
        expect(screen.getByText('LLM7 (free)')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Tones' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Custom Prompt' })).toBeEnabled();
        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://api.llm7.io/v1/chat/completions']);
        expect(messages()).toEqual(['\nme and him goes']);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('asks for the five tones only when Tones is pressed', async () => {
        httpMock.queue(answer('He and I go.'));
        open();
        await screen.findByText('He and I go.');
        expect(screen.queryByText('Professional')).not.toBeInTheDocument();
        httpMock.queue(answer('one'), answer('two'), answer('three'), answer('four'), answer('five'));

        fireEvent.click(screen.getByRole('button', { name: 'Tones' }));

        for (const tone of ['Professional', 'Casual', 'Friendly', 'Confident', 'Concise']) {
            expect(await screen.findByText(tone)).toBeInTheDocument();
        }
        expect(await screen.findByText('five')).toBeInTheDocument();
        expect(
            messages()
                .slice(1)
                .map((message) => message.split(':')[1].trim())
        ).toEqual(['Professional', 'Casual', 'Friendly', 'Confident', 'Concise']);
        expect(messages()[1]).toBe(
            'Style: Professional: polished and precise, as in business writing.\n\nme and him goes'
        );
        // The tones are asked for once per text.
        await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Tones' })).toBeDisabled());
    });

    it('goes tone by tone when several services are switched on', async () => {
        fakeTauri.store.set('writing_service_list', ['llm7', 'openai@a']);
        fakeTauri.store.set('openai@a', { requestPath: 'https://api.example.com', apiKey: 'k', model: 'm' });
        fakeTauri.store.set('writing_tones', [
            { name: 'Casual', instruction: 'Casual.' },
            { name: 'Concise', instruction: 'Concise.' },
        ]);
        httpMock.queue(answer('a'), answer('b'));
        open();
        await screen.findByText('b');
        httpMock.queue(answer('c'), answer('d'), answer('e'), answer('f'));

        fireEvent.click(screen.getByRole('button', { name: 'Tones' }));

        await screen.findByText('f');
        expect(httpMock.calls.slice(2).map((call) => new URL(call.url).host)).toEqual([
            'api.llm7.io',
            'api.example.com',
            'api.llm7.io',
            'api.example.com',
        ]);
        expect(messages().slice(2)).toEqual([
            'Style: Casual.\n\nme and him goes',
            'Style: Casual.\n\nme and him goes',
            'Style: Concise.\n\nme and him goes',
            'Style: Concise.\n\nme and him goes',
        ]);
    });

    it('sends a custom prompt on Enter, shows its result in a box of its own, and takes another', async () => {
        httpMock.queue(answer('He and I go.'));
        open();
        await screen.findByText('He and I go.');
        httpMock.queue(answer('We go.'), answer('Off we go!'));

        fireEvent.click(screen.getByRole('button', { name: 'Custom Prompt' }));
        const input = screen.getByRole('textbox', { name: 'Custom Prompt' });
        fireEvent.change(input, { target: { value: 'make it shorter' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(await screen.findByText('We go.')).toBeInTheDocument();
        expect(screen.getByText('make it shorter')).toBeInTheDocument();
        expect(messages()[1]).toBe('Request: make it shorter\n\nme and him goes');
        expect(input).toHaveValue('');

        fireEvent.change(input, { target: { value: 'more fun' } });
        fireEvent.click(screen.getByRole('button', { name: 'Enter' }));

        expect(await screen.findByText('Off we go!')).toBeInTheDocument();
        expect(screen.getByText('We go.')).toBeInTheDocument();
    });

    it('does not send an empty custom prompt', async () => {
        httpMock.queue(answer('He and I go.'));
        open();
        await screen.findByText('He and I go.');

        fireEvent.click(screen.getByRole('button', { name: 'Custom Prompt' }));
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Custom Prompt' }), { key: 'Enter' });

        expect(screen.getByRole('button', { name: 'Enter' })).toBeDisabled();
        expect(httpMock.calls).toHaveLength(1);
    });

    it('replaces the selection with the box that is clicked', async () => {
        httpMock.queue(answer('He and I go.'));
        open();

        fireEvent.click(await screen.findByText('He and I go.'));

        await vi.waitFor(() =>
            expect(fakeTauri.calls.find((call) => call.cmd === 'writing_replace')?.args).toEqual({
                text: 'He and I go.',
            })
        );
    });

    it('copies without replacing', async () => {
        httpMock.queue(answer('He and I go.'));
        open();
        await screen.findByText('He and I go.');

        fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

        await vi.waitFor(() => expect(fakeTauri.clipboard).toBe('He and I go.'));
        expect(fakeTauri.calls.some((call) => call.cmd === 'writing_replace')).toBe(false);
    });

    it('shows why a request failed, does not replace with it, and tries again', async () => {
        httpMock.queue({ status: 429, data: { error: 'slow down' } });
        open();

        expect(await screen.findByText('Http Status: 429')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Http Status: 429'));
        expect(fakeTauri.calls.some((call) => call.cmd === 'writing_replace')).toBe(false);
        httpMock.queue(answer('He and I go.'));

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(await screen.findByText('He and I go.')).toBeInTheDocument();
        expect(screen.queryByText('Http Status: 429')).not.toBeInTheDocument();
    });

    it('starts over for new text, and drops a late answer for the old one', async () => {
        fakeTauri.command('get_writing_text', () => 'old text');
        // The answer for the old text comes only when the test lets it.
        let late: (response: unknown) => void = () => {};
        const { fetchMock } = await import('../../test/http');
        fetchMock.mockImplementationOnce(async (url: string, options?: Record<string, unknown>) => {
            httpMock.calls.push({ url, options });
            return new Promise((resolve) => (late = resolve)) as never;
        });
        render(
            <NextUIProvider>
                <Writing />
            </NextUIProvider>
        );
        await vi.waitFor(() => expect(messages()).toEqual(['\nold text']));
        httpMock.queue(answer('New text, improved.'));

        fakeTauri.emit('new_writing_text', 'new text');

        expect(await screen.findByText('New text, improved.')).toBeInTheDocument();
        late({ ok: true, status: 200, data: answer('Old text, improved.').data });
        await new Promise((done) => setTimeout(done, 20));
        expect(screen.queryByText('Old text, improved.')).not.toBeInTheDocument();
        expect(messages()[1]).toBe('\nnew text');
    });

    it('asks the free service alone in test mode, whatever services are set', async () => {
        fakeTauri.command('test_mode', () => true);
        fakeTauri.store.set('writing_service_list', ['openai@a']);
        fakeTauri.store.set('openai@a', { requestPath: 'https://api.example.com', apiKey: 'k', model: 'm' });
        httpMock.queue(answer('He and I go.'));

        open();

        expect(await screen.findByText('He and I go.')).toBeInTheDocument();
        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://api.llm7.io/v1/chat/completions']);
        expect(fakeTauri.store.get('writing_service_list')).toEqual(['openai@a']);
    });

    it('leaves out a service that is switched off', async () => {
        fakeTauri.store.set('writing_service_list', ['llm7', 'openai@a']);
        fakeTauri.store.set('openai@a', { enable: false, apiKey: 'k' });
        httpMock.queue(answer('He and I go.'));

        open();

        await screen.findByText('He and I go.');
        expect(httpMock.calls).toHaveLength(1);
        expect(screen.queryByText('OpenAI')).not.toBeInTheDocument();
    });

    it('asks for the height of what it shows, and shows itself once it has it', async () => {
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
        // jsdom lays nothing out: what the window shows is 200 px tall.
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
        vi.stubGlobal('screen', { availWidth: 1920, availHeight: 1000 });
        try {
            httpMock.queue(answer('He and I go.'));
            open();
            await screen.findByText('He and I go.');

            // 35 px of bar, the 200 px, and 8 px under them
            await vi.waitFor(() =>
                expect(fakeTauri.calls.find((call) => call.cmd === 'fit_writing_window')?.args).toEqual({ height: 243 })
            );
            await vi.waitFor(() => expect(fakeTauri.calls.some((call) => call.cmd === 'show_window')).toBe(true));

            // Taller than 80% of the screen: the window stops there.
            vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(2000);
            observed.find(({ target }) => target.parentElement?.className.includes('h-[calc(100vh-35px)]'))!.changed();

            await vi.waitFor(() =>
                expect(fakeTauri.calls.filter((call) => call.cmd === 'fit_writing_window').at(-1)?.args).toEqual({
                    height: 800,
                })
            );
        } finally {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        }
    });
});
