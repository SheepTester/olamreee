const GRID_SIZE = 150;
const SCROLL_THRESHOLD = GRID_SIZE * 100;
const AUTO_SCROLL_SPEED = 10;
const DRAG_DIST = 4;

const options = {
  showGrid: true,
  drag: true,
  snap: true,
  multiple: true
};

const colourScales = {
  masses: chroma.scale(['white', '888']).domain([0, 150]),
  meltingPoints: chroma.scale(['2395e1','b2d7f0','e9f0b2','ebad3c', 'f34d22']).mode('lrgb').domain([-350, 4000]),
  ie: chroma.scale(['white', 'f9e03f']).domain([500, 1700])
};

const win = {};

const camera = {x: 0, y: 0, scale: 1, vel: false};

let globalOffsetX = 0, globalOffsetY = 0;

function compDist(dx, dy, val) {
  const sum = dx * dx + dy * dy;
  const square = val * val;
  if (sum < square) return -1;
  else if (sum > square) return 1;
  else return 0;
}

class Card {

  constructor(parent, data) {
    this.parent = parent;
    this.data = data;
    this.x = 0, this.y = 0;
    this.dragData = null;
    this.selected = false;
    const elem = document.createElement('div');
    this.elem = elem;
    if (data.state !== '?') {
      data.state = {G: 'gas', L: 'liquid', S: 'solid'}[data.state];
      elem.classList.add(data.state.toLowerCase());
    }
    if (data.type !== '?') {
      data.type = {M: 'metal', NM: 'nonmetal', SM: 'semimetal'}[data.type];
      elem.classList.add(data.type.toLowerCase());
    }
    elem.innerHTML = Object.keys(data).map(prop => `<span class="${prop}">${data[prop]}</span>`).join('');
    if (data.mass !== '?')
      this.elem.style.setProperty('--mass', colourScales.masses(data.mass).css());
    if (data.melting !== '?')
      this.elem.style.setProperty('--melting-point', colourScales.meltingPoints(data.melting).css());
    if (data.ie !== '?')
      this.elem.style.setProperty('--ie', colourScales.ie(data.ie).css());
    elem.classList.add('card');
    elem.addEventListener('touchstart', e => {
      const touch = e.changedTouches[0];
      if (options.multiple) {
        parent.touchDrags[touch.identifier] = new SelectionBox(parent, touch.clientX, touch.clientY, this);
        e.preventDefault();
        this.parent.createTouchListeners();
      } else if (options.drag) {
        if (this.dragData === null) {
          this.initDragData(touch.clientX, touch.clientY);
          parent.touchDrags[touch.identifier] = this;
          e.preventDefault();
          this.parent.createTouchListeners();
          this.toTop();
        }
      }
    }, {passive: false});
    elem.addEventListener('mousedown', e => {
      if (options.multiple && e.shiftKey) {
        parent.mouseDrag = new SelectionBox(parent, e.clientX, e.clientY, this);
        e.preventDefault();
        this.parent.createMouseListeners();
      } else if (options.drag) {
        if (this.dragData === null) { // make sure it hasn't been touched beforehand
          this.initDragData(e.clientX, e.clientY);
          parent.mouseDrag = this;
          e.preventDefault();
          this.parent.createMouseListeners();
          this.toTop();
        }
      }
    });
    parent.fragment.appendChild(elem);
  }

  setPos(x, y) {
    this.x = x, this.y = y;
    this.elem.style.transform = `translate(${x}px, ${y}px)`;
  }

  toTop() {
    this.parent.wrapper.removeChild(this.elem);
    this.parent.wrapper.appendChild(this.elem);
  }

  snap() {
    this.setPos(Math.round(this.x / GRID_SIZE) * GRID_SIZE, Math.round(this.y / GRID_SIZE) * GRID_SIZE);
  }

  checkAutoScroll() {
    if (!this.dragging) return;
    let diffX = 0, diffY = 0;
    if (this.x - win.scrollX < GRID_SIZE / 2) window.scrollBy(diffX = -AUTO_SCROLL_SPEED, 0);
    else if (this.x - win.scrollX > win.width - GRID_SIZE * 1.5) window.scrollBy(diffX = AUTO_SCROLL_SPEED, 0);
    if (this.y - win.scrollY < GRID_SIZE / 2) window.scrollBy(0, diffY = -AUTO_SCROLL_SPEED);
    else if (this.y - win.scrollY > win.height - GRID_SIZE * 1.5) window.scrollBy(0, diffY = AUTO_SCROLL_SPEED);
    this.setPos(this.x + diffX, this.y + diffY);
  }

  startDragging() {
    this.elem.classList.add('dragged');
    if (this.selected) {
      this.dragData.selected.forEach(card => card.elem.classList.add('dragged'));
    }
  }

  stopDragging() {
    if (!this.dragData.dragging) {
      // show element info here
    }
    if (this.selected) {
      this.dragData.selected.forEach(card => {
        card.dragData = null;
        card.elem.classList.remove('dragged');
        if (options.snap) card.snap();
      });
    }
    this.dragData = null;
    this.elem.classList.remove('dragged');
    if (options.snap) this.snap();
  }

  initDragData(mouseX, mouseY) {
    this.dragData = {
      dragging: false,
      offsetX: (mouseX / camera.scale - this.x + camera.x) / GRID_SIZE,
      offsetY: (mouseY / camera.scale - this.y + camera.y) / GRID_SIZE,
      initX: mouseX, initY: mouseY
    };
    if (this.selected) {
      const selected = this.parent.elements.filter(card => card.selected && card !== this);
      selected.forEach(card => card.dragData = {
        offsetX: (mouseX / camera.scale - card.x + camera.x) / GRID_SIZE,
        offsetY: (mouseY / camera.scale - card.y + camera.y) / GRID_SIZE
      });
      this.dragData.selected = selected;
    }
  }

  setDragPos(mouseX, mouseY) {
    if (!this.dragData.dragging) {
      if (compDist(this.dragData.initX - mouseX, this.dragData.initY - mouseY, DRAG_DIST) === 1) {
        this.dragData.dragging = true;
        this.startDragging();
      } else {
        return;
      }
    }
    this.setPos(
      mouseX / camera.scale + camera.x - this.dragData.offsetX * GRID_SIZE,
      mouseY / camera.scale + camera.y - this.dragData.offsetY * GRID_SIZE
    );
    if (this.selected) {
      this.dragData.selected.forEach(card => card.setPos(
        mouseX / camera.scale + camera.x - card.dragData.offsetX * GRID_SIZE,
        mouseY / camera.scale + camera.y - card.dragData.offsetY * GRID_SIZE
      ));
    }
  }

}

class SelectionBox {

  constructor(parent, initX, initY, clickTarget) {
    this.selectionBox = true;
    this.canceled = false;
    this.parent = parent;
    this.initX = this.toCameraX(this.lastX = initX);
    this.initY = this.toCameraY(this.lastY = initY);
    this.clickTarget = clickTarget;
    const elem = document.createElement('div');
    elem.classList.add('sel-box');
    parent.wrapper.appendChild(elem);
    this.elem = elem;
    this.dragging = false;
  }

  toCameraX(x) {
    return x / camera.scale + camera.x;
  }

  toCameraY(y) {
    return y / camera.scale + camera.y;
  }

  setDragPos(mouseX, mouseY) {
    mouseX = this.toCameraX(this.lastX = mouseX), mouseY = this.toCameraY(this.lastY = mouseY);
    if (!this.dragging) {
      if (compDist(this.initX - mouseX, this.initY - mouseY, DRAG_DIST) === 1) {
        this.dragging = true;
      } else {
        return;
      }
    }
    const minX = Math.min(mouseX, this.initX);
    const minY = Math.min(mouseY, this.initY);
    const maxX = Math.max(mouseX, this.initX);
    const maxY = Math.max(mouseY, this.initY);
    const elem = this.elem;
    elem.style.width = (maxX - minX) + 'px';
    elem.style.height = (maxY - minY) + 'px';
    elem.style.transform = `translate(${minX}px, ${minY}px)`;
    this.state = [minX, minY, maxX, maxY];
  }

  stopDragging() {
    if (this.canceled) return;
    this.parent.wrapper.removeChild(this.elem);
    if (!this.dragging) {
      if (this.clickTarget) {
        this.clickTarget.selected = !this.clickTarget.selected;
        if (this.clickTarget.selected) this.clickTarget.elem.classList.add('selected');
        else this.clickTarget.elem.classList.remove('selected');
      } else {
        this.parent.clearSelection();
      }
      return;
    }
    const [minX, minY, maxX, maxY] = this.state.map((n, i) => (i < 2 ? Math.floor : Math.ceil)(n / GRID_SIZE) * GRID_SIZE);
    this.parent.elements.filter(card =>
      !card.selected && card.x >= minX && card.y >= minY && card.x < maxX && card.y < maxY)
    .forEach(card => {
      card.selected = true;
      card.elem.classList.add('selected');
    });
  }

  cancel() {
    this.parent.wrapper.removeChild(this.elem);
    this.canceled = true;
  }

}

function init([elements]) {
  const gridLines = document.getElementById('gridlines');
  const cardsWrapper = document.getElementById('cards');
  const mouseTooltip = document.getElementById('mouse-tooltip');
  const showBar = document.getElementById('show-bar');

  function touchMove(e) {
    Object.values(e.changedTouches).forEach(touch => {
      const card = cardParent.touchDrags[touch.identifier];
      if (!card) return;
      card.setDragPos(touch.clientX, touch.clientY);
    });
    e.preventDefault();
  }
  function touchEnd(e) {
    Object.values(e.changedTouches).forEach(touch => {
      const card = cardParent.touchDrags[touch.identifier];
      if (!card) return;
      card.setDragPos(touch.clientX, touch.clientY);
      if (card.scroll) {
        cardParent.touchScroller = null;
      }
      if (card.stopDragging) card.stopDragging();
      delete cardParent.touchDrags[touch.identifier];
    });
    e.preventDefault();
    if (!Object.keys(cardParent.touchDrags).length) {
      document.removeEventListener('touchmove', touchMove);
      document.removeEventListener('touchend', touchEnd);
      cardParent.touchListenersCreated = false;
    }
  }
  function mouseMove(e) {
    const card = cardParent.mouseDrag;
    if (!card) return;
    card.setDragPos(e.clientX, e.clientY);
    e.preventDefault();
  }
  function mouseEnd(e) {
    const card = cardParent.mouseDrag;
    if (!card) return;
    card.setDragPos(e.clientX, e.clientY);
    if (card.stopDragging) card.stopDragging();
    cardParent.mouseDrag = null;
    e.preventDefault();
    document.removeEventListener('mousemove', mouseMove);
    document.removeEventListener('mouseup', mouseEnd);
    cardParent.mouseListenersCreated = false;
  }

  const cardParent = {
    wrapper: cardsWrapper,
    fragment: document.createDocumentFragment(),
    touchDrags: {},
    touchScroller: null,
    touchListenersCreated: false,
    createTouchListeners() {
      if (this.touchListenersCreated) return;
      this.touchListenersCreated = true;
      document.addEventListener('touchmove', touchMove, {passive: false});
      document.addEventListener('touchend', touchEnd, {passive: false});
    },
    mouseDrag: null,
    mouseListenersCreated: false,
    createMouseListeners() {
      if (this.mouseListenersCreated) return;
      this.mouseListenersCreated = true;
      document.addEventListener('mousemove', mouseMove);
      document.addEventListener('mouseup', mouseEnd);
    },
    clearSelection() {
      this.elements.filter(card => card.selected).forEach(card => {
        card.selected = false;
        card.elem.classList.remove('selected');
      });
    }
  };
  elements = elements.map(data => new Card(cardParent, data));
  cardParent.elements = elements;
  cardsWrapper.appendChild(cardParent.fragment);

  document.addEventListener('touchstart', e => {
    const touch = e.changedTouches[0];
    if (!cardParent.touchDrags[touch.identifier]) {
      const initX = camera.x, initY = camera.y, initScale = camera.scale;
      if (cardParent.touchScroller !== null) {
        const partner = cardParent.touchDrags[cardParent.touchScroller];
        if (partner.selectionBox) {
          partner.cancel();
        }
        if (partner.paired) return;
        else partner.paired = true;
        const initCX = (touch.clientX + partner.lastX) / 2;
        const initCY = (touch.clientY + partner.lastY) / 2;
        const initDist = Math.hypot(touch.clientX - partner.lastX, touch.clientY - partner.lastY);
        const lastVals = {x1: touch.clientX, y1: touch.clientY, x2: partner.lastX, y2: partner.lastY};
        function recalc(x1, y1, x2, y2) {
          const centreX = (x1 + x2) / 2;
          const centreY = (y1 + y2) / 2;
          const dist = Math.hypot(x1 - x2, y1 - y2);
          camera.scale = dist / initDist * initScale;
          camera.x = initX + initCX / initScale - centreX / camera.scale;
          camera.y = initY + initCY / initScale - centreY / camera.scale;
        }
        partner.setDragPos = (mouseX, mouseY) => recalc(lastVals.x1, lastVals.y1, lastVals.x2 = mouseX, lastVals.y2 = mouseY);
        cardParent.touchDrags[touch.identifier] = {
          scroll: true,
          setDragPos(mouseX, mouseY) {
            recalc(lastVals.x1 = mouseX, lastVals.y1 = mouseY, lastVals.x2, lastVals.y2);
          }
        };
      } else if (options.multiple) {
        cardParent.touchScroller = touch.identifier;
        cardParent.touchDrags[touch.identifier] = new SelectionBox(cardParent, touch.clientX, touch.clientY, null);
        cardParent.touchDrags[touch.identifier].scroll = true;
        e.preventDefault();
        cardParent.createTouchListeners();
      } else {
        cardParent.touchScroller = touch.identifier;
        cardParent.touchDrags[touch.identifier] = {
          scroll: true,
          paired: false,
          lastX: touch.clientX, lastY: touch.clientY,
          dx: 0, dy: 0,
          setDragPos(mouseX, mouseY) {
            if (mouseX - this.lastX === 0 && mouseY - this.lastY === 0) {
              camera.xv = -this.dx;
              camera.yv = -this.dy;
              camera.vel = true;
            } else {
              this.dx = mouseX - this.lastX;
              this.dy = mouseY - this.lastY;
            }
            camera.x = initX + touch.clientX / initScale - (this.lastX = mouseX) / camera.scale;
            camera.y = initY + touch.clientY / initScale - (this.lastY = mouseY) / camera.scale;
          }
        };
      }
      e.preventDefault();
      cardParent.createTouchListeners();
    }
  }, {passive: false});
  document.addEventListener('mousedown', e => {
    if (!cardParent.mouseDrag) {
      if (options.multiple && e.shiftKey) {
        cardParent.mouseDrag = new SelectionBox(cardParent, e.clientX, e.clientY, null);
        e.preventDefault();
        cardParent.createMouseListeners();
      } else {
        const initX = camera.x, initY = camera.y, initScale = camera.scale;
        cardParent.mouseDrag = {
          scroll: true,
          dragging: false,
          setDragPos(mouseX, mouseY) {
            if (!this.dragging) {
              if (compDist(e.clientX - mouseX, e.clientY - mouseY, DRAG_DIST) === 1) {
                this.dragging = true;
              } else {
                return;
              }
            }
            camera.x = initX + e.clientX / initScale - mouseX / camera.scale;
            camera.y = initY + e.clientY / initScale - mouseY / camera.scale;
          }
        };
        if (options.multiple) {
          cardParent.mouseDrag.stopDragging = () => {
            if (!cardParent.mouseDrag.dragging)
              cardParent.clearSelection();
          };
        }
        e.preventDefault();
        cardParent.createMouseListeners();
      }
    }
  });

  elements.sort((a, b) => a.data.mass - b.data.mass).forEach((card, i) => {
    card.setPos(i * GRID_SIZE, 0);
  });

  document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(0,0,0,0.3)' stroke-width='3'%3E%3Cpath d='M0 ${GRID_SIZE}H${GRID_SIZE}V0'/%3E%3C/svg%3E")`;

  document.addEventListener('touchstart', e => {
    mouseTooltip.classList.add('hidden');
    options.multiple = false;
  }, {once: true});

  window.addEventListener('wheel', e => {
    if (e.ctrlKey) {
      const change = Math.abs(e.deltaY / 1000) + 1;
      const oldScale = camera.scale;
      let xDiff = -camera.x * oldScale - e.clientX, yDiff = -camera.y * oldScale - e.clientY;
      if (e.deltaY > 0) {
        camera.scale /= change, xDiff /= change, yDiff /= change;
      } else if (e.deltaY < 0) {
        camera.scale *= change, xDiff *= change, yDiff *= change;
      }
      camera.x = -(e.clientX + xDiff) / camera.scale;
      camera.y = -(e.clientY + yDiff) / camera.scale;
      e.preventDefault();
    } else {
      camera.x += e.shiftKey ? e.deltaY : e.deltaX;
      camera.y += e.shiftKey ? e.deltaX : e.deltaY;
      if (e.deltaX) e.preventDefault();
    }
  });

  win.height = window.innerHeight;
  win.width = window.innerWidth;
  window.addEventListener('resize', e => {
    win.height = window.innerHeight;
    win.width = window.innerWidth;
  });

  showBar.addEventListener('touchstart', e => {
    e.stopPropagation();
  });
  showBar.addEventListener('mousedown', e => {
    e.stopPropagation();
  });
  showBar.addEventListener('click', e => {
    if (e.target.dataset.prop) {
      document.body.className = 'show-' + e.target.dataset.prop;
    }
  });

  function paint() {
    if (camera.vel) {
      camera.xv *= 0.9;
      camera.yv *= 0.9;
      camera.x += camera.xv;
      camera.y += camera.yv;
      if (Math.abs(camera.xv) < 1 && Math.abs(camera.yv) < 1) camera.vel = false;
    }

    cardsWrapper.style.transform = `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`;
    document.body.style.backgroundPosition = `${-(camera.x % GRID_SIZE) * camera.scale}px ${-(camera.y % GRID_SIZE) * camera.scale}px`;
    document.body.style.backgroundSize = GRID_SIZE * camera.scale + 'px';

    // if (cardParent.mouseDrag) cardParent.mouseDrag.checkAutoScroll();

    window.requestAnimationFrame(paint);
  }
  camera.scale = 0.5;
  camera.x = -GRID_SIZE / 2;
  camera.y = -(win.height - GRID_SIZE) / 2 / camera.scale;
  paint();
}

Promise.all([
  fetch('./olam.json').then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
