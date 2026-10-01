import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { DEFAULT_WRITING_PROMPT } from '../../../utils/writing_prompt';
import { improve, info } from './index';

const answer = { data: { choices: [{ message: { content: 'He and I go.' } }] } };

function sent() {
    const { url, options } = httpMock.calls[0];
    return { url, headers: options!.headers, payload: (options!.body as { payload: any }).payload };
}

describe('llm7 writing', () => {
    it('exports its info', () => {
        expect(info).toEqual({ name: 'llm7', icon: 'logo/llm7.svg' });
    });

    it('asks llm7.io without a key, with the default model and instructions', async () => {
        httpMock.queue(answer);

        await expect(improve('me and him goes', { config: {} })).resolves.toBe('He and I go.');
        expect(sent()).toEqual({
            url: 'https://api.llm7.io/v1/chat/completions',
            headers: { 'Content-Type': 'application/json' },
            payload: {
                model: 'default',
                stream: false,
                messages: [
                    { role: 'system', content: DEFAULT_WRITING_PROMPT },
                    { role: 'user', content: '\nme and him goes' },
                ],
            },
        });
    });

    it('sends the style and the request in the message, and the saved model and instructions', async () => {
        httpMock.queue(answer);

        await improve('hello', {
            config: { model: 'fast', systemPrompt: 'Rewrite.' },
            style: 'Casual: relaxed.',
            request: 'shorter',
        });

        expect(sent().payload.model).toBe('fast');
        expect(sent().payload.messages).toEqual([
            { role: 'system', content: 'Rewrite.' },
            { role: 'user', content: 'Style: Casual: relaxed.\nRequest: shorter\n\nhello' },
        ]);
    });

    it('throws what the server answered', async () => {
        httpMock.queue({ status: 402, data: {} });

        await expect(improve('hello', { config: {} })).rejects.toBe('Http Request Error\nHttp Status: 402\n{}');
    });
});
