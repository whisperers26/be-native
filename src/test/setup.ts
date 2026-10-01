/**
 * Runs before every test file (vitest.config.ts → setupFiles).
 *
 * - Replaces `fetch` from `@tauri-apps/api/http` with the queue in ./http.
 * - Freezes nanoid and uuid; freezes Date and Math.random in every test.
 * - Installs the fake Tauri backend (./fake-tauri) and the browser APIs jsdom lacks, at load time,
 *   because app modules call Tauri and window APIs while they are imported.
 *
 * A render test that needs a window label other than 'main' sets it in a `vi.hoisted` block:
 * `@tauri-apps/api/window` reads the label once, when it is first imported.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, vi } from 'vitest';
import { fakeTauri } from './fake-tauri';
import { httpMock } from './http';

vi.mock('@tauri-apps/api/http', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tauri-apps/api/http')>();
    const { fetchMock } = await import('./http');
    return { ...actual, fetch: fetchMock };
});
vi.mock('nanoid', () => ({ nanoid: () => 'nanoid-fixed-id' }));
vi.mock('uuid', () => ({ v4: () => '01234567-89ab-4cde-8f01-23456789abcd' }));

export const FIXED_NOW = new Date('2026-01-02T03:04:05.678Z');

// Frozen clock without fake timers: a test can still call vi.useFakeTimers(), which starts
// from this time. (Vitest ignores useFakeTimers() while fake timers are already installed,
// so freezing Date with them here would silently keep setTimeout real in every test.)
const RealDate = Date;
class FrozenDate extends RealDate {
    // ConstructorParameters picks a single overload (one value), so name the empty call too.
    constructor(...args: [] | ConstructorParameters<typeof Date>) {
        if (args.length === 0) super(FIXED_NOW.getTime());
        else super(...args);
    }

    static now(): number {
        return FIXED_NOW.getTime();
    }
}

const w = window as any;
if (!w.__TAURI_METADATA__) {
    w.__TAURI_METADATA__ = { __windows: [{ label: 'main' }], __currentWindow: { label: 'main' } };
}
w.__TAURI__ = {
    convertFileSrc: (path: string, protocol = 'asset') => `${protocol}://localhost/${encodeURIComponent(path)}`,
};
mockIPC(fakeTauri.handle);

class FakeAudioContext {
    destination = {};
    decodeAudioData(): void {}
    createBufferSource() {
        return { connect() {}, disconnect() {}, start() {}, stop() {}, buffer: null, onended: null };
    }
}
w.AudioContext = FakeAudioContext;
w.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
});
w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
};
w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
};
w.scrollTo = () => {};
w.Notification = class {
    static permission = 'granted';
    static requestPermission = async () => 'granted';
};
// jsdom has no innerText; the app reads it from parsed HTML (cambridge_dict).
if (!('innerText' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'innerText', {
        get(this: HTMLElement) {
            return this.textContent;
        },
        set(this: HTMLElement, value: string) {
            this.textContent = value;
        },
        configurable: true,
    });
}

beforeEach(() => {
    vi.stubGlobal('Date', FrozenDate);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    fakeTauri.reset();
    httpMock.reset();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});
