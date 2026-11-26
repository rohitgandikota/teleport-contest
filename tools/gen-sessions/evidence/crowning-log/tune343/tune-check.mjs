import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const expected = JSON.parse(readFileSync(new URL('./tune-expectation.json', import.meta.url)));

export function tuneCheck(rows) {
    const actual = rows[expected.index].last.logs.filter(entry => entry.text === expected.event.text);
    const check = {index:expected.index, name:expected.name, expected:[expected.event], actual};
    try {
        assert.deepEqual(actual, [expected.event]);
        check.pass = true;
    } catch (error) {
        check.pass = false;
        check.error = error.message;
    }
    return check;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = new URL('./', import.meta.url);
    const lock = JSON.parse(readFileSync(new URL('./pre-edit-lock.json', root)));
    for (const [name, expectedHash] of Object.entries(lock.files))
        assert.equal(createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex'), expectedHash, name);
    const prior = JSON.parse(readFileSync(new URL('./prior/reports/candidate-observation.json', root)));
    const check = tuneCheck(prior.rows);
    const report = {baselineReplay:false, beforeRuntimeEdits:true, check};
    writeFileSync(new URL('./reports/tune-baseline.json', root), JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
    console.log(JSON.stringify(report));
    if (!check.pass) process.exitCode = 1;
}
