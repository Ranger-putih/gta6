// Keyboard and mouse for Vice Rush. The game reads held keys every frame
// for movement, and edge-triggered actions (enter a car, confirm, pause)
// through a small queue the world drains once per step. Dragging orbits
// the camera, the wheel zooms it, left click punches, right click shoots.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_ENTER = 'enter';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';
export const ACTION_WEAPON_1 = 'weapon1';
export const ACTION_WEAPON_2 = 'weapon2';

class Input {
  constructor() {
    this.held = new Set();
    this.queue = [];
    this.orbit = { x: 0, y: 0 };
    this.camDist = 13;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.onPauseRequest = null;
    this._bound = false;
  }

  bind(canvas) {
    if (this._bound) return;
    this._bound = true;
    this.canvas = canvas || document;
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.held.clear());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.onPauseRequest) this.onPauseRequest();
    });
    const target = canvas || window;
    target.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    target.addEventListener('wheel', (e) => this.onWheel(e), { passive: true });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onKeyDown(e) {
    if (e.repeat) return;
    this.held.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') {
      this.queue.push(ACTION_CONFIRM);
      e.preventDefault();
    } else if (e.code === 'KeyE') {
      this.queue.push(ACTION_ENTER);
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      this.queue.push(ACTION_PAUSE);
    } else if (e.code === 'KeyM') {
      this.queue.push(ACTION_MUTE);
    } else if (e.code === 'Digit1') {
      this.queue.push(ACTION_WEAPON_1);
    } else if (e.code === 'Digit2') {
      this.queue.push(ACTION_WEAPON_2);
    }
  }

  onKeyUp(e) {
    this.held.delete(e.code);
  }

  onMouseDown(e) {
    if (e.button === 0) {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.queue.push(ACTION_PUNCH);
    } else if (e.button === 2) {
      this.queue.push(ACTION_SHOOT);
    }
  }

  onMouseUp(e) {
    if (e.button === 0) this.dragging = false;
  }

  onMouseMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    // orbit.x is a turn rate applied while dragging; the world turns it
    // into a camera heading. A big drag spins the view, a small one
    // nudges it.
    this.orbit.x += dx * 0.005;
    this.orbit.y = Math.max(-0.5, Math.min(0.9, this.orbit.y + dy * 0.003));
  }

  onWheel(e) {
    this.camDist = Math.max(7, Math.min(22, this.camDist + Math.sign(e.deltaY) * 1.5));
  }

  // True while the key is held down.
  isDown(code) {
    return this.held.has(code);
  }

  // Forward / strafe / run, in the game's own words.
  get forward() {
    return this.isDown('KeyW') || this.isDown('ArrowUp');
  }
  get back() {
    return this.isDown('KeyS') || this.isDown('ArrowDown');
  }
  get left() {
    return this.isDown('KeyA') || this.isDown('ArrowLeft');
  }
  get right() {
    return this.isDown('KeyD') || this.isDown('ArrowRight');
  }
  get run() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  // Drain the edge-triggered actions queued since the last step.
  drain() {
    const out = this.queue;
    this.queue = [];
    return out;
  }

  clear() {
    this.held.clear();
    this.queue = [];
  }
}

export const input = new Input();
