// Test-only access to the current source. No gameplay source replacement.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const moduleUrl = name => pathToFileURL(realpathSync(
    new URL(`../js/${name}.js`, import.meta.url))).href;
const uhitm = moduleUrl('uhitm'), options = moduleUrl('options');

export async function load(url, context, nextLoad) {
    if (url !== uhitm && url !== options) return nextLoad(url, context);
    let source = readFileSync(new URL(url), 'utf8');
    if (url === options) {
        source = source.replace(/^async function parseoptions_interactive\(/m,
            'export async function parseoptions_interactive(');
    } else {
        for (const name of ['attack_checks', 'hitum', 'known_hitum']) {
            const signature = new RegExp(`async function ${name}\\([^)]*\\)\\s*\\{`, 'g');
            assert.equal([...source.matchAll(signature)].length, 1);
            source = source.replace(signature, match => match
                + `\n    globalThis.__stormbringer_routing_probe?.('${name}');`);
        }
    }
    // Existing static imports, especially the live `game` binding, stay intact.
    return { format: 'module', shortCircuit: true, source };
}
