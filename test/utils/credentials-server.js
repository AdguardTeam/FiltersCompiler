import http from 'node:http';

const HOST = '127.0.0.1';
const USERNAME = 'adg-user';
// Must match PASSWORD in `test/include-credentials.test.js`: the Basic-auth
// check and the absence assertions use the same value.
const PASSWORD = 'adg-s3cr3t-9f4c';
const RULE = '||example.org^';
const REDIRECT_LINE = `! Redirect: http://${USERNAME}:${PASSWORD}@example.org/next.txt`;
const BASIC_AUTH = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}`;

const server = http.createServer((req, res) => {
    if (req.url === '/filter.txt') {
        const authorized = req.headers.authorization === BASIC_AUTH;
        res.writeHead(authorized ? 200 : 401, { 'Content-Type': 'text/plain' });
        res.end(authorized ? RULE : 'Unauthorized');
        return;
    }

    if (req.url === '/redirect.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(REDIRECT_LINE);
        return;
    }

    if (req.url === '/empty.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end();
        return;
    }

    if (req.url === '/whitespace.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('\n');
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(0, HOST, () => {
    process.stdout.write(`${server.address().port}\n`);
});
