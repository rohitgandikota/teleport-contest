// Validate source-branch claims against concrete C recorder output.

function stringList(value, field, branch, errors) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        errors.push(branch + ': ' + field + ' must be an array of strings');
        return [];
    }
    return value;
}

export function branchAssertionErrors(recipe, generated = null) {
    const errors = [];
    const assertions = recipe.branchAssertions || [];
    if (!Array.isArray(assertions))
        return ['branchAssertions must be an array'];

    const declared = new Set(recipe.branches || []);
    const asserted = new Set();
    for (const assertion of assertions) {
        const branch = assertion?.branch;
        if (typeof branch !== 'string' || !branch) {
            errors.push('branch assertion needs a non-empty branch');
            continue;
        }
        if (!declared.has(branch))
            errors.push(branch + ': assertion branch is not declared');
        if (asserted.has(branch))
            errors.push(branch + ': duplicate branch assertion');
        asserted.add(branch);

        const rawSegments = assertion.segment;
        const segmentIndexes = Number.isInteger(rawSegments)
            ? [rawSegments]
            : rawSegments;
        if (!Array.isArray(segmentIndexes) || !segmentIndexes.length
            || segmentIndexes.some((index) => !Number.isInteger(index) || index < 0)) {
            errors.push(branch + ': segment must be a non-negative integer or array of them');
            continue;
        }
        const screenIncludes = stringList(
            assertion.screenIncludes, 'screenIncludes', branch, errors);
        const screenExcludes = stringList(
            assertion.screenExcludes, 'screenExcludes', branch, errors);
        const rngIncludes = stringList(
            assertion.rngIncludes, 'rngIncludes', branch, errors);
        if (!screenIncludes.length && !screenExcludes.length && !rngIncludes.length)
            errors.push(branch + ': assertion has no observable condition');

        if (!generated)
            continue;
        const segments = segmentIndexes.map((index) => generated.segments?.[index]);
        const missing = segmentIndexes.filter((_index, position) => !segments[position]);
        if (missing.length) {
            errors.push(branch + ': generated segment ' + missing.join(', ') + ' is missing');
            continue;
        }
        const label = segmentIndexes.length === 1
            ? 'segment ' + segmentIndexes[0]
            : 'segments ' + segmentIndexes.join(', ');
        const screenText = segments.flatMap((segment) => segment.steps || [])
            .map((step) => step.screen || '').join('\n');
        const rngText = segments.flatMap((segment) => segment.steps || [])
            .flatMap((step) => step.rng || []).join('\n');
        for (const text of screenIncludes) {
            if (!screenText.includes(text))
                errors.push(branch + ': ' + label
                            + ' lacks screen text ' + JSON.stringify(text));
        }
        for (const text of screenExcludes) {
            if (screenText.includes(text))
                errors.push(branch + ': ' + label
                            + ' unexpectedly contains ' + JSON.stringify(text));
        }
        for (const text of rngIncludes) {
            if (!rngText.includes(text))
                errors.push(branch + ': ' + label
                            + ' lacks RNG text ' + JSON.stringify(text));
        }
    }

    if (recipe.requireBranchAssertions) {
        for (const branch of declared) {
            if (!asserted.has(branch))
                errors.push(branch + ': declared branch has no assertion');
        }
    }
    return errors;
}
