// Constructed representation controls, not gameplay or a runtime candidate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const timer = setTimeout(() => process.exit(124), 55_000);
timer.unref();
const root = new URL('../', import.meta.url);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const manifestBytes = fs.readFileSync(new URL('source/runtime-manifest.json', root));
assert.equal(sha(manifestBytes), 'e16cc136a9ca9feceec02559a2166ed6d6669fd55d029dcb9e6654781e5ddd2d');
const manifest = JSON.parse(manifestBytes);
assert.equal(Object.keys(manifest).length, 280);
const moduleUrl = new URL('baseline/js/posixregex.js', root);
assert.equal(sha(fs.readFileSync(moduleUrl)), manifest['js/posixregex.js']);
const { regex_init, regex_compile, regex_match, regex_free } = await import(moduleUrl.href);

// The string interface takes Unicode and encodes it. The byte-array interface
// already preserves C bytes. These controls reject a proposed untagged byte
// string handoff, not the existing documented regex interface.
const cases = [
    { name: 'complete-utf8', bytes: [0xc3, 0xa9], unicode: '\u00e9', pattern: '^..$' },
    { name: 'partial-utf8', bytes: [0xc3], pattern: '^.$' },
    { name: 'ascii-negative', bytes: [0x61, 0x62], unicode: 'ab', pattern: '^..$' },
];
const rows = [];
for (const c of cases) {
    const re = regex_init();
    assert.equal(regex_compile(c.pattern, re), true);
    const bytes = Uint8Array.from(c.bytes);
    const byteString = String.fromCharCode(...bytes);
    const byteArrayMatch = regex_match(bytes, re);
    const byteStringMatch = regex_match(byteString, re);
    assert.equal(byteArrayMatch, true);
    assert.equal(byteStringMatch, c.name === 'ascii-negative');
    const row = {
        name: c.name, pattern: c.pattern,
        retainedBytesHex: Buffer.from(bytes).toString('hex'),
        byteStringReencodedHex: Buffer.from(new TextEncoder().encode(byteString)).toString('hex'),
        byteArrayMatch, byteStringMatch,
    };
    if ('unicode' in c) {
        row.originalUnicodeMatch = regex_match(c.unicode, re);
        assert.equal(row.originalUnicodeMatch, true);
    }
    rows.push(row);
    regex_free(re);
}
const report = {
    classification: 'Constructed source controls of an existing helper. No C execution, native comparison, gameplay replay, or repaired-fruit claim.',
    baselineManifestSHA256: sha(manifestBytes),
    source: { path: fileURLToPath(moduleUrl), sha256: manifest['js/posixregex.js'] },
    controls: 8, passed: 8,
    finding: 'Both non-ASCII byte-string handoffs change the bytes and fail matching; byte arrays preserve them. The existing Unicode and ASCII controls still match.',
    rows,
};
fs.writeFileSync(new URL('reports/fruit-representation-boundary.json', root),
                 JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ controls: report.controls, passed: report.passed,
    rejectedByteStringHandoffs: 2, runtimeChanges: 0 }));
clearTimeout(timer);
