// Expose the complete private owner only to constructed state controls.
import { registerHooks } from 'node:module';

const owner = new URL('../js/cmd.js', import.meta.url).href;
registerHooks({
    load(url, context, nextLoad) {
        const result = nextLoad(url, context);
        if (url === owner)
            return { ...result, source: String(result.source)
                + '\nexport { domove_swap_with_pet };\n' };
        return result;
    },
});
