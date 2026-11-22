// Vaultlight — screenshot scenes behind ?shot=start|play|end. Each scene
// plays the real rules forward from a fresh world, steered by a waypoint
// autopilot that walks the routes, waits out patrols, pops smoke at the
// vault and runs for the van — so every frame is what a short game really
// looks like, and the same seed always gives the same frame.

import { FIELD, STEP, dist2 } from './config.js';
import { VAULT } from './loot.js';
import { EVENT_CAUGHT, EVENT_ESCAPED } from './world.js';
import { SCREEN_CAUGHT, SCREEN_ESCAPED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const SAMPLE = STEP;

// The full job, waypoint by waypoint: door, west corridor (hugging the far
// wall, clear of the corridor guard's patrol line), vent, east gallery,
// vault, then the van. The autopilot waits at staging points while a guard
// is on the near side, and pops smoke to pick the lock.
const JOB_ROUTE = [
  { x: 640, y: 700 },
  { x: 400, y: 700 },
  { x: 70, y: 700 },
  { x: 70, y: 600 },
  { x: 70, y: 420 },
  { x: 70, y: 90 },
  { x: 340, y: 75 },
  { x: 940, y: 75 },
  { x: 973, y: 110 },
  { x: 973, y: 185 },
  { x: 1010, y: 260 },
  { x: 1100, y: 380 },
  { x: 760, y: 380 },
  { x: 680, y: 372 },
];

function steerToward(state, target) {
  const player = state.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) return { move: { x: 0, y: 0 }, arrived: true };
  return { move: { x: dx / d, y: dy / d }, arrived: false };
}

/**
 * True when the hall guard is on the far side of the vault AND walking
 * away from the crossing: the guard loops clockwise around the vault, so
 * it is safe to cross from the east gallery only while it heads for the
 * south and west legs (waypoints 4, 5, 0). A guard on the west side but
 * heading east (waypoints 1, 2) would meet the thief halfway across.
 */
function hallGuardClear(state) {
  const guard = state.guards[0];
  if (guard.state === 2) return false;
  return guard.waypointIndex === 4 || guard.waypointIndex === 5 || guard.waypointIndex === 0;
}

/**
 * The west corridor is a straight line the corridor guard walks up and
 * down, so the pilot only climbs it while that guard is walking north
 * with enough of its leg left: the thief needs about 3 s to climb, and
 * the guard needs longer than that to turn around and come back down.
 * While the gate is shut the thief waits at the corridor mouth, inside
 * the south shadow alcove, where the guard cannot spot it.
 */
function corridorGateOpen(state) {
  const guard = state.guards[1];
  return guard.waypointIndex === 0 && guard.y >= 350;
}

/**
 * Flee direction when a chasing guard is close enough to grab the thief:
 * toward the nearest cover (a shadow alcove or the vent), never blindly
 * away — blind flight corners the thief against a wall.
 */
function fleeToCover(state) {
  const player = state.player;
  const covers = [
    { x: 640, y: 75 },   // the vent
    { x: 160, y: 585 },  // south west alcove
    { x: 1110, y: 360 }, // east gallery shadow
    { x: 640, y: 705 },  // foyer shadow
  ];
  let best = null;
  let bestD2 = Infinity;
  for (const cover of covers) {
    const d2 = dist2(player.x, player.y, cover.x, cover.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = cover;
    }
  }
  const dx = best.x - player.x;
  const dy = best.y - player.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

/**
 * Drive the world toward `route` for up to `maxSeconds`. Returns the
 * events raised along the way. The pilot waits for a clear guard, waits
 * out live lasers at the vault door, and uses smoke while picking the lock.
 * With `finishJob`, reaching the last waypoint without the diamond keeps
 * nudging at the vault until the pick finishes; without it the run stops
 * at the route's end (a mid-heist frame). `onTick` (optional) is called
 * with the state once per simulated second for debugging.
 */
function runRoute(world, route, maxSeconds, finishJob = true, onTick = null) {
  let events = 0;
  let leg = 0;
  let wait = 0;
  let smoked = false;
  let evadeSmokeUsed = false;
  const state = world.state;
  let nextTick = 1;
  for (let t = 0; t < maxSeconds / STEP; t += 1) {
    if (state.caught || state.escaped) break;
    if (onTick && state.time >= nextTick) {
      nextTick += 1;
      onTick(state);
    }
    const target = route[Math.min(leg, route.length - 1)];
    const player = state.player;
    let tools = {};

    // Chased in the open: pop a smoke pellet to break the sight line so
    // the guard loses the trail at the last place it saw the thief. Keep
    // one pellet in reserve for the vault pick.
    const chased = state.guards.some((guard) => guard.state === 2);
    if (chased && state.smokeLeft > 1 && !evadeSmokeUsed) {
      tools = { smoke: true };
      evadeSmokeUsed = true;
    }

    // A chasing guard cannot catch a thief that keeps moving along the
    // route (the thief is faster), so the pilot never flees blindly —
    // a blind run corners the thief against a wall. Smoke breaks the
    // sight line instead.


    // Near the vault: pick the lock. Pop smoke first so the cone cannot see.
    const nearVault = Math.hypot(player.x - VAULT.x, player.y - VAULT.y) < 56;
    if (nearVault && !state.hasDiamond) {
      if (!smoked && state.smokeLeft > 0) {
        tools = { smoke: true };
        smoked = true;
      }
      events |= world.step({ x: 0, y: 0 }, tools);
      continue;
    }
    if (state.hasDiamond) {
      // Diamond in hand: straight for the van, no waiting.
      const exit = { x: 640, y: 745 };
      const s = steerToward(state, exit);
      events |= world.step(s.move, {});
      continue;
    }

    // West corridor: climb only while the gate is open; otherwise hold
    // at the corridor mouth, inside the south shadow alcove. The gate
    // only ever holds the thief at the mouth (player.y > 590): once the
    // climb has started it is committed — freezing mid-corridor while a
    // guard closes in is how the thief gets grabbed.
    const climbing = leg >= 3 && leg <= 5 && player.y > 590;
    if (climbing && !corridorGateOpen(state)) {
      events |= world.step({ x: 0, y: 0 }, tools);
      continue;
    }

    // Staging: hold at the staging point (the east shadow, leg 11) before
    // the vault approach until the hall guard is far. Only holds once the
    // thief has arrived at the point (dist < 25), and never at the vault
    // approach itself: freezing in the open hall while a guard closes in
    // is how the thief gets grabbed.
    const staging = leg === 11;
    const arrivedAtStaging = Math.hypot(target.x - player.x, target.y - player.y) < 25;
    if (staging && arrivedAtStaging && !hallGuardClear(state)) {
      wait += STEP;
      events |= world.step({ x: 0, y: 0 }, tools);
      if (wait > 12) leg += 1;
      continue;
    }
    wait = 0;

    // The laser grid: the pilot crosses the beam live and pays the small
    // alarm tax (a fraction of a second in the beam). Waiting at the door
    // in the open hall while a guard closes in is what gets the thief
    // grabbed, so there is no wait here.
    const s = steerToward(state, target);
    events |= world.step(s.move, {});
    if (s.arrived) leg += 1;
    if (leg >= route.length) {
      // Route done but no diamond yet: keep nudging at the vault until the
      // pick finishes (or the run ends caught/escaped) — only for the full job.
      if (finishJob && !state.hasDiamond && !state.escaped) {
        const nudge = steerToward(state, { x: 676, y: 372 });
        events |= world.step(nudge.move, {});
      } else {
        break;
      }
    }
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Start: title over a live room. Play: mid-heist
 * in the hall with a guard cone sweeping and the alarm half raised. End:
 * the full job, finished at the van.
 */
export function stageShot(name, world, onTick = null) {
  world.reset();
  const state = world.state;

  if (name !== 'play' && name !== 'end') {
    // Title: let the patrols walk for a few seconds behind the title card.
    for (let i = 0; i < 5 / STEP; i += 1) world.step({ x: 0, y: 0 }, {});
    return { screen: SCREEN_TITLE, best: 525000 };
  }

  if (name === 'play') {
    // Walk the route to the vault approach, then hold in the open hall for
    // a few seconds while a guard cone sweeps across — the alarm climbs
    // and the meter shows it. If a guard closes in, the pilot runs for
    // the nearest cover instead of standing still to be grabbed.
    const midRoute = JOB_ROUTE.slice(0, 13);
    runRoute(world, midRoute, 60, false, onTick);
    let evadeSmokeUsed = false;
    // A short hold: long enough for a cone to sweep across the thief, short
    // enough that the alarm meter still shows the chase (it decays fast).
    for (let i = 0; i < 2.5 / STEP && !state.caught; i += 1) {
      let tools = {};
      const chased = state.guards.some((guard) => guard.state === 2);
      if (chased && state.smokeLeft > 0 && !evadeSmokeUsed) {
        tools = { smoke: true };
        evadeSmokeUsed = true;
      }
      // Standing still while chased gets the thief grabbed: run for the
      // nearest cover instead.
      const move = chased ? fleeToCover(state) : { x: 0, y: 0 };
      world.step(move, tools);
    }
    return { screen: state.caught ? SCREEN_CAUGHT : SCREEN_PLAY, best: 525000 };
  }

  // End: run the whole job.
  const events = runRoute(world, JOB_ROUTE, 150, true, onTick);
  if (state.escaped || events & EVENT_ESCAPED) return { screen: SCREEN_ESCAPED, best: 525000 };
  if (state.caught || events & EVENT_CAUGHT) return { screen: SCREEN_CAUGHT, best: 525000 };
  return { screen: SCREEN_PLAY, best: 525000 };
}
