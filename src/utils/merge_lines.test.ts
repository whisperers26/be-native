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

    describe('lists', () => {
        it('starts a line at every bullet, whatever the item before ends with', () => {
            expect(
                mergeLines(
                    lines(
                        'The application does three things for its user:',
                        '• translates the text selected in any other window',
                        '• reads the text of a screenshot',
                        '- keeps what was translated',
                        '* runs plugins'
                    )
                )
            ).toBe(
                lines(
                    'The application does three things for its user:',
                    '• translates the text selected in any other window',
                    '• reads the text of a screenshot',
                    '- keeps what was translated',
                    '* runs plugins'
                )
            );
        });

        it('joins the wrapped lines of an item to it', () => {
            expect(
                mergeLines(
                    lines(
                        '• translates the text selected in any other window',
                        'and shows it beside the selection',
                        '• reads the text of a screenshot and copies it to',
                        'the clipboard',
                        'A paragraph follows the list and wraps onto a second',
                        'line of its own.'
                    )
                )
            ).toBe(
                lines(
                    '• translates the text selected in any other window and shows it beside the selection',
                    '• reads the text of a screenshot and copies it to the clipboard',
                    'A paragraph follows the list and wraps onto a second line of its own.'
                )
            );
        });

        it('starts a line at every number of a numbered list', () => {
            expect(
                mergeLines(
                    lines(
                        '1. Download the installer from the releases page of',
                        'the project',
                        '2. Run it and follow the steps that it shows you',
                        '3. Start the application from the menu',
                        '3.1 Or from the icon in the tray'
                    )
                )
            ).toBe(
                lines(
                    '1. Download the installer from the releases page of the project',
                    '2. Run it and follow the steps that it shows you',
                    '3. Start the application from the menu',
                    '3.1 Or from the icon in the tray'
                )
            );
        });

        it('takes a single number or letter with a full stop for part of the sentence', () => {
            expect(
                mergeLines(lines('The meeting was moved from the first of May to May', '3. Everyone was told about it.'))
            ).toBe('The meeting was moved from the first of May to May 3. Everyone was told about it.');
            expect(
                mergeLines(lines('The speech was given in the city of Berlin by John', 'F. Kennedy in the year 1963.'))
            ).toBe('The speech was given in the city of Berlin by John F. Kennedy in the year 1963.');
        });

        it('starts a line at a number or letter in brackets', () => {
            expect(
                mergeLines(
                    lines(
                        'The user of the application may do any of these:',
                        'a) copy the text that was recognized in a picture',
                        '(b) translate it into another language',
                        '2) keep it for later'
                    )
                )
            ).toBe(
                lines(
                    'The user of the application may do any of these:',
                    'a) copy the text that was recognized in a picture',
                    '(b) translate it into another language',
                    '2) keep it for later'
                )
            );
        });
    });

    describe('a word broken at the end of a line', () => {
        it('is put together again without the hyphen', () => {
            expect(mergeLines(lines('All the infor-', 'mation is here'))).toBe('All the information is here');
            expect(mergeLines(lines('All the infor\u00ad', 'mation is here'))).toBe('All the information is here');
        });

        it('keeps a hyphen that belongs to it', () => {
            expect(mergeLines(lines('It was said by Jean-', 'Paul Sartre'))).toBe('It was said by Jean-Paul Sartre');
            expect(mergeLines(lines('The years of COVID-', '19 were long'))).toBe('The years of COVID-19 were long');
        });

        it('is not looked for after a dash', () => {
            expect(mergeLines(lines('Translation -', 'Recognition'))).toBe(lines('Translation -', 'Recognition'));
        });
    });

    describe('Chinese, Japanese and Korean', () => {
        it('joins Chinese lines without a space', () => {
            expect(
                mergeLines(
                    lines(
                        '这是一个跨平台的划词翻译和文字识别软件，它可以',
                        '在任何应用中翻译选中的文字，并把结果显示在选区',
                        '旁边。',
                        '第二段从这里开始，同样会换到下一行继续写下去直',
                        '到结束。'
                    )
                )
            ).toBe(
                lines(
                    '这是一个跨平台的划词翻译和文字识别软件，它可以在任何应用中翻译选中的文字，并把结果显示在选区旁边。',
                    '第二段从这里开始，同样会换到下一行继续写下去直到结束。'
                )
            );
        });

        it('joins Chinese to Latin text without a space', () => {
            expect(
                mergeLines(lines('这个软件的前端部分全部使用严格模式的 TypeScript', '编写，后端部分则使用 Rust 编写。'))
            ).toBe('这个软件的前端部分全部使用严格模式的 TypeScript编写，后端部分则使用 Rust 编写。');
        });

        it('joins Japanese lines without a space', () => {
            expect(
                mergeLines(lines('これは翻訳と文字認識のためのデスクトップアプリで', 'す。どのアプリでも使えます。'))
            ).toBe('これは翻訳と文字認識のためのデスクトップアプリです。どのアプリでも使えます。');
        });

        it('joins Korean lines with a space', () => {
            expect(
                mergeLines(lines('이것은 번역과 문자 인식을 위한 데스크톱 앱이며 어떤', '앱에서도 사용할 수 있습니다.'))
            ).toBe('이것은 번역과 문자 인식을 위한 데스크톱 앱이며 어떤 앱에서도 사용할 수 있습니다.');
        });

        it('starts a line at every Chinese list marker', () => {
            expect(
                mergeLines(
                    lines(
                        '本软件提供以下几种功能',
                        '一、在任何应用中翻译选中的文字并显示',
                        '在选区旁边',
                        '二、识别截图中的文字',
                        '（三）保存翻译记录',
                        '4、运行插件'
                    )
                )
            ).toBe(
                lines(
                    '本软件提供以下几种功能',
                    '一、在任何应用中翻译选中的文字并显示在选区旁边',
                    '二、识别截图中的文字',
                    '（三）保存翻译记录',
                    '4、运行插件'
                )
            );
        });

        it('keeps short lines that could be labels', () => {
            expect(mergeLines(lines('文件名称', '修改日期'))).toBe(lines('文件名称', '修改日期'));
        });
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
