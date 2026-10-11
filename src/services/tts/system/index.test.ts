import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { info, Language, tts } from './index';

const audio = [82, 73, 70, 70, 0, 0, 0, 0];

describe('system TTS', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('asks the Rust command for the text and language and returns its bytes', async () => {
        const requested: unknown[] = [];
        fakeTauri.command('system_tts', (args) => {
            requested.push(args);
            return audio;
        });

        await expect(tts('你好', 'zh-CN', { config: {} })).resolves.toEqual(audio);
        expect(requested).toEqual([{ text: '你好', lang: 'zh-CN' }]);
    });

    it('rejects with the command error, such as a missing voice', async () => {
        fakeTauri.command('system_tts', () => {
            throw 'No installed voice for zh-CN';
        });

        await expect(tts('你好', 'zh-CN', { config: {} })).rejects.toBe('No installed voice for zh-CN');
    });
});
