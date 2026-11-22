// Vaultlight — input: keyboard (WASD / arrows to move, Q smoke, E EMP,
// P pause, Enter/Space confirm) and mouse (click a spot to walk there,
// click to start). One-shot actions are drained with takeActions() each
// frame so a key press fires exactly once.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_EMP = 8;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let clickTarget = null;

  function keyDown(event) {
    const key = event.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') actions |= ACTION_CONFIRM;
    else if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    else if (key === 'q') actions |= ACTION_SMOKE;
    else if (key === 'e') actions |= ACTION_EMP;
  }

  function keyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  function pointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointerdown', pointerDown);

  return {
    /** Movement vector from held keys, else toward the click target. */
    direction(player) {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 || y !== 0) {
        clickTarget = null;
        return { x, y };
      }
      if (clickTarget) {
        const dx = clickTarget.x - player.x;
        const dy = clickTarget.y - player.y;
        if (Math.hypot(dx, dy) < 10) {
          clickTarget = null;
          return { x: 0, y: 0 };
        }
        return { x: dx, y: dy };
      }
      return { x: 0, y: 0 };
    },

    /** Drain the one-shot actions pressed since the last frame. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
