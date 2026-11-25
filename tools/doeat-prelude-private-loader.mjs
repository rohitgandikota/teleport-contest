// Expose private owners only. No body, import or call-site substitution.
import { registerHooks } from 'node:module';
registerHooks({
    load(url, context, nextLoad) {
        const loaded = nextLoad(url, context);
        if (!url.endsWith('/js/eat.js'))
            return loaded;
        const source = String(loaded.source);
        const names = ['edibility_prompts', 'nonrotting_corpse'].filter(name =>
            new RegExp(`^(?:(?:async )?function |const )${name}\\b`, 'm').test(source));
        return { ...loaded, source: `${source}\nexport { ${names.join(', ')} };\n` };
    },
});
