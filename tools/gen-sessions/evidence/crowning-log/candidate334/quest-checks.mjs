import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const expectations = JSON.parse(readFileSync(new URL('./quest-expectations.json', import.meta.url)));

// Supplementary checks, separate from the unchanged 42 crowning checks.
export function questChecks(rows) {
    return expectations.map(({index, name, event}) => {
        const actual = rows[index].last.logs.filter(entry => entry.text === event.text);
        const check = {index, name, expected:[event], actual};
        try {
            assert.deepEqual(actual, [event]);
            check.pass = true;
        } catch (error) {
            check.pass = false;
            check.error = error.message;
        }
        return check;
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const root = new URL('./', import.meta.url);
    const lock = JSON.parse(readFileSync(new URL('./pre-edit-lock.json', root)));
    for (const [name, expected] of Object.entries(lock.files))
        assert.equal(createHash('sha256').update(readFileSync(new URL(name, root))).digest('hex'), expected, name);
    const baseline = JSON.parse(readFileSync(new URL('./source/baseline-observation.json', root)));
    const checks = questChecks(baseline.rows);
    const report = {baselineReplay:false, beforeRuntimeEdits:true, checks};
    writeFileSync(new URL('./reports/quest-baseline.json', root), JSON.stringify(report, null, 2) + '\n', {flag:'wx'});
    console.log(JSON.stringify(report));
    if (checks.some(check => !check.pass)) process.exitCode = 1;
}
