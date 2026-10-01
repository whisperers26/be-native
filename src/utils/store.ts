import { Store } from 'tauri-plugin-store-api';
import { appConfigDir, join } from '@tauri-apps/api/path';
import { watch } from 'tauri-plugin-fs-watch-api';
import { invoke } from '@tauri-apps/api';

// @ts-expect-error placeholder without a path: Store requires one, and initStore() replaces this instance
export let store = new Store();

export async function initStore() {
    const appConfigDirPath = await appConfigDir();
    const appConfigPath = await join(appConfigDirPath, 'config.json');
    store = new Store(appConfigPath);
    const _ = await watch(appConfigPath, async () => {
        await store.load();
        await invoke('reload_store');
    });
}
