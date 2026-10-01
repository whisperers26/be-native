import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { info, Language, translate } from './index';

// One meaning group the way the dictionary API nests it.
function group(description: string | undefined, name: string, ...texts: string[]) {
    return {
        partsOfSpeech: [{ name, description }],
        meanings: [{ richDefinitions: [{ fragments: texts.map((text) => ({ text })) }] }],
    };
}

describe('bing_dict translate', () => {
    it('exports its info and language table', () => {
        expect({ info, Language }).toMatchSnapshot();
    });

    it('returns the text without a request when from equals to', async () => {
        await expect(translate('hello', 'en-us', 'en-us')).resolves.toBe('hello');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('detects auto as zh-cn for a text starting with a Chinese character, so no request for a zh-cn target', async () => {
        await expect(translate('你好', 'auto', 'zh-cn')).resolves.toBe('你好');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('detects auto as en-us for a text starting with a Latin letter, so no request for an en-us target', async () => {
        await expect(translate('hello', 'auto', 'en-us')).resolves.toBe('hello');
        expect(httpMock.calls).toHaveLength(0);
    });

    it('keeps auto when the text starts with neither, so it still sends a request', async () => {
        httpMock.queue({ data: { value: [{ meaningGroups: [] }] } });

        await expect(translate('123', 'auto', 'zh-cn')).rejects.toBe('Words not yet included: 123');
        expect(httpMock.calls).toHaveLength(1);
    });

    it('collects pronunciations, quick explanations and the first inflection group', async () => {
        httpMock.queue({
            data: {
                value: [
                    {
                        meaningGroups: [
                            group('发音', '美', '/həˈloʊ/'),
                            group('发音', '英', '/həˈləʊ/'),
                            group('快速释义', 'int.', '喂', '你好'),
                            group('快速释义', 'n.', '招呼'),
                            group('变形', '变形', '复数 hellos', '过去式 helloed'),
                            group('变形', '变形', 'ignored second inflection group'),
                            group('网络释义', '网络', 'ignored web definition'),
                            { meanings: [] },
                        ],
                    },
                ],
            },
        });

        await expect(translate('hello', 'en-us', 'zh-cn')).resolves.toEqual({
            pronunciations: [
                { region: '美', symbol: '/həˈloʊ/', voice: '' },
                { region: '英', symbol: '/həˈləʊ/', voice: '' },
            ],
            explanations: [
                { trait: 'int.', explains: ['喂', '你好'] },
                { trait: 'n.', explains: ['招呼'] },
            ],
            associations: ['复数 hellos', '过去式 helloed'],
            sentence: [],
        });
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('groups by the part-of-speech name when it has no description', async () => {
        httpMock.queue({ data: { value: [{ meaningGroups: [group(undefined, '发音', '/x/')] }] } });

        await expect(translate('hello', 'en-us', 'zh-cn')).resolves.toEqual({
            pronunciations: [{ region: '发音', symbol: '/x/', voice: '' }],
            explanations: [],
            associations: [],
            sentence: [],
        });
    });

    it('puts the text into the query without encoding it', async () => {
        httpMock.queue({ data: { value: [{ meaningGroups: [] }] } });

        await expect(translate('hello world & more', 'en-us', 'zh-cn')).rejects.toBe(
            'Words not yet included: hello world & more'
        );
        expect(httpMock.calls[0].url).toBe(
            'https://www.bing.com/api/v6/dictionarywords/search?q=hello world & more&appid=371E7B2AF0F9B84EC491D731DF90A55719C7D209&mkt=zh-cn&pname=bingdict'
        );
    });

    it('throws "Words not yet included" when there are no meaning groups', async () => {
        httpMock.queue({ data: { value: [{ meaningGroups: [] }] } });

        await expect(translate('asdfgh', 'en-us', 'zh-cn')).rejects.toBe('Words not yet included: asdfgh');
    });

    it('throws the status and body on an HTTP error', async () => {
        httpMock.queue({ status: 500, data: { message: 'server error' } });

        await expect(translate('hello', 'en-us', 'zh-cn')).rejects.toBe(
            'Http Request Error\nHttp Status: 500\n{"message":"server error"}'
        );
    });
});
