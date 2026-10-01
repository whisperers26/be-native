import { describe, expect, it, vi } from 'vitest';
import { type FetchCall, streamBody, stubFetch } from '../../../test/stream';
import { info, Language, translate } from './index';

const promptList = [
    { role: 'system', content: 'Translate from $from to $to (detected: $detect).' },
    { role: 'user', content: 'Translate into $to:\n"""\n$text\n"""' },
];
const config = { stream: true, model: 'gemma:2b', requestPath: 'http://localhost:11434', promptList };
const plainConfig = { ...config, stream: false };

// One line of the NDJSON stream /api/chat sends.
function chunk(content: string, done = false): string {
    return (
        JSON.stringify({
            model: 'gemma:2b',
            created_at: '2026-01-02T03:04:05.678Z',
            message: { role: 'assistant', content },
            done,
        }) + '\n'
    );
}

// ollama-js puts the platform in the User-Agent and an AbortSignal prints its internals, so a snapshot of
// the requests shows a placeholder for each. The User-Agent is still checked to be ollama-js's.
function describeRequests(calls: FetchCall[]) {
    return calls.map(({ url, options }) => {
        const { signal, headers, ...rest } = options ?? {};
        const { 'User-Agent': userAgent, ...otherHeaders } = (headers ?? {}) as Record<string, string>;
        expect(userAgent).toMatch(/^ollama-js\/\d+\.\d+\.\d+ \(/);
        return {
            url,
            options: {
                ...rest,
                headers: { ...otherHeaders, 'User-Agent': '<ollama-js user agent>' },
                signal: signal ? '<AbortSignal>' : undefined,
            },
        };
    });
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('ollama translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    describe('with streaming', () => {
        it('posts the prompts to /api/chat and passes the growing text to setResult', async () => {
            const requests = stubFetch(() => new Response(streamBody(chunk('Hallo'), chunk(' Welt'), chunk('', true))));
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config, setResult, detect: 'en' })).resolves.toBe(
                'Hallo Welt'
            );
            expect(setResult.mock.calls).toEqual([['Hallo_'], ['Hallo Welt_'], ['Hallo Welt_'], ['Hallo Welt']]);
            expect(describeRequests(requests())).toMatchSnapshot();
        });

        it('returns "[STREAM]" at the first part and aborts the request when there is no setResult', async () => {
            const requests = stubFetch(() => new Response(streamBody(chunk('Hallo'), chunk(' Welt'), chunk('', true))));

            await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('[STREAM]');
            expect(requests()[0].options?.signal?.aborted).toBe(true);
        });

        it('rejects when the stream ends without a done message', async () => {
            stubFetch(() => new Response(streamBody(chunk('Hallo'))));

            await expect(translate('hello', 'Auto', 'German', { config, setResult: vi.fn() })).rejects.toThrow(
                new Error('Did not receive done or success response in stream.')
            );
        });

        it('rejects with the error message of an error line in the stream', async () => {
            stubFetch(() => new Response(streamBody(chunk('Hallo'), '{"error":"model runner crashed"}\n')));

            await expect(translate('hello', 'Auto', 'German', { config, setResult: vi.fn() })).rejects.toThrow(
                new Error('model runner crashed')
            );
        });
    });

    it('without streaming: sends stream false and returns the reply content without trimming it', async () => {
        const requests = stubFetch(() =>
            jsonResponse({ message: { role: 'assistant', content: ' Hallo ' }, done: true })
        );

        await expect(translate('hello', 'Auto', 'German', { config: plainConfig, detect: 'en' })).resolves.toBe(
            ' Hallo '
        );
        expect(describeRequests(requests())).toMatchSnapshot();
    });

    it('substitutes $text, $from, $to and $detect in every prompt', async () => {
        const requests = stubFetch(() => jsonResponse({ message: { content: 'x' }, done: true }));

        await translate('hello', 'Auto', 'German', { config: plainConfig, detect: 'en' });
        expect(JSON.parse(requests()[0].options!.body as string).messages).toEqual([
            { role: 'system', content: 'Translate from Auto to German (detected: English).' },
            { role: 'user', content: 'Translate into German:\n"""\nhello\n"""' },
        ]);
    });

    it('substitutes "undefined" for $detect when no language was detected', async () => {
        const requests = stubFetch(() => jsonResponse({ message: { content: 'x' }, done: true }));

        await translate('hello', 'Auto', 'German', { config: plainConfig });
        expect(JSON.parse(requests()[0].options!.body as string).messages[0].content).toBe(
            'Translate from Auto to German (detected: undefined).'
        );
    });

    it('lets String.replaceAll interpret $ patterns in the text', async () => {
        const requests = stubFetch(() => jsonResponse({ message: { content: 'x' }, done: true }));

        await translate('costs $$5 and $&', 'Auto', 'German', { config: plainConfig });
        expect(JSON.parse(requests()[0].options!.body as string).messages[1].content).toBe(
            'Translate into German:\n"""\ncosts $5 and $text\n"""'
        );
    });

    it('normalises requestPath: https:// added, trailing slash dropped, default port added by ollama-js', async () => {
        const requests = stubFetch(() => jsonResponse({ message: { content: 'x' }, done: true }));

        await translate('hello', 'Auto', 'German', { config: { ...plainConfig, requestPath: 'localhost:11434' } });
        await translate('hello', 'Auto', 'German', {
            config: { ...plainConfig, requestPath: 'http://localhost:11434/' },
        });
        await translate('hello', 'Auto', 'German', {
            config: { ...plainConfig, requestPath: 'https://ollama.example.com' },
        });
        await translate('hello', 'Auto', 'German', {
            config: { ...plainConfig, requestPath: 'http://example.com:8080/base/' },
        });

        expect(requests().map((request) => request.url)).toEqual([
            'https://localhost:11434/api/chat',
            'http://localhost:11434/api/chat',
            'https://ollama.example.com:443/api/chat',
            'http://example.com:8080/base/api/chat',
        ]);
    });

    it('rejects with the error message of an HTTP error response', async () => {
        stubFetch(() => jsonResponse({ error: 'model "gemma:2b" not found' }, 404));

        await expect(translate('hello', 'Auto', 'German', { config })).rejects.toMatchObject({
            name: 'ResponseError',
            message: 'model "gemma:2b" not found',
            status_code: 404,
        });
    });
});
