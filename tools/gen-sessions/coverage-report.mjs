#!/usr/bin/env node
// Build the supplemental-session coverage report from declared recipe tags.
// Tags state scenario intent. C RNG annotations and frozen-runner scores remain
// the evidence that a generated trace is real and that the JS port matches it.

import {
    readFileSync, readdirSync, existsSync, writeFileSync,
} from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { branchAssertionErrors } from './assertions.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RECIPES = join(HERE, 'recipes');
const GENERATED = join(HERE, 'generated');
const REQUIREMENTS = join(HERE, 'coverage-requirements.json');
const BRANCH_REQUIREMENTS = join(HERE, 'branch-requirements.json');
const OUT = join(ROOT, 'docs', 'plan', 'supplemental-coverage.md');
const RNG_ANNOTATION = /@\s*([A-Za-z0-9_]+)\(([A-Za-z0-9_.]+):(\d+)\)\s*$/;

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function sessionFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((name) => name.endsWith('.session.json'))
        .sort()
        .map((name) => join(dir, name));
}

function scanAnnotations(dir) {
    const files = new Set();
    const functions = new Set();
    let sessions = 0;
    let steps = 0;
    let calls = 0;
    for (const path of sessionFiles(dir)) {
        sessions += 1;
        const session = readJson(path);
        for (const segment of session.segments || []) {
            for (const step of segment.steps || []) {
                steps += 1;
                for (const entry of step.rng || []) {
                    const match = RNG_ANNOTATION.exec(entry);
                    if (!match) continue;
                    calls += 1;
                    files.add(match[2]);
                    functions.add(`${match[2]}:${match[1]}`);
                }
            }
        }
    }
    return { sessions, steps, calls, files, functions };
}

function recipeMode(recipe) {
    const modes = new Set((recipe.segments || []).map((segment) =>
        /playmode:debug/.test(segment.nethackrc || '') ? 'debug' : 'normal'));
    return [...modes].sort().join('+');
}

function verifyGenerated(recipe) {
    const path = join(GENERATED, `${recipe.name}.session.json`);
    if (!existsSync(path)) return { present: false, reason: 'missing' };
    const generated = readJson(path);
    const expectedCoverage = [...new Set(recipe.coverage)].sort();
    const actualCoverage = [...(generated.coverage || [])].sort();
    if (JSON.stringify(actualCoverage) !== JSON.stringify(expectedCoverage)) {
        return { present: false, reason: 'coverage metadata differs' };
    }
    const expectedBranches = [...new Set(recipe.branches || [])].sort();
    const actualBranches = [...(generated.branches || [])].sort();
    if (JSON.stringify(actualBranches) !== JSON.stringify(expectedBranches)) {
        return { present: false, reason: 'branch metadata differs' };
    }
    if (JSON.stringify(generated.branchAssertions || [])
        !== JSON.stringify(recipe.branchAssertions || [])) {
        return { present: false, reason: 'branch assertion metadata differs' };
    }
    if (!!generated.requireBranchAssertions !== !!recipe.requireBranchAssertions) {
        return { present: false, reason: 'branch assertion policy differs' };
    }
    if ((generated.segments || []).length !== recipe.segments.length) {
        return { present: false, reason: 'segment count differs' };
    }
    for (let index = 0; index < recipe.segments.length; index += 1) {
        const expected = recipe.segments[index];
        const actual = generated.segments[index];
        for (const field of ['seed', 'datetime', 'nethackrc', 'moves']) {
            if (actual[field] !== expected[field]) {
                return { present: false, reason: `segment ${index} ${field} differs` };
            }
        }
        if (!Array.isArray(actual.steps) || actual.steps.length === 0) {
            return { present: false, reason: `segment ${index} has no C steps` };
        }
    }
    const assertionErrors = branchAssertionErrors(recipe, generated);
    if (assertionErrors.length)
        return { present: false, reason: assertionErrors[0] };
    return { present: true, reason: 'C trace present' };
}

const config = readJson(REQUIREMENTS);
const requirements = config.requirements || [];
const byId = new Map();
for (const requirement of requirements) {
    if (byId.has(requirement.id)) throw new Error(`duplicate requirement ${requirement.id}`);
    byId.set(requirement.id, requirement);
}

const branchConfig = readJson(BRANCH_REQUIREMENTS);
const branchRequirements = branchConfig.requirements || [];
const branchById = new Map();
for (const requirement of branchRequirements) {
    if (branchById.has(requirement.id))
        throw new Error(`duplicate branch requirement ${requirement.id}`);
    const cPath = join(ROOT, 'nethack-c', 'upstream', requirement.cFile || '');
    if (!existsSync(cPath))
        throw new Error(`${requirement.id}: missing C source ${requirement.cFile}`);
    if (!readFileSync(cPath, 'utf8').includes(requirement.cFunction))
        throw new Error(`${requirement.id}: C function ${requirement.cFunction} not found`);
    branchById.set(requirement.id, requirement);
}

const recipes = readdirSync(RECIPES)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
        const recipe = readJson(join(RECIPES, name));
        if (recipe.name !== basename(name, '.json')) {
            throw new Error(`${name}: recipe name is ${recipe.name}`);
        }
        if (!Array.isArray(recipe.coverage)) {
            throw new Error(`${name}: coverage must be an array`);
        }
        const coverage = [...new Set(recipe.coverage)].sort();
        for (const tag of coverage) {
            if (!byId.has(tag)) throw new Error(`${name}: unknown coverage tag ${tag}`);
        }
        const branches = [...new Set(recipe.branches || [])].sort();
        for (const branch of branches) {
            if (!branchById.has(branch))
                throw new Error(`${name}: unknown branch tag ${branch}`);
        }
        return {
            ...recipe,
            coverage,
            branches,
            mode: recipeMode(recipe),
            keys: recipe.segments.reduce((sum, segment) => sum + segment.moves.length, 0),
            generated: verifyGenerated(recipe),
        };
    });

const coverageByTag = new Map(requirements.map((requirement) => [requirement.id, []]));
for (const recipe of recipes) {
    for (const tag of recipe.coverage) coverageByTag.get(tag).push(recipe);
}
const coverageByBranch = new Map(branchRequirements.map((requirement) => [requirement.id, []]));
for (const recipe of recipes) {
    for (const branch of recipe.branches) coverageByBranch.get(branch).push(recipe);
}

function requirementStatus(requirement) {
    if (requirement.kind === 'static') {
        return { status: 'covered', evidence: ['tools/game-inventory.mjs'] };
    }
    const evidence = coverageByTag.get(requirement.id) || [];
    const enough = evidence.length >= (requirement.minimumSessions || 1);
    const hasNormal = !requirement.normalModeRequired
        || evidence.some((recipe) => recipe.mode.includes('normal'));
    const allGenerated = evidence.every((recipe) => recipe.generated.present);
    const status = enough && hasNormal && allGenerated
        ? 'covered'
        : evidence.length > 0 ? 'partial' : 'gap';
    return { status, evidence: evidence.map((recipe) => recipe.name) };
}

const evaluated = requirements.map((requirement) => ({
    ...requirement,
    ...requirementStatus(requirement),
}));
const evaluatedBranches = branchRequirements.map((requirement) => {
    const evidence = coverageByBranch.get(requirement.id) || [];
    const enough = evidence.length >= (requirement.minimumSessions || 1);
    const allGenerated = evidence.every((recipe) => recipe.generated.present);
    return {
        ...requirement,
        status: enough && allGenerated ? 'covered'
            : evidence.length ? 'partial' : 'gap',
        evidence: evidence.map((recipe) => recipe.name),
    };
});

const summary = Object.fromEntries(['covered', 'partial', 'gap'].map((status) => [
    status, evaluated.filter((entry) => entry.status === status).length,
]));
const branchSummary = Object.fromEntries(['covered', 'partial', 'gap'].map((status) => [
    status, evaluatedBranches.filter((entry) => entry.status === status).length,
]));
const publicStats = scanAnnotations(join(ROOT, 'sessions'));
const supplementalStats = scanAnnotations(GENERATED);
const unionFiles = new Set([...publicStats.files, ...supplementalStats.files]);
const unionFunctions = new Set([...publicStats.functions, ...supplementalStats.functions]);
const groups = [...new Set(requirements.map((requirement) => requirement.group))];

const lines = [];
lines.push('# Supplemental C-reference coverage');
lines.push('');
lines.push('Generated by `node tools/gen-sessions/coverage-report.mjs`.');
lines.push('');
lines.push('Recipe tags state the intended behavior of a scenario. A `covered` row');
lines.push('means the required number and mode of C-recorded scenarios exist. It does');
lines.push('not mean the JavaScript port passes them. Static rows are checked by');
lines.push('`node tools/game-inventory.mjs`. Dynamic parity is measured by the frozen');
lines.push('runner. RNG annotations only observe C functions that draw randomness.');
lines.push('');
lines.push(`Requirements: **${evaluated.length}**. Covered: **${summary.covered}**.`);
lines.push(`Partial: **${summary.partial}**. Gaps: **${summary.gap}**.`);
lines.push('');
lines.push(`Branch requirements: **${evaluatedBranches.length}**. Covered: **${branchSummary.covered}**.`);
lines.push(`Partial: **${branchSummary.partial}**. Gaps: **${branchSummary.gap}**.`);
lines.push('');
lines.push('## Corpus inventory');
lines.push('');
lines.push('| Corpus | Sessions | Steps | Annotated RNG calls | C files observed | C functions observed |');
lines.push('|---|---:|---:|---:|---:|---:|');
lines.push(`| Public | ${publicStats.sessions} | ${publicStats.steps} | ${publicStats.calls} | ${publicStats.files.size} | ${publicStats.functions.size} |`);
lines.push(`| Supplemental | ${supplementalStats.sessions} | ${supplementalStats.steps} | ${supplementalStats.calls} | ${supplementalStats.files.size} | ${supplementalStats.functions.size} |`);
lines.push(`| Union | ${publicStats.sessions + supplementalStats.sessions} | ${publicStats.steps + supplementalStats.steps} | ${publicStats.calls + supplementalStats.calls} | ${unionFiles.size} | ${unionFunctions.size} |`);
lines.push('');

for (const group of groups) {
    lines.push(`## ${group}`);
    lines.push('');
    lines.push('| Status | Requirement | Criterion | Evidence |');
    lines.push('|---|---|---|---|');
    for (const requirement of evaluated.filter((entry) => entry.group === group)) {
        const evidence = requirement.evidence.length
            ? requirement.evidence.map((name) => `\`${name}\``).join(', ')
            : 'none';
        const criterion = requirement.kind === 'static'
            ? 'static inventory gate'
            : `${requirement.minimumSessions || 1} session(s)`
                + (requirement.normalModeRequired ? ', including normal mode' : '');
        lines.push(`| ${requirement.status} | \`${requirement.id}\` | ${criterion} | ${evidence} |`);
    }
    lines.push('');
}

lines.push('## Branch-level oracle ledger');
lines.push('');
lines.push('Branch rows name a concrete C decision and require a generated C trace');
lines.push('that deliberately reaches it. This ledger starts with shops and counted');
lines.push('object menus, then grows subsystem by subsystem. A gap is an explicit test');
lines.push('target, not evidence that the JavaScript behavior is wrong.');
lines.push('');
for (const group of [...new Set(branchRequirements.map((entry) => entry.group))]) {
    lines.push(`### ${group}`);
    lines.push('');
    lines.push('| Status | Branch | C source | Evidence |');
    lines.push('|---|---|---|---|');
    for (const requirement of evaluatedBranches.filter((entry) => entry.group === group)) {
        const evidence = requirement.evidence.length
            ? requirement.evidence.map((name) => `\`${name}\``).join(', ')
            : 'none';
        lines.push(`| ${requirement.status} | \`${requirement.id}\` | \`${requirement.cFile}:${requirement.cFunction}\` | ${evidence} |`);
    }
    lines.push('');
}

lines.push('## Scenario index');
lines.push('');
lines.push('| Scenario | Mode | Keys | C trace | Declared coverage |');
lines.push('|---|---|---:|---|---|');
for (const recipe of recipes) {
    const trace = recipe.generated.present ? 'present' : recipe.generated.reason;
    lines.push(`| \`${recipe.name}\` | ${recipe.mode} | ${recipe.keys} | ${trace} | ${recipe.coverage.map((tag) => `\`${tag}\``).join(', ')} |`);
}
lines.push('');

lines.push('## Open gaps');
lines.push('');
for (const requirement of evaluated.filter((entry) => entry.status !== 'covered')) {
    lines.push(`- **${requirement.status}:** \`${requirement.id}\`: ${requirement.description}`);
}
for (const requirement of evaluatedBranches.filter((entry) => entry.status !== 'covered')) {
    lines.push(`- **branch ${requirement.status}:** \`${requirement.id}\`: ${requirement.description}`);
}
lines.push('');

const text = `${lines.join('\n').trimEnd()}\n`;
if (process.argv.includes('--stdout')) {
    process.stdout.write(text);
} else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT}`);
    console.log(`coverage: ${summary.covered} covered, ${summary.partial} partial, ${summary.gap} gaps`);
    console.log(`branches: ${branchSummary.covered} covered, ${branchSummary.partial} partial, ${branchSummary.gap} gaps`);
}

if (process.argv.includes('--strict') && (summary.partial || summary.gap)) {
    process.exitCode = 1;
}
if (process.argv.includes('--branch-strict')
    && (branchSummary.partial || branchSummary.gap)) {
    process.exitCode = 1;
}
