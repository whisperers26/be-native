import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { DEFAULT_WRITING_PROMPT } from '../../../utils/writing_prompt';
import { improve, info } from './index';

function run() {
    return fakeTauri.calls.find((call) => call.cmd === 'agent_cli_run')?.args;
}

describe('claude_code writing', () => {
    it('exports its info', () => {
        expect(info).toEqual({ name: 'claude_code', icon: 'logo/claude_code.svg' });
    });

    it('rewrites in a claude session, with the style and the request in the message', async () => {
        fakeTauri.command('agent_cli_run', () => 'He and I go.\n');
        const config = { command: '', model: 'haiku', effort: 'off', systemPrompt: 'Rewrite.' };

        await expect(improve('me and him goes', { config, style: 'Concise', request: 'no jargon' })).resolves.toBe(
            'He and I go.'
        );
        expect(run()).toEqual({
            id: 'nanoid-fixed-id',
            spec: { provider: 'claude_code', command: '', model: 'haiku', effort: 'off', systemPrompt: 'Rewrite.' },
            prompt: 'Style: Concise\nRequest: no jargon\n\nme and him goes',
        });
    });

    it('uses the writing instructions, not the translation ones, when none are saved', async () => {
        fakeTauri.command('agent_cli_run', () => 'ok');

        await improve('hello', { config: {} });

        expect(run()?.spec.systemPrompt).toBe(DEFAULT_WRITING_PROMPT);
    });

    it('streams the text so far', async () => {
        const partial: string[] = [];
        let finish: (answer: string) => void = () => {};
        fakeTauri.command('agent_cli_run', () => new Promise<string>((resolve) => (finish = resolve)));

        const answer = improve('hello', { config: {}, setResult: (v) => partial.push(v) });
        await expect.poll(() => fakeTauri.calls.some((call) => call.cmd === 'agent_cli_run')).toBe(true);
        fakeTauri.emit('agent_cli_stream', { id: 'nanoid-fixed-id', text: 'Hel' });
        await expect.poll(() => partial).toEqual(['Hel_']);
        finish('Hello');

        await expect(answer).resolves.toBe('Hello');
    });
});
