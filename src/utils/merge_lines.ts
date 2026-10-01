// A block whose widest line is narrower than this is too narrow to tell a wrapped line by its width: labels, buttons
// and short lists look the same as wrapped text there.
const NARROW = 24;
// Lines of wrapped text do not all hold the same number of characters, so a line counts as full from this share of
// the widest one.
const FULL = 0.88;

const ENDS_SENTENCE = /[.!?…:]["')\]]*$/;
const ENDS_COMMA = /,$/;
const BRACKETS = ['()', '[]'];

// A bullet. The characters that also appear inside text count only with a space after them.
const BULLET = /^(?:[•‣⁃∙◦▪▫■□●○◆◇▶►➢➤✓✔☐☑★☆※]|[-–—*+·]\s)/;
// A number or letter that only a list starts a line with: `1)`, `(a)`, `iv)`, `①`.
const ORDINAL = /^(?:\(?(?:\d{1,3}|[A-Za-z]|[ivxIVX]{1,4})\)|[①-⒛⓪-⓿❶-➓])/;
// One that a wrapped line can start with as well, as in "on May\n3. The next day" or "J.\nF. Kennedy": `1.`, `1.2`,
// `a.`, `iv.`. It marks a list only when the text has more than one.
const LOOSE_ORDINAL = /^(?:\d{1,3}(?:\.\d{1,3})*\.|\d{1,3}(?:\.\d{1,3})+|[A-Za-z]\.|[ivxIVX]{1,4}\.)\s/;

function width(line: string): number {
    return [...line].length;
}

function firstWord(line: string): string {
    return /^\S*/.exec(line)![0];
}

// Whether the first word of `next` had room at the end of `line`. If it had, wrapping did not break the line there.
function hasRoom(line: string, next: string, widest: number): boolean {
    return width(line) + 1 + width(firstWord(next)) <= widest * FULL;
}

function startsLowercase(line: string): boolean {
    const first = [...line][0];
    return first.toLowerCase() === first && first.toUpperCase() !== first;
}

function startsUppercase(line: string): boolean {
    const first = [...line][0];
    return first.toUpperCase() === first && first.toLowerCase() !== first;
}

// Whether `line` stops in the middle of something: after a comma, or inside brackets.
function unfinished(line: string): boolean {
    return (
        ENDS_COMMA.test(line) || BRACKETS.some(([open, close]) => line.lastIndexOf(open) > line.lastIndexOf(close))
    );
}

// Whether the break between `line` and `next` is there only because the text wrapped. `startsItem` tells whether a
// line starts a list item.
function wrapped(line: string, next: string, widest: number, startsItem: (line: string) => boolean): boolean {
    if (startsItem(next)) return false;
    if (unfinished(line)) return true;
    if (hasRoom(line, next, widest)) return false;
    if (widest < NARROW) {
        return startsLowercase(next) && !ENDS_SENTENCE.test(line) && line.includes(' ');
    }
    return true;
}

function glue(head: string, tail: string): string {
    return head + ' ' + tail;
}

// Whether every line starts with a capital and none ends in punctuation, as the items of a list without markers do.
// Wrapped text hardly ever does: its lines start wherever the words fall.
function looksLikeList(lines: string[]): boolean {
    return lines.every((line) => startsUppercase(line) && !ENDS_SENTENCE.test(line) && !ENDS_COMMA.test(line));
}

// Merge lines that have no blank line between them.
function mergeBlock(lines: string[], startsItem: (line: string) => boolean): string {
    if (looksLikeList(lines)) return lines.join('\n');
    const widest = Math.max(...lines.map(width));
    let merged = lines[0];
    for (let i = 1; i < lines.length; i++) {
        merged = wrapped(lines[i - 1], lines[i], widest, startsItem)
            ? glue(merged, lines[i])
            : merged + '\n' + lines[i];
    }
    return merged;
}

/**
 * Join the lines of `text` that are broken only because the text wrapped, as recognized and copied text is, and keep
 * the breaks its author made: paragraphs, headings, list items. Spaces are trimmed and runs of them, and of blank lines,
 * become one.
 */
export function mergeLines(text: string): string {
    const lines = text.split(/\r\n|\r|\n/).map((line) => line.replace(/[ \t ]+/g, ' ').trim());
    const numbered = lines.filter((line) => LOOSE_ORDINAL.test(line)).length > 1;
    const startsItem = (line: string) =>
        BULLET.test(line) || ORDINAL.test(line) || (numbered && LOOSE_ORDINAL.test(line));
    const blocks: string[] = [];
    let block: string[] = [];
    for (const line of [...lines, '']) {
        if (line !== '') {
            block.push(line);
        } else if (block.length > 0) {
            blocks.push(mergeBlock(block, startsItem));
            block = [];
        }
    }
    return blocks.join('\n\n');
}
