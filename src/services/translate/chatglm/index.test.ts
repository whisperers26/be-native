import { beforeEach, describe, expect, it, vi } from 'vitest';
import { info, Language, translate } from './index';

const config = {
    model: 'glm-4-flash',
    apiKey: 'test-id.test-secret',
    promptList: [
        { role: 'system', content: 'Translate from $from to $to. The detected language is $detect.' },
        { role: 'user', content: 'Translate into $to\n"""\n$text\n"""' },
    ],
};

// jose checks `instanceof Uint8Array`, but under jsdom the global Uint8Array is not the class
// TextEncoder returns, so signing the JWT would throw. Point it at the class TextEncoder
// returns, as it is in a real webview. setup.ts undoes the stub after each test.
beforeEach(() => {
    vi.stubGlobal('Uint8Array', new TextEncoder().encode('').constructor);
});

// One server-sent event the way the API streams it: a JSON delta after "data:", then a blank line.
function event(delta: object): string {
    return `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`;
}

// A streamed response body that delivers `text` in reads of `readSize` bytes.
function streamBody(text: string, readSize = Infinity): ReadableStream<Uint8Array> {
    const bytes = new TextEncoder().encode(text);
    return new ReadableStream({
        start(controller) {
            for (let start = 0; start < bytes.length; start += readSize) {
                controller.enqueue(bytes.slice(start, start + readSize));
            }
            controller.close();
        },
    });
}

// Replaces the global fetch (the service does not use Tauri's); returns what it was called with.
function stubFetch(response: Response) {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => response);
    vi.stubGlobal('fetch', fetchMock);
    return () => fetchMock.mock.calls.map(([url, options]) => ({ url, options }));
}

describe('chatglm translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('rejects with "invalid apikey" when the key has no dot', async () => {
        const requests = stubFetch(new Response(streamBody('')));

        await expect(
            translate('hello', 'Auto', 'Simplified Chinese', { config: { ...config, apiKey: 'nodot' } })
        ).rejects.toBe('invalid apikey');
        expect(requests()).toHaveLength(0);
    });

    it('rejects with "invalid apikey" when the key is empty', async () => {
        const requests = stubFetch(new Response(streamBody('')));

        await expect(
            translate('hello', 'Auto', 'Simplified Chinese', { config: { ...config, apiKey: '' } })
        ).rejects.toBe('invalid apikey');
        expect(requests()).toHaveLength(0);
    });

    it('streams the reply, passing the growing text with a trailing underscore to setResult', async () => {
        const requests = stubFetch(
            new Response(
                streamBody(
                    event({ role: 'assistant', content: '你' }) +
                        event({ role: 'assistant', content: '好' }) +
                        event({ role: 'assistant', content: '' }) +
                        'data: [DONE]\n\n'
                )
            )
        );
        const setResult = vi.fn();

        await expect(
            translate('hello', 'Auto', 'Simplified Chinese', { config, setResult, detect: 'en' })
        ).resolves.toBe('你好');
        expect(setResult.mock.calls).toEqual([['你_'], ['你好_'], ['你好_']]);
        expect(requests()).toMatchSnapshot();
    });

    it('works without setResult and returns the text without the underscore', async () => {
        stubFetch(
            new Response(streamBody(event({ content: 'Hallo' }) + event({ content: ' Welt' }) + 'data: [DONE]\n\n'))
        );

        await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('Hallo Welt');
    });

    it('reassembles events and multi-byte characters split across reads', async () => {
        stubFetch(
            new Response(
                streamBody(
                    event({ content: '你好' }) +
                        event({ content: '，世界' }) +
                        event({ content: '！' }) +
                        'data: [DONE]\n\n',
                    7
                )
            )
        );
        const setResult = vi.fn();

        await expect(translate('hello', 'Auto', 'Simplified Chinese', { config, setResult })).resolves.toBe(
            '你好，世界！'
        );
        expect(setResult.mock.calls).toEqual([['你好_'], ['你好，世界_'], ['你好，世界！_']]);
    });

    it('substitutes $text, $from, $to and $detect in every prompt', async () => {
        const requests = stubFetch(new Response(streamBody(event({ content: 'x' }))));

        await translate('hello', 'Auto', 'Simplified Chinese', { config, detect: 'en' });
        const body = JSON.parse(requests()[0].options!.body as string);
        expect(body.messages).toEqual([
            { role: 'system', content: 'Translate from Auto to Simplified Chinese. The detected language is English.' },
            { role: 'user', content: 'Translate into Simplified Chinese\n"""\nhello\n"""' },
        ]);
    });

    it('substitutes "undefined" for $detect when no language was detected', async () => {
        const requests = stubFetch(new Response(streamBody(event({ content: 'x' }))));

        await translate('hello', 'Auto', 'German', { config });
        const body = JSON.parse(requests()[0].options!.body as string);
        expect(body.messages[0].content).toBe('Translate from Auto to German. The detected language is undefined.');
    });

    it('lets String.replaceAll interpret $ patterns in the text', async () => {
        const requests = stubFetch(new Response(streamBody(event({ content: 'x' }))));

        await translate('costs $$5 and $&', 'Auto', 'German', { config });
        const body = JSON.parse(requests()[0].options!.body as string);
        expect(body.messages[1].content).toBe('Translate into German\n"""\ncosts $5 and $text\n"""');
    });

    it('appends "undefined" for a chunk without content', async () => {
        stubFetch(new Response(streamBody(event({ role: 'assistant' }) + event({ content: 'Hi' }))));

        await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('undefinedHi');
    });

    it('drops a final event that is not terminated by a blank line', async () => {
        stubFetch(
            new Response(
                streamBody(
                    event({ content: 'Hi' }) +
                        `data: ${JSON.stringify({ choices: [{ delta: { content: ' there' } }] })}`
                )
            )
        );

        await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('Hi');
    });

    it('rejects with an Error carrying the status and body on an HTTP error', async () => {
        stubFetch(new Response('{"error":{"message":"invalid token"}}', { status: 401 }));

        await expect(translate('hello', 'Auto', 'German', { config })).rejects.toThrow(
            new Error('Http Request Error\nHttp Status: 401\n{"error":{"message":"invalid token"}}')
        );
    });

    it('rejects with the SyntaxError when a chunk is not JSON', async () => {
        stubFetch(new Response(streamBody('data: not json\n\n')));

        await expect(translate('hello', 'Auto', 'German', { config })).rejects.toThrow(SyntaxError);
    });
});
