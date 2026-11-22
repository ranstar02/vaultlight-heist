// Vaultlight — loot: the Meridian Diamond on its pedestal vault, four
// optional display cases, and the laser grid guarding the vault approach.
// The diamond needs a 3-second lockpick while the thief stands still at the
// pedestal; a case is cracked by standing next to it for a moment. Lasers
// blink on a cycle — cross a live beam and the alarm spikes.

import { ALARM, CASE_VALUE, DIAMOND_VALUE, dist2, pointInRect } from './config.js';

export const VAULT = { x: 640, y: 372, radius: 30, pickRadius: 56 };

/** The four optional cases, each worth CASE_VALUE when cracked. */
export function createCases() {
  return [
    { x: 430, y: 205, taken: false, crack: 0, label: 'Jade Idol' },
    { x: 850, y: 205, taken: false, crack: 0, label: 'Gold Mask' },
    { x: 430, y: 565, taken: false, crack: 0, label: 'Sapphire Tiara' },
    { x: 850, y: 565, taken: false, crack: 0, label: 'Pearl Brooch' },
  ];
}

/**
 * Laser beams guarding the vault: vertical beams left and right of the
 * pedestal, blinking in phase so there is a real dark window to time
 * (both off for 1.6 s of every 3.4 s cycle).
 */
export function createLasers() {
  return [
    { x: 556, y1: 296, y2: 448, period: 3.4, onSeconds: 1.8, phase: 0.0 },
    { x: 724, y1: 296, y2: 448, period: 3.4, onSeconds: 1.8, phase: 0.0 },
    { x: 640, y1: 296, y2: 320, period: 4.2, onSeconds: 2.4, phase: 0.9, horizontal: true, x1: 576, x2: 704 },
  ];
}

/** True when this laser beam is live right now. */
export function laserIsOn(laser, time) {
  return ((time + laser.phase) % laser.period) < laser.onSeconds;
}

/**
 * Advance the loot state one fixed step. The thief must stand still at the
 * vault to pick it (moving pauses the pick); cases crack while standing
 * close. Returns alarm added by live lasers and the value just looted.
 */
export function updateLoot(state, world, dt) {
  let alarmAdd = 0;
  let looted = 0;
  const player = state.player;

  // Lasers: crossing a live beam feeds the alarm fast.
  for (const laser of world.lasers) {
    if (!laserIsOn(laser, state.time)) continue;
    if (laser.horizontal) {
      if (Math.abs(player.y - laser.y1) < player.radius + 3 && player.x > laser.x1 && player.x < laser.x2) {
        alarmAdd += ALARM.laserPerSecond * dt;
      }
    } else if (Math.abs(player.x - laser.x) < player.radius + 3 && player.y > laser.y1 && player.y < laser.y2) {
      alarmAdd += ALARM.laserPerSecond * dt;
    }
  }

  // The vault: stand still inside the pick ring and the lockpick advances.
  const nearVault = dist2(player.x, player.y, VAULT.x, VAULT.y) < VAULT.pickRadius * VAULT.pickRadius;
  if (!state.hasDiamond && nearVault && !player.movedThisStep) {
    state.lockpick += dt;
    if (state.lockpick >= 3) {
      state.hasDiamond = true;
      state.lootValue += DIAMOND_VALUE;
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.diamondSpike);
      looted = DIAMOND_VALUE;
      state.events |= 4; // EVENT_DIAMOND
    }
  } else if (!nearVault) {
    state.lockpick = 0;
  }

  // Display cases: stand close for a second to crack one open.
  for (const lootCase of world.cases) {
    if (lootCase.taken) continue;
    const near = dist2(player.x, player.y, lootCase.x, lootCase.y) < 46 * 46;
    if (near && !player.movedThisStep) {
      lootCase.crack += dt;
      if (lootCase.crack >= 1) {
        lootCase.taken = true;
        state.lootValue += CASE_VALUE;
        looted += CASE_VALUE;
        state.events |= 8; // EVENT_CASE
      }
    } else {
      lootCase.crack = 0;
    }
  }
  return { alarmAdd, looted };
}

/** True when the thief is inside the vent corridor (hidden, slow). */
export function inVent(x, y, world) {
  for (const vent of world.vents) {
    if (pointInRect(x, y, vent)) return true;
  }
  return false;
}

/** True when the thief is crouched in a deep-shadow cover zone. */
export function inShadow(x, y, world) {
  for (const zone of world.shadows) {
    if (pointInRect(x, y, zone)) return true;
  }
  return false;
}
