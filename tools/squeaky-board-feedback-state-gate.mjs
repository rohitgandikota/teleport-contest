// C trap.c:1403-1476, reached through real trap, status and monster producers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate} from 'node:timers/promises';
import {setup, mount, clearMessages, messages, seed, x, y} from './status-followup-test-setup.mjs';
import {game} from '../js/gstate.js';
import {maketrap} from '../js/mklev.js';
import {makemon} from '../js/makemon.js';
import {mintrap, dotrap, Trap_Effect_Finished} from '../js/trap.js';
import {make_deaf, make_blinded} from '../js/potion.js';
import {polymon} from '../js/polyself.js';
import {mon_set_minvis} from '../js/worn.js';
import {Flying, Deaf} from '../js/youprop.js';
import {set_msg_xy} from '../js/pline.js';
import {pline} from '../js/display.js';
import {getRngLog} from '../js/rng.js';
import {PMNAMES as P} from '../js/monst_data.js';
import * as C from '../js/const.js';

const notes = {0:'a C note',3:'an E flat',11:'a B note'};
async function create(species, xx, yy) {
    const mon = await makemon(game.mons[species],xx,yy,
        C.NO_MINVENT | C.MM_NOGRP | C.MM_NOWAIT | C.MM_NOMSG);
    assert.ok(mon); return mon;
}
async function scene({species=P.PM_KOBOLD,blind=false,deaf=false,invisible=false,
                      accessible=true,note=0,clinging=false}={}) {
    const run=await setup(); game.flags.accessiblemsg=accessible;
    const mon=await create(species,x+1,y);
    if (clinging) mon.mundetected=true; // Constructed ceiling-hiding boundary.
    const neighbor=await create(P.PM_GNOME,x+2,y+1);
    // Constructed indeterminate sleep, distinguished from mfrozen by wake_nearto.
    neighbor.msleeping=1; mon.msleeping=0;
    if (invisible) mon_set_minvis(mon,false);
    if (blind) await make_blinded(10,false);
    if (deaf) await make_deaf(10,false);
    const trap=await maketrap(mon.mx,mon.my,C.SQKY_BOARD);
    trap.tnote=note; trap.tseen=trap.madeby_u=0;
    clearMessages(); seed(); return {run,mon,neighbor,trap};
}
for (const options of [
    {accessible:true}, {accessible:false},
    {deaf:true,accessible:true}, {deaf:true,accessible:false},
    {blind:true}, {invisible:true}, {blind:true,deaf:true},
    {invisible:true,deaf:true}, {species:P.PM_HUMAN_ZOMBIE,deaf:true},
    {species:P.PM_BAT}, {species:P.PM_FLOATING_EYE},
    {species:P.PM_ROCK_PIERCER,clinging:true}, {note:3}, {note:11},
]) test(`monster board: ${JSON.stringify(options)}`,async()=>{
    const {mon,neighbor,trap}=await scene(options);
    const airborne=[P.PM_BAT,P.PM_FLOATING_EYE,P.PM_ROCK_PIERCER].includes(options.species);
    const unseen=!!(options.blind||options.invisible);
    const silent=airborne || (options.deaf && (unseen||options.species===P.PM_HUMAN_ZOMBIE));
    set_msg_xy(x-1,y);
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    assert.deepEqual(getRngLog(),[]);
    const text=messages();
    assert.equal(!!neighbor.msleeping,airborne);
    assert.equal(!!trap.tseen,!airborne&&!unseen&&!options.deaf);
    if (silent) {
        assert.ok(!text.includes('squeak')&&!text.includes('cringe'));
    } else if (unseen) {
        assert.ok(text.includes(`You hear ${notes[options.note||0]} squeak nearby.`));
    } else {
        const line=options.deaf ? 'The kobold stops momentarily and appears to cringe.'
            : `A board beneath the kobold squeaks ${notes[options.note||0]} loudly.`;
        assert.ok(text.includes(line),text);
        assert.equal(text.includes('(east): '+line),options.accessible!==false);
        assert.ok(!text.includes('(west): '+line));
    }
});

for (const deaf of [false,true]) test(`feedback precedes reveal and wake while More is pending: deaf=${deaf}`,async()=>{
    const {run,mon,neighbor,trap}=await scene({deaf});
    await pline('The preceding message occupies the available space on this first line.');
    let release,reads=0,done=false;
    run._display.onEmptyQueue=()=>{
        assert.equal(++reads,1,'one controlled initial More');
        return new Promise(resolve=>{release=resolve;});
    };
    const pending=mintrap(mon,C.FORCETRAP).then(value=>{done=true;return value;});
    for(let i=0;i<30&&!release;i++)await setImmediate();
    assert.ok(release,'real input provider is held');
    assert.equal(done,false);assert.equal(trap.tseen,0);assert.equal(neighbor.msleeping,1);
    assert.deepEqual(getRngLog(),[]);
    run._display.onEmptyQueue=()=>32;
    release(32);
    assert.equal(await pending,Trap_Effect_Finished);
    assert.equal(!!trap.tseen,!deaf);assert.equal(neighbor.msleeping,0);
    assert.ok(messages().includes('(east): '));
});

for (const [flying,deaf,flags] of [
    [false,false,0],[false,true,0],[true,false,0],[true,false,C.VIASITTING],
]) test(`hero caller: flying=${flying}, deaf=${deaf}, flags=${flags}`,async()=>{
    await setup();
    if (flying) assert.equal(await polymon(P.PM_BAT),1);
    if (deaf) await make_deaf(10,false);
    assert.equal(Flying(),flying);assert.equal(Deaf(),deaf);
    const trap=await maketrap(game.u.ux,game.u.uy,C.SQKY_BOARD);
    trap.tnote=0;trap.tseen=trap.madeby_u=0;
    clearMessages();seed();await dotrap(trap,flags);
    assert.deepEqual(getRngLog(),[]);
    if (flying&&!flags) {
        assert.equal(trap.tseen,0);assert.equal(messages().trim(),'');
    } else {
        assert.ok(trap.tseen);
        assert.ok(messages().includes(deaf ? 'A board beneath you vibrates.'
            : 'A board beneath you squeaks a C note loudly.'));
    }
});

test('a blind rider still observes the mounted pony through the steed branch',async()=>{
    await setup();await mount();await make_blinded(10,false);
    game.flags.accessiblemsg=true;
    const mon=game.u.usteed;
    assert.deepEqual([mon.mx,mon.my],[game.u.ux,game.u.uy]);
    const trap=await maketrap(mon.mx,mon.my,C.SQKY_BOARD);
    trap.tnote=0;trap.tseen=trap.madeby_u=0;
    clearMessages();seed();
    assert.equal(await mintrap(mon,C.FORCETRAP),Trap_Effect_Finished);
    assert.ok(trap.tseen);
    assert.ok(messages().includes('A board beneath the pony squeaks a C note loudly.'));
    assert.deepEqual(getRngLog(),[]);
});
