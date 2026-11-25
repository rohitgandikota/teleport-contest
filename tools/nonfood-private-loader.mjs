// Test-only exports. Runtime bodies, imports and call sites remain unchanged.
import { registerHooks } from 'node:module';

registerHooks({
    load(url, context, nextLoad) {
        const loaded = nextLoad(url, context);
        if (!url.endsWith('/js/eat.js'))
            return loaded;
        const source = String(loaded.source);
        const names = ['foodword', 'rottenfood', 'bounded_increase',
            'accessory_has_effect', 'eataccessory', 'eatspecial', 'doeat_nonfood']
            .filter(name => new RegExp(`^(?:async )?function ${name}\\(`, 'm').test(source));
        return { ...loaded, source: `${source}\nexport { ${names.join(', ')} };\n` };
    },
});
