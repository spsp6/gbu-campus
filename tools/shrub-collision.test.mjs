// AI-assisted regression checks; browser observations must still be recorded by the student.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { build } from '../shared/campus-world.js';
import { CampusGame } from '../night/src/game.js';

const day = build(new THREE.Scene(), null);
const night = build(new THREE.Scene(), null, { night: true });
const shrubs = day.colliders.filter(c => c.id === 'shrub');
const radius = .34;

function blocked(world, x, z) {
  return world.colliders.some(c => x > c.minX-radius && x < c.maxX+radius &&
    z > c.minZ-radius && z < c.maxZ+radius);
}

test('both modes share solid shrubs and keep routes, stations and track clear', () => {
  assert.ok(shrubs.length > 0);
  assert.deepEqual(night.colliders, day.colliders);
  for (const world of [day, night]) {
    assert.deepEqual(world.diagnostics.routeConflicts, []);
    assert.deepEqual(world.diagnostics.stationConflicts, []);
    assert.deepEqual(world.diagnostics.trackConflicts, []);
    assert.equal(world.isWalkable(world.spawn.x, world.spawn.z), true);
    for (const c of shrubs) {
      const x = (c.minX+c.maxX)/2, z = (c.minZ+c.maxZ)/2;
      assert.equal(world.isWalkable(x, z), false);
      assert.equal(blocked(world, x, z), true);
    }
  }
});

test('night movement cannot enter shrubs from any reachable side in the full world', () => {
  let checked=0;
  for (const c of shrubs) {
    const x = (c.minX+c.maxX)/2, z = (c.minZ+c.maxZ)/2;
    const approaches = [
      [c.minX-radius-.02, z, .08, 0],
      [c.maxX+radius+.02, z, -.08, 0],
      [x, c.minZ-radius-.02, 0, .08],
      [x, c.maxZ+radius+.02, 0, -.08],
    ];
    for (const [px, pz, dx, dz] of approaches) {
      const game = {world: night, player: {x: px, z: pz}, blocked: CampusGame.prototype.blocked};
      // Adjacent shrubs can overlap; do not start a simulated player inside another solid.
      if (game.blocked(px, pz)) continue;
      checked++;
      for (let i=0; i<120; i++) CampusGame.prototype.move.call(game, dx, dz);
      assert.equal(game.player.x, px);
      assert.equal(game.player.z, pz);
    }
  }
  assert.ok(checked >= shrubs.length*3);
});

test('each isolated shrub permits perimeter movement without an oversized blocking zone', () => {
  // Neighbouring scenery can prevent a full loop in the actual campus layout.
  for (const c of shrubs) {
    const world={bounds:day.bounds,colliders:[c]};
    const margin = radius+.1;
    const corners = [
      [c.minX-margin,c.minZ-margin], [c.maxX+margin,c.minZ-margin],
      [c.maxX+margin,c.maxZ+margin], [c.minX-margin,c.maxZ+margin],
    ];
    for (let side=0; side<4; side++) {
      const a=corners[side], b=corners[(side+1)%4];
      const game = {world, player: {x:a[0],z:a[1]}, blocked: CampusGame.prototype.blocked};
      for (let i=1; i<=100; i++) {
        const x=a[0]+(b[0]-a[0])*i/100, z=a[1]+(b[1]-a[1])*i/100;
        assert.equal(blocked(world,x,z), false);
        CampusGame.prototype.move.call(game,x-game.player.x,z-game.player.z);
        assert.ok(Math.abs(game.player.x-x)<1e-9 && Math.abs(game.player.z-z)<1e-9);
      }
    }
  }
});
