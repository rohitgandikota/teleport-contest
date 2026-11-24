#!/usr/bin/env node
// Static contracts against pinned source. No C execution or coverage claims.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const sources = [];
const bodies = new Map();
for (const [file, names] of Object.entries({
    sp_lev: ['flip_level'],
    wizard: ['which_arti', 'mon_has_arti', 'other_mon_has_arti', 'on_ground',
        'you_have', 'target_on', 'strategy', 'choose_stairs', 'tactics'],
    dog: ['initedog', 'wary_dog', 'pet_type', 'makedog'],
    dogmove: ['dog_goal', 'dog_move', 'wantdoor'],
    monmove: ['dochug', 'm_move'],
    track: ['initrack', 'settrack', 'gettrack', 'hastrack', 'save_track', 'rest_track'],
    uhitm: ['do_attack'],
    makemon: ['makemon'],
    mkobj: ['copy_oextra'],
    mon: ['copy_mextra'],
    save: ['savemon', 'savemonchn'],
    restore: ['restmon', 'restmonchn'],
    wizcmds: ['wiz_flip_level'],
    mkmaze: ['get_level_extends']
})) {
    const path = `nethack-c/recorder/src/${file}.c`;
    const source = read(path);
    for (const name of names) {
        const match = source.match(new RegExp(`^${name}\\([^]*?^}`, 'm'));
        assert.ok(match, `${path}: ${name}`);
        bodies.set(`${file}.${name}`, match[0]);
        sources.push({ file: path, function: name,
            line: source.slice(0, match.index).split('\n').length,
            functionSha256: sha(match[0]), fileSha256: sha(source) });
    }
}

const checks = [];
const failures = [];
function check(name, fn) {
    try {
        fn();
        checks.push(name);
    } catch (error) {
        failures.push({ name, error: error.message });
    }
}
const cFlip = bodies.get('sp_lev.flip_level');
const disabled = cFlip.match(/#if 0[^]*?#endif/g) || [];
const activeFlip = cFlip.replace(/#if 0[^]*?#endif/g, '');
const jsFlip = read('js/sp_lev.js').match(/^export async function flip_level\([^]*?^}/m)[0];

check('active C transforms mgoal before role-specific monster metadata', () => {
    assert.match(activeFlip, /Flip_coord\(mtmp->mgoal\);\s*if \(mtmp->ispriest\)/);
    assert.ok(activeFlip.indexOf('if (!inFlipArea(mtmp->mx, mtmp->my))')
        < activeFlip.indexOf('Flip_coord(mtmp->mgoal)'));
});
check('C pet goal transform is disabled, not an extras contract', () => {
    assert.equal(disabled.length, 1);
    assert.match(disabled[0], /not useful unless tracking also gets flipped/);
    assert.match(disabled[0], /if \(extras\)[^]*Flip_coord\(EDOG\(mtmp\)->ogoal\)/);
    assert.doesNotMatch(activeFlip, /ogoal|mtrack|utrack/);
});
check('C coordinate macro preserves zero and out-of-area sentinels', () => {
    const macro = read('nethack-c/recorder/src/sp_lev.c').split('#define Flip_coord(cc)')[1]
        .split('while (0)')[0];
    assert.match(macro, /\(cc\)\.x && inFlipArea\(\(cc\)\.x, \(cc\)\.y\)/);
    assert.match(macro, /if \(flp & 1\)/);
    assert.match(macro, /if \(flp & 2\)/);
});
check('C local, off-map guard and migrating owners are distinct', () => {
    assert.match(activeFlip, /if \(mtmp->mx == 0\)[^]*?continue;/);
    const migrating = activeFlip.slice(activeFlip.indexOf('mtmp = gm.migrating_mons'),
        activeFlip.indexOf('/* rooms */'));
    assert.ok(migrating.length > 0);
    assert.doesNotMatch(migrating, /mgoal|ogoal/);
});
check('target_on produces hero, floor and carrier coordinates, then clears unsuccessful goals', () => {
    const target = bodies.get('wizard.target_on');
    for (const value of ['u.ux', 'otmp->ox', 'mtmp2->mx'])
        assert.ok(target.includes(`mtmp->mgoal.x = ${value}`));
    assert.match(target, /mtmp->mgoal\.x = mtmp->mgoal\.y = 0/);
    assert.match(target, /if \(!M_Wants\(mask\)\)\s*return \(unsigned long\) STRAT_NONE/);
});
check('strategy early returns do not promise to refresh every old goal', () => {
    const strategy = bodies.get('wizard.strategy');
    assert.match(strategy, /inhishop\(mtmp\)/);
    assert.match(strategy, /inhistemple\(mtmp\)/);
    assert.match(strategy, /return \(unsigned long\) STRAT_HEAL/);
    assert.ok(strategy.indexOf('return (unsigned long) STRAT_HEAL') < strategy.indexOf('target_on('));
});
check('ordinary covetous turns call tactics before movement and tactics recomputes strategy', () => {
    const turn = bodies.get('monmove.dochug');
    assert.ok(turn.indexOf('tactics(mtmp)') < turn.indexOf('m_move(mtmp, 0)'));
    const tactics = bodies.get('wizard.tactics');
    assert.ok(tactics.indexOf('strategy(mtmp)') < tactics.indexOf('mtmp->mgoal.x'));
});
check('m_move consumes the current goal for an adjacent intruder attack', () => {
    const move = bodies.get('monmove.m_move');
    assert.match(move, /tx = mtmp->mgoal\.x,\s*ty = mtmp->mgoal\.y/);
    assert.match(move, /intruder = isok\(tx, ty\) \? m_at\(tx, ty\) : NULL/);
    assert.match(move, /dist2\(mtmp->mx, mtmp->my, tx, ty\) <= 2/);
    assert.match(move, /mattackm\(mtmp, intruder\)/);
});
check('the other direct m_move caller is guarded by the leprechaun species class', () => {
    assert.match(bodies.get('uhitm.do_attack'),
        /mdat->mlet == S_LEPRECHAUN[^]*?m_move\(mtmp, 0\)/);
});
check('pet initialization and revival reset memory to the invalid pair', () => {
    assert.match(bodies.get('dog.initedog'), /edogp->ogoal\.x = -1/);
    assert.match(bodies.get('dog.initedog'), /edogp->ogoal\.y = -1/);
    assert.match(bodies.get('dog.wary_dog'), /edog->ogoal\.x = edog->ogoal\.y = -1/);
});
check('dog_goal first follows hero tracks, then consumes retained goal, then searches an exit', () => {
    const goal = bodies.get('dogmove.dog_goal');
    assert.ok(goal.indexOf('gettrack(omx, omy)') < goal.indexOf('edog->ogoal.x\n'));
    assert.match(goal, /gg\.gx = edog->ogoal\.x;\s*gg\.gy = edog->ogoal\.y;\s*edog->ogoal\.x = 0/);
    assert.match(goal, /do_clear_area\(omx, omy, 9, wantdoor/);
    assert.match(goal, /edog->ogoal\.x = gg\.gx;\s*edog->ogoal\.y = gg\.gy/);
    assert.match(bodies.get('dogmove.dog_move'), /appr = dog_goal\(mtmp, edog, after, udist, whappr\)/);
    assert.match(bodies.get('dogmove.dog_move'), /GDIST\(nx, ny\)/);
});
check('constructors and value copies preserve owned coordinate values', () => {
    assert.match(bodies.get('makemon.makemon'), /\*mtmp = cg\.zeromonst/);
    assert.match(bodies.get('mkobj.copy_oextra'), /sizeof \(struct monst\)/);
    assert.match(bodies.get('mon.copy_mextra'), /\*EDOG\(mtmp2\) = \*EDOG\(mtmp1\)/);
});
check('explicit ordinary flip choice dispatches with extras true', () => {
    assert.match(bodies.get('wizcmds.wiz_flip_level'), /flip_level\(\(int\) c, TRUE\)/);
});
check('JS performs the active mgoal transform at the C location', () => {
    assert.match(jsFlip, /Flip_coord\(m\.mgoal\);\s*if \(m\.ispriest\)/);
    assert.doesNotMatch(jsFlip, /mgoal is not modelled/);
});
check('JS performs no disabled pet-goal or track transform', () => {
    assert.doesNotMatch(jsFlip, /ogoal|mtrack|utrack/);
});

console.log(JSON.stringify({ evidence: 'static pinned C and JS source',
    passed: checks.length, total: checks.length + failures.length,
    functions: sources.length, checks, failures, sources,
    touchedJsFunction: { function: 'flip_level', sha256: sha(jsFlip) }
}, null, 4));
if (failures.length)
    process.exitCode = 1;
