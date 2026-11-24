// Closed-result proof for C vision.c:2152-2186 and pager.c:481-551.
// This enumerates the producer's result domain, not 128 reachable game states.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parse} from './node_modules/acorn/dist/acorn.mjs';
import {howmonseen} from '../js/vision.js';
import * as constants from '../js/const.js';

const names = ['MONSEEN_NORMAL','MONSEEN_SEEINVIS','MONSEEN_INFRAVIS',
    'MONSEEN_TELEPAT','MONSEEN_XRAYVIS','MONSEEN_DETECT','MONSEEN_WARNMON'];

test('actual howmonseen has a local zero result and only seven constant OR writes', () => {
    const ast = parse(howmonseen.toString(), {ecmaVersion:'latest'});
    const owner = ast.body[0];
    assert.equal(owner.type, 'FunctionDeclaration');
    assert.equal(owner.async, false);
    assert.equal(owner.generator, false);
    let declarations = 0, returns = 0;
    const writes = [];
    function walk(node, parent) {
        if (!node || typeof node !== 'object') return;
        assert.ok(!['FunctionExpression','ArrowFunctionExpression','WithStatement'].includes(node.type));
        if (node.type === 'FunctionDeclaration') assert.equal(node, owner);
        if (node.type === 'CallExpression') assert.notEqual(node.callee?.name, 'eval');
        if (node.type === 'ReturnStatement') {
            assert.equal(node.argument?.type, 'Identifier');
            assert.equal(node.argument.name, 'how_seen');
            returns++;
        }
        if (node.type === 'Identifier' && node.name === 'how_seen') {
            if (parent.type === 'VariableDeclarator' && parent.id === node) {
                assert.equal(parent.init.type, 'Literal');
                assert.equal(parent.init.value, 0);
                declarations++;
            } else if (parent.type === 'AssignmentExpression' && parent.left === node) {
                assert.equal(parent.operator, '|=');
                assert.equal(parent.right.type, 'Identifier');
                assert.ok(names.includes(parent.right.name));
                writes.push(parent.right.name);
            } else {
                assert.equal(parent.type, 'ReturnStatement', 'result must not escape or be overwritten');
                assert.equal(parent.argument, node);
            }
        }
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(child=>walk(child,node));
            else if (value && typeof value === 'object') walk(value,node);
        }
    }
    walk(owner, null);
    assert.equal(declarations, 1);
    assert.equal(returns, 1);
    assert.deepEqual(writes, names);
    assert.deepEqual(names.map(name=>constants[name]), [1,2,4,8,16,32,64]);
    for (let mask=0; mask<128; mask++) {
        let remainder = mask;
        for (const name of names) remainder &= ~constants[name];
        assert.equal(remainder, 0);
    }
});
