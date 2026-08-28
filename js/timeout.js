// timeout.js — the timer queue.
// C ref: src/timeout.c
//
// Nothing here draws. The queue exists because several subsystems schedule an
// effect for a future turn rather than applying it now: buried organics rot,
// eggs hatch, lit objects burn out. Level generation starts those timers, so a
// port that skips them looks right at generation time and then never fires the
// effect.
//
// The delay itself is drawn by the CALLER, before start_timer is reached
// (bury_an_obj spends rnd(250) for ROT_ORGANIC). Only the bookkeeping is here.

import { game } from './gstate.js';
import { rn2, rnd, d } from './rng.js';
import { stop_occupation } from './allmain.js';
import { nomul } from './hack.js';
import { TIMEOUT, FROMOUTSIDE, I_SPECIAL, WT_NOISY_INV, FOOT, NECK,
         A_STR, A_DEX, A_CON, DIED, KILLED_BY,
         PLNMSG_ONE_ITEM_HERE, FULL_MOON, FAINTING, MV_KNOWS_EGG,
         NO_MINVENT, MM_NOMSG, OBJ_FLOOR, OBJ_INVENT, OBJ_MINVENT }
    from './const.js';
import { ONAMES } from './objects_data.js';
import { PMNAMES, MFLAGS, MONSYMS } from './monst_data.js';
import { pline } from './display.js';

// src/timeout.c:187 vomiting_dialogue(). It runs before the property timer is
// decremented, so every switch value uses the pending timeout minus one.
async function vomiting_dialogue() {
    const props = (game.u.uprops ||= {});
    const v = (props.VOMITING || 0) - 1;
    let text = null;

    switch (v) {
    case 14:
        text = 'are feeling mildly nauseated.';
        break;
    case 11:
        text = props.CONFUSION ? 'feel slightly more confused.'
                               : 'feel slightly confused.';
        break;
    case 6: {
        const { make_stunned, make_confused } = await import('./potion.js');
        await make_stunned((game.u.intrinsic?.HStun || 0) + d(2, 4), false);
        await stop_occupation();
        await make_confused((game.u.intrinsic?.HConfusion || 0) + d(2, 4),
                            false);
        if ((game.multi ?? 0) > 0)
            nomul(0);
        break;
    }
    case 9: {
        const { make_confused } = await import('./potion.js');
        await make_confused((game.u.intrinsic?.HConfusion || 0) + d(2, 4),
                            false);
        if ((game.multi ?? 0) > 0)
            nomul(0);
        break;
    }
    case 8:
        text = game.u.uprops?.STUNNED ? "can't think straight."
                                     : "can't seem to think straight.";
        break;
    case 5:
        text = 'feel incredibly sick.';
        break;
    case 2: {
        const { cantvomit } = await import('./mondata.js');
        const { Hallucination } = await import('./youprop.js');
        if (cantvomit(game.youmonst.data))
            text = 'gag uncontrollably.';
        else
            text = Hallucination() ? 'are about to hurl!'
                                   : 'are about to vomit.';
        break;
    }
    case 0: {
        await stop_occupation();
        const { cantvomit } = await import('./mondata.js');
        const { Hallucination } = await import('./youprop.js');
        const { morehungry, vomit } = await import('./eat.js');
        if (!cantvomit(game.youmonst.data)) {
            await morehungry(20);
            if (game.u.uhs < FAINTING)
                await pline(`You ${Hallucination() ? 'hurl chunks' : 'vomit'}!`);
        }
        await vomit();
        break;
    }
    default:
        break;
    }

    if (text)
        await pline(`You ${text}`);
    const { exercise } = await import('./attrib.js');
    exercise(A_CON, false);
}

// include/timeout.h:11 enum timer_type
export const TIMER_NONE = 0;
export const TIMER_LEVEL = 1;
export const TIMER_GLOBAL = 2;
export const TIMER_OBJECT = 3;
export const TIMER_MONSTER = 4;
export const NUM_TIMER_KINDS = 5;

// include/timeout.h:36 enum timeout_types
export const ROT_ORGANIC = 0;
export const ROT_CORPSE = 1;
export const REVIVE_MON = 2;
export const ZOMBIFY_MON = 3;
export const BURN_OBJECT = 4;
export const HATCH_EGG = 5;
export const FIG_TRANSFORM = 6;
export const SHRINK_GLOB = 7;
export const MELT_ICE_AWAY = 8;
export const NUM_TIME_FUNCS = 9;

// src/timeout.c:2467 insert_timer() — keep the queue sorted by timeout.
//
// The scan stops at the first entry whose timeout is >= the new one and links
// in FRONT of it, so a tie puts the newcomer first: equal timeouts come out in
// reverse insertion order.
function insert_timer(gnu) {
    const base = (game.timer_base ||= []);
    let i = 0;
    while (i < base.length && base[i].timeout < gnu.timeout)
        i++;
    base.splice(i, 0, gnu);
}

// src/timeout.c:2247 start_timer() — schedule `func_index` for `arg` in `when`
// turns. Returns whether it was scheduled.
export function start_timer(when, kind, func_index, arg) {
    if (kind <= TIMER_NONE || kind >= NUM_TIMER_KINDS
        || func_index < 0 || func_index >= NUM_TIME_FUNCS)
        throw new Error(`start_timer (${kind}: ${func_index})`);   /* panic() */

    /* fail if <arg> already has a <func_index> timer running */
    const dup = (game.timer_base ||= []).find(
        (d) => d.kind === kind && d.func_index === func_index && d.arg === arg);
    if (dup)
        return false;                   /* impossible(), aborted */

    const gnu = {
        tid: (game.timer_id ??= 0),     /* svt.timer_id++ — post-increment */
        timeout: (game.moves ?? 0) + when,
        kind,
        needs_fixup: 0,
        func_index,
        arg,
    };
    game.timer_id++;
    insert_timer(gnu);

    if (kind === TIMER_OBJECT)          /* increment object's timed count */
        arg.timed = (arg.timed ?? 0) + 1;

    return true;
}

// src/timeout.c:2299 stop_timer() and :2328 peek_timer().
export function stop_timer(func_index, arg) {
    const base = (game.timer_base ||= []);
    const index = base.findIndex(
        (timer) => timer.func_index === func_index && timer.arg === arg);
    if (index < 0)
        return 0;

    const [timer] = base.splice(index, 1);
    if (timer.kind === TIMER_OBJECT)
        arg.timed = Math.max(0, (arg.timed ?? 1) - 1);
    return timer.timeout - (game.moves ?? 0);
}

export function peek_timer(func_index, arg) {
    const timer = (game.timer_base || []).find(
        (candidate) => candidate.func_index === func_index
            && candidate.arg === arg);
    return timer?.timeout ?? 0;
}

// src/timeout.c:2377 obj_stop_timers(). Remove every timer attached to an
// object before changing the object type or corpse species.
export function obj_stop_timers(obj) {
    const base = (game.timer_base ||= []);
    let removed = 0;
    for (let i = base.length - 1; i >= 0; --i) {
        const timer = base[i];
        if (timer.kind === TIMER_OBJECT && timer.arg === obj) {
            base.splice(i, 1);
            removed++;
        }
    }
    obj.timed = Math.max(0, (obj.timed || 0) - removed);
}

// src/timeout.c:1712 begin_burn(), limited to the oil-potion path currently
// reached by apply.js. The timer stores the next fuel checkpoint while age
// holds any fuel beyond that checkpoint, exactly as the C object does.
export async function begin_burn(obj, already_lit) {
    if (!obj?.age)
        return;
    if (obj.otyp !== ONAMES.POT_OIL) {
        note_unported_timeout('begin_burn:otyp=' + obj.otyp);
        return;
    }

    let turns = obj.age;
    if (obj.odiluted)
        turns = Math.trunc((3 * turns + 2) / 4);

    if (start_timer(turns, TIMER_OBJECT, BURN_OBJECT, obj)) {
        obj.lamplit = 1;
        obj.age -= turns;
        if (obj.where === OBJ_INVENT && !already_lit) {
            const { update_inventory } = await import('./invent.js');
            update_inventory();
        }
    } else {
        obj.lamplit = 0;
    }

    if (obj.lamplit && !already_lit) {
        let x, y;
        if (obj.where === OBJ_INVENT) {
            x = game.u.ux;
            y = game.u.uy;
        } else if (obj.where === OBJ_FLOOR) {
            x = obj.ox;
            y = obj.oy;
        } else if (obj.where === OBJ_MINVENT && obj.ocarry) {
            x = obj.ocarry.mx;
            y = obj.ocarry.my;
        }
        if (x === undefined) {
            note_unported_timeout('begin_burn:object_location');
        } else {
            const { new_light_source, LS_OBJECT } = await import('./light.js');
            new_light_source(x, y, 1, LS_OBJECT, obj.o_id);
            game.vision_full_recalc = 1;
        }
    }
}

// src/timeout.c:1804 end_burn() plus cleanup_burn(). stop_timer() returns the
// remaining delay, which is the unused fuel cleanup_burn restores to age.
export async function end_burn(obj, timer_attached) {
    if (!obj?.lamplit)
        return;

    if (timer_attached) {
        const remaining = stop_timer(BURN_OBJECT, obj);
        if (!remaining)
            note_unported_timeout('end_burn:missing_timer');
        obj.age = (obj.age || 0) + remaining;
    }

    const { del_light_source, LS_OBJECT } = await import('./light.js');
    del_light_source(LS_OBJECT, obj.o_id);
    obj.lamplit = 0;
    game.vision_full_recalc = 1;
    if (obj.where === OBJ_INVENT) {
        const { update_inventory } = await import('./invent.js');
        update_inventory();
    }
}

async function burn_object(obj, timeout) {
    if (obj?.otyp !== ONAMES.POT_OIL) {
        note_unported_timeout('burn_object:otyp=' + obj?.otyp);
        return;
    }

    if (timeout !== (game.moves ?? 0)) {
        const how_long = (game.moves ?? 0) - timeout;
        if (how_long < (obj.age || 0)) {
            obj.age -= how_long;
            await begin_burn(obj, true);
            return;
        }
        obj.age = 0;
        await end_burn(obj, false);
        if (obj.where === OBJ_FLOOR || obj.where === OBJ_MINVENT) {
            const was_floor = obj.where === OBJ_FLOOR;
            const ox = obj.ox, oy = obj.oy;
            const { obj_extract_self } = await import('./invent.js');
            obj_extract_self(obj);
            if (was_floor) {
                const { newsym } = await import('./display.js');
                newsym(ox, oy);
            }
        }
        return;
    }

    let x, y;
    if (obj.where === OBJ_INVENT) {
        x = game.u.ux;
        y = game.u.uy;
    } else if (obj.where === OBJ_FLOOR) {
        x = obj.ox;
        y = obj.oy;
    } else if (obj.where === OBJ_MINVENT && obj.ocarry) {
        x = obj.ocarry.mx;
        y = obj.ocarry.my;
    }
    if (x !== undefined) {
        const [{ Blind }, { cansee }] = await Promise.all([
            import('./youprop.js'), import('./vision.js'),
        ]);
        if (!Blind() && cansee(x, y)) {
            if (obj.where === OBJ_INVENT)
                await pline('Your potion of oil has burnt away.');
            else if (obj.where === OBJ_FLOOR) {
                const { You_see } = await import('./pline.js');
                await You_see('a burning potion of oil go out.');
            } else {
                note_unported_timeout('burn_object:minvent_message');
            }
        }
    }
    await end_burn(obj, false);

    const { obj_extract_self, useupall } = await import('./invent.js');
    if (obj.where === OBJ_INVENT) {
        useupall(obj);
    } else {
        const was_floor = obj.where === OBJ_FLOOR;
        const ox = obj.ox, oy = obj.oy;
        obj_extract_self(obj);
        if (was_floor) {
            const { newsym } = await import('./display.js');
            newsym(ox, oy);
        }
    }
}

// src/timeout.c:2222 run_timers() — fire every timer whose time has come.
// The list is ordered; we are done when the first element is in the future.
// Runs from nh_timeout()'s tail (timeout.c:947) and from goto_level.
export async function run_timers() {
    const base = (game.timer_base ||= []);
    while (base.length && base[0].timeout <= (game.moves ?? 0)) {
        const curr = base.shift();
        if (curr.kind === TIMER_OBJECT && curr.arg)
            curr.arg.timed = Math.max(0, (curr.arg.timed ?? 1) - 1);
        switch (curr.func_index) {
        case ROT_CORPSE: {
            const { rot_corpse } = await import('./dig.js');
            await rot_corpse(curr.arg);
            break;
        }
        case ROT_ORGANIC: {
            const { rot_organic } = await import('./dig.js');
            rot_organic(curr.arg);
            break;
        }
        case REVIVE_MON: {
            const { revive_mon } = await import('./do.js');
            await revive_mon(curr.arg);
            break;
        }
        case ZOMBIFY_MON: {
            const { zombify_mon } = await import('./do.js');
            await zombify_mon(curr.arg, curr.timeout);
            break;
        }
        case BURN_OBJECT:
            await burn_object(curr.arg, curr.timeout);
            break;
        case HATCH_EGG:
            await hatch_egg(curr.arg, curr.timeout);
            break;
        default:
            /* The remaining callbacks each need their own subsystem; record
               which one fired unported. */
            (game.unported ||= new Set())
                .add('timeout:run_timers:' + curr.func_index);
            break;
        }
    }
}

// src/timeout.c:951 fall_asleep() — put the hero to sleep for -how_long turns.
//
// The #if 0 deafness block is not compiled in C and is not ported. usleep
// records WHEN sleep began so combat can wake the hero no earlier than the
// next monster turn. nomovemsg carries the wake message.
export async function fall_asleep(how_long, wakeup_msg) {
    await stop_occupation();
    nomul(how_long);
    game.multi_reason = "sleeping";
    /* early wakeup from combat won't be possible until next monster turn */
    game.u.usleep = game.moves;
    game.nomovemsg = wakeup_msg ? "You wake up." : "You can move again.";
}

// src/timeout.c:1221 slip_or_trip() — feedback when FUMBLING expires after a
// move. The floor-object and ordinary on-foot paths are common. Ice and
// mounted movement retain their exact gates and record only the unported
// forced-movement tail.
async function slip_or_trip() {
    const u = game.u;
    const on_foot = !u.usteed;
    let otmp = (game.level?.objects || [])
        .find(o => o.ox === u.ux && o.oy === u.uy) || null;
    const { is_pool } = await import('./mon.js');
    if (otmp && on_foot && !u.uinwater && is_pool(u.ux, u.uy))
        otmp = null;

    const { You } = await import('./pline.js');
    const { Hallucination } = await import('./youprop.js');
    if (otmp && on_foot) {
        const { doname } = await import('./objnam.js');
        const { body_part } = await import('./polyself.js');
        let what;
        if (game.iflags?.last_msg === PLNMSG_ONE_ITEM_HERE)
            what = (otmp.quan === 1) ? 'it'
                 : Hallucination() ? 'they' : 'them';
        else if (otmp.dknown || !u.ublind)
            what = doname(otmp);
        else {
            const rock = (game.level.objects || [])
                .find(o => o.ox === u.ux && o.oy === u.uy
                           && o.otyp === ONAMES.ROCK);
            what = !rock ? 'something'
                 : rock.quan === 1 ? 'a rock' : 'some rocks';
        }
        if (Hallucination()) {
            const { pline } = await import('./display.js');
            const cap = what.charAt(0).toUpperCase() + what.slice(1);
            await pline(`Egads!  ${cap} bite${otmp.quan === 1 ? 's' : ''} `
                        + `your ${body_part(FOOT)}!`);
        } else {
            await You(`trip over ${what}.`);
        }
        if (!u.uarmf && otmp.otyp === ONAMES.CORPSE)
            note_unported_timeout('slip_or_trip:petrifying_corpse');
        return;
    }

    const { is_ice } = await import('./dbridge.js');
    const intrinsic = u.intrinsic || {};
    if ((intrinsic.HFumbling & FROMOUTSIDE)
        || (is_ice(u.ux, u.uy) && !rn2(3))) {
        const { pline } = await import('./display.js');
        const verb = rn2(2) ? 'slip' : 'slide';
        await pline(`You ${verb} ${is_ice(u.ux, u.uy) ? 'on' : 'off'} the ice.`);
        if (!on_foot) {
            note_unported_timeout('slip_or_trip:mounted_ice');
        } else {
            const { ACURR } = await import('./attrib.js');
            if (!rn2(10 + ACURR(A_DEX)))
                note_unported_timeout('slip_or_trip:hurtle');
        }
        return;
    }

    if (on_foot) {
        switch (rn2(4)) {
        case 1: {
            const { body_part } = await import('./polyself.js');
            const { makeplural } = await import('./objnam.js');
            await You(`trip over your own ${Hallucination()
                       ? 'elbow' : makeplural(body_part(FOOT))}.`);
            break;
        }
        case 2:
            await You(`slip ${Hallucination()
                      ? 'on a banana peel' : 'and nearly fall'}.`);
            break;
        case 3:
            await You('flounder.');
            break;
        default:
            await You('stumble.');
            break;
        }
    } else {
        /* The mounted branch uses the same rn2(4), then dismounts unless the
           saddle is cursed. Keep the draw while its steed plumbing is absent. */
        rn2(4);
        note_unported_timeout('slip_or_trip:mounted');
    }
}

// src/timeout.c:588 nh_timeout() - per-turn luck and intrinsic timeouts.
export async function nh_timeout() {
    const u = game.u;
    const intr = (u.intrinsic ||= {});
    let baseluck = game.flags?.moonphase === FULL_MOON ? 1 : 0;
    if (game.flags?.friday13)
        baseluck--;
    if (game.quest_status?.killed_leader)
        baseluck -= 4;
    const role = game.urole?.mnum;
    if ((role === PMNAMES.PM_ARCHEOLOGIST || role === 'PM_ARCHEOLOGIST')
        && u.uarmh?.otyp === ONAMES.FEDORA)
        baseluck++;

    const luckPeriod = (u.uhave?.amulet || u.ugangr) ? 300 : 600;
    if ((u.uluck || 0) !== baseluck
        && (game.moves || 0) % luckPeriod === 0) {
        const { stone_luck } = await import('./invent.js');
        const timeLuck = stone_luck(false);
        const noStone = !(game.invent || []).some(
            (obj) => obj.otyp === ONAMES.LUCKSTONE) && !stone_luck(true);
        if (u.uluck > baseluck && (noStone || timeLuck < 0))
            u.uluck--;
        else if (u.uluck < baseluck && (noStone || timeLuck > 0))
            u.uluck++;
    }
    /* src/timeout.c:621, successful prayer freezes every dangerous
       timeout, including wizard-set intrinsics, until prayer finishes. */
    if (u.uinvulnerable)
        return;

    /* src/timeout.c:649: facial cream wears off one point per turn before
       HBlinded is decremented below. */
    if (u.ucreamed)
        u.ucreamed--;

    const vomiting = u.uprops?.VOMITING || 0;
    if (vomiting) {
        await vomiting_dialogue();
        u.uprops.VOMITING = vomiting - 1;
        if (!u.uprops.VOMITING)
            (game.disp ||= {}).botl = true;
    }

    const strangled = intr.HStrangled || 0;
    if (strangled) {
        const remaining = strangled & TIMEOUT;
        if (remaining > 0 && remaining <= 5) {
            const { breathless } = await import('./mondata.js');
            const cannot_breathe = breathless(game.youmonst.data)
                || !!(intr.HMagical_breathing
                       || game.u.uprops?.MAGICAL_BREATHING);
            const alternate = cannot_breathe || !rn2(50);
            const neck = (await import('./polyself.js')).body_part(NECK);
            const ordinary = [
                'You find it hard to breathe.',
                "You're gasping for air.",
                'You can no longer breathe.',
                null,
                'You suffocate.',
            ];
            const special = [
                `Your ${neck} is becoming constricted.`,
                'Your blood is having trouble reaching your brain.',
                `The pressure on your ${neck} increases.`,
                'Your consciousness is fading.',
                'You suffocate.',
            ];
            let message = (alternate ? special : ordinary)[5 - remaining];
            if (!message) {
                const { hcolor } = await import('./do_name.js');
                const { NH_BLUE } = await import('./const.js');
                message = `You're turning ${hcolor(NH_BLUE)}.`;
            }
            await pline(message);
            if (!alternate)
                await stop_occupation();
        }
        const { exercise } = await import('./attrib.js');
        exercise(A_STR, false);
    }

    /* src/timeout.c:631 sickness_dialogue(), followed later in nh_timeout by
       the property countdown. Fatal illness abuses constitution every turn,
       even when its low-time warning text is not yet due. */
    const sick = game.u.uprops?.SICK || 0;
    if (sick) {
        const half = Math.trunc(sick / 2);
        if (half > 0 && half <= 3 && (sick % 2) !== 0) {
            const messages = ["Your illness feels worse.",
                              "Your illness is severe.",
                              "You are at Death's door."];
            await pline(messages[3 - half]);
        }
        const { exercise } = await import('./attrib.js');
        exercise(A_CON, false);
        game.u.uprops.SICK = sick - 1;
    }

    for (const key of Object.keys(intr)) {
        const v = intr[key];
        if (typeof v !== 'number' || !(v & TIMEOUT))
            continue;
        intr[key] = (v & ~TIMEOUT) | (((v & TIMEOUT) - 1) & TIMEOUT);
        if (intr[key] & TIMEOUT)
            continue;
        /* the timeout just ran out */
        switch (key) {
        case 'HStrangled': {
            intr.HStrangled |= I_SPECIAL;
            game.killer = {
                format: KILLED_BY,
                name: u.uburied ? 'suffocation' : 'strangulation',
            };
            const { done } = await import('./end.js');
            await done(DIED);
            intr.HStrangled &= ~I_SPECIAL;
            (game.disp ||= {}).botl = true;
            if (u.uamul?.otyp === ONAMES.AMULET_OF_STRANGULATION) {
                const amulet = u.uamul;
                const { Your } = await import('./pline.js');
                await Your('amulet vanishes!');
                const { useup } = await import('./invent.js');
                useup(amulet);
            }
            break;
        }
        case 'HWounded_legs': {
            /* src/timeout.c nh_timeout WOUNDED_LEGS arm: heal_legs(0) */
            const { heal_legs } = await import('./do.js');
            intr.HWounded_legs = 1; /* Wounded_legs still true for the heal */
            await heal_legs(0);
            break;
        }
        case 'HConfusion': {
            const { make_confused } = await import('./potion.js');
            intr.HConfusion = 1; /* so make_confused works properly */
            await make_confused(0, true);
            if (!game.u.uprops?.CONFUSION) {
                const { stop_occupation } = await import('./allmain.js');
                await stop_occupation();
            }
            break;
        }
        case 'HStun': {
            const { make_stunned } = await import('./potion.js');
            intr.HStun = 1; /* preserve the old timeout for the cure */
            await make_stunned(0, true);
            break;
        }
        case 'HHallucination': {
            const { make_hallucinated } = await import('./potion.js');
            intr.HHallucination = 1;
            await make_hallucinated(0, true, 0);
            break;
        }
        case 'HBlinded': {
            const { make_blinded } = await import('./potion.js');
            intr.HBlinded = 1; /* preserve the old timeout for the cure */
            await make_blinded(0, true);
            break;
        }
        case 'HGlib': {
            const { make_glib } = await import('./potion.js');
            intr.HGlib = 1; /* preserve the old state for make_glib() */
            make_glib(0);
            break;
        }
        case 'HDeaf': {
            const { make_deaf } = await import('./potion.js');
            const { Deaf } = await import('./youprop.js');
            intr.HDeaf = (intr.HDeaf & ~TIMEOUT) | 1;
            await make_deaf(0, true);
            (game.disp ||= {}).botl = true;
            if (!Deaf())
                await stop_occupation();
            break;
        }
        case 'HFast': {
            const { Fast, Very_fast } = await import('./attrib.js');
            if (!Very_fast()) {
                const { You_feel } = await import('./pline.js');
                await You_feel(`yourself slow down${Fast() ? ' a bit' : ''}.`);
            }
            break;
        }
        case 'HSee_invisible': {
            const { newsym, see_monsters } = await import('./display.js');
            see_monsters();
            newsym(game.u.ux, game.u.uy);
            await stop_occupation();
            break;
        }
        case 'HFumbling': {
            const { Levitation, Flying, Deaf } = await import('./youprop.js');
            if (game.u.umoved && !(Levitation() || Flying())) {
                await slip_or_trip();
                nomul(-2);
                game.multi_reason = 'fumbling';
                game.nomovemsg = '';
                const { inv_weight } = await import('./attrib.js');
                if (inv_weight() > -WT_NOISY_INV) {
                    if (!Deaf()) {
                        const { You } = await import('./pline.js');
                        await You('make a lot of noise!');
                    }
                    const { wake_nearby } = await import('./mon.js');
                    wake_nearby(false);
                }
            }
            intr.HFumbling &= ~FROMOUTSIDE;
            if (intr.HFumbling || game.u.uprops?.FUMBLING) {
                const timeout = Math.min(TIMEOUT,
                    (intr.HFumbling & TIMEOUT) + rnd(20));
                intr.HFumbling = (intr.HFumbling & ~TIMEOUT) | timeout;
            }
            break;
        }
        default:
            note_unported_timeout(`nh_timeout:${key}`);
            break;
        }
    }

    /* wiz_intrinsic_timeout() keeps properties without a dedicated live
       HFoo slot here. They are still ordinary u.uprops timeouts in C and
       lose one turn in the same loop. */
    const wiz = game.u.wiz_intrinsic_timeouts;
    if (wiz) {
        for (const key of Object.keys(wiz)) {
            if (typeof wiz[key] !== 'number' || wiz[key] <= 0)
                continue;
            if (--wiz[key] === 0)
                delete wiz[key];
        }
    }

    /* src/timeout.c:947 — expired timers fire at the end of nh_timeout */
    await run_timers();
}

function note_unported_timeout(what) {
    (game.unported ||= new Set()).add(what);
}

// src/timeout.c:981 attach_egg_hatch_timeout() — decide if and when the egg
// hatches: one rnd(i) per age 151..200 until a roll exceeds 150.
export function attach_egg_hatch_timeout(egg, when = 0) {
    /* stop_timer: no previous timer exists at creation */
    if (!when) {
        for (let i = (200 - 50) + 1; i <= 200; i++)
            if (rnd(i) > 150) {
                when = i;
                break;
            }
    }
    if (when)
        start_timer(when, TIMER_OBJECT, HATCH_EGG, egg);
}

// src/timeout.c:1017 hatch_egg() -- turn a fertile egg stack into one or more
// adjacent baby monsters, report what the hero can perceive, and consume the
// eggs which actually hatched.
export async function hatch_egg(egg, timeout) {
    if (!egg || (egg.corpsenm ?? -1) < 0)
        return;

    const { big_to_little } = await import('./mkobj.js');
    const { carried } = await import('./obj.js');
    const mnum = big_to_little(egg.corpsenm);

    let x, y;
    if (egg.where === OBJ_INVENT && (game.invent || []).includes(egg)) {
        x = game.u.ux;
        y = game.u.uy;
    } else if (egg.where === OBJ_FLOOR
               && (game.level?.objects || []).includes(egg)) {
        x = egg.ox;
        y = egg.oy;
    } else if (egg.where === OBJ_MINVENT && egg.ocarry
               && (game.level?.monsters || []).includes(egg.ocarry)
               && (egg.ocarry.minvent || []).includes(egg)) {
        x = egg.ocarry.mx;
        y = egg.ocarry.my;
    } else {
        /* C moves object timers to the saved level's timer chain. The port's
           timer queue is global, so reject an object which is not owned by
           the active level before this callback consumes any RNG. */
        return;
    }

    const isCarried = carried(egg);
    const yours = !!(egg.spe
        || (!game.flags.female && isCarried && !rn2(2)));
    const silent = timeout !== game.moves;

    const { cansee } = await import('./vision.js');
    const { enexto } = await import('./teleport.js');
    const { makemon } = await import('./makemon.js');
    let hatchcount = rnd(egg.quan | 0);
    const canseeHatchspot = cansee(x, y) && !silent;
    const ptr = game.mons[mnum];
    let mon = null, mon2 = null;
    let i = hatchcount;

    if (!(ptr.geno & MFLAGS.G_UNIQ)
        && !((game.mvitals[mnum]?.mvflags ?? 0)
             & (MFLAGS.G_GENOD | MFLAGS.G_EXTINCT))) {
        for (; i > 0; i--) {
            const cc = { x: 0, y: 0 };
            if (!enexto(cc, x, y, ptr))
                break;
            mon = makemon(ptr, cc.x, cc.y, NO_MINVENT | MM_NOMSG);
            if (!mon)
                break;

            if ((yours && !silent)
                || (isCarried && mon.data.mlet === MONSYMS.S_DRAGON)) {
                const { initedog } = await import('./dog.js');
                initedog(mon, true);
                if (isCarried && mon.data.mlet !== MONSYMS.S_DRAGON)
                    mon.mtame = 20;
            }
            if ((game.mvitals[mnum]?.mvflags ?? 0) & MFLAGS.G_EXTINCT)
                break;
            mon2 = mon;
        }
        if (!mon)
            mon = mon2;
        hatchcount -= i;
        egg.quan -= hatchcount;
    }

    if (!mon)
        return;

    const siblings = hatchcount > 1;
    let monname = '';
    if (canseeHatchspot) {
        const { m_monnam } = await import('./do_name.js');
        const { an, makeplural } = await import('./objnam.js');
        const base = m_monnam(mon);
        monname = siblings ? `some ${makeplural(base)}` : an(base);
    }

    let knowsEgg = false;
    let redraw = false;
    if (egg.where === OBJ_INVENT) {
        const { You_feel, You_see } = await import('./pline.js');
        const { locomotion, is_silent } = await import('./mondata.js');
        knowsEgg = true;
        if (canseeHatchspot)
            await You_see(`${monname} ${locomotion(mon.data, 'drop')} out of your pack!`);
        else
            await You_feel(`something ${locomotion(mon.data, 'drop')} from your pack!`);

        const { Deaf } = await import('./youprop.js');
        if (yours) {
            const { cry_sound } = await import('./sounds.js');
            const { ing_suffix } = await import('./hacklib.js');
            await pline(`${siblings ? 'Their' : 'Its'} ${
                ing_suffix(cry_sound(mon))} ${
                is_silent(mon.data) || Deaf() ? 'seems' : 'sounds'} like "${
                game.flags.female ? 'mommy' : 'daddy'}${egg.spe ? '.' : '?'}"`);
        } else if (mon.data.mlet === MONSYMS.S_DRAGON && !Deaf()) {
            await pline('"Gleep!"');
        }
    } else if (egg.where === OBJ_FLOOR) {
        if (canseeHatchspot) {
            const { You_see } = await import('./pline.js');
            knowsEgg = true;
            await You_see(`${monname} hatch.`);
            redraw = true;
        }
    } else if (egg.where === OBJ_MINVENT && canseeHatchspot) {
        const { a_monnam } = await import('./do_name.js');
        const { s_suffix } = await import('./hacklib.js');
        const { locomotion } = await import('./mondata.js');
        const { canseemon } = await import('./display.js');
        const { is_pool } = await import('./mon.js');
        const carrier = egg.ocarry;
        let carriedby;
        if (carrier && canseemon(carrier)
            && (!carrier.wormno || cansee(carrier.mx, carrier.my))) {
            carriedby = `${s_suffix(a_monnam(carrier))} pack`;
            knowsEgg = true;
        } else {
            carriedby = is_pool(mon.mx, mon.my) ? 'empty water' : 'thin air';
        }
        const { You_see } = await import('./pline.js');
        await You_see(`${monname} ${locomotion(mon.data, 'drop')} out of ${carriedby}!`);
    }

    if (canseeHatchspot && knowsEgg) {
        game.mvitals[egg.corpsenm].mvflags |= MV_KNOWS_EGG;
        const { update_inventory } = await import('./invent.js');
        update_inventory();
    }

    const { useup, obj_extract_self, weight } = await import('./invent.js');
    if (egg.quan > 0) {
        attach_egg_hatch_timeout(egg, rnd(12));
        egg.owt = weight(egg);
    } else if (isCarried) {
        useup(egg);
    } else {
        obj_extract_self(egg);
        const { m_at } = await import('./mon.js');
        const { hideunder } = await import('./makemon.js');
        const floorMon = m_at(x, y);
        if (floorMon && !hideunder(floorMon) && cansee(x, y))
            redraw = true;
    }
    if (redraw) {
        const { newsym } = await import('./display.js');
        newsym(x, y);
    }
}

// src/timeout.c:1846 do_storms() — no lightning if not a stormy level (the
// Plane of Air) or too often even then: the rn2(8) gate is the only draw on
// 7 of 8 stormy turns. A strike sequence spends rnd(64), a cloud hunt of
// up to 100 coordinate pairs and an rn2(3) pair per strike; the bolt itself
// is buzz(), the zap beam engine, which is not ported and records.
export async function do_storms() {
    const { rn2 } = await import('./rng.js');
    const { COLNO, ROWNO, CLOUD } = await import('./const.js');

    /* no lightning if not stormy level or too often, even then */
    if (!game.level?.flags?.stormy || rn2(8))
        return;

    /* the number of strikes is 8-log2(nstrike) */
    for (let nstrike = rnd(64); nstrike <= 64; nstrike *= 2) {
        let x, y, count = 0;
        do {
            x = rnd(COLNO - 1);
            y = rn2(ROWNO);
        } while (++count < 100 && game.level.at(x, y)?.typ !== CLOUD);

        if (count < 100) {
            const dirx = rn2(3) - 1;
            const diry = rn2(3) - 1;
            if (dirx !== 0 || diry !== 0)
                note_unported_timeout('do_storms:buzz');
        }
    }

    if (game.level.at(game.u.ux, game.u.uy)?.typ === CLOUD) {
        /* Inside a cloud during a thunderstorm is deafening. */
        /* Even if already deaf, we sense the thunder's vibrations. */
        const { pline } = await import('./display.js');
        await pline('Kaboom!!!  Boom!!  Boom!!');
        /* incr_itimeout(&HDeaf, rn1(20, 30)) — the draw is C's; the
           deafness property linkage past the timer is not wired */
        const { rn1 } = await import('./rng.js');
        (game.u.intrinsic ||= {}).HDeaf =
            ((game.u.intrinsic.HDeaf | 0) + rn1(20, 30));
        game.botl = true;
        if (!game.u.uinvulnerable) {
            const { stop_occupation } = await import('./allmain.js');
            await stop_occupation();
            await nomul(-3);
            game.multi_reason = 'hiding from thunderstorm';
            game.nomovemsg = 0;
        }
    } else {
        const { You_hear } = await import('./pline.js');
        await You_hear('a rumbling noise.');
    }
}
