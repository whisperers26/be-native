import { chat } from '../chat';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../../utils/writing_prompt';
import type { WritingOptions } from '../../../types/service';

export const LLM7_URL = 'https://api.llm7.io/v1/chat/completions';
/** LLM7's own name for whichever model it picks. */
export const DEFAULT_MODEL = 'default';

/** Rewrite with LLM7.io, an OpenAI-compatible API that asks for no key (docs/agents/services.md). */
export async function improve(text: string, options: WritingOptions): Promise<string> {
    const { config, style, request } = options;
    return chat({
        url: LLM7_URL,
        model: config.model || DEFAULT_MODEL,
        systemPrompt: config.systemPrompt || DEFAULT_WRITING_PROMPT,
        message: writingMessage(text, { style, request }),
    });
}

export * from './Config';
export * from './info';
