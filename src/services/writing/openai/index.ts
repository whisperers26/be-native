import { chat, chatUrl } from '../chat';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../../utils/writing_prompt';
import type { WritingOptions } from '../../../types/service';

export const DEFAULT_REQUEST_PATH = 'https://api.openai.com/v1/chat/completions';
export const DEFAULT_MODEL = 'gpt-4o-mini';

/** Rewrite with an OpenAI-compatible chat API and the user's key. */
export async function improve(text: string, options: WritingOptions): Promise<string> {
    const { config, style, request } = options;
    return chat({
        url: chatUrl(config.requestPath || DEFAULT_REQUEST_PATH),
        apiKey: config.apiKey,
        model: config.model || DEFAULT_MODEL,
        systemPrompt: config.systemPrompt || DEFAULT_WRITING_PROMPT,
        message: writingMessage(text, { style, request }),
    });
}

export * from './Config';
export * from './info';
