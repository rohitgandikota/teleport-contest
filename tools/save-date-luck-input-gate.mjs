// Ordinary save/resume commands exercise startup and persisted date luck.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runSegment } from '../js/jsmain.js';
import { game } from '../js/gstate.js';
import { InMemoryStorage } from '../js/storage.js';
import { FULL_MOON } from '../js/const.js';

const paths = ['full-moon', 'friday-13', 'ordinary'].map(name =>
    new URL(`gen-sessions/generated/save-date-${name}.session.json`, import.meta.url));
for (const [index, path] of paths.entries()) {
    test(path.pathname.split('/').at(-1), async () => {
        const recording = JSON.parse(readFileSync(path));
        assert.equal(recording.source, 'c');
        assert.equal(recording.segments.length, 2);
        const storage = new InMemoryStorage();
        for (const [part, segment] of recording.segments.entries()) {
            const run = await runSegment({ ...segment, storage });
            assert.equal(run.getScreens().length, segment.steps.length);
            assert.equal(run.getRngLog().length,
                segment.steps.reduce((n, step) => n + step.rng.length, 0));
            assert.equal(game.flags.moonphase === FULL_MOON, index === 0);
            assert.equal(!!game.flags.friday13, index === 1);
            if (part === 0) {
                assert.equal(game.u.uluck, 0, 'saved game has no startup date adjustment');
                assert.ok(storage.getItem('save:wizard'), 'ordinary S command writes the save');
            } else {
                assert.equal(game.u.uluck, [1, -1, 0][index]);
                assert.equal(game.u.uhp, 12, 'the hero resumes alive');
                assert.equal(storage.getItem('save:wizard'), null,
                    'answering no to keep-save removes the restored save');
            }
        }
    });
}
