import { describe, expect, it } from 'vitest';
import { httpMock } from '../../../test/http';
import { collection, info } from './index';

const config = { token: 'test-token', name: 'pot' };

// The categories the account has, as the list endpoint returns them.
const categories = {
    data: {
        data: [
            { id: '111', language: 'en', name: 'other' },
            { id: '222', language: 'en', name: 'pot' },
        ],
    },
};

// The body of a recorded request.
function payloadOf(call: { options?: Record<string, unknown> }): any {
    return (call.options as any).body.payload;
}

describe('eudic collection', () => {
    it('exports its info', () => {
        expect({ info }).toMatchSnapshot();
    });

    it('finds the category, posts the word to it and returns the message', async () => {
        httpMock.queue(categories, { data: { message: 'success' } });

        await expect(collection('hello', 'hallo', { config })).resolves.toBe('success');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('creates the category when it is missing, then posts the word to the new category', async () => {
        httpMock.queue(
            { data: { data: [{ id: '111', language: 'en', name: 'other' }] } },
            { data: { data: { id: '333', language: 'en', name: 'pot' }, message: '' } },
            { data: { message: 'success' } }
        );

        await expect(collection('hello', 'hallo', { config })).resolves.toBe('success');
        expect(httpMock.calls).toMatchSnapshot();
    });

    it('creates the category when the account has none', async () => {
        httpMock.queue(
            { data: { data: [] } },
            { data: { data: { id: '333', language: 'en', name: 'pot' } } },
            { data: { message: 'success' } }
        );

        await collection('hello', 'hallo', { config });

        expect(httpMock.calls.map((call) => [call.options!.method, call.url])).toEqual([
            ['GET', 'https://api.frdic.com/api/open/v1/studylist/category'],
            ['POST', 'https://api.frdic.com/api/open/v1/studylist/category'],
            ['POST', 'https://api.frdic.com/api/open/v1/studylist/words'],
        ]);
        expect(payloadOf(httpMock.calls[2]).id).toBe('333');
    });

    it('looks for the category "pot" and sends an empty token when the config has neither', async () => {
        httpMock.queue(categories, { data: { message: 'success' } });

        await collection('hello', 'hallo', { config: {} });

        expect(httpMock.calls.map((call) => (call.options as any).headers.Authorization)).toEqual(['', '']);
        expect(payloadOf(httpMock.calls[1]).id).toBe('222');
    });

    it('looks for the category of the configured name and creates it under that name', async () => {
        httpMock.queue(
            categories,
            { data: { data: { id: '444', language: 'en', name: 'my-words' } } },
            { data: { message: 'success' } }
        );

        await collection('hello', 'hallo', { config: { token: 'test-token', name: 'my-words' } });

        expect(payloadOf(httpMock.calls[1])).toEqual({ language: 'en', name: 'my-words' });
        expect(payloadOf(httpMock.calls[2]).id).toBe('444');
    });

    it('throws "Get Category Failed" when the category list has no data, without adding the word', async () => {
        httpMock.queue({ status: 401, data: { message: 'Unauthorized' } });

        await expect(collection('hello', 'hallo', { config })).rejects.toBe('Get Category Failed');
        expect(httpMock.calls).toHaveLength(1);
    });

    it('throws "Create Category Failed" when the created category has no data, without adding the word', async () => {
        httpMock.queue(
            { data: { data: [{ id: '111', language: 'en', name: 'other' }] } },
            { status: 400, data: { message: 'Bad Request' } }
        );

        await expect(collection('hello', 'hallo', { config })).rejects.toBe('Create Category Failed');
        expect(httpMock.calls).toHaveLength(2);
    });

    it('returns the message of the words request even when it failed', async () => {
        httpMock.queue(categories, { status: 500, data: { message: 'Internal Server Error' } });

        await expect(collection('hello', 'hallo', { config })).resolves.toBe('Internal Server Error');
    });
});
