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
    afterEach,
    vi,
} from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

import { build, include } from '../src/main/builder';
import { downloadFile } from '../src/main/utils/webutils';

vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn(),
}));

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const REMOTE_RULE = '||remote.example^';
const MISSING_INCLUDE_PATH = '/missing.txt';
const PROTECTED_INCLUDE_PATH = '/protected.txt';
const USERNAME = 'user';
const PASSWORD = 'pass';
const BASIC_AUTH = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

describe('remote !#include in an @include body', () => {
    let server;
    let remoteBaseUrl;
    let remotePort;
    let parentUrl;

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === '/remote.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(REMOTE_RULE);
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
});

describe('remote !#include in a filter template', () => {
    const FILTER_DIR_NAME = 'filter_1_RemoteInclude';

    let server;
    let remoteBaseUrl;
    let filtersDir;
    let filterDir;

    const createFilter = (templateContent) => {
        filtersDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-'));
        filterDir = path.join(filtersDir, FILTER_DIR_NAME);
        fs.mkdirSync(filterDir);
        fs.writeFileSync(path.join(filterDir, 'template.txt'), templateContent);
        fs.writeFileSync(path.join(filterDir, 'metadata.json'), JSON.stringify({
            filterId: 1,
            name: 'Remote Include Test Filter',
            description: 'Remote include test filter',
            timeAdded: 1404115015843,
            homepage: 'https://example.org/',
            expires: '2 days',
            displayNumber: 101,
            groupId: 2,
            subscriptionUrl: 'https://example.org/filter.txt',
            tags: ['purpose:ads'],
            trustLevel: 'low',
        }));
    };

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            if (req.url === '/rules.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(REMOTE_RULE);
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        });

        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });

        const { port } = server.address();
        remoteBaseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    afterEach(() => {
        if (filtersDir) {
            fs.rmSync(filtersDir, { recursive: true, force: true });
        }
    });

    it('resolves an absolute remote !#include from template.txt', async () => {
        createFilter(`! Title: Remote Include Test\n!#include ${remoteBaseUrl}/rules.txt\n`);

        await build(filtersDir, null, null, null, {}, null, null);

        const filterContent = fs.readFileSync(path.join(filterDir, 'filter.txt'), 'utf8');
        expect(filterContent.split(/\r?\n/)).toContain(REMOTE_RULE);
    });

    it('resolves an absolute remote !#include in a local @include body', async () => {
        createFilter('! Title: Remote Include Test\n@include "body.txt"\n');
        fs.writeFileSync(path.join(filterDir, 'body.txt'), `!#include ${remoteBaseUrl}/rules.txt\n`);

        await build(filtersDir, null, null, null, {}, null, null);

        const filterContent = fs.readFileSync(path.join(filterDir, 'filter.txt'), 'utf8');
        expect(filterContent.split(/\r?\n/)).toContain(REMOTE_RULE);
    });

    it('rejects when a remote !#include from template.txt returns 404', async () => {
        createFilter(`! Title: Remote Include Test\n!#include ${remoteBaseUrl}${MISSING_INCLUDE_PATH}\n`);

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(new RegExp(`${MISSING_INCLUDE_PATH}.*\\b404\\b`, 's'));
    });
});
