import { Store } from 'tauri-plugin-store-api';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { watch } from 'tauri-plugin-fs-watch-api';
import { invoke } from '@tauri-apps/api';

// @ts-expect-error placeholder without a path: Store requires one, and initStore() replaces this instance
export let store = new Store();

// The settings as this window last knew them. Reading the store takes a call to Rust, so a component that
// waited for it would be drawn without its settings first; useConfig starts from this copy instead.
const cache = new Map<string, unknown>();

export function cachedValue<T>(key: string): T | null {
    return cache.has(key) ? (cache.get(key) as T) : null;
}

export function cacheValue(key: string, value: unknown) {
    if (value === null || value === undefined) {
        cache.delete(key);
    } else {
        cache.set(key, value);
    }
}

export function clearCache() {
    cache.clear();
}

async function fillCache() {
    const entries = await store.entries();
    cache.clear();
    for (const [key, value] of entries) {
        cacheValue(key, value);
    }
}

export async function initStore() {
    const appConfigDirPath = await appConfigDir();
    const appConfigPath = await join(appConfigDirPath, 'config.json');
    store = new Store(appConfigPath);
    await fillCache();
    const _ = await watch(appConfigPath, async () => {
        await store.load();
        await fillCache();
        await invoke('reload_store');
    });
}
