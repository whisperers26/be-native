import { describe, expect, it } from 'vitest';
import { fakeTauri } from '../test/fake-tauri';
import {
    agentCliSpec,
    DEFAULT_SYSTEM_PROMPT,
    Language,
    listAgentCliModels,
    runAgentCli,
    translationPrompt,
} from './agent_cli';

const spec = { provider: 'claude_code', command: '', model: 'haiku', effort: 'off', systemPrompt: 'Translate.' } as const;

describe('agentCliSpec', () => {
    it('takes the session settings from the instance config', () => {
        const config = {
            instanceName: 'Claude',
            enable: true,
            command: 'C:/bin/claude.exe',
            model: 'sonnet',
            effort: 'low',
            systemPrompt: 'Translate.',
        };
        expect(agentCliSpec('claude_code', config)).toEqual({
            provider: 'claude_code',
            command: 'C:/bin/claude.exe',
            model: 'sonnet',
            effort: 'low',
            systemPrompt: 'Translate.',
        });
    });

    it('falls back to the tool defaults and the built-in instructions', () => {
        expect(agentCliSpec('codex', {})).toEqual({
            provider: 'codex',
            command: '',
            model: '',
            effort: '',
            systemPrompt: DEFAULT_SYSTEM_PROMPT,
        });
        expect(agentCliSpec('codex', { systemPrompt: '' }).systemPrompt).toBe(DEFAULT_SYSTEM_PROMPT);
    });

    it('keeps the built-in instructions on one line, so they survive a .cmd launcher', () => {
        expect(DEFAULT_SYSTEM_PROMPT).not.toMatch(/[\r\n"%]/);
    });
});

describe('translationPrompt', () => {
    it('names the target and source languages before the text', () => {
        expect(translationPrompt('hello\nworld', Language.en, Language.de)).toBe(
            'Target language: German\nSource language: English\n\nhello\nworld'
        );
    });

    it('leaves the source language out when it is to be detected', () => {
        expect(translationPrompt('hello', Language.auto, Language.zh_cn)).toBe(
            'Target language: Simplified Chinese\n\nhello'
        );
    });
});

describe('runAgentCli', () => {
    it('runs the prompt in a session of the spec and returns the trimmed answer', async () => {
        fakeTauri.command('agent_cli_run', () => ' Hallo \n');

        await expect(runAgentCli(spec, 'Target language: German\n\nhello')).resolves.toBe('Hallo');
        expect(fakeTauri.calls.find((call) => call.cmd === 'agent_cli_run')?.args).toEqual({
            id: 'nanoid-fixed-id',
            spec,
            prompt: 'Target language: German\n\nhello',
        });
    });

    it('passes on the text so far, with a cursor, while the answer arrives', async () => {
        const partial: string[] = [];
        let finish: (answer: string) => void = () => {};
        fakeTauri.command('agent_cli_run', () => new Promise<string>((resolve) => (finish = resolve)));

        const answer = runAgentCli(spec, 'hello', (text) => partial.push(text));
        await expect.poll(() => fakeTauri.calls.some((call) => call.cmd === 'agent_cli_run')).toBe(true);
        fakeTauri.emit('agent_cli_stream', { id: 'nanoid-fixed-id', text: 'Hal' });
        fakeTauri.emit('agent_cli_stream', { id: 'another-run', text: 'Bonjour' });
        fakeTauri.emit('agent_cli_stream', { id: 'nanoid-fixed-id', text: 'Hallo' });
        await expect.poll(() => partial).toEqual(['Hal_', 'Hallo_']);
        finish('Hallo');

        await expect(answer).resolves.toBe('Hallo');
    });

    it('stops listening once the answer is complete', async () => {
        const partial: string[] = [];
        fakeTauri.command('agent_cli_run', () => 'Hallo');
        await runAgentCli(spec, 'hello', (text) => partial.push(text));

        fakeTauri.emit('agent_cli_stream', { id: 'nanoid-fixed-id', text: 'late' });
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(partial).toEqual([]);
    });

    it('rejects with what the tool reported', async () => {
        fakeTauri.command('agent_cli_run', () => {
            throw 'claude was not found. Install it, or set its path in the service settings.';
        });

        await expect(runAgentCli(spec, 'hello')).rejects.toBe(
            'claude was not found. Install it, or set its path in the service settings.'
        );
    });
});

describe('listAgentCliModels', () => {
    it('asks the tool at the given path for its models', async () => {
        const models = [{ label: 'GPT-6-Luna', value: 'gpt-6-luna' }];
        fakeTauri.command('agent_cli_models', () => models);

        await expect(listAgentCliModels('codex', 'C:/bin/codex.cmd')).resolves.toEqual(models);
        expect(fakeTauri.calls.find((call) => call.cmd === 'agent_cli_models')?.args).toEqual({
            provider: 'codex',
            command: 'C:/bin/codex.cmd',
        });
    });

    it('rejects with why the tool listed none', async () => {
        fakeTauri.command('agent_cli_models', () => {
            throw 'codex was not found. Install it, or set its path in the service settings.';
        });

        await expect(listAgentCliModels('codex', '')).rejects.toMatch(/codex was not found/);
    });
});
