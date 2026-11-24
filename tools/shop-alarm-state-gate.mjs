// C shk.c:510 call_kops, through the real public robbery callers.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runSegment} from '../js/jsmain.js';
import {InMemoryStorage} from '../js/storage.js';
import {game} from '../js/gstate.js';
import {u_left_shop, remote_burglary} from '../js/shk.js';
import {makemon} from '../js/makemon.js';
import {mksobj, bless} from '../js/mkobj.js';
import {make_deaf} from '../js/potion.js';
import {Deaf} from '../js/youprop.js';
import {seffects} from '../js/read.js';
import {makeknown} from '../js/o_init.js';
import {resetInputState, pushKeys} from '../js/input.js';
import {initRng, enableRngLog, getRngLog} from '../js/rng.js';
import {pline} from '../js/display.js';
import {PMNAMES} from '../js/monst_data.js';
import {ONAMES} from '../js/objects_data.js';
import {MM_NOMSG, MM_ASLEEP, NO_MINVENT, G_GONE} from '../js/const.js';
import {clearMessages, messages} from './status-followup-test-setup.mjs';
import recipe from './gen-sessions/recipes/shop-robbery-chronicle.json' with {type:'json'};
const foundation=recipe.segments[0];
const prefix=foundation.moves.slice(0,foundation.moves.indexOf('\x163\r'));
const kopTypes=[PMNAMES.PM_KEYSTONE_KOP,PMNAMES.PM_KOP_SERGEANT,
    PMNAMES.PM_KOP_LIEUTENANT,PMNAMES.PM_KOP_KAPTAIN];
const isWatch=m=>[PMNAMES.PM_WATCHMAN,PMNAMES.PM_WATCH_CAPTAIN].includes(m.mnum);
async function setup({deaf=false,watch=false,gone=false,verbose=true}={}) {
    const run=await runSegment({...foundation,moves:prefix,storage:new InMemoryStorage()});
    game._preNhgetchHook=null;resetInputState();
    let reads=0;
    run._display.onEmptyQueue=()=>{assert.ok(++reads<100,'bounded feedback');return 32;};
    const owner=game.level.monsters.find(m=>m.isshk);
    assert.ok(owner && owner.eshk.billct===1 && game.u.ushops);
    assert.equal(game.level.monsters.some(isWatch),false);
    let guard;
    if(watch){
        guard=await makemon(game.mons[PMNAMES.PM_WATCHMAN],game.u.ux,game.u.uy,
            MM_NOMSG|MM_ASLEEP|NO_MINVENT);
        assert.ok(guard && guard.mpeaceful && guard.msleeping);
    }
    if(gone){
        const scroll=mksobj(ONAMES.SCR_GENOCIDE,false,false);bless(scroll);
        makeknown(ONAMES.SCR_GENOCIDE);clearMessages();pushKeys('K\r');
        await seffects(scroll);
        assert.ok(kopTypes.every(i=>game.mvitals[i].mvflags&G_GONE));
    }
    await make_deaf(deaf?100:0,false);assert.equal(!!Deaf(),deaf);
    game.flags.verbose=verbose;clearMessages();initRng(711);enableRngLog();
    return {run,owner,guard,shop:game.u.ushops.charAt(0)};
}
for(const deaf of [false,true])for(const watch of [false,true])for(const gone of [false,true]){
    test(`alarm deaf=${deaf} watch=${watch} all Kops genocided=${gone}`,async()=>{
        const ctx=await setup({deaf,watch,gone});
        await u_left_shop(ctx.shop,true);
        const text=messages(),kops=game.level.monsters.filter(m=>kopTypes.includes(m.mnum));
        assert.equal(text.includes('An alarm sounds!'),!deaf);
        assert.equal(text.includes('But no one seems to respond to it.'),gone&&!watch&&!deaf);
        assert.equal(text.includes('The Keystone Kops are after you!'),!gone);
        assert.equal(text.includes('The guard wakes up.'),watch&&!deaf);
        if(watch){assert.equal(ctx.guard.mpeaceful,0);assert.equal(ctx.guard.msleeping,0);}
        assert.equal(kops.length===0,gone);
        assert.equal(getRngLog().filter(s=>s.startsWith('rnd(5)=')).length,gone?0:2);
        assert.equal(ctx.owner.eshk.following,1);assert.equal(ctx.owner.eshk.billct,0);
    });
}
for(const deaf of [false,true])test(`near-shop caller creates one swarm, deaf=${deaf}`,async()=>{
    const ctx=await setup({deaf,watch:true});
    // Construct the caller's just-crossed-door state; all alarm helpers are real.
    game.u.ux0=ctx.owner.eshk.shd.x;game.u.uy0=ctx.owner.eshk.shd.y;
    assert.ok(game.level.at(game.u.ux0,game.u.uy0).edge);
    await u_left_shop(ctx.shop,false);
    assert.equal(ctx.guard.mpeaceful,0);assert.equal(ctx.guard.msleeping,0);
    assert.ok(messages().includes('The Keystone Kops appear!'));
    assert.equal(messages().includes('An alarm sounds!'),!deaf);
    assert.equal(getRngLog().filter(s=>s.startsWith('rnd(5)=')).length,1);
});
test('quiet no-Kops response still alerts the watch through remote burglary',async()=>{
    const ctx=await setup({watch:true,gone:true,verbose:false});
    await remote_burglary(game.u.ux,game.u.uy);
    assert.equal(ctx.guard.mpeaceful,0);assert.equal(ctx.guard.msleeping,0);
    assert.ok(messages().includes('The guard wakes up.'));
    assert.equal(messages().includes('But no one seems to respond to it.'),false);
    assert.deepEqual(getRngLog(),[]);
});
test('watch feedback completes before any Kops are created',async()=>{
    const ctx=await setup({watch:true});
    const events=[];
    const previous=ctx.run._display.onEmptyQueue;
    ctx.run._display.onEmptyQueue=()=>{
        events.push({text:game._toplines,peaceful:ctx.guard.mpeaceful,
            sleeping:ctx.guard.msleeping,kops:game.level.monsters.filter(m=>kopTypes.includes(m.mnum)).length});
        return previous();
    };
    await pline('A'.repeat(72));
    await u_left_shop(ctx.shop,true);
    const alarm=events.find(e=>e.text.includes('An alarm sounds!'));
    const watch=events.find(e=>e.text.includes('The guard wakes up.'));
    assert.ok(alarm&&watch);assert.equal(alarm.kops,0);assert.equal(watch.kops,0);
    assert.equal(watch.peaceful,0);assert.equal(watch.sleeping,0);
    assert.ok(game.level.monsters.some(m=>kopTypes.includes(m.mnum)));
});
