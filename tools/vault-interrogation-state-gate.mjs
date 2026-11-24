// C vault.c:439-590. Real guard, status, inventory and death producers.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {invault, findgd, vault_summon_gd, vault_occupied} from '../js/vault.js';
import {make_deaf, make_blinded} from '../js/potion.js';
import {Deaf, Blind} from '../js/youprop.js';
import {resetInputState} from '../js/input.js';
import {mksobj, add_to_container} from '../js/mkobj.js';
import {addinv, freeinv, money_cnt, hidden_gold} from '../js/invent.js';
import {dropx} from '../js/do.js';
import {ONAMES} from '../js/objects_data.js';
import {makemon} from '../js/makemon.js';
import {mondead} from '../js/mon.js';
import {PMNAMES} from '../js/monst_data.js';
import {glyph_is_invisible_at} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {DOOR, D_NODOOR, MM_NOMSG, NO_MINVENT, PLINE_VERBALIZE} from '../js/const.js';

const recipe = JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/vault-interrogation-feedback.json', import.meta.url)));
const foundation = recipe.segments[0];

function clearMessages() {
    game._toplin = 0;
    game._toplines = '';
    game._pending_message = '';
    game._msg_history = [];
}
async function setup(mode, gold = 'visible', dead = false) {
    const run = await runSegment({...foundation, moves: foundation.moves.slice(0, 43),
        storage: new InMemoryStorage()});
    game._preNhgetchHook = null;
    resetInputState();
    let setupReads = 0;
    run._display.onEmptyQueue = () => {
        assert.ok(++setupReads < 24, 'bounded producer feedback');
        return 32;
    };
    assert.ok(vault_occupied(game.u.urooms));
    assert.equal(findgd(), null);
    const coins = game.invent.find(o => o.otyp === ONAMES.GOLD_PIECE);
    assert.equal(coins.quan, 500);
    if (gold === 'none') await dropx(coins);
    if (gold === 'hidden' || gold === 'nested') {
        const sack = addinv(mksobj(ONAMES.SACK, false, false));
        await freeinv(coins);
        if (gold === 'nested') {
            const inner = mksobj(ONAMES.SACK, false, false);
            await add_to_container(sack, inner);
            await add_to_container(inner, coins);
        } else {
            await add_to_container(sack, coins);
        }
        assert.equal(sack.cknown || 0, 0, 'unknown contents still count for the guard');
        assert.equal(hidden_gold(game.invent, true), 500);
        assert.equal(hidden_gold(game.invent, false), 0);
    }
    if (dead) {
        const croesus = await makemon(game.mons[PMNAMES.PM_CROESUS],
            game.u.ux, game.u.uy + 1, MM_NOMSG | NO_MINVENT);
        assert.ok(croesus);
        await mondead(croesus);
        assert.equal(game.mvitals[PMNAMES.PM_CROESUS].died, 1);
    }
    await make_deaf(mode === 'hearing' ? 0 : 100, false);
    if (mode === 'recovered') await make_deaf(0, false);
    if (mode === 'deaf-blind') await make_blinded(100, false);
    assert.equal(Deaf(), mode === 'deaf' || mode === 'deaf-blind');
    assert.equal(Blind(), mode === 'deaf-blind');
    clearMessages();
    return run;
}

async function interrogate(run, answer = 'intruder', blankTries = 0) {
    const messages = [], prompts = [], pending = [];
    let readCount = 0, letter = 0, empty = 0;
    const before = getRngLog().length;
    run._display.onEmptyQueue = async () => {
        assert.ok(++readCount <= 60, 'bounded dialogue input');
        const text = game._toplines || '';
        messages.push(text);
        await setImmediate();
        const g = findgd();
        pending.push({text, drop: g?.mextra.egd.dropgoldcnt,
            corridor: g?.mextra.egd.fcend || 0});
        if (/supply your name|Hello stranger/.test(text)) {
            prompts.push(text);
            if (empty < blankTries) {empty++; return 10;}
            return (answer + '\n').charCodeAt(letter++);
        }
        return 32;
    };
    vault_summon_gd();
    assert.equal(await invault(), undefined, 'void caller contract');
    messages.push(game._toplines || '', ...(game._msg_history || []));
    assert.equal(game.pline_flags & PLINE_VERBALIZE, 0, 'speech flag cleared after awaits');
    return {text: messages.join('\n'), prompts, pending,
        calls: getRngLog().slice(before), guard: findgd()};
}

for (const gold of ['visible', 'none', 'hidden', 'nested']) {
    for (const mode of ['hearing', 'deaf', 'deaf-blind']) {
        await test(`${mode}, ${gold}: recognition, gold request and corridor order`, async () => {
            const run = await setup(mode, gold);
            const {text, prompts, pending, guard, calls} = await interrogate(run);
            const deaf = mode !== 'hearing', blind = mode === 'deaf-blind';
            assert.ok(guard);
            assert.match(prompts[0], deaf ? /^You are required to supply your name/ : /^"Hello stranger/);
            assert.ok(text.includes(deaf
                ? `The guard doesn't ${blind ? '' : 'appear to '}recognize you.`
                : '"I don\'t know you."'));
            if (gold === 'none') {
                assert.ok(text.includes(deaf
                    ? `The guard stomps${blind ? '' : ' and beckons'}.`
                    : '"Please follow me."'));
                assert.equal(guard.mextra.egd.dropgoldcnt, 0);
            } else {
                if (gold !== 'visible') {
                    assert.equal(text.includes('"You have hidden gold."'), !deaf);
                    assert.equal(text.includes('The guard glares at your stuff.'), deaf && !blind);
                }
                const possessive = guard.female ? 'her' : 'his';
                assert.equal(text.includes(`The guard holds out ${possessive} palm and beckons with ${possessive} other hand.`), deaf && !blind);
                assert.equal(text.includes('"Most likely all your gold was stolen from this vault."'), !deaf);
                assert.equal(text.includes('"Please drop that gold and follow me."'), !deaf);
                assert.equal(guard.mextra.egd.dropgoldcnt, 1, 'even deaf/blind requests count');
            }
            assert.equal(money_cnt(game.invent), gold === 'visible' ? 500 : 0);
            assert.equal(hidden_gold(game.invent, true), gold === 'hidden' || gold === 'nested' ? 500 : 0);
            assert.equal(guard.mpeaceful, 1);
            assert.equal(guard.mextra.egd.warncnt, 1);
            assert.equal(guard.mextra.egd.fcend, 1);
            assert.equal(game.level.at(guard.mx, guard.my).typ, DOOR);
            assert.equal(game.level.at(guard.mx, guard.my).doormask, D_NODOOR);
            assert.ok(pending.every(s => s.corridor === 0 && s.drop === 0), 'dialogue finishes before corridor/counter mutation');
            assert.equal(glyph_is_invisible_at(guard.mx, guard.my), blind);
            console.log(JSON.stringify({sourceCase: `${mode}-${gold}`, calls: calls.length,
                female: guard.female, drop: guard.mextra.egd.dropgoldcnt}));
        });
    }
}
for (const dead of [false, true]) {
    for (const mode of ['hearing', 'deaf', 'deaf-blind']) {
        await test(`${mode}, Croesus ${dead ? 'dead' : 'alive'}: feedback guards and existing return`, async () => {
            const run = await setup(mode, 'visible', dead);
            const {text, guard} = await interrogate(run, 'CrEoSoTe');
            const deaf = mode !== 'hearing', blind = mode === 'deaf-blind';
            assert.equal(text.includes('waves goodbye.'), !dead && deaf && !blind);
            assert.equal(text.includes('Oh, yes, of course.'), !dead && !deaf);
            assert.equal(text.includes('mouths something and looks very angry!'), dead && deaf && !blind);
            assert.equal(text.includes('Back from the dead, are you?'), dead && !deaf);
            assert.equal(text.includes('recognize you.'), false);
            if (dead) {
                assert.ok(guard);
                assert.equal(guard.mpeaceful, 0);
                assert.equal(guard.mextra.egd.fcend || 0, 0);
                // setmangry/mon_wield_item remain separately audited omissions.
            } else {
                assert.equal(guard, null, 'real mongone completes before return');
            }
        });
    }
}
await test('make_deaf(0) restores hearing dialogue', async () => {
    const result = await interrogate(await setup('recovered', 'none'));
    assert.match(result.prompts[0], /^"Hello stranger/);
    assert.ok(result.text.includes('"Please follow me."'));
    assert.equal(result.guard.mextra.egd.dropgoldcnt, 0);
});
await test('five empty deaf name answers stop retrying and still demand gold', async () => {
    const result = await interrogate(await setup('deaf'), '', 5);
    assert.equal(result.prompts.length, 5);
    assert.ok(result.prompts.every(p => /^You are required to supply your name/.test(p)));
    assert.ok(result.text.includes('holds out'));
    assert.equal(result.guard.mextra.egd.dropgoldcnt, 1);
});
