import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../../../test/fake-tauri';
import { DEFAULT_WRITING_PROMPT } from '../../../utils/writing_prompt';
import { improve, info } from './index';

describe('codex writing', () => {
    it('exports its info', () => {
        expect(info.name).toBe('codex');
    });

    it('rewrites in a codex session with the writing instructions', async () => {
        fakeTauri.command('agent_cli_run', () => 'He and I go.');

        await expect(improve('me and him goes', { config: { effort: 'low' } })).resolves.toBe('He and I go.');
        expect(fakeTauri.calls.find((call) => call.cmd === 'agent_cli_run')?.args).toEqual({
            id: 'nanoid-fixed-id',
            spec: { provider: 'codex', command: '', model: '', effort: 'low', systemPrompt: DEFAULT_WRITING_PROMPT },
            prompt: '\nme and him goes',
        });
    });
});
