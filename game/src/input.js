// Keyboard and mouse input, kept in one place. The game reads this object
// once a frame; edge-triggered presses (E, P, M, clicks) are consumed by the
// frame that reads them, so holding a key never fires an action twice.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    // Accumulated mouse-drag orbit, in radians, since the last frame.
    this.orbitX = 0;
    this.orbitY = 0;
    // Accumulated wheel zoom since the last frame.
    this.wheel = 0;
    // Mouse buttons pressed this frame: 0 = left, 2 = right.
    this.clicks = new Set();
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      // Space and arrows would scroll the page; the game owns them.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.clicks.add(e.button);
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.dragging && e.button === 0) this.dragging = false;
      if (e.button === 2) this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      this.orbitX += (e.clientX - this.lastX) * 0.005;
      this.orbitY += (e.clientY - this.lastY) * 0.005;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    canvas.addEventListener('wheel', (e) => {
      this.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // True while the key is held down.
  held(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down (edge-triggered).
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // True only on the frame the mouse button went down.
  wasClicked(button) {
    return this.clicks.has(button);
  }

  // Forward / back / strafe from WASD or the arrow keys, each in -1..1.
  moveAxes() {
    let fwd = 0;
    let strafe = 0;
    if (this.held('KeyW') || this.held('ArrowUp')) fwd += 1;
    if (this.held('KeyS') || this.held('ArrowDown')) fwd -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) strafe += 1;
    if (this.held('KeyA') || this.held('ArrowLeft')) strafe -= 1;
    return { fwd, strafe };
  }

  running() {
    return this.held('ShiftLeft') || this.held('ShiftRight');
  }

  // Call once per frame, after the game has read the inputs.
  endFrame() {
    this.pressed.clear();
    this.clicks.clear();
    this.orbitX = 0;
    this.orbitY = 0;
    this.wheel = 0;
  }
}
