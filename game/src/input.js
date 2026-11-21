// Keyboard and mouse input. Held keys give movement; one-shot presses (enter
// a car, pause, punch, shoot, interact) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or counted twice.
// Dragging with the mouse orbits the camera; the wheel zooms it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_INTERACT = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const INTERACT = new Set(['KeyF']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let lookX = 0;
  let lookY = 0;
  let zoom = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER | ACTION_INTERACT;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.clear();
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      actions |= ACTION_PUNCH | ACTION_CONFIRM;
    } else if (event.button === 2) {
      actions |= ACTION_SHOOT;
    }
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    lookX += event.clientX - lastX;
    lookY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    zoom += event.deltaY;
    event.preventDefault();
  }, { passive: false });

  function axis(positive, negative) {
    let value = 0;
    positive.forEach((code) => { if (held.has(code)) value += 1; });
    negative.forEach((code) => { if (held.has(code)) value -= 1; });
    return value;
  }

  return {
    /** Forward/back in [-1, 1] (W/S). */
    moveY() {
      return axis(FORWARD, BACK);
    },
    /** Left/right in [-1, 1] (A/D). */
    moveX() {
      return axis(RIGHT, LEFT);
    },
    isRunning() {
      let running = false;
      RUN.forEach((code) => { if (held.has(code)) running = true; });
      return running;
    },
    /** Mouse drag since the last call, in pixels. */
    takeLook() {
      const taken = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return taken;
    },
    /** Wheel scroll since the last call. */
    takeZoom() {
      const taken = zoom;
      zoom = 0;
      return taken;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
