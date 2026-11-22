// Vaultlight — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between five screens: title, play, paused, caught and
// escaped.
//
// ?seed=N fixes the layout seed. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createWorld, EVENT_CAUGHT, EVENT_ESCAPED, EVENT_DIAMOND, EVENT_CASE } from './world.js';
import { ACTION_CONFIRM, ACTION_EMP, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_ESCAPED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      const state = world.state;
      document.title = JSON.stringify({
        shot: name,
        screen: scene.screen,
        alarm: Math.round(state.alarm),
        loot: state.lootValue,
        diamond: state.hasDiamond,
        escaped: state.escaped,
        caught: state.caught,
        x: Math.round(state.player.x),
        y: Math.round(state.player.y),
        time: Math.round(state.time),
      });
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastAlarmBeep = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Steal the Meridian Diamond, then get to the van.');
  }

  function endGame(escaped) {
    screen = escaped ? SCREEN_ESCAPED : SCREEN_CAUGHT;
    if (world.state.lootValue > best) {
      best = world.state.lootValue;
      saveBest(best);
    }
    if (escaped) audio.escaped();
    else audio.caught();
    announce(escaped
      ? `Clean getaway. Loot $${world.state.lootValue.toLocaleString('en-US')}.`
      : `Caught. ${world.state.caughtReason}`);
  }

  // Actions are drained once per frame in frame() and shared: confirm and
  // pause are handled here, tool presses ride into step().
  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_ESCAPED)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions, useTools) {
    if (screen === SCREEN_TITLE) {
      world.step({ x: 0, y: 0 }, {});
      return;
    }
    // One-shot tools fire on the frame's first step only, never once per
    // catch-up step, so a single Q press spends exactly one smoke pellet.
    const tools = useTools ? {
      smoke: Boolean(actions & ACTION_SMOKE),
      emp: Boolean(actions & ACTION_EMP),
    } : {};
    const events = world.step(input.direction(world.state.player), tools);
    if (events & EVENT_DIAMOND) audio.diamond();
    if (events & EVENT_CASE) audio.caseCrack();
    if (events & 32) audio.smoke();
    if (events & 64) audio.emp();
    // One lockpick click per half second of picking, not one per frame.
    if (world.state.lockpick > 0 && world.state.lockpick < 3
      && Math.floor(world.state.lockpick * 2) !== Math.floor((world.state.lockpick - STEP) * 2)) {
      audio.pickClick();
    }
    if (world.state.alarm > 55 && performance.now() - lastAlarmBeep > 650) {
      lastAlarmBeep = performance.now();
      audio.alarmBeep(world.state.alarm);
    }
    if (events & EVENT_CAUGHT) endGame(false);
    else if (events & EVENT_ESCAPED) endGame(true);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions, firstStep);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Vaultlight: The Meridian Job. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
