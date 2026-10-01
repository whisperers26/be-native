import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { info, Language, translate } from './index';

const config = {
    instanceName: 'Claude Code',
    command: '',
    model: 'haiku',
    effort: 'off',
    systemPrompt: 'Translate.',
};

describe('claude_code translate', () => {
    it('exports its info and language table', () => {
        expect(info).toEqual({ name: 'claude_code', icon: 'logo/claude_code.svg' });
        expect(Language.zh_cn).toBe('Simplified Chinese');
    });

    it('runs the translation in a claude session and returns the answer', async () => {
        fakeTauri.command('agent_cli_run', () => 'Hallo Welt\n');

        await expect(translate('hello world', Language.auto, Language.de, { config })).resolves.toBe('Hallo Welt');
        expect(fakeTauri.calls.find((call) => call.cmd === 'agent_cli_run')?.args).toEqual({
            id: 'nanoid-fixed-id',
            spec: {
                provider: 'claude_code',
                command: '',
                model: 'haiku',
                effort: 'off',
                systemPrompt: 'Translate.',
            },
            prompt: 'Target language: German\n\nhello world',
        });
    });

    it('streams the text so far to the result card', async () => {
        const partial: string[] = [];
        let finish: (answer: string) => void = () => {};
        fakeTauri.command('agent_cli_run', () => new Promise<string>((resolve) => (finish = resolve)));

        const answer = translate('hello', Language.en, Language.de, { config, setResult: (v) => partial.push(v) });
        await expect.poll(() => fakeTauri.calls.some((call) => call.cmd === 'agent_cli_run')).toBe(true);
        fakeTauri.emit('agent_cli_stream', { id: 'nanoid-fixed-id', text: 'Hal' });
        await expect.poll(() => partial).toEqual(['Hal_']);
        finish('Hallo');

        await expect(answer).resolves.toBe('Hallo');
    });

    it('throws what the tool reported', async () => {
        fakeTauri.command('agent_cli_run', () => {
            throw 'Not logged in';
        });

        await expect(translate('hello', Language.en, Language.de, { config })).rejects.toBe('Not logged in');
    });
});
