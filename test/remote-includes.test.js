/**
 * @vitest-environment jsdom
 */
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    vi,
} from 'vitest';
import http from 'node:http';
import path from 'node:path';

import { include } from '../src/main/builder';
import { downloadFile } from '../src/main/utils/webutils';

vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn(),
}));

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const REMOTE_RULE = '||remote.example^';
const MISSING_INCLUDE_PATH = '/missing.txt';
const PROTECTED_INCLUDE_PATH = '/protected.txt';
const REDIRECT_INCLUDE_PATH = '/redirect.txt';
const REDIRECT_TARGET_PATH = '/redirect-target.txt';
const EMPTY_INCLUDE_PATH = '/empty.txt';
const USERNAME = 'user';
const PASSWORD = 'pass';
const BASIC_AUTH = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

describe('remote !#include in an @include body', () => {
    let server;
    let remoteBaseUrl;
    let remotePort;
    let parentUrl;
    const requestedPaths = [];

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            requestedPaths.push(req.url);

            if (req.url === '/remote.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(REMOTE_RULE);
                return;
            }

            if (req.url === REDIRECT_INCLUDE_PATH) {
                res.writeHead(302, { Location: `${remoteBaseUrl}${REDIRECT_TARGET_PATH}` });
                res.end();
                return;
            }

            if (req.url === REDIRECT_TARGET_PATH) {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(REMOTE_RULE);
                return;
            }

            if (req.url === EMPTY_INCLUDE_PATH) {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end();
                return;
            }

            if (req.url === PROTECTED_INCLUDE_PATH) {
                if (req.headers.authorization === BASIC_AUTH) {
                    res.writeHead(200, { 'Content-Type': 'text/plain' });
                    res.end(REMOTE_RULE);
                    return;
                }

                res.writeHead(401, { 'Content-Type': 'text/plain' });
                res.end('Unauthorized');
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });

        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });

        const { port } = server.address();
        remotePort = port;
        remoteBaseUrl = `http://127.0.0.1:${port}`;
        parentUrl = `${remoteBaseUrl}/parent.txt`;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    beforeEach(() => {
        downloadFile.mockReset();
        requestedPaths.length = 0;
    });

    it('resolves an absolute nested !#include with fetch', async () => {
        downloadFile.mockResolvedValue(`!#include ${remoteBaseUrl}/remote.txt`);

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        expect(includedLines).toContain(REMOTE_RULE);
    });

    it('resolves a relative nested !#include against the parent origin', async () => {
        downloadFile.mockResolvedValue('!#include remote.txt');

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        expect(includedLines).toContain(REMOTE_RULE);
    });

    it('rejects when a nested !#include returns 404', async () => {
        downloadFile.mockResolvedValue(`!#include ${remoteBaseUrl}${MISSING_INCLUDE_PATH}`);

        await expect(include(__dirname, `@include "${parentUrl}"`, []))
            .rejects
            .toThrow(/Failed to resolve the include directive.*\b404\b/s);
    });

    it('sends the parent URL credentials to a relative nested !#include', async () => {
        downloadFile.mockResolvedValue('!#include protected.txt');

        const parentWithCredentials = `http://${USERNAME}:${PASSWORD}@127.0.0.1:${remotePort}/parent.txt`;

        const { includedLines } = await include(__dirname, `@include "${parentWithCredentials}"`, []);

        expect(includedLines).toContain(REMOTE_RULE);
    });

    it('rejects a relative nested !#include when the parent URL has no credentials', async () => {
        downloadFile.mockResolvedValue('!#include protected.txt');

        await expect(include(__dirname, `@include "${parentUrl}"`, []))
            .rejects
            .toThrow(/Failed to resolve the include directive.*\b401\b/s);
    });

    it('follows a redirect of a nested !#include', async () => {
        downloadFile.mockResolvedValue(`!#include ${remoteBaseUrl}${REDIRECT_INCLUDE_PATH}`);

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        expect(includedLines).toContain(REMOTE_RULE);
        expect(requestedPaths).toEqual([REDIRECT_INCLUDE_PATH, REDIRECT_TARGET_PATH]);
    });

    it('resolves a nested !#include with an empty body to an empty line', async () => {
        const includeUrl = `${remoteBaseUrl}${EMPTY_INCLUDE_PATH}`;
        downloadFile.mockResolvedValue(`!#include ${includeUrl}`);

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        // @adguard/filters-downloader 3.0.1 allows included filters to be
        // empty, so it does not raise its "Response is empty" error here.
        expect(includedLines).toEqual(['']);
        expect(requestedPaths).toEqual([EMPTY_INCLUDE_PATH]);
    });
});
