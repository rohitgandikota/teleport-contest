// Validate source-branch claims against concrete C recorder output.

import { decodeScreen } from './screen-decode.mjs';

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
        const screenCells = assertion.screenCells || [];
        if (!Array.isArray(screenCells)) {
            errors.push(branch + ': screenCells must be an array');
        } else {
            for (const cell of screenCells) {
                const validCharacter = typeof cell?.equals === 'string'
                    && Array.from(cell.equals).length === 1;
                if (!Number.isInteger(cell?.step) || cell.step < 0
                    || !Number.isInteger(cell?.x) || cell.x < 0 || cell.x >= 80
                    || !Number.isInteger(cell?.y) || cell.y < 0 || cell.y >= 24
                    || !validCharacter) {
                    errors.push(branch + ': each screen cell needs non-negative '
                                + 'step, x 0..79, y 0..23, and one equals character');
                }
            }
            if (screenCells.length && segmentIndexes.length !== 1)
                errors.push(branch + ': screenCells require exactly one segment');
        }
        if (!screenIncludes.length && !screenExcludes.length && !rngIncludes.length
            && !screenCells.length)
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
        if (segmentIndexes.length === 1 && Array.isArray(screenCells)) {
            const segment = segments[0];
            for (const cell of screenCells) {
                const step = segment.steps?.[cell.step];
                if (!step) {
                    errors.push(branch + ': ' + label + ' has no step ' + cell.step);
                    continue;
                }
                const actual = decodeScreen(step.screen)[cell.y]?.[cell.x];
                if (actual !== cell.equals) {
                    errors.push(branch + ': ' + label + ' step ' + cell.step
                                + ` cell (${cell.x},${cell.y}) is `
                                + JSON.stringify(actual) + ', expected '
                                + JSON.stringify(cell.equals));
                }
            }
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

export function recordingIntegrityErrors(session) {
    const errors = [];
    for (const [segIdx, seg] of (session.segments || []).entries()) {
        for (const [stepIdx, step] of (seg.steps || []).entries()) {
            const cursor = step.cursor;
            if (!Array.isArray(cursor)
                || !Number.isInteger(cursor[0]) || cursor[0] < 0 || cursor[0] >= 80
                || !Number.isInteger(cursor[1]) || cursor[1] < 0 || cursor[1] >= 24) {
                errors.push(`segment ${segIdx} step ${stepIdx} has invalid cursor ${JSON.stringify(cursor)}`);
            }
            if (String(step.screen || '').includes('\x1b]7777;')) {
                errors.push(`segment ${segIdx} step ${stepIdx} contains a leaked recorder marker`);
            }
        }
    }
    return errors;
}
