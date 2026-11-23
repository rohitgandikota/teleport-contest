// Expose the C-named effects without changing their bodies or dependencies.
export async function load(url, context, nextLoad) {
    const result = await nextLoad(url, context);
    if (url !== new URL('../js/read.js', import.meta.url).href)
        return result;
    return {...result, source:String(result.source) + '\nexport { seffect_charging, seffect_earth, '
        + 'seffect_scare_monster, seffect_create_monster, '
        + 'seffect_enchant_armor, seffect_teleportation };\n'};
}
