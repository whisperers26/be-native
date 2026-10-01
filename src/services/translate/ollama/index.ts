import { Language } from './info';
import { Ollama } from 'ollama/browser';
import type { ChatResponse } from 'ollama/browser';
import type { TranslateOptions, TranslateResult } from '../../../types/service';

interface Prompt {
    role: string;
    content: string;
}

export async function translate(
    text: string,
    from: string,
    to: string,
    options: TranslateOptions = {} as TranslateOptions
): Promise<TranslateResult> {
    const { config, setResult, detect } = options;

    let { stream, promptList, requestPath, model } = config;

    if (!/https?:\/\/.+/.test(requestPath)) {
        requestPath = `https://${requestPath}`;
    }
    if (requestPath.endsWith('/')) {
        requestPath = requestPath.slice(0, -1);
    }
    const ollama = new Ollama({ host: requestPath });

    promptList = promptList.map((item: Prompt) => {
        return {
            ...item,
            content: item.content
                .replaceAll('$text', text)
                .replaceAll('$from', from)
                .replaceAll('$to', to)
                .replaceAll('$detect', Language[detect as keyof typeof Language]),
        };
    });

    const response = await ollama.chat({ model, messages: promptList, stream: stream });

    if (stream) {
        let target = '';
        for await (const part of response) {
            target += part.message.content;
            if (setResult) {
                setResult(target + '_');
            } else {
                ollama.abort();
                return '[STREAM]';
            }
        }
        // @ts-expect-error setResult may be undefined here: the loop's guard is skipped when the stream yields nothing
        setResult(target.trim());
        return target.trim();
    } else {
        // stream is any, so chat was typed with its streaming overload; without streaming it returns a ChatResponse
        return (response as unknown as ChatResponse).message.content;
    }
}

export * from './Config';
export * from './info';
