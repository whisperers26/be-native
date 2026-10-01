/** A way a rewrite can read. The Writing window asks for each on its Tones button. */
export interface Tone {
    /** What the result's box is labelled with. */
    name: string;
    /** What the service is told, as the `Style:` line of the message (`src/utils/writing_prompt`). */
    instruction: string;
}

/** The tones offered until the user changes them (`writing_tones`). */
export const DEFAULT_TONES: Tone[] = [
    { name: 'Professional', instruction: 'Professional: polished and precise, as in business writing.' },
    { name: 'Casual', instruction: 'Casual: relaxed and conversational, as when writing to a friend.' },
    { name: 'Friendly', instruction: 'Friendly: warm, positive and approachable.' },
    { name: 'Confident', instruction: 'Confident: direct and assured, without hedging or filler.' },
    { name: 'Concise', instruction: 'Concise: as short as it can be without losing meaning.' },
];
