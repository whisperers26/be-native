import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { DEFAULT_WRITING_PROMPT } from '../../../utils/writing_prompt';
import { improve, info } from './index';

const answer = { data: { choices: [{ message: { content: 'He and I go.' } }] } };

function sent() {
    const { url, options } = httpMock.calls[0];
    return { url, headers: options!.headers, payload: (options!.body as { payload: any }).payload };
}

describe('openai writing', () => {
    it('exports its info', () => {
        expect(info).toEqual({ name: 'openai', icon: 'logo/openai.svg' });
    });

    it('asks the configured API with the key, model and instructions', async () => {
        httpMock.queue(answer);
        const config = { requestPath: 'api.example.com', apiKey: 'sk-1', model: 'small', systemPrompt: 'Rewrite.' };

        await expect(improve('me and him goes', { config, style: 'Concise' })).resolves.toBe('He and I go.');
        expect(sent()).toEqual({
            url: 'https://api.example.com/v1/chat/completions',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sk-1' },
            payload: {
                model: 'small',
                stream: false,
                messages: [
                    { role: 'system', content: 'Rewrite.' },
                    { role: 'user', content: 'Style: Concise\n\nme and him goes' },
                ],
            },
        });
    });

    it('falls back to OpenAI, its small model and the built-in instructions', async () => {
        httpMock.queue(answer);

        await improve('hello', { config: {} });

        expect(sent().url).toBe('https://api.openai.com/v1/chat/completions');
        expect(sent().payload.model).toBe('gpt-4o-mini');
        expect(sent().payload.messages[0].content).toBe(DEFAULT_WRITING_PROMPT);
    });
});
