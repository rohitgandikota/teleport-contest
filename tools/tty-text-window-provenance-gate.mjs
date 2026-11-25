import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const expected = JSON.parse(readFileSync(new URL('./tty-text-window-native-inputs.json', import.meta.url)));
const fields = ['name', 'seed', 'datetime', 'nethackrc', 'moves'];
assert.ok(process.argv.length > 2, 'provide unchanged parent native files');
for (const path of process.argv.slice(2)) {
    const bytes = readFileSync(path);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const record = expected.find(item => item.nativeSHA256 === sha256);
    assert.ok(record, `${path}: original parent raw SHA256`);
    const raw = JSON.parse(bytes);
    assert.equal(raw.source, 'c');
    assert.equal(raw.version, 5);
    assert.equal(raw.segments.length, record.segments.length);
    for (const [index, part] of raw.segments.entries()) {
        const tuple = record.segments[index];
        for (const key of fields) {
            assert.equal(Object.hasOwn(part, key), Object.hasOwn(tuple, key));
            assert.deepEqual(part[key], tuple[key]);
        }
        assert.deepEqual(part.steps.map(step => step.key), [null, ...part.moves]);
    }
    console.log(JSON.stringify({path, sha256, segments: raw.segments.length, fiveInputsAndAllKeysExact: true}));
}
