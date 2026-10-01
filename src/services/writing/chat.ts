import { fetch, Body } from '@tauri-apps/api/http';

/** One chat completion from an OpenAI-compatible API, which the writing services that use HTTP share. */
export interface ChatRequest {
    url: string;
    /** Sent as a bearer token; left out when empty. */
    apiKey?: string;
    model: string;
    systemPrompt: string;
    message: string;
}

interface ChatResponse {
    choices?: { message?: { content?: string | null } }[];
}

/** The chat completions URL of an API given as a host, a base URL or the full URL. */
export function chatUrl(requestPath: string): string {
    const url = new URL(/^https?:\/\//.test(requestPath) ? requestPath : `https://${requestPath}`);
    if (!url.pathname.endsWith('/chat/completions')) {
        const base = url.pathname.replace(/\/+$/, '');
        url.pathname = `${base}${base.endsWith('/v1') ? '' : '/v1'}/chat/completions`;
    }
    return url.href;
}

/** Ask once, without streaming, and return the answer's text. */
export async function chat(request: ChatRequest): Promise<string> {
    const { url, apiKey, model, systemPrompt, message } = request;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const res = await fetch<ChatResponse>(url, {
        method: 'POST',
        headers,
        body: Body.json({
            model,
            stream: false,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message },
            ],
        }),
    });
    if (!res.ok) {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
    const text = res.data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
        throw JSON.stringify(res.data);
    }
    return text;
}
