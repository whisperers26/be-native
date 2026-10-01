import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import { deleteKey, useConfig } from './useConfig';

async function loaded<T>(key: string, defaultValue: T, options?: { sync?: boolean }) {
    const hook = renderHook(() => useConfig(key, defaultValue, options));
    await waitFor(() => expect(hook.result.current[0]).not.toBeNull());
    return hook;
}

describe('useConfig', () => {
    it('is null until the store answers, then the default, which it writes to the store', async () => {
        const { result } = renderHook(() => useConfig('app_theme', 'system'));
        expect(result.current[0]).toBeNull();

        await waitFor(() => expect(result.current[0]).toBe('system'));
        expect(fakeTauri.store.get('app_theme')).toBe('system');
    });

    it('prefers the stored value and leaves it alone', async () => {
        fakeTauri.store.set('app_theme', 'dark');

        const { result } = await loaded('app_theme', 'system');

        expect(result.current[0]).toBe('dark');
        expect(fakeTauri.store.get('app_theme')).toBe('dark');
    });

    it('updates state at once, then saves and announces the change after 500 ms', async () => {
        const { result } = await loaded('greeting', 'hello');
        vi.useFakeTimers();

        act(() => result.current[1]('bonjour'));
        expect(result.current[0]).toBe('bonjour');
        expect(result.current[2]()).toBe('bonjour');

        vi.advanceTimersByTime(499);
        expect(fakeTauri.store.get('greeting')).toBe('hello');

        vi.advanceTimersByTime(1);
        await vi.waitFor(() => expect(fakeTauri.store.get('greeting')).toBe('bonjour'));
        await vi.waitFor(() =>
            expect(fakeTauri.emitted).toContainEqual({ event: 'greeting_changed', windowLabel: undefined, payload: 'bonjour' })
        );
        expect(fakeTauri.calls.some((call) => call.cmd === 'plugin:store|save')).toBe(true);
    });

    it('turns "." into "_" and "@" into ":" in the change event name', async () => {
        const { result } = await loaded('deepl@abc.def', {});
        vi.useFakeTimers();

        act(() => result.current[1]({ authKey: 'k' }));
        vi.advanceTimersByTime(500);

        await vi.waitFor(() =>
            expect(fakeTauri.emitted.map((event) => event.event)).toContain('deepl:abc_def_changed')
        );
    });

    it('keeps two hooks on the same key in sync through the change event', async () => {
        const first = await loaded('shared', 'a');
        const second = await loaded('shared', 'a');

        act(() => first.result.current[1]('b'));

        await waitFor(() => expect(second.result.current[0]).toBe('b'), { timeout: 2000 });
    });

    it('with sync off, saves only when forced', async () => {
        const { result } = await loaded('draft', 'a', { sync: false });
        vi.useFakeTimers();

        act(() => result.current[1]('b'));
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
        expect(fakeTauri.store.get('draft')).toBe('a');

        act(() => result.current[1]('c', true));
        vi.advanceTimersByTime(500);
        await vi.waitFor(() => expect(fakeTauri.store.get('draft')).toBe('c'));
    });
});

describe('deleteKey', () => {
    it('removes the key from the store', async () => {
        fakeTauri.store.set('old_key', 1);

        deleteKey('old_key');

        await vi.waitFor(() => expect(fakeTauri.store.has('old_key')).toBe(false));
    });

    it('sends the delete even for a missing key (store.has is not awaited)', async () => {
        deleteKey('never_set');

        await vi.waitFor(() =>
            expect(fakeTauri.calls.some((call) => call.cmd === 'plugin:store|delete' && call.args.key === 'never_set')).toBe(
                true
            )
        );
    });
});
