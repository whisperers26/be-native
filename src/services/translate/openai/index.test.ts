import { describe, expect, it, vi } from 'vitest';
import { httpMock } from '../../../test/http';
import { sseEvent, streamBody, stubFetch } from '../../../test/stream';
import { info, Language, translate } from './index';

const promptList = [
    { role: 'system', content: 'Translate from $from to $to (detected: $detect).' },
    { role: 'user', content: 'Translate into $to:\n"""\n$text\n"""' },
];
const config = {
    service: 'openai',
    requestPath: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    apiKey: 'test-key',
    stream: false,
    promptList,
    requestArguments: undefined as string | undefined,
};
const azureConfig = {
    ...config,
    service: 'azure',
    requestPath: 'https://example.openai.azure.com/openai/deployments/gpt35/chat/completions?api-version=2023-05-15',
};
const streamConfig = { ...config, stream: true };

function reply(content: string) {
    return { data: { choices: [{ message: { role: 'assistant', content } }] } };
}

describe('openai translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    describe('without streaming', () => {
        it('posts the prompts with the bearer key and returns the reply without its quotes', async () => {
            httpMock.queue(reply(' "Hallo Welt" '));

            await expect(translate('hello', 'Auto', 'German', { config, detect: 'en' })).resolves.toBe('Hallo Welt');
            expect(httpMock.calls).toMatchSnapshot();
        });

        it('removes only one quote from each end', async () => {
            httpMock.queue(reply('""Hallo""'));

            await expect(translate('hello', 'Auto', 'German', { config })).resolves.toBe('"Hallo"');
        });

        it('throws the choices as JSON when the reply is empty', async () => {
            httpMock.queue(reply('  '));

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                '[{"message":{"role":"assistant","content":"  "}}]'
            );
        });

        it('throws the response as JSON when it has no choices', async () => {
            httpMock.queue({ data: { error: { message: 'overloaded' } } });

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                '{"error":{"message":"overloaded"}}'
            );
        });

        it('throws the status and body on an HTTP error', async () => {
            httpMock.queue({ status: 401, data: { error: { message: 'Incorrect API key' } } });

            await expect(translate('hello', 'Auto', 'German', { config })).rejects.toBe(
                'Http Request Error\nHttp Status: 401\n{"error":{"message":"Incorrect API key"}}'
            );
        });
    });

    describe('request', () => {
        it('azure: sends the api-key header, no model, and the URL as it is', async () => {
            httpMock.queue(reply('Hallo'));

            await translate('hello', 'Auto', 'German', { config: azureConfig, detect: 'en' });
            expect(httpMock.calls).toMatchSnapshot();
        });

        it('normalises requestPath for the openai service', async () => {
            httpMock.queue(reply('x'), reply('x'), reply('x'), reply('x'), reply('x'), reply('x'));

            for (const requestPath of [
                'https://api.openai.com/v1/chat/completions',
                'http://localhost:8080/chat/completions',
                'api.openai.com',
                'https://example.com/api/',
                'https://example.com/proxy?x=1',
                'https://example.com/v1',
            ]) {
                await translate('hello', 'Auto', 'German', { config: { ...config, requestPath } });
            }

            expect(httpMock.calls.map((call) => call.url)).toEqual([
                'https://api.openai.com/v1/chat/completions',
                'http://localhost:8080/chat/completions',
                'https://api.openai.com/v1/chat/completions',
                'https://example.com/api/v1/chat/completions',
                'https://example.com/proxy/v1/chat/completions?x=1',
                // A base URL that already ends in /v1 gets a second one.
                'https://example.com/v1/v1/chat/completions',
            ]);
        });

        it('normalises requestPath for another service only by adding https:// and parsing it as a URL', async () => {
            httpMock.queue(reply('x'), reply('x'));

            await translate('hello', 'Auto', 'German', {
                config: { ...azureConfig, requestPath: 'example.openai.azure.com' },
            });
            await translate('hello', 'Auto', 'German', {
                config: { ...azureConfig, requestPath: 'https://example.com/chat' },
            });

            expect(httpMock.calls.map((call) => call.url)).toEqual([
                'https://example.openai.azure.com/',
                'https://example.com/chat',
            ]);
        });

        it('substitutes $text, $from, $to and $detect in every prompt', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', { config, detect: 'en' });
            expect((httpMock.calls[0].options as any).body.payload.messages).toEqual([
                { role: 'system', content: 'Translate from Auto to German (detected: English).' },
                { role: 'user', content: 'Translate into German:\n"""\nhello\n"""' },
            ]);
        });

        it('substitutes "undefined" for $detect when no language was detected', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', { config });
            expect((httpMock.calls[0].options as any).body.payload.messages[0].content).toBe(
                'Translate from Auto to German (detected: undefined).'
            );
        });

        it('lets String.replaceAll interpret $ patterns in the text', async () => {
            httpMock.queue(reply('x'));

            await translate('costs $$5 and $&', 'Auto', 'German', { config });
            expect((httpMock.calls[0].options as any).body.payload.messages[1].content).toBe(
                'Translate into German:\n"""\ncosts $5 and $text\n"""'
            );
        });

        it('falls back to the built-in prompts when the config has no promptList', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', { config: { ...config, promptList: undefined } });
            expect((httpMock.calls[0].options as any).body.payload.messages).toEqual([
                {
                    role: 'system',
                    content:
                        'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                },
                { role: 'user', content: 'Translate into German:\n"""\nhello\n"""' },
            ]);
        });

        it('uses the default request arguments when the config has none', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', { config });
            const payload = (httpMock.calls[0].options as any).body.payload;
            expect(payload).toMatchObject({
                temperature: 0.1,
                top_p: 0.99,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: false,
                model: 'gpt-3.5-turbo',
            });
        });

        it('puts custom request arguments first, before stream, messages and model', async () => {
            httpMock.queue(reply('x'));

            await translate('hello', 'Auto', 'German', {
                config: { ...config, requestArguments: '{"temperature":0.7,"max_tokens":100,"stream":true}' },
            });
            const payload = (httpMock.calls[0].options as any).body.payload;
            expect(Object.keys(payload)).toEqual(['temperature', 'max_tokens', 'stream', 'messages', 'model']);
            expect(payload.temperature).toBe(0.7);
            expect(payload.stream).toBe(false);
        });

        it('rejects with a SyntaxError, without a request, when requestArguments is not JSON', async () => {
            await expect(
                translate('hello', 'Auto', 'German', { config: { ...config, requestArguments: 'temperature=1' } })
            ).rejects.toThrow(SyntaxError);
            expect(httpMock.calls).toHaveLength(0);
        });
    });

    describe('with streaming', () => {
        it('reads the events and passes the growing text to setResult', async () => {
            const requests = stubFetch(
                new Response(
                    streamBody(
                        sseEvent({ role: 'assistant', content: '' }) +
                            sseEvent({ content: 'Hallo' }) +
                            sseEvent({ content: ' Welt' }) +
                            sseEvent({}) +
                            'data: [DONE]\n\n'
                    )
                )
            );
            const setResult = vi.fn();

            await expect(
                translate('hello', 'Auto', 'German', { config: streamConfig, setResult, detect: 'en' })
            ).resolves.toBe('Hallo Welt');
            expect(setResult.mock.calls).toEqual([['Hallo_'], ['Hallo Welt_'], ['Hallo Welt']]);
            expect(requests()).toMatchSnapshot();
            expect(httpMock.calls).toHaveLength(0);
        });

        it('returns "[STREAM]" at the first piece of content when there is no setResult', async () => {
            stubFetch(new Response(streamBody(sseEvent({ content: 'Hallo' }) + sseEvent({ content: ' Welt' }))));

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig })).resolves.toBe('[STREAM]');
        });

        it('joins an event that arrives in two reads', async () => {
            const whole = sseEvent({ content: 'Hallo' });
            const cut = whole.indexOf('Hal') + 3;
            stubFetch(new Response(streamBody(whole.slice(0, cut), whole.slice(cut) + 'data: [DONE]\n\n')));
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).resolves.toBe(
                'Hallo'
            );
            expect(setResult.mock.calls).toEqual([['Hallo_'], ['Hallo']]);
        });

        it('uses the api-key header and omits the model when streaming through azure', async () => {
            const requests = stubFetch(new Response(streamBody(sseEvent({ content: 'Hallo' }))));

            await translate('hello', 'Auto', 'German', {
                config: { ...azureConfig, stream: true },
                setResult: vi.fn(),
            });
            const [{ url, options }] = requests();
            expect(url).toBe(azureConfig.requestPath);
            expect((options?.headers as any)['api-key']).toBe('test-key');
            expect(JSON.parse(options?.body as string)).not.toHaveProperty('model');
        });

        // Known sharp edge: an event whose choices are empty (azure sends one first) fails to parse
        // as a delta, and everything after it is then appended to the buffer and never parsed.
        it('returns an empty string when an event with empty choices comes first', async () => {
            stubFetch(
                new Response(
                    streamBody(
                        'data: {"choices":[],"prompt_filter_results":[]}\n\n',
                        sseEvent({ content: 'Hallo' }),
                        sseEvent({ content: ' Welt' }),
                        'data: [DONE]\n\n'
                    )
                )
            );
            const setResult = vi.fn();

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig, setResult })).resolves.toBe('');
            expect(setResult.mock.calls).toEqual([['']]);
        });

        // Known limitation: the end of the stream calls setResult without checking that it exists.
        it('rejects with a TypeError when the stream has no content and there is no setResult', async () => {
            stubFetch(new Response(streamBody('data: [DONE]\n\n')));

            await expect(translate('hello', 'Auto', 'German', { config: streamConfig })).rejects.toThrow(TypeError);
        });

        it('throws the status and "undefined" for the body on an HTTP error, as a Response has no data', async () => {
            stubFetch(new Response('{"error":"bad"}', { status: 401 }));

            await expect(
                translate('hello', 'Auto', 'German', { config: streamConfig, setResult: vi.fn() })
            ).rejects.toBe('Http Request Error\nHttp Status: 401\nundefined');
        });
    });
});
