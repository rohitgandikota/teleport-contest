const put = (id, type, x = 10, y = 10, quan = 8) => ({ op: 'put', id, type, x, y, quan });
const replace = (old, id, type) => ({ op: 'replace', old, id, type });
const split = (old, id, num = 2) => ({ op: 'split', old, id, num });
const remove = id => ({ op: 'remove', id });
const recreate = (x = 10, y = 10) => ({ op: 'recreate', x, y });
const restore = () => ({ op: 'restore' });
const ambiguous = [put(1, 'BOULDER'), put(2, 'DAGGER'), replace(1, 3, 'ROCK')];
const outOfOrder = [put(1, 'ROCK'), put(2, 'DAGGER'), replace(1, 3, 'BOULDER')];

export const cases = [
    {
        name: 'empty',
        actions: []
    },
    {
        name: 'single-boulder',
        actions: [put(1, 'BOULDER')]
    },
    {
        name: 'ordinary-newest-first',
        actions: [put(1, 'ROCK'), put(2, 'DAGGER'), put(3, 'APPLE')]
    },
    {
        name: 'boulder-then-dagger',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER')]
    },
    {
        name: 'dagger-then-boulder',
        actions: [put(1, 'DAGGER'), put(2, 'BOULDER')]
    },
    {
        name: 'all-boulders-before-new-items',
        actions: [put(1, 'BOULDER'), put(2, 'BOULDER'), put(3, 'DAGGER'), put(4, 'APPLE')]
    },
    {
        name: 'alternating-placements',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'BOULDER'), put(4, 'APPLE')]
    },
    {
        name: 'other-square-interleaving',
        actions: [
            put(1, 'BOULDER'),
            put(2, 'BOULDER', 11, 10),
            put(3, 'DAGGER'),
            put(4, 'ROCK', 12, 10)
        ]
    },
    {
        name: 'remove-top-boulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'BOULDER'), remove(3)]
    },
    {
        name: 'remove-last-boulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'APPLE'), remove(1)]
    },
    {
        name: 'remove-ordinary-item',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'APPLE'), remove(2)]
    },
    {
        name: 'move-boulder-away',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), remove(1), put(1, 'BOULDER', 11, 10)]
    },
    {
        name: 'reinsert-nonboulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'APPLE'), remove(2), put(2, 'DAGGER')]
    },
    {
        name: 'replace-ordinary-item',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'APPLE'), replace(2, 4, 'ROCK')]
    },
    {
        name: 'replace-boulder-with-boulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), replace(1, 3, 'BOULDER')]
    },
    {
        name: 'same-flat-list-ordinary-history',
        actions: [put(3, 'ROCK'), put(2, 'DAGGER')]
    },
    {
        name: 'boulder-replaced-by-rock',
        actions: ambiguous
    },
    {
        name: 'ordinary-replaced-by-boulder-before-restack',
        actions: outOfOrder
    },
    {
        name: 'split-divergent-local-slot',
        actions: [...ambiguous, split(3, 4)]
    },
    {
        name: 'split-boulder-under-boulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'BOULDER'), split(1, 4)]
    },
    {
        name: 'split-nonboulder-remove-parent',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), split(2, 3), remove(2)]
    },
    {
        name: 'replace-middle-independent-slots',
        actions: [
            put(1, 'BOULDER'),
            put(2, 'DAGGER'),
            put(3, 'APPLE'),
            split(1, 4),
            replace(4, 5, 'ROCK')
        ]
    },
    {
        name: 'replace-then-remove-local-head',
        actions: [...ambiguous, remove(3)]
    },
    {
        name: 'replace-then-remove-global-head',
        actions: [...ambiguous, remove(2)]
    },
    {
        name: 'recreate-no-boulders',
        actions: [...ambiguous, recreate()]
    },
    {
        name: 'recreate-out-of-order-boulder',
        actions: [...outOfOrder, recreate()]
    },
    {
        name: 'recreate-interleaved-other-squares',
        actions: [...outOfOrder, put(4, 'APPLE', 11, 10), put(5, 'ROCK', 10, 11), recreate()]
    },
    {
        name: 'recreate-empty-square',
        actions: [put(1, 'DAGGER', 11, 10), recreate()]
    },
    {
        name: 'restore-ambiguous-history',
        actions: [...ambiguous, restore()]
    },
    {
        name: 'stone-to-flesh-chain-and-restore',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), replace(1, 3, 'ENORMOUS_MEATBALL'), restore()]
    },
    {
        name: 'restore-boulder-tail',
        actions: [...outOfOrder, restore()]
    },
    {
        name: 'restore-split-and-interleaving',
        actions: [...ambiguous, split(3, 4), put(5, 'APPLE', 11, 10), restore()]
    },
    {
        name: 'restore-then-replace-and-split',
        actions: [...outOfOrder, restore(), replace(3, 4, 'ROCK'), split(4, 5)]
    },
    {
        name: 'extract-local-before-global',
        actions: [...ambiguous, { op: 'extract', id: 3 }, put(3, 'ROCK', 11, 10)]
    },
    {
        name: 'exhaust-and-reuse-square',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), remove(2), remove(1), put(1, 'BOULDER')]
    },
    {
        name: 'bhitpile-retains-local-order',
        actions: [...ambiguous, { op: 'hit', mode: 0 }]
    },
    {
        name: 'bhitpile-removes-current',
        actions: [...ambiguous, { op: 'hit', mode: 1 }]
    },
    {
        name: 'bhitpile-inserts-after-future-item',
        actions: [put(1, 'ROCK'), put(2, 'DAGGER'), put(3, 'APPLE'), { op: 'hit', mode: 2 }]
    },
    {
        name: 'bhitpile-replaces-current-skips-new-object',
        actions: [put(1, 'DAGGER'), put(2, 'BOULDER'), { op: 'hit', mode: 3 }]
    },
    {
        name: 'bhitpile-restacks-surviving-boulder',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), put(3, 'BOULDER'), { op: 'hit', mode: 4 }]
    },
    {
        name: 'bhitpile-restacks-tail-boulder',
        actions: [...outOfOrder, { op: 'hit', mode: 0 }]
    },
    {
        name: 'bhitpile-hiding-zap-up-top-only',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), { op: 'hit', mode: 0, zz: -1, hide: true }]
    },
    {
        name: 'bhitpile-hiding-zap-down-skips-top',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), { op: 'hit', mode: 0, zz: 1, hide: true }]
    },
    {
        name: 'bhitpile-hiding-horizontal-hits-all',
        actions: [put(1, 'BOULDER'), put(2, 'DAGGER'), { op: 'hit', mode: 0, zz: 0, hide: true }]
    }
];

// Bounded deterministic histories exercise independent local/global slots.
// Their expected states come from C, never from a JS ordering algorithm.
let seed = 0x31c07;
const rnd = n => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
};
for (let c = 0; c < 24; c++) {
    const actions = [];
    const live = [];
    let next = 1;
    for (let step = 0; step < 20; step++) {
        const kind = rnd(5);
        if (!live.length || kind === 0) {
            const id = next++;
            const type = ['BOULDER', 'DAGGER', 'ROCK', 'APPLE'][rnd(4)];
            actions.push(put(id, type, 10 + rnd(2), 10 + rnd(2)));
            live.push(id);
        } else if (kind === 1) {
            const i = rnd(live.length);
            const old = live[i];
            const id = next++;
            const type = ['BOULDER', 'DAGGER', 'ROCK'][rnd(3)];
            actions.push(replace(old, id, type));
            live[i] = id;
        } else if (kind === 2) {
            const i = rnd(live.length);
            actions.push(remove(live[i]));
            live.splice(i, 1);
        } else if (kind === 3) {
            actions.push(recreate(10 + rnd(2), 10 + rnd(2)));
        } else {
            actions.push(restore());
        }
    }
    cases.push({ name: `mixed-history-${c}`, actions });
}
