import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import * as storeModule from './store';

describe('initStore', () => {
    it('opens config.json in the app config dir and watches it', async () => {
        await storeModule.initStore();
        await storeModule.store.set('k', 1);

        expect(fakeTauri.store.get('k')).toBe(1);
        const setCall = fakeTauri.calls.find((call) => call.cmd === 'plugin:store|set');
        expect(setCall?.args.path).toBe('/fake/AppConfig/config.json');

        const watchCall = fakeTauri.calls.find((call) => call.cmd === 'plugin:fs-watch|watch');
        expect(watchCall?.args.paths).toEqual(['/fake/AppConfig/config.json']);
    });

    it('reads values back from the settings file', async () => {
        fakeTauri.store.set('app_theme', 'dark');
        await storeModule.initStore();

        await expect(storeModule.store.get('app_theme')).resolves.toBe('dark');
    });
});
