#!/usr/bin/env node

// C bot/timebot/flush_screen and damage contracts. Constructed states
// exercise boundaries which ordinary recordings need not encounter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runSegment} from '../js/jsmain.js';
import {game} from '../js/gstate.js';
import {InMemoryStorage} from '../js/storage.js';
import {pushKeys,resetInputState} from '../js/input.js';
import {bot,timebot,flush_screen,suppress_map_output} from '../js/display.js';
import {losehp,showdamage} from '../js/hack.js';
import {mdamageu} from '../js/mhitu.js';
import {PMNAMES as P} from '../js/monst_data.js';
import {KILLED_BY} from '../js/const.js';
import {decodeScreen} from './gen-sessions/screen-decode.mjs';

let replays=0;
for(const name of ['fatal-hp-status','damage-feedback']) {
    const recipe=JSON.parse(fs.readFileSync(new URL('gen-sessions/recipes/'+name+'.json',import.meta.url)));
    const native=JSON.parse(fs.readFileSync(new URL('gen-sessions/generated/'+name+'.session.json',import.meta.url)));
    for(const [i,s]of recipe.segments.entries()) {
        await runSegment({...s,storage:new InMemoryStorage()});replays++;
        const label=name+':'+s.name;
        const deaths=native.segments[i].steps.filter((t,j)=>
            decodeScreen(t.screen)[0].includes('Die? [yn] (n)')
            && /^[yn \r\n\x1b]$/.test(s.moves[j]||'')).length;
        assert.equal(game.u.umortality||0,deaths,label+': C death prompts answered');
        assert.deepEqual(game.impossible_log||[],[],label);
        assert.equal(game._deferred_status_hp_until_more,undefined,label);
        if(name==='fatal-hp-status') {
            const hp=s.name.includes('positive-two')?2:s.name.includes('positive-one')?1:
                s.name.startsWith('lava-')?120:12;
            assert.deepEqual([game.u.uhp,game.u.uhpmax],[hp,s.name.startsWith('lava-')?126:12],label);
        } else if(i<4) {
            assert.deepEqual([game.u.uhp,game.u.uhpmax],[113,126],label);
        } else if(i===4) {
            assert.deepEqual([game.u.mh,game.u.mhmax],[15,28],label);
            assert.equal(game.u.umonnum,P.PM_XORN,label);assert.ok(game.u.mtimedone>0,label);
        } else if(i<7) {
            assert.deepEqual([game.u.uhp,game.u.uhpmax],[126,126],label);
            assert.equal(game.u.mtimedone,0,label);assert.equal(game.u.mh,0,label);
        } else {
            assert.deepEqual([game.u.uhp,game.u.uhpmax],[i<9?0:1,10],label);
        }
    }
}
console.log(`status suppression: ${replays} native replays, HP, mortality and polymorph state PASS`);

const base=JSON.parse(fs.readFileSync(new URL(
    'gen-sessions/recipes/floor-pickup-traditional.json',import.meta.url))).segments[0];
const row=y=>game.nhDisplay.grid[y].map(c=>c.ch).join('');
const flags=()=>[game.disp.botl,game.disp.botlx,game.disp.time_botl];
const dirty=()=>Object.assign(game.disp,{botl:true,botlx:true,time_botl:true});
let groups=0;
async function setup() {
    resetInputState();await runSegment({...base,moves:' ',storage:new InMemoryStorage()});
    game._preNhgetchHook=null;game._toplin=0;game._win_stop=false;
    game.flags.time=true;game.moves=9;game.u.uhp=12;game.u.uhpmax=12;
    resetInputState();pushKeys(' '.repeat(100));await bot();groups++;
}

// -1 suppresses the entire status update; it is not a test for negative HP.
for(const hp of [-2,-1,0,1]) {
    await setup();const old=[row(22),row(23)];game.u.uhp=hp;game.u.uen+=10;
    dirty();await bot();assert.deepEqual(flags(),[false,false,false]);
    if(hp===-1)assert.deepEqual([row(22),row(23)],old);
    else {assert.match(row(23),new RegExp(` HP:${Math.max(hp,0)}\\(12\\)`));assert.notEqual(row(23),old[1]);}
}
await setup();const human=row(23);game.u.umonnum=P.PM_XORN;game.u.mtimedone=100;
game.youmonst.data=game.mons[P.PM_XORN];game.u.mh=17;game.u.mhmax=20;game.u.uhp=-1;
dirty();await bot();assert.equal(row(23),human,'human -1 suppresses polymorph status too');
game.u.uhp=12;await bot();assert.match(row(23),/ HP:17\(20\)/);

// A disabled bot retains its pending flags; other bot guards clear them.
for(const guard of ['disabled','status','no-data','in_mklev','saving','restoring','done_hup']) {
    await setup();const before=[row(22),row(23)];game.u.uhp=5;dirty();
    if(guard==='disabled')game.bot_disabled=true;
    else if(guard==='status')game.flags.status_updates=false;
    else if(guard==='no-data')game.youmonst.data=null;
    else if(guard==='in_mklev')game.in_mklev=true;
    else game.program_state[guard]=true;
    await bot();assert.deepEqual([row(22),row(23)],before,guard);
    assert.deepEqual(flags(),guard==='disabled'?[true,true,true]:[false,false,false],guard);
}
for(const guard of ['in_mklev','saving','restoring','done_hup']) {
    await setup();const before=game.nhDisplay.terminal.serialize();game.u.uhp=5;dirty();
    if(guard==='in_mklev')game.in_mklev=true;else game.program_state[guard]=true;
    assert.ok(suppress_map_output());await flush_screen(-1);
    assert.equal(game.nhDisplay.terminal.serialize(),before,guard);
    assert.deepEqual(flags(),[true,true,true],guard);
    assert.ok(!game._delay_flushing,'suppression occurs before the flush toggle');
}

// timebot has no human HP sentinel guard and refreshes only the clock.
await setup();let before=row(23);game.u.uhp=-1;game.u.uen+=10;game.moves=10;
game.disp.time_botl=true;timebot();assert.equal(row(23),before.replace(' T:9',' T:10').slice(0,80));
assert.equal(game.disp.time_botl,false);
for(const guard of ['status','time','saving','disabled']) {
    await setup();before=row(23);game.moves=10;game.disp.time_botl=true;
    if(guard==='status')game.flags.status_updates=false;
    else if(guard==='time')game.flags.time=false;
    else if(guard==='disabled')game.bot_disabled=true;
    else game.program_state.saving=true;
    timebot();assert.equal(row(23),before,guard);
    assert.equal(game.disp.time_botl,guard==='disabled',guard);
}

// Damage messages report the post-subtraction value before later HP clamps.
await setup();game.flags.showdamage=true;game.u.uhp=10;game.u.uhpmax=10;
Object.assign(game.context,{run:8,travel:1,travel1:1,mv:1});game.multi=20;
await losehp(3,'test damage',KILLED_BY);assert.equal(game.u.uhp,7);
assert.deepEqual([game.context.run,game.context.travel,game.context.travel1,game.context.mv,game.multi],[0,0,0,0,0]);
assert.equal(game._prevmsg,'[HP -3, 7 left]');
game.u.uhpmax=8;await losehp(-4,'test healing',KILLED_BY);
assert.deepEqual([game.u.uhp,game.u.uhpmax],[11,11]);assert.equal(game._prevmsg,'[HP 4, 11 left]');
const last=game._prevmsg;await showdamage(0);assert.equal(game._prevmsg,last);
game.flags.showdamage=false;await showdamage(2);assert.equal(game._prevmsg,last);

await setup();game.flags.showdamage=true;game.u.uhp=12;game.u.uhpmax=8;
await mdamageu(null,2);assert.equal(game.u.uhp,8);assert.equal(game._prevmsg,'[HP -2, 10 left]');
await mdamageu(null,-1);assert.equal(game.u.uhp,8);
assert.deepEqual(game.impossible_log,['mdamageu for negative damage? (-1)']);

for(const monsterDamage of [false,true]) {
    await setup();game.flags.showdamage=true;game.u.umonnum=P.PM_XORN;game.u.mtimedone=100;
    game.youmonst.data=game.mons[P.PM_XORN];game.u.mh=15;game.u.mhmax=10;
    if(monsterDamage)await mdamageu(null,2);else await losehp(2,'test damage',KILLED_BY);
    assert.deepEqual([game.u.mh,game.u.mhmax],monsterDamage?[10,10]:[13,13]);
    assert.equal(game._prevmsg,'[HP -2, 13 left]');assert.equal(game.u.uhp,12);
}
console.log(`status suppression: ${groups} constructed control groups PASS`);
