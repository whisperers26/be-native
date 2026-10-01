import { describe, expect, it, vi } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

const promptList = [
    { role: 'user', parts: [{ text: 'Translate from $from to $to (detected: $detect)' }] },
    { role: 'model', parts: [{ text: 'Ok.' }] },
    { role: 'user', parts: [{ text: 'Translate into $to\n"""\n$text\n"""' }] },
];
const config = { apiKey: 'test-key', stream: false, promptList, requestPath: '' };
const streamConfig = { ...config, stream: true };

function reply(text: string) {
    return { data: { candidates: [{ content: { parts: [{ text }] } }] } };
}

// One response object the way streamGenerateContent prints it: pretty-printed JSON.
function candidate(text: string): string {
    return JSON.stringify({ candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }] }, null, 2);
}

// A streamed response body that delivers each string as one read.
function streamBody(...reads: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            for (const read of reads) controller.enqueue(new TextEncoder().encode(read));
            controller.close();
        },
    });
}

// Replaces the global fetch (window.fetch, which the streaming branch uses); returns what it was called with.
function stubFetch(response: Response) {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) => response);
    vi.stubGlobal('fetch', fetchMock);
    return () => fetchMock.mock.calls.map(([url, options]) => ({ url, options }));
}

describe('geminipro translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    describe('without streaming', () => {
        it('posts the prompts with the key in the URL and returns the trimmed text without its quotes', async () => {
            httpMock.queue(reply(' "Hallo Welt" '));

            await expect(translate('hello', 'Auto', 'German', { config, detect: 'en' })).resolves.toBe('Hallo Welt');
            expect(httpMock.calls).toMatchSnapshot();
        });

        it('removes only one quote from each end', async () => {
            httpMock.queue(reply('""Hallo""'));

            await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('"Hallo"');
        });

        it('substitutes $text, $from, $to and $detect in the first part of every prompt', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', {
                config: {
                    ...config,
                    promptList: [
                        { role: 'user', parts: [{ text: '$from>$to ($detect): $text' }, { text: 'dropped' }] },
                    ],
                },
                detect: 'en',
            });
            expect((httpMock.calls[0].options as any).body.payload.contents).toEqual([
                { role: 'user', parts: [{ text: 'Auto>German (English): hello' }] },
            ]);
        });

        it('substitutes "undefined" for $detect when no language was detected', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', { config });
            expect((httpMock.calls[0].options as any).body.payload.contents[0].parts[0].text).toBe(
                'Translate from Auto to German (detected: undefined)'
            );
        });

        it('lets String.replaceAll interpret $ patterns in the text', async () => {
            httpMock.queue(reply('x'));

            await translate('costs $$5 and $&', 'Auto', 'German', { config });
            expect((httpMock.calls[0].options as any).body.payload.contents[2].parts[0].text).toBe(
                'Translate into German\n"""\ncosts $5 and $text\n"""'
            );
        });

        it('normalises requestPath: default, missing scheme, kept http, trailing slash', async () => {
            httpMock.queue(reply('x'), reply('x'), reply('x'), reply('x'));

            await translate('hello', 'Auto', 'German', { config: { ...config, requestPath: undefined } });
            await translate('hello', 'Auto', 'German', {
                config: { ...config, requestPath: 'proxy.example.com/models/gemini-pro' },
            });
            await translate('hello', 'Auto', 'German', {
                config: { ...config, requestPath: 'http://localhost:8080/models/gemini-pro' },
            });
            await translate('hello', 'Auto', 'German', {
                config: { ...config, requestPath: 'https://example.com/models/gemini-pro/' },
            });

            expect(httpMock.calls.map((call) => call.url)).toEqual([
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=test-key',
                'https://proxy.example.com/models/gemini-pro:generateContent?key=test-key',
                'http://localhost:8080/models/gemini-pro:generateContent?key=test-key',
                'https://example.com/models/gemini-pro:generateContent?key=test-key',
            ]);
        });

        it('throws the candidates as JSON when the text is empty', async () => {
            httpMock.queue(reply('  '));

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                '[{"content":{"parts":[{"text":"  "}]}}]'
            );
        });

        it('throws the response as JSON when it has no candidates', async () => {
            httpMock.queue({ data: { promptFeedback: { blockReason: 'SAFETY' } } });

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                '{"promptFeedback":{"blockReason":"SAFETY"}}'
            );
        });

        it('throws the status and body on an HTTP error', async () => {
            httpMock.queue({ status: 400, data: { error: { message: 'API key not valid' } } });

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                'Http Request Error\nHttp Status: 400\n{"error":{"message":"API key not valid"}}'
            );
        });
    });

    describe('with streaming', () => {
        it('reads the text parts as they arrive and passes the growing text to setResult', async () => {
            const requests = stubFetch(
                new Response(streamBody('[' + candidate('Hallo'), ',\r\n' + candidate(' Welt'), ']'))
            );
            const setResult = vi.fn();

            await expect(
                translate('hello', 'Auto', 'German', { config: streamConfig, setResult, detect: 'en' })
            ).resolves.toBe('Hallo Welt');
            expect(setResult.mock.calls).toEqual([['Hallo_'], ['Hallo Welt_'], ['Hallo Welt']]);
            expect(requests()).toMatchSnapshot();
            expect(httpMock.calls).toHaveLength(0);
        });

        it('returns "[STREAM]" at the first text part when there is no setResult', async () => {
            stubFetch(new Response(streamBody('[' + candidate('Hallo'), ',\r\n' + candidate(' Welt'), ']')));

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig })).resolves.toBe('[STREAM]');
        });

        it('requests :streamGenerateContent on a normalised requestPath', async () => {
            const requests = stubFetch(new Response(streamBody(candidate('x'))));

            await translate('hello', 'Auto', 'German', {
                config: { ...streamConfig, requestPath: 'proxy.example.com/models/gemini-pro/' },
                setResult: vi.fn(),
            });
            expect(requests()[0].url).toBe(
                'https://proxy.example.com/models/gemini-pro:streamGenerateContent?key=test-key'
            );
        });

        it('joins a text part that arrives in two reads', async () => {
            const part = candidate('Hallo');
            const cut = part.indexOf('Hal') + 3;
            stubFetch(new Response(streamBody('[' + part.slice(0, cut), part.slice(cut), ']')));
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).resolves.toBe(
                'Hallo'
            );
            expect(setResult.mock.calls).toEqual([['Hallo_'], ['Hallo']]);
        });

        it('skips empty text parts and collapses runs of whitespace in the text', async () => {
            stubFetch(
                new Response(streamBody('[' + candidate(''), ',' + candidate('He said "hi"  twice\nnewline'), ']'))
            );
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).resolves.toBe(
                'He said "hi" twice\nnewline'
            );
            expect(setResult.mock.calls).toEqual([['He said "hi" twice\nnewline_'], ['He said "hi" twice\nnewline']]);
        });

        it('returns an empty string, after calling setResult with it, when the stream has no text', async () => {
            stubFetch(new Response(streamBody('[]')));
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).resolves.toBe('');
            expect(setResult.mock.calls).toEqual([['']]);
        });

        // Known limitation of the text-part regex: it is greedy and not anchored to one part.
        it('rejects with a SyntaxError when one read holds two text parts', async () => {
            stubFetch(new Response(streamBody('[' + candidate('Hallo') + ',\r\n' + candidate(' Welt') + ']')));
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).rejects.toThrow(
                SyntaxError
            );
            expect(setResult).not.toHaveBeenCalled();
        });

        // Known limitation: a read that has no complete part is appended to temp after temp was
        // already prefixed to it, so the buffered text doubles.
        it('rejects with a SyntaxError when a text part arrives in three reads', async () => {
            const part = candidate('Hallo');
            const first = part.indexOf('Hal') + 1;
            const second = part.indexOf('Hal') + 3;
            stubFetch(
                new Response(streamBody('[' + part.slice(0, first), part.slice(first, second), part.slice(second), ']'))
            );

            await expect(
                translate('hello', 'Auto', 'German', { config: streamConfig, setResult: vi.fn() })
            ).rejects.toThrow(SyntaxError);
        });

        // Known limitation: the end of the stream calls setResult without checking that it exists.
        it('rejects with a TypeError when the stream has no text and there is no setResult', async () => {
            stubFetch(new Response(streamBody('[]')));

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig })).rejects.toThrow(TypeError);
        });

        it('throws the status and "undefined" for the body on an HTTP error, as a Response has no data', async () => {
            stubFetch(new Response('{"error":"bad"}', { status: 500 }));

            await expect(
                translate('hello', 'Auto', 'German', { config: streamConfig, setResult: vi.fn() })
            ).rejects.toBe('Http Request Error\nHttp Status: 500\nundefined');
        });
    });
});
