import { beforeEach, describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { DEFAULT_WRITING_PROMPT } from '../../../utils/writing_prompt';
import { improve, info, pacing } from './index';

const answer = { data: { choices: [{ message: { content: 'He and I go.' } }] } };
const limited = (retry_after?: number) => ({ status: 429, data: { error: { message: 'Rate limit', retry_after } } });
const refused = { status: 402, data: {} };

// The waits the service asked for, in seconds, instead of the waiting.
let waits: number[] = [];
beforeEach(() => {
    waits = [];
    pacing.wait = async (seconds) => {
        waits.push(seconds);
    };
});

function payloads(): any[] {
    return httpMock.calls.map((call) => (call.options!.body as { payload: any }).payload);
}

describe('llm7 writing', () => {
    it('exports its info', () => {
        expect(info).toEqual({ name: 'llm7', icon: 'logo/llm7.svg' });
    });

    it('asks llm7.io without a key, with a free model and the default instructions', async () => {
        httpMock.queue(answer);

        await expect(improve('me and him goes', { config: {} })).resolves.toBe('He and I go.');
        expect(httpMock.calls[0].url).toBe('https://api.llm7.io/v1/chat/completions');
        expect(httpMock.calls[0].options!.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(payloads()[0]).toEqual({
            model: 'mistral-Nemo-Instruct-2407',
            stream: false,
            messages: [
                { role: 'system', content: DEFAULT_WRITING_PROMPT },
                { role: 'user', content: '\nme and him goes' },
            ],
        });
    });

    it('sends the style and the request in the message, and the saved model and instructions', async () => {
        httpMock.queue(answer);

        await improve('hello', {
            config: { model: 'fast', systemPrompt: 'Rewrite.' },
            style: 'Casual: relaxed.',
            request: 'shorter',
        });

        expect(payloads()[0].model).toBe('fast');
        expect(payloads()[0].messages).toEqual([
            { role: 'system', content: 'Rewrite.' },
            { role: 'user', content: 'Style: Casual: relaxed.\nRequest: shorter\n\nhello' },
        ]);
    });

    it('sends a token when one is set', async () => {
        httpMock.queue(answer);

        await improve('hello', { config: { apiKey: 'token-1' } });

        expect(httpMock.calls[0].options!.headers).toEqual({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-1',
        });
    });

    it('waits as long as a rate-limited reply says, then asks again', async () => {
        httpMock.queue(limited(7), limited(), answer);

        await expect(improve('hello', { config: {} })).resolves.toBe('He and I go.');
        expect(waits).toEqual([7, 1]);
        expect(payloads().map((payload) => payload.model)).toEqual(Array(3).fill('mistral-Nemo-Instruct-2407'));
    });

    it('never waits longer than half a minute at a time, and gives up after four waits', async () => {
        httpMock.queue(limited(600), limited(1), limited(1), limited(1), limited(1));

        await expect(improve('hello', { config: {} })).rejects.toContain('Http Status: 429');
        expect(waits).toEqual([30, 1, 1, 1]);
        expect(httpMock.calls).toHaveLength(5);
    });

    it('asks the next free model when one is refused', async () => {
        httpMock.queue(refused, { status: 500, data: {} }, answer);

        await expect(improve('hello', { config: { model: 'fast' } })).resolves.toBe('He and I go.');
        expect(payloads().map((payload) => payload.model)).toEqual(['fast', 'codestral-latest', 'default']);
        expect(waits).toEqual([]);
    });

    it('throws what the server answered once every model was refused', async () => {
        httpMock.queue(refused, refused, refused);

        await expect(improve('hello', { config: {} })).rejects.toBe('Http Request Error\nHttp Status: 402\n{}');
        expect(httpMock.calls).toHaveLength(3);
    });

    it('asks one request after another, in the order they were made', async () => {
        httpMock.queue(limited(2), answer, answer);

        await Promise.all([improve('first', { config: {} }), improve('second', { config: {} })]);

        // The second request starts only when the first, with its wait, is done.
        expect(payloads().map((payload) => payload.messages[1].content)).toEqual(['\nfirst', '\nfirst', '\nsecond']);
    });

    it('goes on with the next request after one that failed', async () => {
        httpMock.queue({ data: { choices: [] } }, answer);

        const failed = improve('first', { config: {} });
        const next = improve('second', { config: {} });

        await expect(failed).rejects.toBe('{"choices":[]}');
        await expect(next).resolves.toBe('He and I go.');
    });

    it('does not ask for a rewrite that is no longer wanted when its turn comes', async () => {
        httpMock.queue(answer);
        const gone = new AbortController();

        const first = improve('first', { config: {} });
        const second = improve('second', { config: {}, signal: gone.signal });
        gone.abort();

        await expect(first).resolves.toBe('He and I go.');
        await expect(second).rejects.toBe('Cancelled');
        expect(httpMock.calls).toHaveLength(1);
    });

    it('stops waiting out the rate limit for a rewrite that is no longer wanted', async () => {
        httpMock.queue(limited(5));
        const gone = new AbortController();
        pacing.wait = async () => gone.abort();

        await expect(improve('hello', { config: {}, signal: gone.signal })).rejects.toBe('Cancelled');
        expect(httpMock.calls).toHaveLength(1);
    });
});
