// Vaultlight — render: one canvas painter for the museum at night and every
// screen. Warm pools of light on a dark floor, deep-blue cover shadow, red
// and yellow danger, cyan loot: safe, danger and prize are obvious at a
// glance. The HUD always shows the alarm meter, loot value, tools and time.

import { ALARM, CAMERA, COLORS, FIELD, GUARD } from './config.js';
import { VAULT, laserIsOn } from './loot.js';
import { guardConeColors } from './guards.js';
import { finalScore } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_ESCAPED = 'escaped';

const GOLD = COLORS.gold;
const CYAN = COLORS.loot;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    canvas.width = FIELD.width;
    canvas.height = FIELD.height;
    canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
    canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  }
  fit();
  window.addEventListener('resize', fit);

  function drawCone(x, y, angle, range, halfAngle, fill, edge) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawFloor(state) {
    // Dark floor with a subtle checker and warm light pools.
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = COLORS.floorAlt;
    for (let ty = 0; ty < 10; ty += 1) {
      for (let tx = 0; tx < 16; tx += 1) {
        if ((tx + ty) % 2 === 0) ctx.fillRect(tx * 80, ty * 80, 80, 80);
      }
    }
    // Warm spotlights over the hall and the vault.
    const pools = [
      [640, 372, 330], [430, 205, 150], [850, 205, 150],
      [430, 565, 150], [850, 565, 150], [640, 730, 220],
    ];
    for (const [x, y, r] of pools) {
      const g = ctx.createRadialGradient(x, y, 10, x, y, r);
      g.addColorStop(0, 'rgba(255, 200, 110, 0.13)');
      g.addColorStop(1, 'rgba(255, 200, 110, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Deep-blue cover shadows.
    for (const zone of state.shadows) {
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.strokeStyle = 'rgba(90, 140, 255, 0.25)';
      ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.w, zone.h);
    }
    // The vent: a dark crawlspace along the north wall.
    for (const vent of state.vents) {
      ctx.fillStyle = COLORS.vent;
      ctx.fillRect(vent.x, vent.y, vent.w, vent.h);
      ctx.strokeStyle = 'rgba(120, 160, 255, 0.35)';
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(vent.x + 0.5, vent.y + 0.5, vent.w, vent.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(160, 190, 255, 0.75)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VENT — HIDDEN ROUTE', vent.x + vent.w / 2, vent.y + vent.h / 2 + 4);
    }
  }

  function drawWalls(state) {
    for (const wall of state.walls) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = COLORS.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 4);
    }
    // Street door and the getaway van at the bottom.
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(600, 776, 80, 24);
    ctx.fillStyle = '#3a6ea5';
    ctx.fillRect(612, 700, 56, 62);
    ctx.fillStyle = '#7fb3e8';
    ctx.fillRect(618, 712, 44, 18);
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VAN', 640, 758);
    ctx.fillStyle = 'rgba(232, 230, 223, 0.8)';
    ctx.font = '11px sans-serif';
    ctx.fillText('ESCAPE — GET TO THE VAN', 640, 692);
  }

  function drawLoot(state) {
    // Display cases: cyan glass, gold label, sparkle when cracked open.
    for (const lootCase of state.cases) {
      ctx.save();
      ctx.translate(lootCase.x, lootCase.y);
      ctx.fillStyle = lootCase.taken ? 'rgba(77, 232, 255, 0.08)' : 'rgba(77, 232, 255, 0.22)';
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!lootCase.taken) {
        ctx.fillStyle = CYAN;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(lootCase.label, 0, 36);
        if (lootCase.crack > 0) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + (lootCase.crack / 1) * Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(232, 230, 223, 0.6)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EMPTY', 0, 36);
      }
      ctx.restore();
    }
    // The vault pedestal and the Meridian Diamond.
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(VAULT.x - 22, VAULT.y - 22, 44, 44);
    ctx.strokeStyle = GOLD;
    ctx.strokeRect(VAULT.x - 22.5, VAULT.y - 22.5, 45, 45);
    if (!state.hasDiamond) {
      const pulse = 1 + 0.18 * Math.sin(state.time * 4);
      ctx.save();
      ctx.translate(VAULT.x, VAULT.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(10, 0);
      ctx.lineTo(0, 12);
      ctx.lineTo(-10, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 4);
      ctx.lineTo(-4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MERIDIAN DIAMOND — $500,000', VAULT.x, VAULT.y - 34);
      if (state.lockpick > 0) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(VAULT.x, VAULT.y, 34, -Math.PI / 2, -Math.PI / 2 + (state.lockpick / 3) * Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('PICKING THE LOCK…', VAULT.x, VAULT.y + 52);
      }
    } else {
      ctx.fillStyle = 'rgba(232, 230, 223, 0.6)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VAULT EMPTY', VAULT.x, VAULT.y - 30);
    }
  }

  function drawLasers(state) {
    for (const laser of state.lasers) {
      if (!laserIsOn(laser, state.time)) continue;
      ctx.strokeStyle = COLORS.laser;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.laser;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      if (laser.horizontal) {
        ctx.moveTo(laser.x1, laser.y1);
        ctx.lineTo(laser.x2, laser.y1);
      } else {
        ctx.moveTo(laser.x, laser.y1);
        ctx.lineTo(laser.x, laser.y2);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      const colors = guardConeColors(guard);
      drawCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, colors.fill, colors.edge);
    }
    for (const guard of state.guards) {
      ctx.save();
      ctx.translate(guard.x, guard.y);
      ctx.rotate(guard.angle);
      ctx.fillStyle = COLORS.guard;
      ctx.beginPath();
      ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.fillRect(6, -4, 14, 8);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(16, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (guard.state !== 0) {
        ctx.fillStyle = guard.state === 2 ? '#ff5040' : '#ffd166';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(guard.state === 2 ? '!' : '?', guard.x, guard.y - 22);
      }
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      if (camera.disabledSeconds <= 0) {
        drawCone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, COLORS.cameraCone, 'rgba(255, 190, 60, 0.4)');
      }
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.fillStyle = camera.disabledSeconds > 0 ? '#555' : '#e8e6df';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = camera.disabledSeconds > 0 ? '#333' : (camera.seesPlayer ? '#ff5040' : '#37d67a');
      ctx.beginPath();
      ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (camera.disabledSeconds > 0) {
        ctx.fillStyle = '#9fb4d8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`EMP ${Math.ceil(camera.disabledSeconds)}s`, camera.x, camera.y + 22);
      }
    }
  }

  function drawSmoke(state) {
    for (const smoke of state.smokes) {
      const g = ctx.createRadialGradient(smoke.x, smoke.y, 4, smoke.x, smoke.y, smoke.radius);
      g.addColorStop(0, 'rgba(200, 205, 215, 0.55)');
      g.addColorStop(1, 'rgba(200, 205, 215, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.inVent) ctx.globalAlpha = 0.55;
    ctx.rotate(player.angle);
    // Hooded thief: dark cloak, pale hood.
    ctx.fillStyle = '#23232e';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-13, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(2, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#23232e';
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (state.hasDiamond) {
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.arc(player.x + 16, player.y - 14, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHud(state, screen, elapsed) {
    const pad = 14;
    ctx.fillStyle = 'rgba(8, 10, 16, 0.82)';
    ctx.fillRect(0, 0, FIELD.width, 46);
    // Alarm meter.
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', pad, 19);
    const meterX = 78;
    const meterW = 260;
    ctx.fillStyle = '#2a2f3a';
    ctx.fillRect(meterX, 8, meterW, 16);
    const frac = state.alarm / ALARM.max;
    ctx.fillStyle = frac < 0.5 ? '#ffd166' : frac < 0.85 ? '#ff8c2e' : '#ff5040';
    ctx.fillRect(meterX, 8, meterW * frac, 16);
    ctx.strokeStyle = '#e8e6df';
    ctx.strokeRect(meterX + 0.5, 8.5, meterW, 16);
    ctx.fillStyle = '#e8e6df';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`${Math.round(state.alarm)}%`, meterX + meterW + 10, 20);
    // Loot, tools, timer.
    ctx.fillStyle = CYAN;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`LOOT $${state.lootValue.toLocaleString('en-US')}`, 470, 20);
    ctx.fillStyle = '#e8e6df';
    ctx.font = '13px sans-serif';
    ctx.fillText(`SMOKE ×${state.smokeLeft}  [Q]`, 660, 20);
    ctx.fillText(`EMP ×${state.empLeft}  [E]`, 790, 20);
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    ctx.fillText(`TIME ${minutes}:${String(seconds).padStart(2, '0')}`, 920, 20);
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(state.hasDiamond ? '★ GET TO THE VAN!' : '◇ STEAL THE DIAMOND', 1050, 20);
    if (screen === SCREEN_PLAY && state.alarm >= 85) {
      ctx.fillStyle = '#ff5040';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!! LOCKDOWN IMMINENT !!', FIELD.width / 2, 72);
    }
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = '#e8e6df';
    ctx.font = '18px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, 310 + i * 32);
    });
  }

  function drawTitle(state, best) {
    overlay('VAULTLIGHT', [
      'The Meridian Job — a one-night museum heist',
      'Steal the Meridian Diamond. Dodge the guards, the cameras and the lasers.',
      'Then get out to the van. Blue shadows hide you. The vent is slow but safe.',
      'Move: WASD / arrows or click  •  Smoke [Q]  •  EMP [E]  •  Pause [P]',
      best > 0 ? `Best loot so far: $${best.toLocaleString('en-US')}` : 'No loot yet. Tonight the museum is yours.',
      'Press ENTER or click to begin',
    ], GOLD);
  }

  function drawCaught(state) {
    const score = finalScore(state);
    overlay('CAUGHT!', [
      state.caughtReason,
      `Loot kept: $${score.loot.toLocaleString('en-US')} — the diamond stays in the museum.`,
      'Press ENTER or click to try again',
    ], '#ff5040');
  }

  function drawEscaped(state) {
    const score = finalScore(state);
    overlay('CLEAN GETAWAY!', [
      `The Meridian Diamond is yours. Loot: $${score.loot.toLocaleString('en-US')}`,
      `Time bonus: $${score.timeBonus.toLocaleString('en-US')}  •  Total score: $${score.total.toLocaleString('en-US')}`,
      `Job time: ${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, '0')}`,
      'Press ENTER or click to run it again',
    ], CYAN);
  }

  function drawPaused() {
    overlay('PAUSED', ['The museum waits. Press P or click to keep moving.'], GOLD);
  }

  return {
    draw(state, screen, best) {
      ctx.clearRect(0, 0, FIELD.width, FIELD.height);
      drawFloor(state);
      drawLasers(state);
      drawLoot(state);
      drawWalls(state);
      drawGuards(state);
      drawCameras(state);
      drawSmoke(state);
      drawPlayer(state);
      drawHud(state, screen, state.time);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_CAUGHT) drawCaught(state);
      else if (screen === SCREEN_ESCAPED) drawEscaped(state);
      else if (screen === SCREEN_PAUSED) drawPaused();
    },
  };
}
