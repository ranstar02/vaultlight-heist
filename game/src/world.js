// Vaultlight — the world: the museum at night, its rooms and routes, and the
// one fixed-step advance that runs the whole heist. Three routes cross the
// floor: the grand hall (fast, open, watched), the west corridor (narrow,
// one guard) and the north vent (slow, hidden). The thief starts at the
// street door, steals the Meridian Diamond, and escapes to the van.

import {
  ALARM, FIELD, GUARD, PLAYER, STEP, TOOLS, clamp, dist2, pointInRect,
} from './config.js';
import { createCamera, disableAllCameras, updateCamera } from './cameras.js';
import { GUARD_CHASE, GUARD_SUSPICIOUS, createGuard, updateGuard } from './guards.js';
import { VAULT, createCases, createLasers, inShadow, inVent, updateLoot } from './loot.js';

export const EVENT_CAUGHT = 1;
export const EVENT_ESCAPED = 2;
export const EVENT_DIAMOND = 4;
export const EVENT_CASE = 8;
export const EVENT_ALARM_HIGH = 16;

const START = { x: 640, y: 742 };
const EXIT = { x: 600, y: 728, w: 80, h: 42 };

/**
 * The museum floor. Walls are solid rectangles; shadows are deep-blue cover
 * where a thief is hard to spot; the vent is a hidden crawlspace along the
 * north wall. The vault pedestal sits in the middle of the grand hall.
 */
export function buildMuseum() {
  const walls = [
    // Outer shell (the bottom wall leaves a gap for the street door).
    { x: 0, y: 0, w: 1280, h: 24 },
    { x: 0, y: 0, w: 24, h: 800 },
    { x: 1256, y: 0, w: 24, h: 800 },
    { x: 0, y: 776, w: 600, h: 24 },
    { x: 680, y: 776, w: 600, h: 24 },
    // West corridor walls: a narrow passage down the left side.
    { x: 300, y: 120, w: 24, h: 520 },
    { x: 300, y: 120, w: 260, h: 24 },
    { x: 300, y: 640, w: 260, h: 24 },
    // East gallery wall with a doorway gap in the middle; the top wall
    // leaves a 34 px gap so the vent lets out into the gallery, and the
    // west wall starts at y=200 so the vent exit shaft (x 956..990) is
    // open from the vent down to the gallery floor.
    { x: 956, y: 200, w: 24, h: 120 },
    { x: 956, y: 440, w: 24, h: 200 },
    { x: 990, y: 120, w: 266, h: 24 },
    { x: 956, y: 640, w: 300, h: 24 },
    // Freestanding pillars in the grand hall (cover, and they block sight).
    { x: 470, y: 180, w: 34, h: 34 },
    { x: 776, y: 180, w: 34, h: 34 },
    { x: 470, y: 556, w: 34, h: 34 },
    { x: 776, y: 556, w: 34, h: 34 },
    // The vault pedestal block (walk around it, not through it).
    { x: VAULT.x - 22, y: VAULT.y - 22, w: 44, h: 44 },
  ];
  const shadows = [
    { x: 40, y: 140, w: 240, h: 90, label: 'west alcove' },
    { x: 40, y: 540, w: 240, h: 190, label: 'west alcove' },
    { x: 990, y: 300, w: 240, h: 120, label: 'east gallery' },
    { x: 560, y: 660, w: 160, h: 90, label: 'foyer shadow' },
  ];
  const vents = [
    { x: 330, y: 52, w: 620, h: 46 },
  ];
  return { walls, shadows, vents };
}

function createPlayer() {
  return {
    x: START.x, y: START.y,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    inVent: false,
    inShadow: false,
    movedThisStep: false,
    moving: false,
  };
}

/** A fresh heist: thief at the door, guards on patrol, alarm at zero. */
export function createWorld(seed) {
  const museum = buildMuseum();
  void seed;
  const state = {
    time: 0,
    player: createPlayer(),
    guards: [
      createGuard([
        { x: 430, y: 330 }, { x: 640, y: 300 }, { x: 850, y: 330 },
        { x: 850, y: 470 }, { x: 640, y: 500 }, { x: 430, y: 470 },
      ], 1.2),
      createGuard([
        { x: 160, y: 180 }, { x: 160, y: 600 },
      ], 1.6),
      createGuard([
        { x: 1060, y: 300 }, { x: 1180, y: 300 }, { x: 1180, y: 520 }, { x: 1060, y: 520 },
      ], 1.0),
    ],
    cameras: [
      createCamera(360, 40, 0.5, 1.9, 0),
      createCamera(920, 40, 1.25, 2.65, 2.1),
    ],
    lasers: createLasers(),
    cases: createCases(),
    walls: museum.walls,
    shadows: museum.shadows,
    vents: museum.vents,
    smokes: [],
    alarm: 0,
    lootValue: 0,
    hasDiamond: false,
    lockpick: 0,
    smokeLeft: TOOLS.smokeCount,
    empLeft: TOOLS.empCount,
    caught: false,
    caughtReason: '',
    escaped: false,
    events: 0,
  };
  return { state, step, reset };

  /** Reset the world to a fresh heist (same seed, same layout). */
  function reset() {
    const fresh = createWorld(1);
    for (const key of Object.keys(fresh.state)) state[key] = fresh.state[key];
  }

  /**
   * Advance the heist one fixed step. `move` is {x, y} (unit-ish) from the
   * keys or a click target, `tools` carries one-shot tool requests. Returns
   * the event flags raised this step.
   */
  function step(move, tools, dt = STEP) {
    state.events = 0;
    if (state.caught || state.escaped) return 0;
    state.time += dt;

    // Tools first: smoke breaks line of sight, EMP kills the cameras.
    if (tools && tools.smoke && state.smokeLeft > 0) {
      state.smokeLeft -= 1;
      state.smokes.push({ x: state.player.x, y: state.player.y, radius: TOOLS.smokeRadius, left: TOOLS.smokeSeconds });
      state.events |= 32; // EVENT_SMOKE
      // A guard chasing through the smoke loses the trail outright and
      // falls back to suspicion instead of marching to the last place it
      // saw the thief: standing still in the smoke would otherwise be a
      // death sentence while it closes in.
      for (const guard of state.guards) {
        if (guard.state === GUARD_CHASE) {
          guard.state = GUARD_SUSPICIOUS;
          guard.stateTime = 0;
          guard.unseenSeconds = 0;
        }
      }
    }
    if (tools && tools.emp && state.empLeft > 0) {
      state.empLeft -= 1;
      disableAllCameras(state.cameras, TOOLS.empSeconds);
      state.events |= 64; // EVENT_EMP
    }
    for (let i = state.smokes.length - 1; i >= 0; i -= 1) {
      state.smokes[i].left -= dt;
      if (state.smokes[i].left <= 0) state.smokes.splice(i, 1);
    }

    // Move the thief (slower in the vent), sliding along walls.
    const player = state.player;
    player.movedThisStep = false;
    player.inVent = inVent(player.x, player.y, state);
    player.inShadow = inShadow(player.x, player.y, state);
    const speed = player.inVent ? PLAYER.ventSpeed : PLAYER.speed;
    const mx = move ? move.x : 0;
    const my = move ? move.y : 0;
    const mag = Math.hypot(mx, my);
    if (mag > 0.01) {
      const nx = mx / mag;
      const ny = my / mag;
      player.angle = Math.atan2(ny, nx);
      player.moving = true;
      const nextX = player.x + nx * speed * dt;
      if (!circleHitsWall(nextX, player.y, player.radius, state)) { player.x = nextX; player.movedThisStep = true; }
      const nextY = player.y + ny * speed * dt;
      if (!circleHitsWall(player.x, nextY, player.radius, state)) { player.y = nextY; player.movedThisStep = true; }
    } else {
      player.moving = false;
    }
    player.x = clamp(player.x, 24 + player.radius, FIELD.width - 24 - player.radius);
    player.y = clamp(player.y, 24 + player.radius, FIELD.height - 24 - player.radius);
    player.inVent = inVent(player.x, player.y, state);
    player.inShadow = inShadow(player.x, player.y, state);

    // Guards and cameras feed the alarm; it decays when nobody sees the thief.
    let alarmAdd = 0;
    for (const guard of state.guards) alarmAdd += updateGuard(guard, player, state, dt);
    for (const camera of state.cameras) alarmAdd += updateCamera(camera, player, state, dt);
    const loot = updateLoot(state, state, dt);
    alarmAdd += loot.alarmAdd;
    if (alarmAdd > 0) state.alarm = Math.min(ALARM.max, state.alarm + alarmAdd);
    else state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
    if (state.alarm >= 90 && !state.alarmHighAnnounced) {
      state.alarmHighAnnounced = true;
      state.events |= EVENT_ALARM_HIGH;
    }

    // Caught: alarm full, or a guard lays hands on the thief.
    for (const guard of state.guards) {
      if (dist2(guard.x, guard.y, player.x, player.y) < GUARD.touchRange * GUARD.touchRange) {
        state.caught = true;
        state.caughtReason = 'A guard grabbed Wren in the hall.';
        state.events |= EVENT_CAUGHT;
        return state.events;
      }
    }
    if (state.alarm >= ALARM.max) {
      state.caught = true;
      state.caughtReason = 'The alarm hit full — lockdown sealed the museum.';
      state.events |= EVENT_CAUGHT;
      return state.events;
    }

    // Escaped: diamond in hand and out the street door to the van.
    if (state.hasDiamond && pointInRect(player.x, player.y, EXIT)) {
      state.escaped = true;
      state.events |= EVENT_ESCAPED;
      return state.events;
    }
    return state.events;
  }
}

/** True when a circle of `radius` at (x, y) overlaps a wall. */
function circleHitsWall(x, y, radius, state) {
  for (const wall of state.walls) {
    const cx = clamp(x, wall.x, wall.x + wall.w);
    const cy = clamp(y, wall.y, wall.y + wall.h);
    if (dist2(x, y, cx, cy) < radius * radius) return true;
  }
  return false;
}

/** Final score: loot value plus a time bonus for a fast, quiet job. */
export function finalScore(state) {
  const timeBonus = state.escaped ? Math.max(0, Math.round((300 - state.time) * 100)) : 0;
  return { loot: state.lootValue, timeBonus, total: state.lootValue + timeBonus };
}
