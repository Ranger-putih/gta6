// Keyboard + mouse input for Vice Rush. Tracks held keys and the mouse
// aim point; the game reads state each frame, it never listens twice.

export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._pressed = new Set();
    this._canvas = null;
  }

  attach(canvas) {
    this._canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this._pressed.add(e.code);
        this.keys.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      if (this._dragging) {
        this.dragDX += e.clientX - this._lastX;
        this.dragDY += e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this._dragging = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // True only on the first read after the key went down; consumes the
  // press so a multi-substep frame never sees it twice.
  pressed(code) {
    if (this._pressed.has(code)) {
      this._pressed.delete(code);
      return true;
    }
    return false;
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  consumeDrag() {
    const d = { x: this.dragDX, y: this.dragDY };
    this.dragDX = 0;
    this.dragDY = 0;
    return d;
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  // Call once per frame after the game has read input.
  endFrame() {
    this._pressed.clear();
  }
}
