// Pinned-C contracts. State gates independently exercise the real owners.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const { parse } = createRequire(import.meta.url)('acorn');
const read = name => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const source = read('js/eat.js');
const tree = parse(source, { ecmaVersion: 2025, sourceType: 'module' });
const owner = name => {
    const node = tree.body.map(node => node.declaration || node)
        .find(node => (node.id?.name || node.declarations?.[0]?.id?.name) === name);
    assert.ok(node, `${name} exists`);
    return source.slice(node.start, node.end);
};
const c = read('nethack-c/recorder/src/eat.c');
const cwarn = c.slice(c.indexOf('edibility_prompts(struct obj *otmp)'),
    c.indexOf('staticfn int\ndoeat_nonfood'));
const cdoeat = c.slice(c.indexOf('doeat(void)'), c.indexOf('doeat(void)') + 13000);
const ordered = (text, pieces) => {
    let at = -1;
    for (const piece of pieces) {
        const next = text.indexOf(piece, at + 1);
        assert.ok(next > at, `ordered source token: ${piece}`);
        at = next;
    }
};

test('the complete warning ladder keeps C hazard priority and punctuation', () => {
    const warnings = [
        'could be tainted!', 'could be something very dangerous!', 'could be tainted.',
        'could be rotten!', 'might be poisonous!', 'might have been poisoned.',
        'unhealthy.', 'rather acidic.', 'disgusting to you right now.',
        'foul and unfamiliar to you.', 'unfamiliar to you.',
    ];
    ordered(cwarn, warnings);
    ordered(owner('edibility_prompts'), warnings);
});
test('worst-case rot uses actual iced age and integer truncation without random draws', () => {
    assert.match(cwarn, /peek_at_iced_corpse_age\(otmp\)/);
    assert.match(cwarn, /\(svm\.moves - age\) \/ \(10L \+ 0/);
    const warning = owner('edibility_prompts');
    assert.match(warning, /Math\.trunc\(\(game\.moves - age\) \/ 10\)/);
    assert.doesNotMatch(warning, /\b(rn2|rnd|rn1|rnl|d)\s*\(/);
    ordered(warning, ['peek_at_iced_corpse_age(otmp)', 'if (otmp.cursed)',
        'rotted += 2', 'else if (otmp.blessed)', 'rotted -= 2']);
});
test('stone and slime use the same object classes and canonical defenses as C', () => {
    const warning = owner('edibility_prompts');
    for (const token of ['EGG', 'TIN', 'GLOB_OF_GREEN_SLIME', 'flesh_petrifies',
        'Stone_resistance', 'poly_when_stoned', 'Unchanging', 'slimeproof']) {
        assert.ok(cwarn.includes(token), token);
        assert.ok(warning.includes(token), token);
    }
    assert.match(warning, /ismnum\(mnum\)/);
});
test('the shared nonrotting predicate includes all three Riders through is_rider', () => {
    assert.match(c.slice(0, 4000), /is_rider\(&mons\[mnum\]\)/);
    const predicate = owner('nonrotting_corpse');
    for (const token of ['PM_LIZARD', 'PM_LICHEN', 'PM_ACID_BLOB', 'is_rider(game.mons[mnum])'])
        assert.ok(predicate.includes(token), token);
});
test('sickness defense uses the existing hero defended contract', () => {
    const macro = read('nethack-c/recorder/include/youprop.h');
    assert.match(macro, /defended\(&gy\.youmonst, AD_DISE\)/);
    assert.match(read('js/youprop.js'), /HSick_resistance[\s\S]{0,120}defended\(null, ATTKS\.AD_DISE\)/);
    assert.ok(read('js/artifact.js').includes('defended(yours ? null : mon, adtyp)'));
    assert.ok(read('js/mondata.js').includes('const is_you = (mon === game.u || mon === null)'));
});
test('selection and capacity precede the warning, then bars precede normal object guards', () => {
    ordered(cdoeat, ['Strangled', 'floorfood("eat", 0)', 'check_capacity',
        'edibility_prompts(otmp)', 'otmp == &hands_obj', '!is_edible(otmp)', 'retouch_object']);
    ordered(owner('doeat'), ['HStrangled', "floorfood('eat', 0)", 'check_capacity',
        'await edibility_prompts(otmp)', 'otmp === hands_obj', '!is_edible(otmp)', 'retouch_object']);
});
test('warning lifetime awaits nose feedback and preserves a safe result', () => {
    ordered(owner('doeat'), ['const res = await edibility_prompts(otmp)', 'if (res)',
        'await Your(', 'game.u.uedibility = 0', 'if (res === 1)', 'return ECMD_OK']);
    assert.match(owner('edibility_prompts'), /return 0;\s*\}$/);
    assert.doesNotMatch(owner('edibility_prompts'), /uedibility\s*=/);
});
test('bars await the existing chewing owner and test the live cell before pause feedback', () => {
    const eating = owner('doeat');
    const bars = eating.slice(eating.indexOf('if (otmp === hands_obj)'), eating.indexOf('if (!is_edible'));
    ordered(bars, ['await still_chewing(game.u.ux, game.u.uy)',
        'game.level.at(game.u.ux, game.u.uy).typ === IRONBARS', "await You('pause to swallow.')",
        'return ECMD_TIME']);
    assert.doesNotMatch(bars, /victual|touch_artifact|retouch_object|useup/);
});
test('all four floor choices and the warning preserve C repeatable input', () => {
    assert.equal((owner('floorfood').match(/tty_yn_function\(qbuf, 'ynq', 'n', true\)/g) || []).length, 4);
    assert.match(owner('edibility_prompts'), /tty_yn_function\(buf, 'yn', 'n', true\)/);
    assert.equal((c.slice(c.indexOf('floorfood(\n')).match(/yn_function\(qbuf, ynqchars, 'n', TRUE\)/g) || []).length, 4);
});
test('the warning uses its BUFSZ contract, without an inline replacement for the tty wrapper', () => {
    assert.match(cwarn, /char buf\[BUFSZ\]/);
    assert.match(owner('edibility_prompts'), /buf\.slice\(0, BUFSZ - 1\)/);
    assert.doesNotMatch(owner('edibility_prompts'), /QBUFSZ|paniclog|new Promise|nhgetch/);
    assert.ok(!tree.body.some(node => node.type === 'ExportNamedDeclaration'
        && node.declaration?.id?.name === 'edibility_prompts'));
});
