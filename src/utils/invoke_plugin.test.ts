import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import { invoke_plugin } from './invoke_plugin';

const PLUGIN_DIR = '/fake/AppConfig/plugins/translate/plugin_demo';

describe('invoke_plugin', () => {
    it('evaluates main.js and returns the function named after the plugin type', async () => {
        fakeTauri.files.set(`${PLUGIN_DIR}/main.js`, 'async function translate(text) { return text.toUpperCase(); }');

        const [translate] = await invoke_plugin('translate', 'plugin_demo');

        await expect(translate('abc')).resolves.toBe('ABC');
    });

    it('hands the plugin a fixed set of utilities and paths', async () => {
        fakeTauri.files.set(`${PLUGIN_DIR}/main.js`, 'function translate() {}');

        const [, utils] = await invoke_plugin('translate', 'plugin_demo');

        expect(Object.keys(utils).sort()).toEqual(
            [
                'CryptoJS',
                'Database',
                'cacheDir',
                'http',
                'osType',
                'pluginDir',
                'readBinaryFile',
                'readTextFile',
                'run',
                'tauriFetch',
            ].sort()
        );
        expect(utils.cacheDir).toBe('/fake/AppCache');
        expect(utils.pluginDir).toBe(PLUGIN_DIR);
    });

    it('runs binaries through the run_binary command', async () => {
        fakeTauri.files.set(`${PLUGIN_DIR}/main.js`, 'function translate() {}');
        fakeTauri.command('run_binary', () => ({ stdout: 'v1', stderr: '', status: 0 }));

        const [, utils] = await invoke_plugin('translate', 'plugin_demo');
        const output = await utils.run('tool.exe', ['-v']);

        expect(output).toEqual({ stdout: 'v1', stderr: '', status: 0 });
        expect(fakeTauri.calls.find((call) => call.cmd === 'run_binary')?.args).toEqual({
            pluginType: 'translate',
            pluginName: 'plugin_demo',
            cmdName: 'tool.exe',
            args: ['-v'],
        });
    });

    it('fails when the plugin has no main.js', async () => {
        await expect(invoke_plugin('translate', 'plugin_missing')).rejects.toBe(
            'fakeTauri: no such file /fake/AppConfig/plugins/translate/plugin_missing/main.js'
        );
    });
});
