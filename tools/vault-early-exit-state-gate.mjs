// C vault.c:423-495. Status producers are real; only input delivery is deferred.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {invault, findgd, vault_summon_gd, vault_occupied} from '../js/vault.js';
import {make_deaf, peffects} from '../js/potion.js';
import {Deaf, Free_action, Detect_monsters} from '../js/youprop.js';
import {resetInputState, pushKeys} from '../js/input.js';
import {mksobj, set_corpsenm, bless} from '../js/mkobj.js';
import {addinv} from '../js/invent.js';
import {ONAMES} from '../js/objects_data.js';
import {Amulet_on, Amulet_off, Ring_on} from '../js/do_wear.js';
import {setworn} from '../js/worn.js';
import {polymon, dohide} from '../js/polyself.js';
import {morehungry, is_fainted, doeat, eatfood, eatmdone} from '../js/eat.js';
import {makemon} from '../js/makemon.js';
import {gulpmu} from '../js/mhitu.js';
import {PMNAMES, ATTKS} from '../js/monst_data.js';
import {is_silent} from '../js/mondata.js';
import {canspotmon} from '../js/display.js';
import {set_occupation} from '../js/allmain.js';
import {dosearch} from '../js/detect.js';
import {getRngLog} from '../js/rng.js';
import {M_AP_TYPE, M_AP_OBJECT, MM_NOMSG, NO_MINVENT,
    W_RINGL, PLINE_VERBALIZE} from '../js/const.js';

const foundation = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url))).segments[0];

function clearMessages() {
    game._toplin = 0;
    game._toplines = '';
    game._pending_message = '';
    game._msg_history = [];
}
async function setup(kind, deaf = false, detected = false) {
    const run = await runSegment({...foundation, moves: foundation.moves.slice(0, 43),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let reads = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 30, 'bounded producer feedback');
        await setImmediate();
        return 32;
    };
    assert.ok(vault_occupied(game.u.urooms));
    assert.equal(findgd(), null);
    if (kind === 'silent') await polymon(PMNAMES.PM_GELATINOUS_CUBE);
    if (kind === 'mimic' || kind === 'hidden') {
        await polymon(kind === 'mimic' ? PMNAMES.PM_SMALL_MIMIC : PMNAMES.PM_TRAPPER);
        await dohide();
    }
    if (kind === 'gold') {
        const corpse = mksobj(ONAMES.CORPSE, false, false);
        set_corpsenm(corpse, PMNAMES.PM_SMALL_MIMIC);
        bless(corpse);
        addinv(corpse);
        clearMessages();
        pushKeys(corpse.invlet);
        await doeat();
        let bites = 0;
        while (game.occupation === eatfood) {
            assert.ok(++bites < 12);
            await eatfood();
        }
        assert.equal(game.invent.includes(corpse), false);
        assert.equal(M_AP_TYPE(game.youmonst), M_AP_OBJECT);
        assert.equal(game.youmonst.mappearance, ONAMES.GOLD_PIECE);
        assert.equal(game.multi, -20);
        assert.equal(game.afternmv, eatmdone);
    }
    if (kind === 'strangled' || kind === 'removed') {
        await Amulet_on(addinv(mksobj(ONAMES.AMULET_OF_STRANGULATION, false, false)));
        assert.equal(game.u.intrinsic.HStrangled, 6);
        if (kind === 'removed') await Amulet_off();
    }
    if (kind === 'free-action') {
        const ring = addinv(mksobj(ONAMES.RIN_FREE_ACTION, false, false));
        setworn(ring, W_RINGL);
        await Ring_on(ring);
        assert.equal(Free_action(), true);
    }
    if (kind === 'paralyzed' || kind === 'free-action')
        await peffects(mksobj(ONAMES.POT_PARALYSIS, false, false));
    if (kind === 'swallowed') {
        const engulfer = await makemon(game.mons[PMNAMES.PM_FOG_CLOUD],
            game.u.ux, game.u.uy + 1, MM_NOMSG | NO_MINVENT);
        assert.ok(engulfer);
        await gulpmu(engulfer, engulfer.data.mattk.find(a => a[0] === ATTKS.AT_ENGL));
        assert.equal(game.u.uswallow, 1);
        assert.equal(game.u.ustuck, engulfer);
        assert.ok(game.u.uhp > 0);
        if (detected) {
            const potion = mksobj(ONAMES.POT_MONSTER_DETECTION, false, false);
            potion.blessed = 1;
            await peffects(potion);
        }
    }
    await make_deaf(deaf ? 100 : 0, false);
    if (kind === 'fainted') {
        await morehungry(game.u.uhunger + 1);
        assert.equal(game.u.uhunger, -1);
        assert.equal(is_fainted(), true);
        assert.equal(game.afternmv.name, 'unfaint');
        assert.ok(game.multi < 0 && Deaf());
    }
    if (kind === 'silent') assert.equal(is_silent(game.youmonst.data), true);
    if (kind === 'mimic') {
        assert.equal(M_AP_TYPE(game.youmonst), M_AP_OBJECT);
        assert.equal(game.youmonst.mappearance, ONAMES.STRANGE_OBJECT);
    }
    if (kind === 'hidden') assert.equal(game.u.uundetected, 1);
    if (kind === 'paralyzed') {
        assert.ok(game.multi < 0);
        assert.notEqual(game.afternmv?.name, 'unfaint');
    }
    clearMessages();
    return run;
}

async function arrival(run) {
    const messages = [], pending = [], guards = new Set();
    const terrain = new Map();
    for (let x = 1; x < 80; x++) for (let y = 0; y < 21; y++) {
        const loc = game.level.at(x, y);
        terrain.set(`${x},${y}`, [loc.typ, loc.doormask]);
    }
    const start = getRngLog().length;
    const births = game.mvitals[PMNAMES.PM_GUARD].born;
    const deaths = game.mvitals[PMNAMES.PM_GUARD].died;
    let reads = 0, letter = 0;
    run._display.onEmptyQueue = async () => {
        assert.ok(++reads < 48, 'bounded guard feedback');
        await setImmediate();
        const text = game._toplines || '', guard = findgd();
        messages.push(text);
        if (guard) guards.add(guard);
        pending.push({text, multi: game.multi, after: game.afternmv?.name,
            spotted: guard && canspotmon(guard),
            corridor: guard?.mextra.egd.fcend || 0});
        if (/supply your name|Hello stranger/.test(text))
            return 'intruder\n'.charCodeAt(letter++);
        return 32;
    };
    vault_summon_gd();
    assert.equal(await invault(), undefined, 'void return after every awaited effect');
    messages.push(game._toplines || '', ...(game._msg_history || []));
    assert.equal(game.pline_flags & PLINE_VERBALIZE, 0);
    assert.equal(game.mvitals[PMNAMES.PM_GUARD].born, births + 1, 'real guard creation');
    assert.equal(game.mvitals[PMNAMES.PM_GUARD].died, deaths, 'dismissal is not death');
    return {text: messages.join('\n'), pending, guards, terrain,
        calls: getRngLog().slice(start), guard: findgd()};
}

for (const kind of ['swallowed', 'mimic', 'gold', 'hidden', 'silent', 'strangled', 'paralyzed']) {
    for (const deaf of [false, true]) {
        await test(`${kind}, ${deaf ? 'deaf' : 'hearing'}: ordered dismissal and no interrogation`, async () => {
            const run = await setup(kind, deaf);
            const beforeMulti = game.multi, beforeAfter = game.afternmv;
            if (kind === 'silent') set_occupation(dosearch, 'searching', 0);
            const r = await arrival(run);
            assert.equal(r.guard, null, 'real mongone completes');
            assert.doesNotMatch(r.text, /Hello stranger|supply your name|drop that gold|follow me/);
            assert.match(r.text, /entered the Vault|Vault's guards enters/);
            for (const g of r.guards) {
                assert.equal(g.mextra.egd.fcend || 0, 0);
                const xy = [g.mextra.egd.ogx, g.mextra.egd.ogy];
                const loc = game.level.at(...xy);
                assert.deepEqual([loc.typ, loc.doormask], r.terrain.get(xy.join(',')));
            }
            assert.ok(r.pending.every(p => p.corridor === 0));
            for (const [xy, before] of r.terrain) {
                const loc = game.level.at(...xy.split(',').map(Number));
                assert.deepEqual([loc.typ, loc.doormask], before, 'no temporary corridor');
            }
            assert.equal(game.multi, beforeMulti, 'only actual fainting is reset');
            assert.equal(game.afternmv, beforeAfter);
            if (kind === 'swallowed') {
                assert.equal(r.text.includes('"What\'s going on here?"'), !deaf);
                assert.ok(r.text.includes('The other presence vanishes.'));
                assert.equal(game.u.uswallow, 1);
            } else if (kind === 'mimic' || kind === 'gold' || kind === 'hidden') {
                assert.match(r.text, kind === 'gold'
                    ? /Puzzled, (he|she) turns around and leaves\./
                    : /Puzzled, it turns around and leaves\./);
                assert.equal(r.text.includes('"Hey!  Who left that whatcha-may-callit in here?"'), kind === 'mimic' && !deaf);
                assert.doesNotMatch(r.text, /huffs|back when/);
            } else {
                assert.equal(r.text.includes('The guard huffs and turns to leave.'), deaf);
                assert.equal(r.text.includes('"I\'ll be back when you\'re ready to speak to me!"'), !deaf);
            }
            if (kind === 'silent') assert.equal(game.occupation, dosearch, 'early return precedes stop_occupation');
            console.log(JSON.stringify({kind, deaf, calls: r.calls.length}));
        });
    }
}
await test('real monster detection cannot sense a different monster while swallowed', async () => {
    const r = await arrival(await setup('swallowed', false, true));
    assert.equal(r.guard, null);
    assert.equal(Detect_monsters(), true);
    assert.match(r.text, /Someone else has entered the Vault/);
    assert.match(r.text, /What's going on here/);
    assert.match(r.text, /The other presence vanishes/);
    assert.doesNotMatch(r.text, /Hello stranger/);
});
for (const kind of ['normal', 'removed', 'free-action']) {
    await test(`${kind}: actual producer negative control still interrogates`, async () => {
        const r = await arrival(await setup(kind));
        assert.ok(r.guard);
        assert.match(r.text, /Hello stranger/);
        assert.doesNotMatch(r.text, /huffs|back when|Puzzled/);
        assert.equal(r.guard.mextra.egd.fcend, 1);
        assert.equal(r.guard.mextra.egd.dropgoldcnt, 1);
        assert.equal(game.u.intrinsic?.HStrangled || 0, 0);
    });
}
await test('real hunger faint: revive and callback finish before entry and interrogation', async () => {
    const r = await arrival(await setup('fainted'));
    assert.ok(r.guard);
    assert.equal(is_fainted(), false);
    assert.equal(game.multi, 0);
    assert.equal(game.afternmv, null);
    assert.match(r.text, /You revive\./);
    assert.match(r.text, /Hello stranger|supply your name/);
    assert.doesNotMatch(r.text, /huffs|back when/);
    assert.ok(r.text.indexOf('You revive.') < r.text.indexOf('Vault'));
    assert.ok(r.pending.filter(p => /Vault|stranger|supply/.test(p.text))
        .every(p => p.multi === 0 && !p.after));
    assert.ok(r.calls.some(c => c.startsWith('rn2(2)=')), 'real unfaint invokes Hear_again once');
});
