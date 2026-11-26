// Constructed C-buffer/storage controls. This is not an ordinary replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root = new URL('../', import.meta.url);
const js = new URL('baseline/js/', root);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const mapBytes = fs.readFileSync(new URL('source/runtime-manifest.json', root));
assert.equal(sha(mapBytes), 'e16cc136a9ca9feceec02559a2166ed6d6669fd55d029dcb9e6654781e5ddd2d');
const map = JSON.parse(mapBytes);
for (const [name, expected] of Object.entries(map))
    assert.equal(sha(fs.readFileSync(new URL(`baseline/${name}`, root))), expected, name);
const timer = setTimeout(() => process.exit(124), 55_000);
timer.unref();
await import(new URL('jsmain.js', js)); // Existing canonical module load order.
const state = await import(new URL('gstate.js', js));
const { sanitize_name } = await import(new URL('bones.js', js));
const { makesingular, makeplural, fruit_from_name } = await import(new URL('objnam.js', js));
const { savefruitchn, gamestate_encode, gamestate_decode } = await import(new URL('save.js', js));
const { loadfruitchn } = await import(new URL('restore.js', js));
const byteString = hex => String.fromCharCode(...Buffer.from(hex, 'hex'));
const unitsHex = text => [...text].map(ch => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const cases = [
    { name: 'retained-utf8', input: 'c3a9', enabled: 'c3a9', disabled: '5f5f' },
    { name: 'retained-partial-utf8', input: '41'.repeat(30) + 'c3', enabled: '41'.repeat(30) + 'c3', disabled: '41'.repeat(30) + '5f' },
    { name: 'low-seven-control', input: 'e282ac', enabled: 'e22eac', disabled: '5f2e5f' },
    { name: 'ascii-negative', input: '627974656672756974', enabled: '627974656672756974', disabled: '627974656672756974' },
];
const checks = [];
function check(name, body) {
    try { body(); checks.push({ name, pass: true }); }
    catch (e) { checks.push({ name, pass: false, error: String(e.message).slice(0, 600) }); }
}
for (const c of cases) {
    state.resetGame();
    const g = state.game;
    g.iflags = { wc_eight_bit_input: true };
    const input = byteString(c.input), stored = byteString(c.enabled);
    check(`${c.name}/enabled-sanitizer`, () => assert.equal(unitsHex(sanitize_name(input)), c.enabled));
    g.iflags.wc_eight_bit_input = false;
    check(`${c.name}/disabled-sanitizer`, () => assert.equal(unitsHex(sanitize_name(input)), c.disabled));
    check(`${c.name}/singular-retains-bytes`, () => assert.equal(makesingular(stored), stored));
    check(`${c.name}/C-plural-suffix`, () => assert.equal(makeplural(stored), stored + (c.name === 'ascii-negative' ? 's' : "'s")));
    g.svp = { pl_fruit: stored };
    g.ffruit = { fname: stored, fid: 1, nextf: null };
    check(`${c.name}/exact-fruit-lookup`, () => assert.equal(fruit_from_name(stored, true, null), g.ffruit));
    check(`${c.name}/owned-fruit-save-load`, () => assert.deepEqual(loadfruitchn(savefruitchn(false)), g.ffruit));
    check(`${c.name}/game-codec-preserves-name-and-alias`, () => {
        const record = { svp: g.svp, ffruit: g.ffruit, selected: g.ffruit };
        const restored = gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode(record))));
        assert.equal(unitsHex(restored.svp.pl_fruit), c.enabled);
        assert.equal(unitsHex(restored.ffruit.fname), c.enabled);
        assert.equal(restored.selected, restored.ffruit);
    });
}
check('typed-array-is-not-a-persistent-name', () => {
    const restored = gamestate_decode(JSON.parse(JSON.stringify(gamestate_encode({ name: Uint8Array.of(0xc3) }))));
    assert.equal(restored.name instanceof Uint8Array, false);
});
check('RC-and-key-ingress-differ', () => {
    assert.equal(Buffer.from('\u00e9', 'utf8').toString('hex'), 'c3a9');
    assert.equal(Buffer.from('\u00e9', 'latin1').toString('hex'), 'e9');
    assert.equal(Buffer.from('\u00c3\u00a9', 'latin1').toString('hex'), 'c3a9');
});
const report = {
    classification: 'Constructed real-owner checks of the selected byte-valued-string storage design, not new ordinary inputs, a runtime candidate, or native closure.',
    baselineManifestSHA256: sha(mapBytes),
    runtimeFiles: Object.keys(map).length,
    sourceControls: checks.length, passed: checks.filter(c => c.pass).length,
    cases, checks,
};
fs.writeFileSync(new URL('reports/fruit-byte-storage-design.json', root), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ controls: report.sourceControls, passed: report.passed,
    failures: checks.filter(c => !c.pass), runtimeChanges: 0 }));
clearTimeout(timer);
if (checks.some(c => !c.pass)) process.exitCode = 1;
