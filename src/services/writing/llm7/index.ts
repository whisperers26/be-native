import { answer, send } from '../chat';
import { DEFAULT_WRITING_PROMPT, writingMessage } from '../../../utils/writing_prompt';
import type { ChatReply } from '../chat';
import type { WritingOptions } from '../../../types/service';

export const LLM7_URL = 'https://api.llm7.io/v1/chat/completions';
/** A model LLM7 serves without a token. */
export const DEFAULT_MODEL = 'mistral-Nemo-Instruct-2407';
// What is asked when a model is refused: another model served without a token, then whichever LLM7 picks.
const FALLBACK_MODELS = ['codestral-latest', 'default'];
// How often a request waits out the rate limit before it gives up, and the longest it waits each time, in seconds.
// LLM7 counts requests by the minute, and a request made before the minute is over is refused again. It also
// counts them by the hour, and then says to wait far longer than is worth waiting.
const RATE_LIMIT_TRIES = 2;
const LONGEST_WAIT = 65;

/** How the service waits; a test replaces it. */
export const pacing = {
    wait: (seconds: number): Promise<void> => new Promise((done) => setTimeout(done, seconds * 1000)),
};

// Without a token LLM7 answers 429 to requests that come together, as the five of the Tones button do. So the
// requests of a window go one after another.
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
    const turn = queue.then(task, task);
    queue = turn.catch(() => undefined);
    return turn;
}

/** Rewrite with LLM7.io, an OpenAI-compatible API that asks for no key (docs/agents/services.md). */
export async function improve(text: string, options: WritingOptions): Promise<string> {
    const { config, style, request, signal } = options;
    const models = [...new Set([config.model || DEFAULT_MODEL, ...FALLBACK_MODELS])];
    const ask = (model: string) => {
        // The box that asked is gone: the request would only use up the few that are allowed.
        if (signal?.aborted) throw 'Cancelled';
        return send({
            url: LLM7_URL,
            apiKey: config.apiKey,
            model,
            systemPrompt: config.systemPrompt || DEFAULT_WRITING_PROMPT,
            message: writingMessage(text, { style, request }),
        });
    };
    return inTurn(async () => {
        let reply: ChatReply = await ask(models[0]);
        let waits = 0;
        let model = 0;
        while (!reply.ok) {
            // A second when it does not say, or says it in a way that is no number.
            const seconds = Math.max(Number(reply.data?.error?.retry_after) || 1, 1);
            // Once the hour's requests are used up it says to wait for many minutes: that is not waited for, and
            // its message, which says how long, is shown.
            if (reply.status === 429 && waits < RATE_LIMIT_TRIES && seconds <= LONGEST_WAIT) {
                waits++;
                await pacing.wait(seconds);
            } else if (reply.status !== 429 && model < models.length - 1) {
                model++;
            } else {
                break;
            }
            reply = await ask(models[model]);
        }
        return answer(reply);
    });
}

export * from './Config';
export * from './info';
