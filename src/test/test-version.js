const version = require('../main/utils/version.js');

QUnit.test('Test versions', (assert) => {
    let v = version.increment('0.0.0.0');
    assert.equal('0.0.0.1', v);

    v = version.increment('0.0.1.99');
    assert.equal('0.0.2.0', v);

    v = version.increment('99.99.99.99');
    assert.equal('100.0.0.0', v);
});
