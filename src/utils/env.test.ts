import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import * as env from './env';

describe('initEnv', () => {
    it('starts empty and fills in the OS and app details', async () => {
        expect([env.osType, env.arch, env.osVersion, env.appVersion, env.appName]).toEqual(['', '', '', '', '']);

        await env.initEnv();

        expect(env.osType).toBe('Windows_NT');
        expect(env.arch).toBe('x86_64');
        expect(env.osVersion).toBe('10.0.26200');
        expect(env.appVersion).toBe('3.0.7');
        expect(env.appName).toBe('Be Native');
    });

    it('reports whatever OS Tauri reports', async () => {
        fakeTauri.os.osType = 'Linux';
        fakeTauri.os.arch = 'aarch64';

        await env.initEnv();

        expect(env.osType).toBe('Linux');
        expect(env.arch).toBe('aarch64');
    });
});
