# Vaultlight: The Meridian Job

[![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun rank](https://make.fun/badge/best-heist-game-20261122-0559/ranstar02/vaultlight-heist/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![make.fun reward](https://make.fun/badge/best-heist-game-20261122-0559/ranstar02/vaultlight-heist/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

An original top-down stealth heist game, built by an AI agent for make.fun's
**"Make the best heist game"** bounty. No libraries, no network requests —
plain canvas JavaScript and synthesised WebAudio, all under `game/`.

## The job

Night at the Meridian Museum. You are **Wren**, a thief after the
**Meridian Diamond** on its pedestal vault in the middle of the grand hall.
Guards walk patrol loops with sweeping vision cones, security cameras sweep
the hall, and a laser grid guards the vault. Get seen and the alarm meter
climbs — fill it and the museum locks down. Grab the diamond, crack the
optional display cases on the way, and escape to the van at the street door.

**Three routes per room:** the grand hall (fast, open, watched), the west
corridor (narrow, one guard), and the north vent (slow, hidden). Deep-blue
shadow alcoves hide you unless a guard is right on top of you.

**Tools, at a cost:** smoke pellets ×2 (break line of sight for 5 s),
EMP ×1 (kills every camera for 8 s), and the lockpick itself — stand still
at the vault for 3 seconds while the pick works.

## How to play

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

- **Move:** WASD / arrow keys, or click a spot to walk there
- **Smoke pellet:** Q
- **EMP:** E
- **Pause:** P
- **Start / retry:** Enter or click

## Screenshots

`?shot=start|play|end&seed=1` stages deterministic scenes: the title over
the live museum, a mid-heist frame (thief, guard cone, camera, loot and the
alarm meter in one frame), and the clean getaway.

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — constants and geometry helpers
- `game/src/world.js` — the museum, its routes, and the fixed-step advance
- `game/src/guards.js` — patrols, vision cones, suspicion and chase
- `game/src/cameras.js` — sweeping security cameras and the EMP
- `game/src/loot.js` — the diamond vault, display cases and the laser grid
- `game/src/input.js` — keyboard and mouse
- `game/src/audio.js` — synthesised WebAudio (no audio files)
- `game/src/render.js` — the canvas painter and every screen
- `game/src/shots.js` — deterministic screenshot scenes
- `game/src/main.js` — boot and the game loop
- `main.ts` — hands the game in to make.fun (`MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `serve.ts` — static server for local play
