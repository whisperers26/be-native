import { agentCliSpec, runAgentCli } from '../../../utils/agent_cli';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../../utils/writing_prompt';
import type { WritingOptions } from '../../../types/service';

/** Rewrite with the installed `claude` command-line tool, in a session of its own (docs/agents/services.md). */
export async function improve(text: string, options: WritingOptions): Promise<string> {
    const { config, style, request, setResult } = options;
    const spec = agentCliSpec('claude_code', {
        ...config,
        systemPrompt: config.systemPrompt || DEFAULT_WRITING_PROMPT,
    });
    return runAgentCli(spec, writingMessage(text, { style, request }), setResult);
}

export * from './Config';
export * from './info';
