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
        expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('haiku');
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
                    model: 'haiku',
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
                model: 'haiku',
                effort: 'off',
                systemPrompt: DEFAULT_SYSTEM_PROMPT,
            })
        );
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
