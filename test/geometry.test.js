'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { route, WIDTH, HEIGHT, GAP_X, GAP_Y } = require('../media/geometry');
test('routes use only orthogonal segments and anchor to box borders', () => {
  assert.equal(route({ x: 0, y: 0 }, { x: 400, y: 250 }), 'M190,55 H295 V305 H400');
  assert.equal(route({ x: 400, y: 250 }, { x: 0, y: 0 }), 'M400,305 H295 V55 H190');
  assert.equal(route({ x: 0, y: 0 }, { x: 0, y: 250 }), 'M95,110 V180 H95 V250');
  for (const target of [{ x: 0, y: -250 }, { x: 40, y: 20 }, { x: -400, y: 250 }]) assert.match(route({ x: 0, y: 0 }, target), /^M[-\d,.]+ [HV\d\s,.-]+$/);
  assert.ok(GAP_X - WIDTH >= 200);
  assert.ok(GAP_Y - HEIGHT >= 130);
});
test('long vertical edges bypass intermediate boxes', () => {
  const a = { x: 0, y: 500 }, b = { x: 0, y: 0 }, obstacle = { x: 0, y: 250 };
  assert.equal(route(a, b, [a, b, obstacle]), 'M190,555 H260 V55 H190');
});
