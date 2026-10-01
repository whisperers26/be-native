import { describe, expect, it } from 'vitest';
import { httpMock } from '../../test/http';
import { chat, chatUrl } from './chat';

const request = {
    url: 'https://api.example.com/v1/chat/completions',
    model: 'small',
    systemPrompt: 'Rewrite.',
    message: '\nme and him goes',
};

function answer(content: string | null) {
    return { data: { choices: [{ message: { role: 'assistant', content } }] } };
}

describe('chatUrl', () => {
    it('adds the scheme and the chat completions path to a host', () => {
        expect(chatUrl('api.openai.com')).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('does not double /v1', () => {
        expect(chatUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1/chat/completions');
        expect(chatUrl('https://api.example.com/v1/')).toBe('https://api.example.com/v1/chat/completions');
    });

    it('keeps a full URL, and plain http', () => {
        expect(chatUrl('http://localhost:11434/v1/chat/completions')).toBe(
            'http://localhost:11434/v1/chat/completions'
        );
        expect(chatUrl('https://x.example/openai/deployments/d/chat/completions?api-version=1')).toBe(
            'https://x.example/openai/deployments/d/chat/completions?api-version=1'
        );
    });
});

describe('chat', () => {
    it('sends the instructions as the system message and returns the trimmed answer', async () => {
        httpMock.queue(answer(' He and I go. \n'));

        await expect(chat(request)).resolves.toBe('He and I go.');
        expect(httpMock.calls).toEqual([
            {
                url: 'https://api.example.com/v1/chat/completions',
                options: {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: {
                        type: 'Json',
                        payload: {
                            model: 'small',
                            stream: false,
                            messages: [
                                { role: 'system', content: 'Rewrite.' },
                                { role: 'user', content: '\nme and him goes' },
                            ],
                        },
                    },
                },
            },
        ]);
    });

    it('sends a key as a bearer token', async () => {
        httpMock.queue(answer('ok'));

        await chat({ ...request, apiKey: 'sk-1' });

        expect((httpMock.calls[0].options!.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-1');
    });

    it('throws the status and the reply of a failed request', async () => {
        httpMock.queue({ status: 429, data: { error: 'slow down' } });

        await expect(chat(request)).rejects.toBe('Http Request Error\nHttp Status: 429\n{"error":"slow down"}');
    });

    it('throws the reply when it carries no text', async () => {
        httpMock.queue({ data: { choices: [] } }, answer(null), answer('  '));

        await expect(chat(request)).rejects.toBe('{"choices":[]}');
        await expect(chat(request)).rejects.toContain('"content":null');
        await expect(chat(request)).rejects.toContain('choices');
    });
});
