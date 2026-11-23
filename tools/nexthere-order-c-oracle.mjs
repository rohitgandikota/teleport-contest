// Extract whole pinned C functions. Side effects unrelated to chains are stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export function nexthereOrderOracle(cases) {
    const root = new URL('../', import.meta.url);
    const sourceText = Object.fromEntries(['mkobj', 'restore', 'zap'].map(name => [
        name,
        fs.readFileSync(new URL(`nethack-c/recorder/src/${name}.c`, root), 'utf8')
    ]));
    const extracted = [];
    for (const [file, names] of [
        ['mkobj', [
            'extract_nobj',
            'extract_nexthere',
            'place_object',
            'remove_object',
            'recreate_pile_at',
            'replace_object',
            'splitobj'
        ]],
        ['restore', ['find_lev_obj']],
        ['zap', ['bhitpile']]
    ]) {
        for (const name of names) {
            const code = sourceText[file].match(new RegExp(
                '^(?:staticfn void|void|int|struct obj \\*)\\n' + name + '\\([^]*?^}', 'm'
            ))?.[0];
            assert.ok(code, name);
            extracted.push({ name, file, code });
        }
    }

    let main = 'int main(void) {\n';
    for (const sample of cases) {
        main += `
    memset(items, 0, sizeof items);
    memset(&svl, 0, sizeof svl);
    fobj = NULL;
    visits_count = 0;
`;
        main += `    snapshot(${JSON.stringify(sample.name)}, 0);\n`;
        for (const [step, a] of sample.actions.entries()) {
            if (a.op === 'put') {
                main += `
    items[${a.id}].id = ${a.id};
    items[${a.id}].otyp = ${a.type};
    items[${a.id}].quan = ${a.quan ?? 8};
    place_object(&items[${a.id}], ${a.x}, ${a.y});
`;
            } else if (a.op === 'remove') {
                main += `    remove_object(&items[${a.id}]);\n`;
            } else if (a.op === 'extract') {
                main += `
    extract_nexthere(&items[${a.id}], &svl.level.objects[items[${a.id}].ox][items[${a.id}].oy]);
    extract_nobj(&items[${a.id}], &fobj);
`;
            } else if (a.op === 'replace') {
                main += `
    items[${a.id}].id = ${a.id};
    items[${a.id}].quan = 8;
    items[${a.id}].otyp = ${a.type};
    replace_object(&items[${a.old}], &items[${a.id}]);
`;
            } else if (a.op === 'split') {
                main += `
    allocation = ${a.id};
    splitobj(&items[${a.old}], ${a.num});
    items[${a.id}].id = ${a.id};
`;
            } else if (a.op === 'recreate') {
                main += `    recreate_pile_at(${a.x}, ${a.y});\n`;
            } else if (a.op === 'restore') {
                main += '    find_lev_obj();\n';
            } else if (a.op === 'hit') {
                main += `
    hitmode = ${a.mode};
    u.uundetected = ${+!!a.hide};
    bhitpile(&wand, hit, 10, 10, ${a.zz ?? 0});
`;
            } else {
                throw Error(a.op);
            }
            main += `    snapshot(${JSON.stringify(sample.name)}, ${step + 1});\n`;
        }
    }
    main += '    return 0;\n}\n';

    const header = String.raw`
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>

typedef int coordxy;
typedef int schar;
typedef int boolean;
#define TRUE 1
#define FALSE 0
#define OBJ_P struct obj *
#define SPE_FORCE_BOLT 100
#define WAN_STRIKING 101
#define STATUE_TRAP 1
#define PRINTF_F_PTR(a, b)
#define staticfn static
#define COLNO 80
#define ROWNO 21
#define OBJ_FREE 0
#define OBJ_FLOOR 1
#define OBJ_INVENT 2
#define OBJ_CONTAINED 3
#define OBJ_MINVENT 4
#define OBJ_LUAFREE 9
#define W_BALL 1
#define W_CHAIN 2

enum { BOULDER = 1, DAGGER, ROCK, APPLE, ENORMOUS_MEATBALL };
struct monst;
struct obj {
    int id, otyp, where, ox, oy, no_charge, timed, o_id, lamplit, owornmask,
        quan, owt, lua_ref_cnt, pickup_prev, unpaid;
    void *oextra;
    struct obj *nobj, *nexthere, *cobj, *ocontainer;
    struct monst *ocarry;
} items[128];
struct monst {
    struct obj *minvent;
};
struct {
    struct {
        struct obj *objects[COLNO][ROWNO];
    } level;
} svl;
struct {
    struct obj *invent;
} gi;
struct {
    struct {
        struct {
            int parent_oid, child_oid;
        } objsplit;
    } context;
} svc;
struct {
    struct {
        int dlevel;
    } uz;
    int uundetected;
} u;
struct {
    struct {
        void *data;
    } youmonst;
} gy;
struct {
    int poly_zapped;
} gp;
struct trap {
    int ttyp;
};

struct trap *t_at(int x, int y) {
    return NULL;
}

int activate_statue_trap(struct trap *t, int x, int y, int flag) {
    return 0;
}

void learnwand(struct obj *o) {}
void create_polymon(struct obj *o, int kind) {}
void maybe_unhide_at(int x, int y) {}
void fill_pit(int x, int y) {}

int hides_under(void *data) {
    return 1;
}

struct obj *fobj;
int allocation;

int isok(int x, int y) {
    return x > 0 && x < COLNO && y >= 0 && y < ROWNO;
}

void panic(const char *s, ...) {
    fputs(s, stderr);
    exit(2);
}

void impossible(const char *s, ...) {
    fputs(s, stderr);
    exit(2);
}

const char *safe_typename(int t) {
    return "plain test item";
}

void obj_no_longer_held(struct obj *o) {}
void block_point(int x, int y) {}
void recalc_block_point(int x, int y) {}

int costly_spot(int x, int y) {
    return 0;
}

int find_objowner(struct obj *o, int x, int y) {
    return 0;
}

int costly_adjacent(int m, int x, int y) {
    return 0;
}

void obj_timer_checks(struct obj *o, int x, int y, int arg) {}
void setworn(struct obj *o, int mask) {}

struct obj *newobj(void) {
    return &items[allocation];
}

int nextoid(struct obj *o, struct obj *n) {
    return allocation;
}

int weight(struct obj *o) {
    return o->quan;
}

void splitbill(struct obj *o, struct obj *n) {}
void copy_oextra(struct obj *o, struct obj *n) {}

int has_omid(struct obj *o) {
    return 0;
}

void free_omid(struct obj *o) {}
void obj_split_timers(struct obj *o, struct obj *n) {}

int obj_sheds_light(struct obj *o) {
    return 0;
}

void obj_split_light_source(struct obj *o, struct obj *n) {}
`;

    const output = String.raw`
int visits[128], visits_count, hitmode;
struct obj wand = { 0 };

int hit(struct obj *o, struct obj *w) {
    visits[visits_count++] = o->id;
    if (hitmode == 1)
        remove_object(o);
    if (hitmode == 2 && o->id == 3) {
        allocation = 4;
        splitobj(&items[1], 2);
        items[4].id = 4;
    }
    if ((hitmode == 3 && o->id == 2) || (hitmode == 4 && o->id == 3)) {
        items[4].id = 4;
        items[4].otyp = ROCK;
        items[4].quan = 8;
        replace_object(o, &items[4]);
    }
    return 1;
}

void ids(struct obj *o, int local) {
    printf("[");
    int first = 1, limit = 0;
    for (; o; o = local ? o->nexthere : o->nobj) {
        assert(++limit < 128);
        printf("%s%d", first ? "" : ",", o->id);
        first = 0;
    }
    printf("]");
}

void snapshot(const char *name, int step) {
    printf("{\"name\":\"%s\",\"step\":%d,\"global\":", name, step);
    ids(fobj, 0);
    printf(",\"piles\":{");
    int first = 1;
    for (int x = 0; x < COLNO; x++)
        for (int y = 0; y < ROWNO; y++)
            if (svl.level.objects[x][y]) {
                printf("%s\"%d,%d\":", first ? "" : ",", x, y);
                first = 0;
                ids(svl.level.objects[x][y], 1);
            }
    printf("},\"visits\":[");
    for (int i = 0; i < visits_count; i++)
        printf("%s%d", i ? "," : "", visits[i]);
    printf("]}\n");
}
`;

    const temp = fs.mkdtempSync(join(tmpdir(), 'nexthere-order-'));
    try {
        fs.writeFileSync(join(temp, 'probe.c'), header + extracted.map(f => f.code).join('\n') + output + main);
        execFileSync('clang', ['-std=c11', join(temp, 'probe.c'), '-o', join(temp, 'probe')]);
        const states = execFileSync(join(temp, 'probe'), [], { encoding: 'utf8' })
            .trim().split('\n').map(JSON.parse);
        const sources = extracted.map(({ name, file, code }) => ({
            name,
            file,
            sha256: createHash('sha256').update(code).digest('hex')
        }));
        return { states, sources };
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}
