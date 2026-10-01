/**
 * Stand-ins for the browser's `fetch` and for streamed response bodies, for the services that do not
 * use Tauri's `fetch`: chatglm, ollama, and openai and geminipro when they stream.
 *
 * `stubFetch` replaces the global fetch for one test (src/test/setup.ts undoes the stub after each
 * test) and records what it was called with, in the `{ url, options }` shape of `httpMock.calls`.
 * `streamBody` and `sseEvent` build what such a fetch answers with.
 */
import { vi } from 'vitest';

export interface FetchCall {
    url: string;
    options?: RequestInit;
}

/**
 * Replaces the global fetch with one that answers every request with `respond`. Pass a function to get a
 * new Response per request, for a test that makes several (a Response body can only be read once).
 * Returns a function that lists the calls made so far. `window.fetch` is the same function under jsdom.
 */
export function stubFetch(respond: Response | (() => Response)): () => FetchCall[] {
    const fetchMock = vi.fn(async (_url: string, _options?: RequestInit) =>
        typeof respond === 'function' ? respond() : respond
    );
    vi.stubGlobal('fetch', fetchMock);
    return () => fetchMock.mock.calls.map(([url, options]) => ({ url, options }));
}

/**
 * A streamed response body. Each string is one read, so a test chooses where an event is cut:
 * `streamBody(first, second)`. With a number as the second argument the text is cut into reads of that
 * many bytes instead, which can also split a multi-byte character: `streamBody(text, 7)`.
 */
export function streamBody(...reads: string[]): ReadableStream<Uint8Array>;
export function streamBody(text: string, readSize: number): ReadableStream<Uint8Array>;
export function streamBody(...args: (string | number)[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    if (typeof args[1] === 'number') {
        const bytes = encoder.encode(args[0] as string);
        for (let start = 0; start < bytes.length; start += args[1]) {
            chunks.push(bytes.slice(start, start + args[1]));
        }
    } else {
        for (const read of args as string[]) chunks.push(encoder.encode(read));
    }
    return new ReadableStream({
        start(controller) {
            for (const chunk of chunks) controller.enqueue(chunk);
            controller.close();
        },
    });
}

/**
 * One server-sent event the way OpenAI-style chat APIs stream it: a chat completion chunk with one
 * choice and the given delta after "data:", then a blank line.
 */
export function sseEvent(delta: object): string {
    return `data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`;
}
