import { NextUIProvider } from '@nextui-org/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fakeTauri } from '../../test/fake-tauri';
import { DEFAULT_SYSTEM_PROMPT } from '../../utils/agent_cli';
import { Config as ClaudeCodeConfig } from '../../services/translate/claude_code';
import { Config as CodexConfig } from '../../services/translate/codex';
import { Config as WritingClaudeCodeConfig } from '../../services/writing/claude_code';
import { DEFAULT_WRITING_PROMPT } from '../../utils/writing_prompt';
import '../../i18n';

function renderForm(Form: typeof ClaudeCodeConfig, instanceKey: string) {
    const updateServiceList = vi.fn();
    const onClose = vi.fn();
    render(
        <NextUIProvider>
            <Form
                instanceKey={instanceKey}
                updateServiceList={updateServiceList}
                onClose={onClose}
            />
        </NextUIProvider>
    );
    return { updateServiceList, onClose };
}

function runs() {
    return fakeTauri.calls.filter((call) => call.cmd === 'agent_cli_run').map((call) => call.args);
}

describe('AgentCliConfig', () => {
    it('offers the executable, model, reasoning level and instructions of Claude Code', async () => {
        renderForm(ClaudeCodeConfig, 'claude_code@abc');

        expect(await screen.findByLabelText('Configuration Name')).toHaveValue('Claude Code');
        expect(screen.getByLabelText('Executable')).toHaveValue('');
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('Haiku 4.5');
        expect(screen.getByRole('button', { name: 'Off' })).toBeInTheDocument();
        expect(screen.getByLabelText('Instructions')).toHaveValue(DEFAULT_SYSTEM_PROMPT);
        expect(fakeTauri.unhandled).toEqual([]);
    });

    it('starts Codex with the tool default model and low reasoning', async () => {
        renderForm(CodexConfig, 'codex@abc');

        expect(await screen.findByLabelText('Configuration Name')).toHaveValue('Codex');
        expect(screen.getByLabelText('Model')).toHaveValue('');
        expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
    });

    it('translates once with the settings, then saves them and adds the instance', async () => {
        fakeTauri.command('agent_cli_run', () => '你好');
        const { updateServiceList, onClose } = renderForm(ClaudeCodeConfig, 'claude_code@abc');
        fireEvent.change(await screen.findByLabelText('Executable'), { target: { value: 'C:/bin/claude.exe' } });

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
        expect(runs()).toEqual([
            {
                id: 'nanoid-fixed-id',
                spec: {
                    provider: 'claude_code',
                    command: 'C:/bin/claude.exe',
                    model: 'claude-haiku-4-5-20251001',
                    effort: 'off',
                    systemPrompt: DEFAULT_SYSTEM_PROMPT,
                },
                prompt: 'Target language: Simplified Chinese\n\nhello',
            },
        ]);
        expect(updateServiceList).toHaveBeenCalledWith('claude_code@abc');
        await vi.waitFor(() =>
            expect(fakeTauri.store.get('claude_code@abc')).toEqual({
                instanceName: 'Claude Code',
                command: 'C:/bin/claude.exe',
                model: 'claude-haiku-4-5-20251001',
                effort: 'off',
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
            })
        );
    });

    it('shows a chosen model by its name and saves its exact id', async () => {
        renderForm(ClaudeCodeConfig, 'claude_code@abc');
        const model = await screen.findByRole('combobox', { name: 'Model' });

        fireEvent.change(model, { target: { value: 'Opus 5.5' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await vi.waitFor(() => expect(fakeTauri.store.get('claude_code@abc')).toMatchObject({ model: 'claude-opus-5-5' }));
        expect(model).toHaveValue('Opus 5.5');
    });

    it('asks Codex for its models, offers them by name and keeps the list with the settings', async () => {
        fakeTauri.command('agent_cli_run', () => '你好');
        fakeTauri.command('agent_cli_models', () => [
            { label: 'GPT-6-Luna', value: 'gpt-6-luna' },
            { label: 'GPT-5.6-Terra', value: 'gpt-5.6-terra' },
        ]);
        renderForm(CodexConfig, 'codex@abc');
        fireEvent.change(await screen.findByLabelText('Executable'), { target: { value: 'C:/bin/codex.cmd' } });

        fireEvent.click(screen.getByRole('button', { name: 'Check which models the tool offers' }));

        const model = await screen.findByRole('combobox', { name: 'Model' });
        expect(fakeTauri.calls.find((call) => call.cmd === 'agent_cli_models')?.args).toEqual({
            provider: 'codex',
            command: 'C:/bin/codex.cmd',
        });
        fireEvent.change(model, { target: { value: 'GPT-5.6-Terra' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await vi.waitFor(() =>
            expect(fakeTauri.store.get('codex@abc')).toMatchObject({
                model: 'gpt-5.6-terra',
                models: [
                    { label: 'GPT-6-Luna', value: 'gpt-6-luna' },
                    { label: 'GPT-5.6-Terra', value: 'gpt-5.6-terra' },
                ],
            })
        );
        expect(model).toHaveValue('GPT-5.6-Terra');
    });

    it('offers the models the tool listed the last time', async () => {
        fakeTauri.store.set('codex@abc', {
            model: 'gpt-6-luna',
            models: [{ label: 'GPT-6-Luna', value: 'gpt-6-luna' }],
        });
        renderForm(CodexConfig, 'codex@abc');

        expect(await screen.findByRole('combobox', { name: 'Model' })).toHaveValue('GPT-6-Luna');
    });

    it('replaces the suggested Claude Code models with the ones the tool lists', async () => {
        fakeTauri.command('agent_cli_models', () => [
            { label: 'Default (recommended)', value: 'default' },
            { label: 'Haiku 4.5 (new)', value: 'claude-haiku-4-5-20251001' },
        ]);
        renderForm(ClaudeCodeConfig, 'claude_code@abc');
        const model = await screen.findByRole('combobox', { name: 'Model' });

        fireEvent.click(screen.getByRole('button', { name: 'Check which models the tool offers' }));

        await vi.waitFor(() => expect(model).toHaveValue('Haiku 4.5 (new)'));
    });

    it('shows why the models could not be listed and keeps the field as it was', async () => {
        fakeTauri.command('agent_cli_models', () => {
            throw 'The command-line tool did not list its models. Update it, or type the name of the model.';
        });
        renderForm(CodexConfig, 'codex@abc');
        fireEvent.change(await screen.findByLabelText('Model'), { target: { value: 'gpt-x' } });

        fireEvent.click(screen.getByRole('button', { name: 'Check which models the tool offers' }));

        expect(await screen.findByText(/did not list its models/)).toBeInTheDocument();
        expect(screen.getByLabelText('Model')).toHaveValue('gpt-x');
        expect(screen.queryByRole('combobox', { name: 'Model' })).not.toBeInTheDocument();
    });

    it('shows why the test translation failed and does not add the instance', async () => {
        fakeTauri.command('agent_cli_run', () => {
            throw 'claude was not found. Install it, or set its path in the service settings.';
        });
        const { updateServiceList, onClose } = renderForm(ClaudeCodeConfig, 'claude_code@abc');

        fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/claude was not found/)).toBeInTheDocument();
        expect(updateServiceList).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('gives a writing service the writing instructions and tests it with a rewrite', async () => {
        fakeTauri.command('agent_cli_run', () => 'Hello');
        const { updateServiceList } = renderForm(WritingClaudeCodeConfig, 'claude_code@w');

        expect(await screen.findByLabelText('Instructions')).toHaveValue(DEFAULT_WRITING_PROMPT);
        expect(screen.getByText(/^Rewrites with the Claude Code command-line tool/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        await vi.waitFor(() => expect(updateServiceList).toHaveBeenCalledWith('claude_code@w'));
        expect(runs()[0].prompt).toBe('\nhello');
        expect(runs()[0].spec.systemPrompt).toBe(DEFAULT_WRITING_PROMPT);
    });
});
