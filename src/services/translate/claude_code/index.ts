import { agentCliSpec, runAgentCli, translationPrompt } from '../../../utils/agent_cli';
import type { TranslateOptions, TranslateResult } from '../../../types/service';

/** Translate with the installed `claude` command-line tool, in a session of its own (docs/agents/services.md). */
export async function translate(
    text: string,
    from: string,
    to: string,
    options: TranslateOptions
): Promise<TranslateResult> {
    const { config, setResult } = options;
    return runAgentCli(agentCliSpec('claude_code', config), translationPrompt(text, from, to), setResult);
}

export * from './Config';
export * from './info';
