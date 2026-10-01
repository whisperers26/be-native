import { invoke } from '@tauri-apps/api/tauri';
import { emit, listen } from '@tauri-apps/api/event';
import { fetch } from '@tauri-apps/api/http';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { nanoid } from 'nanoid';
import { Store } from 'tauri-plugin-store-api';
import { v4 as uuidv4 } from 'uuid';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from './fake-tauri';
import { httpMock } from './http';
import { FIXED_NOW } from './setup';

describe('test harness', () => {
    it('freezes Date, and fake timers start from the frozen time', () => {
        expect(Date.now()).toBe(FIXED_NOW.getTime());
        expect(new Date().toISOString()).toBe('2026-01-02T03:04:05.678Z');
        expect(new Date(0).toISOString()).toBe('1970-01-01T00:00:00.000Z');

        vi.useFakeTimers();
        vi.advanceTimersByTime(1000);
        expect(Date.now()).toBe(FIXED_NOW.getTime() + 1000);
    });

    it('freezes Math.random, nanoid and uuid', () => {
        expect(Math.random()).toBe(0.123456789);
        expect(nanoid()).toBe('nanoid-fixed-id');
        expect(uuidv4()).toBe('01234567-89ab-4cde-8f01-23456789abcd');
    });

    it('answers HTTP requests from the queue, in order, and records them', async () => {
        httpMock.queue({ data: { a: 1 } }, { status: 500, data: 'boom' });

        const first = await fetch('https://example.test/one', { method: 'GET' });
        const second = await fetch('https://example.test/two', { method: 'POST' });

        expect([first.ok, first.status, first.data]).toEqual([true, 200, { a: 1 }]);
        expect([second.ok, second.status, second.data]).toEqual([false, 500, 'boom']);
        expect(httpMock.calls.map((call) => call.url)).toEqual(['https://example.test/one', 'https://example.test/two']);
    });

    it('throws on an HTTP request with no queued response', async () => {
        await expect(fetch('https://example.test/missing', { method: 'GET' })).rejects.toThrow(
            'httpMock: no response queued for GET https://example.test/missing'
        );
    });

    it('answers Rust commands with defaults and overrides', async () => {
        await expect(invoke('get_text')).resolves.toBe('');
        fakeTauri.command('get_text', () => 'selected text');
        await expect(invoke('get_text')).resolves.toBe('selected text');
    });

    it('records commands it does not know', async () => {
        await expect(invoke('no_such_command')).resolves.toBeNull();
        expect(fakeTauri.unhandled).toEqual(['no_such_command']);
    });

    it('resolves Tauri paths under /fake', async () => {
        await expect(appConfigDir()).resolves.toBe('/fake/AppConfig');
        await expect(join('/fake/AppConfig', 'plugins', 'x')).resolves.toBe('/fake/AppConfig/plugins/x');
    });

    it('keeps the settings store in memory', async () => {
        const store = new Store('/fake/AppConfig/config.json');
        await store.set('k', { v: 1 });
        expect(fakeTauri.store.get('k')).toEqual({ v: 1 });
        await expect(store.get('k')).resolves.toEqual({ v: 1 });
        await expect(store.get('missing')).resolves.toBeNull();
    });

    it('delivers emitted events to listeners and records them', async () => {
        const received: unknown[] = [];
        await listen('demo', (event) => received.push(event.payload));

        await emit('demo', 'from the app');
        fakeTauri.emit('demo', 'from rust');
        await vi.waitFor(() => expect(received).toEqual(['from the app', 'from rust']));

        expect(fakeTauri.emitted).toEqual([{ event: 'demo', windowLabel: undefined, payload: 'from the app' }]);
    });
});
