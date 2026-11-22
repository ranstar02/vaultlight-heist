// Vaultlight — guards: patrol waypoints, vision cones, suspicion and chase.
// A guard walks its waypoint loop; when the thief is inside its cone with a
// clear line of sight it turns suspicious (cone goes red) and chases. Lose
// sight for a while and it goes back to patrol. Guards cannot see into the
// vent, through smoke, or a thief crouched in deep shadow unless they are
// right on top of them.

import {
  ALARM, COLORS, GUARD, TOOLS, angleDiff, clamp, dist2, pointInRect,
  segmentHitsCircle, segmentHitsRect,
} from './config.js';

export const GUARD_CALM = 0;
export const GUARD_SUSPICIOUS = 1;
export const GUARD_CHASE = 2;

/** Build a guard from a waypoint loop. */
export function createGuard(waypoints, pauseSeconds = 1.1) {
  return {
    x: waypoints[0].x,
    y: waypoints[0].y,
    angle: 0,
    waypoints,
    waypointIndex: 1,
    pause: 0,
    pauseSeconds,
    state: GUARD_CALM,
    stateTime: 0,
    unseenSeconds: 0,
    // Last place the guard actually saw the thief: a chase heads here,
    // never through walls or smoke at the thief's live position.
    lastSeen: { x: waypoints[0].x, y: waypoints[0].y },
    speed: GUARD.patrolSpeed,
  };
}

/**
 * Can this guard see the player right now? Walls, smoke and the vent block
 * sight; deep shadow hides the thief unless the guard is close.
 */
export function guardSeesPlayer(guard, player, world) {
  if (player.inVent) return false;
  const d2 = dist2(guard.x, guard.y, player.x, player.y);
  if (d2 > GUARD.viewRange * GUARD.viewRange) return false;
  const angleTo = Math.atan2(player.y - guard.y, player.x - guard.x);
  if (angleDiff(angleTo, guard.angle) > GUARD.viewHalfAngle) return false;
  for (const wall of world.walls) {
    if (segmentHitsRect(guard.x, guard.y, player.x, player.y, wall)) return false;
  }
  for (const smoke of world.smokes) {
    if (segmentHitsCircle(guard.x, guard.y, player.x, player.y, smoke.x, smoke.y, smoke.radius)) return false;
  }
  if (player.inShadow && d2 > 75 * 75) return false;
  return true;
}

/** Move one guard one fixed step; returns how much alarm its sight adds. */
export function updateGuard(guard, player, world, dt) {
  let alarmAdd = 0;
  const sees = guardSeesPlayer(guard, player, world);
  guard.stateTime += dt;

  if (sees) {
    guard.unseenSeconds = 0;
    guard.lastSeen = { x: player.x, y: player.y };
    alarmAdd = ALARM.guardPerSecond * dt;
    if (guard.state !== GUARD_CHASE) {
      guard.state = GUARD_CHASE;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_CHASE) {
    guard.unseenSeconds += dt;
    if (guard.unseenSeconds > GUARD.loseSightSeconds) {
      guard.state = GUARD_SUSPICIOUS;
      guard.stateTime = 0;
      guard.unseenSeconds = 0;
    }
  } else if (guard.state === GUARD_SUSPICIOUS && guard.stateTime > 3) {
    guard.state = GUARD_CALM;
    guard.stateTime = 0;
  }

  if (guard.state === GUARD_CHASE) {
    // Chase the last place the thief was seen, a touch slower than the
    // thief so a clean run escapes; reach it with no fresh sight and the
    // trail goes cold.
    const dx = guard.lastSeen.x - guard.x;
    const dy = guard.lastSeen.y - guard.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      const angleTo = Math.atan2(dy, dx);
      guard.angle = angleTo;
      moveGuard(guard, dx / d, dy / d, GUARD.chaseSpeed, world, dt);
    }
  } else {
    // Patrol: walk to the next waypoint, pause and look around at each one.
    const target = guard.waypoints[guard.waypointIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      if (guard.pause <= 0) guard.pause = guard.pauseSeconds;
      guard.pause -= dt;
      if (guard.pause <= 0) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pause = 0;
      }
      // Sweep the room while waiting at a waypoint.
      guard.angle += dt * 0.9;
    } else {
      const want = Math.atan2(dy, dx);
      let turn = want - guard.angle;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      guard.angle += clamp(turn, -3.2 * dt, 3.2 * dt);
      moveGuard(guard, dx / d, dy / d, GUARD.patrolSpeed, world, dt);
    }
  }
  return alarmAdd;
}

/** Axis-separated movement so a guard slides along walls instead of sticking. */
function moveGuard(guard, nx, ny, speed, world, dt) {
  const nextX = guard.x + nx * speed * dt;
  if (!hitsWall(nextX, guard.y, GUARD.radius, world)) guard.x = nextX;
  const nextY = guard.y + ny * speed * dt;
  if (!hitsWall(guard.x, nextY, GUARD.radius, world)) guard.y = nextY;
}

/** True when a circle of `radius` at (x, y) overlaps a wall or the bounds. */
export function hitsWall(x, y, radius, world) {
  if (x < 24 + radius || x > 1280 - 24 - radius || y < 24 + radius || y > 800 - 24 - radius) return true;
  for (const wall of world.walls) {
    const cx = clamp(x, wall.x, wall.x + wall.w);
    const cy = clamp(y, wall.y, wall.y + wall.h);
    if (dist2(x, y, cx, cy) < radius * radius) return true;
  }
  return false;
}

/** Cone colour for this guard's current state (calm yellow, hot red). */
export function guardConeColors(guard) {
  return guard.state === GUARD_CALM
    ? { fill: COLORS.coneCalm, edge: COLORS.coneCalmEdge }
    : { fill: COLORS.coneHot, edge: COLORS.coneHotEdge };
}
