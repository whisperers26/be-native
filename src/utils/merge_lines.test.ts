import { describe, expect, it } from 'vitest';
import { mergeLines } from './merge_lines';

const lines = (...all: string[]) => all.join('\n');

describe('mergeLines', () => {
    it('joins the lines of a wrapped paragraph', () => {
        expect(
            mergeLines(
                lines(
                    'The quick brown fox jumps over the lazy dog and',
                    'keeps running through the forest until it finds',
                    'a quiet place to rest.'
                )
            )
        ).toBe(
            'The quick brown fox jumps over the lazy dog and keeps running through the forest until it finds a quiet place to rest.'
        );
    });

    it('joins a full line that happens to end a sentence', () => {
        expect(
            mergeLines(
                lines(
                    'The quick brown fox jumps over the lazy dog today.',
                    'Then it keeps running through the forest until it',
                    'finds a quiet place.'
                )
            )
        ).toBe(
            'The quick brown fox jumps over the lazy dog today. Then it keeps running through the forest until it finds a quiet place.'
        );
    });

    it('keeps the break after a line that ends short', () => {
        expect(
            mergeLines(
                lines(
                    'The quick brown fox jumps over the lazy dog and',
                    'keeps running.',
                    'A second paragraph starts here and wraps onto the',
                    'next line as well.'
                )
            )
        ).toBe(
            lines(
                'The quick brown fox jumps over the lazy dog and keeps running.',
                'A second paragraph starts here and wraps onto the next line as well.'
            )
        );
    });

    it('keeps a heading apart from the paragraph under it', () => {
        expect(
            mergeLines(
                lines(
                    'Getting started',
                    'Install the application from the releases page and',
                    'start it from the menu.'
                )
            )
        ).toBe(
            lines('Getting started', 'Install the application from the releases page and start it from the menu.')
        );
    });

    it('keeps list items that have no marker and no full stop', () => {
        expect(
            mergeLines(
                lines(
                    'Fast translation with many services',
                    'Text recognition',
                    'Works offline when the service allows it',
                    'Plugins'
                )
            )
        ).toBe(
            lines(
                'Fast translation with many services',
                'Text recognition',
                'Works offline when the service allows it',
                'Plugins'
            )
        );
    });

    it('joins lines that all start with a capital once one of them ends a sentence', () => {
        expect(
            mergeLines(lines('The application was installed from the page of', 'New York University by its students.'))
        ).toBe('The application was installed from the page of New York University by its students.');
    });

    it('joins a short line that stops after a comma or inside brackets', () => {
        expect(
            mergeLines(
                lines(
                    'It reads the text of a picture (for',
                    'example a screenshot of a page) and then, if asked,',
                    'translates it into the chosen language of the reader.'
                )
            )
        ).toBe(
            'It reads the text of a picture (for example a screenshot of a page) and then, if asked, translates it into the chosen language of the reader.'
        );
    });

    it('keeps a blank line between blocks, and only one', () => {
        expect(mergeLines(lines('First block.', '', '', 'Second block.'))).toBe(lines('First block.', '', 'Second block.'));
    });

    it('trims the text and its lines, and makes runs of spaces one', () => {
        expect(mergeLines(' \n  Hello   there \r\n\n')).toBe('Hello there');
        expect(mergeLines('  ')).toBe('');
    });

    describe('in a narrow block', () => {
        it('keeps lines that could be labels', () => {
            expect(mergeLines(lines('File name', 'Date modified'))).toBe(lines('File name', 'Date modified'));
            expect(mergeLines(lines('Hello World', 'Goodbye World'))).toBe(lines('Hello World', 'Goodbye World'));
            expect(mergeLines(lines('apples', 'oranges', 'bananas'))).toBe(lines('apples', 'oranges', 'bananas'));
        });

        it('joins a line that goes on in lower case', () => {
            expect(mergeLines(lines('Click here to save', 'your changes now'))).toBe(
                'Click here to save your changes now'
            );
        });

        it('keeps the break after a sentence', () => {
            expect(mergeLines(lines('Save your changes.', 'then close it'))).toBe(
                lines('Save your changes.', 'then close it')
            );
        });
    });
});
