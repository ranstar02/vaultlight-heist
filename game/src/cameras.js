// Vaultlight — security cameras: wall-mounted, sweeping a cone back and
// forth on a fixed arc. A camera that spots the thief feeds the alarm meter.
// An EMP pulse knocks every camera out for a few seconds; smoke blocks them
// the same way it blocks a guard.

import {
  ALARM, CAMERA, angleDiff, dist2, pointInRect, segmentHitsCircle, segmentHitsRect,
} from './config.js';

/** Build a camera at (x, y) sweeping between minAngle and maxAngle. */
export function createCamera(x, y, minAngle, maxAngle, phase = 0) {
  return {
    x, y,
    minAngle, maxAngle,
    angle: minAngle + (maxAngle - minAngle) * (0.5 + 0.5 * Math.sin(phase)),
    sweep: 0,
    phase,
    disabledSeconds: 0,
    seesPlayer: false,
  };
}

/** Can this camera see the player right now? */
export function cameraSeesPlayer(camera, player, world) {
  if (camera.disabledSeconds > 0 || player.inVent) return false;
  const d2 = dist2(camera.x, camera.y, player.x, player.y);
  if (d2 > CAMERA.range * CAMERA.range) return false;
  const angleTo = Math.atan2(player.y - camera.y, player.x - camera.x);
  if (angleDiff(angleTo, camera.angle) > CAMERA.halfAngle) return false;
  for (const wall of world.walls) {
    if (segmentHitsRect(camera.x, camera.y, player.x, player.y, wall)) return false;
  }
  for (const smoke of world.smokes) {
    if (segmentHitsCircle(camera.x, camera.y, player.x, player.y, smoke.x, smoke.y, smoke.radius)) return false;
  }
  if (player.inShadow && d2 > 75 * 75) return false;
  return true;
}

/** Sweep one camera one fixed step; returns how much alarm its sight adds. */
export function updateCamera(camera, player, world, dt) {
  if (camera.disabledSeconds > 0) {
    camera.disabledSeconds = Math.max(0, camera.disabledSeconds - dt);
    camera.seesPlayer = false;
    return 0;
  }
  // Smooth ping-pong sweep across the arc.
  camera.phase += (Math.PI * 2 / CAMERA.sweepSeconds) * dt;
  const t = 0.5 + 0.5 * Math.sin(camera.phase);
  camera.angle = camera.minAngle + (camera.maxAngle - camera.minAngle) * t;
  camera.seesPlayer = cameraSeesPlayer(camera, player, world);
  return camera.seesPlayer ? ALARM.cameraPerSecond * dt : 0;
}

/** Knock every camera out for `seconds` (the EMP tool). */
export function disableAllCameras(cameras, seconds) {
  for (const camera of cameras) {
    camera.disabledSeconds = seconds;
    camera.seesPlayer = false;
  }
}
