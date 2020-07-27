const version = require('../main/utils/version.js');

// Mock log to hide error messages
jest.mock('../main/utils/log');

describe('version', () => {
    it('Test versions', () => {
        let v = version.increment('0.0.0.0');
        expect(v).toBe('0.0.0.1');

        v = version.increment('0.0.1.99');
        expect(v).toBe('0.0.2.0');

        v = version.increment('99.99.99.99');
        expect(v).toBe('100.0.0.0');
    });
});
