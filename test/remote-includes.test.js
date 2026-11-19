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
import { disableOptimization } from '../src/main/optimization';
import { downloadFile } from '../src/main/utils/webutils';

vi.mock('../src/main/utils/webutils', () => ({
    downloadFile: vi.fn(),
}));

disableOptimization();

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const REMOTE_RULE = '||remote.example^';
const CHANGED_REMOTE_RULE = '||changed.example^';
const UBO_HTML_RULE = 'example.com##^script:has-text(ad)';
const CONVERTED_HTML_RULE = 'example.com$$script:contains(ad)';
const SCRIPTLET_RULE = "example.com#%#//scriptlet('abort')";
const UBO_SCRIPTLET_RULE = 'example.com##+js(abort)';
const CSS_INJECTION_RULE = 'example.com#$#.banner { display: none; }';
const INVALID_CONVERSION_RULE = 'example.com#$#selector:style()';
const INVALID_SELECTOR_RULE = 'example.com##div[class"ads-article"]';
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

    it('rejects an absolute nested !#include from another origin', async () => {
        downloadFile.mockResolvedValue('!#include http://other.example/rules.txt');

        await expect(include(__dirname, `@include "${parentUrl}"`, []))
            .rejects
            .toThrow(/Include url is rejected with origin/);
    });

    it('rejects a cross-origin nested !#include when the parent URL has no path', async () => {
        downloadFile.mockResolvedValue('!#include http://other.example/rules.txt');

        await expect(include(__dirname, '@include "https://example.org"', []))
            .rejects
            .toThrow(/Invalid url/);
    });

    it('follows a redirect of a nested !#include', async () => {
        downloadFile.mockResolvedValue(`!#include ${remoteBaseUrl}${REDIRECT_INCLUDE_PATH}`);

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        expect(includedLines).toContain(REMOTE_RULE);
        expect(requestedPaths).toEqual([REDIRECT_INCLUDE_PATH, REDIRECT_TARGET_PATH]);
    });

    it('resolves a nested !#include with an empty body to no rules', async () => {
        const includeUrl = `${remoteBaseUrl}${EMPTY_INCLUDE_PATH}`;
        downloadFile.mockResolvedValue(`!#include ${includeUrl}`);

        const { includedLines } = await include(__dirname, `@include "${parentUrl}"`, []);

        // @adguard/filters-downloader 3.0.1 allows a nested included filter
        // to be empty, so it does not raise its "Response is empty" error
        // here. A direct empty `@include` still throws in `include()`.
        expect(includedLines.filter((line) => line.trim() !== '')).toEqual([]);
        expect(requestedPaths).toEqual([EMPTY_INCLUDE_PATH]);
    });
});

describe('remote !#include in a filter template', () => {
    const FILTER_DIR_NAME = 'filter_1_RemoteInclude';
    const CREDENTIAL_PASSWORD = 'p@ss';

    let server;
    let remoteBaseUrl;
    let remotePort;
    let filtersDir;
    let filterDir;
    let platformsDir;
    let rulesResponse;
    const requestedPaths = [];

    const makePlatformsConfig = (defines) => ({
        TEST: {
            platform: 'test',
            path: 'test',
            configuration: {
                removeRulePatterns: false,
                ignoreRuleHints: false,
            },
            defines,
        },
    });

    const createFilter = (templateContent, metadataOverrides = {}) => {
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
            ...metadataOverrides,
        }));
    };

    const createConditionalFilter = (includePath, metadataOverrides) => createFilter([
        '! Title: Remote Include Test',
        '!#if adguard_ext_safari',
        `!#include ${remoteBaseUrl}${includePath}`,
        '!#endif',
        '',
    ].join('\n'), metadataOverrides);

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            requestedPaths.push(req.url);

            if (req.url === '/rules.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(rulesResponse);
                return;
            }

            if (req.url === '/processed.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end([SCRIPTLET_RULE, UBO_SCRIPTLET_RULE, CSS_INJECTION_RULE, UBO_HTML_RULE].join('\n'));
                return;
            }

            if (req.url === '/invalid.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end([INVALID_CONVERSION_RULE, INVALID_SELECTOR_RULE].join('\n'));
                return;
            }

            if (req.url === '/nested.txt') {
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end('!#include http://other.example/rules.txt');
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
    });

    afterAll(async () => {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    beforeEach(() => {
        rulesResponse = REMOTE_RULE;
        requestedPaths.length = 0;
    });

    afterEach(() => {
        if (filtersDir) {
            fs.rmSync(filtersDir, { recursive: true, force: true });
            filtersDir = undefined;
        }
        if (platformsDir) {
            fs.rmSync(platformsDir, { recursive: true, force: true });
            platformsDir = undefined;
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

    it('rejects a remote !#include in an @include body with /ignoreTrustLevel', async () => {
        createFilter('! Title: Remote Include Test\n@include "body.txt" /ignoreTrustLevel\n');
        fs.writeFileSync(path.join(filterDir, 'body.txt'), `!#include ${remoteBaseUrl}/rules.txt\n`);

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(/Trust level ignoring option is not supported for an @include with a remote !#include/);
    });

    it('rejects when a remote !#include from template.txt returns 404', async () => {
        createFilter(`! Title: Remote Include Test\n!#include ${remoteBaseUrl}${MISSING_INCLUDE_PATH}\n`);

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(new RegExp(`${MISSING_INCLUDE_PATH}.*\\b404\\b`, 's'));
    });

    it('rejects a cross-origin nested !#include from a remote template include', async () => {
        createFilter(`! Title: Remote Include Test\n!#include ${remoteBaseUrl}/nested.txt\n`);

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(/Include url is rejected with origin/);
    });

    it('fails loudly for a protocol-relative remote !#include', async () => {
        createFilter('! Title: Remote Include Test\n!#include //other.example/rules.txt\n');

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(/Error resolving remote include.*\/\/other\.example\/rules\.txt.*Invalid url/s);
    });

    it('does not leak remote !#include credentials in the error message', async () => {
        const includeUrl = `http://${USERNAME}:${CREDENTIAL_PASSWORD}@127.0.0.1:${remotePort}${MISSING_INCLUDE_PATH}`;
        createFilter(`! Title: Remote Include Test\n!#include ${includeUrl}\n`);

        const error = await build(filtersDir, null, null, null, {}, null, null)
            .then(() => null, (e) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error.message).not.toContain(CREDENTIAL_PASSWORD);
        expect(error.message).toContain(MISSING_INCLUDE_PATH);
    });

    it('leaves a remote !#include inside a condition for the per-platform build', async () => {
        createConditionalFilter('/rules.txt');

        await build(filtersDir, null, null, null, {}, null, null);

        const filterContent = fs.readFileSync(path.join(filterDir, 'filter.txt'), 'utf8');
        expect(filterContent).toContain(`!#include ${remoteBaseUrl}/rules.txt`);
        expect(filterContent.split(/\r?\n/)).not.toContain(REMOTE_RULE);
    });

    it('resolves a conditional remote !#include in the per-platform build', async () => {
        createConditionalFilter('/rules.txt');
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));

        await build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard: true, adguard_ext_safari: true }),
            null,
            null,
        );

        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');
        expect(platformContent.split(/\r?\n/)).toContain(REMOTE_RULE);
    });

    it('does not fetch a conditional remote !#include for a platform without the condition', async () => {
        createConditionalFilter(MISSING_INCLUDE_PATH);
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));

        await build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard: true }),
            null,
            null,
        );

        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');
        expect(platformContent).not.toContain(MISSING_INCLUDE_PATH);
    });

    it('does not fetch a conditional remote !#include in an @include body at compile time', async () => {
        createFilter('! Title: Remote Include Test\n@include "body.txt"\n');
        fs.writeFileSync(path.join(filterDir, 'body.txt'), [
            '  !#if adguard_ext_safari',
            `  !#include ${remoteBaseUrl}/rules.txt`,
            '  !#endif',
            '',
        ].join('\n'));

        await build(filtersDir, null, null, null, {}, null, null);

        const filterContent = fs.readFileSync(path.join(filterDir, 'filter.txt'), 'utf8');
        expect(filterContent).toContain(`!#include ${remoteBaseUrl}/rules.txt`);
        expect(filterContent.split(/\r?\n/)).not.toContain(REMOTE_RULE);
        expect(requestedPaths).not.toContain('/rules.txt');

        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));
        await build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard_ext_safari: true }),
            null,
            null,
        );

        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');
        expect(platformContent.split(/\r?\n/)).toContain(REMOTE_RULE);
    });

    it('rejects an indented remote !#include in an @include body with /ignoreTrustLevel', async () => {
        createFilter('! Title: Remote Include Test\n@include "body.txt" /ignoreTrustLevel\n');
        fs.writeFileSync(path.join(filterDir, 'body.txt'), `  !#include ${remoteBaseUrl}/rules.txt\n`);

        await expect(build(filtersDir, null, null, null, {}, null, null))
            .rejects
            .toThrow(/Trust level ignoring option is not supported for an @include with a remote !#include/);
    });

    it('converts and excludes rules from a deferred remote !#include', async () => {
        createConditionalFilter('/processed.txt');
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));

        await build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard_ext_safari: true }),
            null,
            null,
        );

        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');
        const platformLines = platformContent.split(/\r?\n/);

        expect(platformLines).toContain(CONVERTED_HTML_RULE);
        expect(platformLines).not.toContain(UBO_HTML_RULE);
        expect(platformLines).not.toContain(SCRIPTLET_RULE);
        expect(platformLines).not.toContain(UBO_SCRIPTLET_RULE);
        expect(platformLines).not.toContain(CSS_INJECTION_RULE);
    });

    it('validates rules from a deferred remote !#include', async () => {
        createConditionalFilter('/invalid.txt', { trustLevel: 'full' });
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));

        await build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard_ext_safari: true }),
            null,
            null,
        );

        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');
        const platformLines = platformContent.split(/\r?\n/);

        expect(platformLines).not.toContain(INVALID_CONVERSION_RULE);
        expect(platformLines).not.toContain(INVALID_SELECTOR_RULE);
    });

    it('bumps the revision when a deferred remote !#include changes', async () => {
        createConditionalFilter('/rules.txt');
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));
        const platformsConfig = makePlatformsConfig({ adguard_ext_safari: true });
        const revisionPath = path.join(filterDir, 'revision.json');

        await build(filtersDir, null, null, platformsDir, platformsConfig, null, null);

        const firstRevision = JSON.parse(fs.readFileSync(revisionPath, 'utf8'));

        await build(filtersDir, null, null, platformsDir, platformsConfig, null, null);

        const unchangedRevision = JSON.parse(fs.readFileSync(revisionPath, 'utf8'));

        expect(unchangedRevision.version).toBe(firstRevision.version);
        expect(unchangedRevision.hash).toBe(firstRevision.hash);

        rulesResponse = CHANGED_REMOTE_RULE;

        await build(filtersDir, null, null, platformsDir, platformsConfig, null, null);

        const secondRevision = JSON.parse(fs.readFileSync(revisionPath, 'utf8'));
        const platformContent = fs.readFileSync(path.join(platformsDir, 'test', 'filters', '1.txt'), 'utf8');

        expect(secondRevision.version).not.toBe(firstRevision.version);
        expect(secondRevision.hash).not.toBe(firstRevision.hash);
        expect(secondRevision.timeUpdated).toBeGreaterThanOrEqual(firstRevision.timeUpdated);
        expect(platformContent.split(/\r?\n/)).toContain(CHANGED_REMOTE_RULE);
        expect(platformContent.split(/\r?\n/)).not.toContain(REMOTE_RULE);
    });

    it('rejects a failing conditional remote !#include for a platform with the condition', async () => {
        createConditionalFilter(MISSING_INCLUDE_PATH);
        platformsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-includes-platforms-'));

        await expect(build(
            filtersDir,
            null,
            null,
            platformsDir,
            makePlatformsConfig({ adguard: true, adguard_ext_safari: true }),
            null,
            null,
        ))
            .rejects
            .toThrow(new RegExp(`${MISSING_INCLUDE_PATH}.*\\b404\\b`, 's'));
    });
});
