/**
 * Stand-in for `fetch` from `@tauri-apps/api/http`; src/test/setup.ts swaps it in for every test.
 *
 * Queue the responses a test expects with `httpMock.queue(...)`; each request takes the next one.
 * Requests are recorded in `httpMock.calls` exactly as the code passed them (url, options).
 */
import { vi } from 'vitest';

export interface FakeResponse {
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
}

export interface HttpCall {
    url: string;
    options?: Record<string, unknown>;
}

const queued: FakeResponse[] = [];
const calls: HttpCall[] = [];

export const fetchMock = vi.fn(async (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options });
    const next = queued.shift();
    if (!next) {
        throw new Error(`httpMock: no response queued for ${String(options?.method ?? 'GET')} ${url}`);
    }
    const status = next.status ?? 200;
    return {
        url,
        status,
        ok: status >= 200 && status < 300,
        headers: next.headers ?? {},
        rawHeaders: {},
        data: next.data,
    };
});

export const httpMock = {
    calls,
    queue(...responses: FakeResponse[]): void {
        queued.push(...responses);
    },
    reset(): void {
        queued.length = 0;
        calls.length = 0;
        fetchMock.mockClear();
    },
};
