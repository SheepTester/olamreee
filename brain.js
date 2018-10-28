const GRID_SIZE = 150;
const SCROLL_THRESHOLD = GRID_SIZE * 100;
const AUTO_SCROLL_SPEED = 10;
const DRAG_DIST = 4;

const CHARACTERISTICS = {
  'unreactive gas': 'Hadashite, Puzzlite, Shemeshite, and Voyagite are very unreactive. No compounds of these elements are known to exist on Olam.',
  'triatomic gas': 'Aquagen is a triatomic gas, as is Acidium.',
  '(see #3)': 'Newairon, Flowing, and Greening all exist as either diatomic gases or crystalline solids. They readily enter into ionic compounds of the form NwX<sub>2</sub> , where X = Fl, or Gr.',
  'unreactive metal': 'Badgerin, Brooklin, Tennessean, and Zinzan are rather unreactive metals that are used in Olamite coinage.',
  'high IE': 'Margaran, Chameshan, Halfwanon and Gazozite have higher than expected ionization energies.'
};

const options = {
  showGrid: true,
  drag: true,
  snap: true,
  multiple: true,
  multipleTouch: false
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
    if (data.note) {
      elem.classList.add(data.note.toLowerCase().replace(/[^a-z0-9]/g, ''));
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
      if (options.multiple && options.multipleTouch) {
        parent.touchDrags[touch.identifier] = new SelectionBox(parent, touch.clientX, touch.clientY, this);
        e.preventDefault();
        this.parent.createTouchListeners();
      } else if (options.drag) {
        if (this.dragData === null) {
          this.initDragData(touch.clientX, touch.clientY);
          parent.touchDrags[touch.identifier] = this;
          e.preventDefault();
          this.parent.createTouchListeners();
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
    const x = Math.round(this.x / GRID_SIZE);
    const y = Math.round(this.y / GRID_SIZE);
    this.setPos(x * GRID_SIZE, y * GRID_SIZE);
    const posStr = x + '.' + y;
    if (this.parent.positions[posStr]) {
      this.elem.classList.add('stacked');
    } else {
      this.parent.positions[posStr] = 0;
    }
    this.parent.positions[posStr]++;
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

  becomeDragged() {
    this.elem.classList.add('dragged');
    this.elem.classList.remove('stacked');
    this.parent.positions[Math.round(this.x / GRID_SIZE) + '.' + Math.round(this.y / GRID_SIZE)]--;
  }

  startDragging() {
    this.becomeDragged();
    if (this.selected) {
      this.dragData.selected.forEach(card => card.becomeDragged());
    }
  }

  becomeDropped(dragging) {
    if (dragging) {
      this.elem.classList.remove('dragged');
      if (options.snap) this.snap();
    }
    this.dragData = null;
  }

  stopDragging() {
    if (!this.dragData.dragging) {
      this.parent.infoElems.overlayCover.classList.add('showing');
      this.parent.infoElems.overlay.classList.add('showing');
      this.setInformation(this.parent.infoElems);
    }
    const selected = this.dragData.selected;
    const dragging = this.dragData.dragging;
    this.becomeDropped(dragging);
    if (this.selected) {
      selected.forEach(card => card.becomeDropped(dragging));
    }
  }

  fillDropData(mouseX, mouseY) {
    this.dragData = {
      offsetX: (mouseX / camera.scale - this.x + camera.x) / GRID_SIZE,
      offsetY: (mouseY / camera.scale - this.y + camera.y) / GRID_SIZE
    };
    this.toTop();
  }

  initDragData(mouseX, mouseY) {
    this.fillDropData(mouseX, mouseY);
    this.dragData.dragging = false;
    this.dragData.initX = mouseX;
    this.dragData.initY = mouseY;
    if (this.selected) {
      const selected = this.parent.elements.filter(card => card.selected && card !== this);
      selected.forEach(card => card.fillDropData(mouseX, mouseY));
      this.dragData.selected = selected;
    }
  }

  setPosFromMouse(mouseX, mouseY) {
    this.setPos(
      mouseX / camera.scale + camera.x - this.dragData.offsetX * GRID_SIZE,
      mouseY / camera.scale + camera.y - this.dragData.offsetY * GRID_SIZE
    );
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
    this.setPosFromMouse(mouseX, mouseY);
    if (this.selected) {
      this.dragData.selected.forEach(card => card.setPosFromMouse(mouseX, mouseY));
    }
  }

  setInformation({name, mass, state, melting, type, ie, note}) {
    const data = this.data;
    name.innerHTML = `<strong>${data.symbol}</strong> &mdash; ${data.name}`;
    mass.textContent = data.mass;
    state.textContent = data.state;
    melting.textContent = data.melting;
    type.textContent = data.type;
    ie.textContent = data.ie;
    note.innerHTML = CHARACTERISTICS[data.note] || 'This element isn\'t very special :(';
  }

  reposition(x, y) {
    this.parent.positions[Math.round(this.x / GRID_SIZE) + '.' + Math.round(this.y / GRID_SIZE)]--;
    this.setPos(x * GRID_SIZE, y * GRID_SIZE);
    this.snap();
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
  const overlayCover = document.getElementById('overlay-cover');
  const menu = document.getElementById('menu');
  const savecode = document.getElementById('savecode');

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
    positions: {},
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
    },
    infoElems: {
      overlayCover: overlayCover,
      overlay: document.getElementById('element-info'),
      name: document.getElementById('element-name'),
      mass: document.getElementById('element-mass'),
      state: document.getElementById('element-state'),
      melting: document.getElementById('element-melting'),
      type: document.getElementById('element-type'),
      ie: document.getElementById('element-ie'),
      note: document.getElementById('element-note')
    }
  };
  elements = elements.map(data => new Card(cardParent, data));
  cardParent.elements = elements;
  cardsWrapper.appendChild(cardParent.fragment);

  document.addEventListener('touchstart', e => {
    if (!cardsWrapper.contains(e.target) && e.target !== document.body) return;
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
      } else if (options.multiple && options.multipleTouch) {
        cardParent.touchScroller = touch.identifier;
        cardParent.touchDrags[touch.identifier] = new SelectionBox(cardParent, touch.clientX, touch.clientY, null);
        cardParent.touchDrags[touch.identifier].scroll = true;
        e.preventDefault();
        cardParent.createTouchListeners();
      } else {
        cardParent.touchScroller = touch.identifier;
        cardParent.touchDrags[touch.identifier] = {
          scroll: true,
          dragging: false,
          paired: false,
          lastX: touch.clientX, lastY: touch.clientY,
          dx: 0, dy: 0,
          setDragPos(mouseX, mouseY) {
            if (!this.dragging) {
              if (compDist(touch.clientX - mouseX, touch.clientY - mouseY, DRAG_DIST) === 1) {
                this.dragging = true;
              } else {
                return;
              }
            }
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
        if (options.multiple && options.multipleTouch) {
          cardParent.touchDrags[touch.identifier].stopDragging = () => {
            if (!cardParent.touchDrags[touch.identifier].dragging)
              cardParent.clearSelection();
          };
        }
      }
      e.preventDefault();
      cardParent.createTouchListeners();
    }
  }, {passive: false});
  document.addEventListener('mousedown', e => {
    if (!cardsWrapper.contains(e.target) && e.target !== document.body) return;
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
        if (options.multiple && options.multipleTouch) {
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
    card.reposition(i, 0);
  });

  document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(0,0,0,0.3)' stroke-width='3'%3E%3Cpath d='M0 ${GRID_SIZE}H${GRID_SIZE}V0'/%3E%3C/svg%3E")`;

  document.addEventListener('touchstart', e => {
    mouseTooltip.classList.add('hidden');
    const toggleMultiple = document.getElementById('multiple-btn');
    toggleMultiple.classList.remove('hidden');
    toggleMultiple.addEventListener('click', e => {
      options.multipleTouch = !options.multipleTouch;
      if (options.multipleTouch) toggleMultiple.classList.add('multiple-active');
      else toggleMultiple.classList.remove('multiple-active');
    });
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

  showBar.addEventListener('click', e => {
    if (e.target.dataset.prop) {
      document.body.className = 'show-' + e.target.dataset.prop;
    }
  });

  Array.from(document.getElementsByClassName('close')).forEach(closeBtn => closeBtn.addEventListener('click', e => {
    closeBtn.parentNode.classList.remove('showing');
    overlayCover.classList.remove('showing');
  }));

  document.getElementById('menu-btn').addEventListener('click', e => {
    menu.classList.add('showing');
    overlayCover.classList.add('showing');
    const vals = ["approved by the sheep"];
    elements.forEach(card => {
      vals.push(Math.round(card.x / GRID_SIZE));
      vals.push(Math.round(card.y / GRID_SIZE));
    });
    savecode.value = btoa(JSON.stringify(vals));
  });
  document.getElementById('load').addEventListener('click', e => {
    try {
      const vals = JSON.parse(atob(savecode.value).trim()).slice(1);
      elements.forEach((card, i) => {
        card.reposition(vals[i * 2], vals[i * 2 + 1]);
      });
    } catch (e) {
      alert('there was a problem with your save code!');
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
