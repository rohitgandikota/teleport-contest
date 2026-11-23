// Test-only observation of glyph writes and corrupt-state diagnostics.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url !== new URL('../js/display.js', import.meta.url).href)
        return result;
    let source = result.source.toString();
    source = source.replace('    loc.gnew = 1;\n}',
        `    loc.gnew = 1;
    globalThis.__display_monster_cells?.push({x,y,ch,color,attr,
        glyph:{...glyph,glyphnum:gbuf_at(x,y)?.disp_glyphnum ?? GLYPH_UNEXPLORED_OFF}});
}`);
    source = source.replace('impossible(`display_monster:',
        '(globalThis.__display_monster_impossible || impossible)(`display_monster:');
    return {...result, source};
}
