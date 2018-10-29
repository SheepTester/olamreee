const SOURCE = window.location.search === '?main-group' ? './main-group' : './olam';

const GRID_SIZE = 150;
const SCROLL_THRESHOLD = GRID_SIZE * 100;
const AUTO_SCROLL_SPEED = 10;
const DRAG_DIST = 4;
const GRID_URL = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(0,0,0,0.3)' stroke-width='3'%3E%3Cpath d='M0 ${GRID_SIZE}H${GRID_SIZE}V0'/%3E%3C/svg%3E")`;
const COOKIE_NAME = '[olamreee] savecode' + SOURCE;

const options = {
  showGrid: true,
  drag: true,
  snap: true,
  multiple: true,
  multipleTouch: false
};

const colourScales = {};

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

function createFragment(elems) {
  const fragment = document.createDocumentFragment();
  elems.forEach(elem => elem instanceof Element ? fragment.appendChild(elem) : typeof elem === 'string' && document.createTextNode(elem));
  return fragment;
}

function classnameify(value) {
  return value.toLowerCase().replace(/^([0-9-])/g, 'z$1').replace(/[^a-z0-9-]/g, '') || 'z' + value.charCodeAt();
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
    const metadata = parent.metadata;
    let innerHTML = `<span class="name">${data.name}</span><span class="symbol">${data.symbol}</span>`;
    Object.keys(metadata).forEach(prop => {
      if (data[prop] === undefined) return;
      if (metadata[prop].key.type === 'range') {
        elem.style.setProperty('--' + prop, colourScales[prop](data[prop]).css());
      } else {
        elem.classList.add(`z${prop}-${classnameify(data[prop])}`);
      }
      innerHTML += `<span class="z${prop}">${data[prop]}</span>`;
    });
    elem.innerHTML = innerHTML;
    elem.classList.add('card');
    elem.addEventListener('touchstart', e => {
      const touch = e.changedTouches[0];
      if (options.multiple && options.multipleTouch) {
        parent.touchDrags[touch.identifier] = new SelectionBox(parent, touch.clientX, touch.clientY, this, !this.selected);
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
        parent.mouseDrag = new SelectionBox(parent, e.clientX, e.clientY, this, !this.selected);
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
      this.elem.classList.remove('stacked');
    }
    this.parent.positions[posStr]++;
    this.snapped = true;
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
    if (this.snapped)
      this.parent.positions[Math.round(this.x / GRID_SIZE) + '.' + Math.round(this.y / GRID_SIZE)]--;
    this.snapped = false;
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

  setInformation(infoElems) {
    const data = this.data;
    const metadata = this.parent.metadata;
    infoElems.name.innerHTML = `<strong>${data.symbol}</strong> &mdash; ${data.name}`;
    Object.keys(metadata).forEach(prop => {
      if (metadata[prop]['info-values']) {
        infoElems[prop].innerHTML = metadata[prop]['info-values'][data[prop]] || metadata[prop]['info-values']._DEFAULT_;
      } else {
        infoElems[prop].innerHTML = data[prop];
      }
    });
  }

  reposition(x, y) {
    this.setPos(x * GRID_SIZE, y * GRID_SIZE);
    this.snap();
  }

}

class SelectionBox {

  constructor(parent, initX, initY, clickTarget, setTo) {
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
    this.setTo = setTo;
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
    this.parent.statusText.textContent = (Math.ceil(maxX / GRID_SIZE) - Math.floor(minX / GRID_SIZE)) + ' by ' + (Math.ceil(maxY / GRID_SIZE) - Math.floor(minY / GRID_SIZE));
  }

  stopDragging() {
    if (this.canceled) return;
    this.parent.wrapper.removeChild(this.elem);
    if (!this.dragging) {
      if (this.clickTarget) {
        this.clickTarget.selected = !this.clickTarget.selected;
        if (this.clickTarget.selected) this.clickTarget.elem.classList.add('selected');
        else this.clickTarget.elem.classList.remove('selected');
        const selectedCount = this.parent.elements.filter(card => card.selected).length;
        this.parent.statusText.textContent = selectedCount ? selectedCount + ' element(s) selected' : '';
      } else {
        this.parent.clearSelection();
      }
      return;
    }
    const setTo = this.setTo;
    const [minX, minY, maxX, maxY] = this.state.map((n, i) => (i < 2 ? Math.floor : Math.ceil)(n / GRID_SIZE) * GRID_SIZE);
    this.parent.elements.filter(card =>
      (setTo ? !card.selected : card.selected) && card.x >= minX && card.y >= minY && card.x < maxX && card.y < maxY)
    .forEach(card => {
      card.selected = setTo;
      setTo ? card.elem.classList.add('selected') : card.elem.classList.remove('selected');
    });
    const selectedCount = this.parent.elements.filter(card => card.selected).length;
    this.parent.statusText.textContent = selectedCount ? selectedCount + ' element(s) selected' : '';
  }

  cancel() {
    this.parent.wrapper.removeChild(this.elem);
    this.canceled = true;
  }

}

function init([elements, metadata]) {
  const gridLines = document.getElementById('gridlines');
  const cardsWrapper = document.getElementById('cards');
  const mouseTooltip = document.getElementById('mouse-tooltip');
  const showBar = document.getElementById('show-bar');
  const overlayCover = document.getElementById('overlay-cover');
  const menu = document.getElementById('menu');
  const savecode = document.getElementById('savecode');
  const gridToggler = document.getElementById('grid-toggle');
  const snapToggler = document.getElementById('snap-toggle');

  const defaultSort = metadata._DEFAULT_SORT_;
  delete metadata._DEFAULT_SORT_;
  const infoElems = {
    overlayCover: overlayCover,
    overlay: document.getElementById('element-info'),
    name: document.getElementById('element-name')
  };
  showBar.appendChild(createFragment(Object.keys(metadata).map(prop => {
    const btn = document.createElement('button');
    btn.dataset.prop = prop;
    btn.innerHTML = metadata[prop]['show-btn'];
    return btn;
  })));
  document.getElementById('element-info-content').appendChild(createFragment(Object.keys(metadata).map(prop => {
    const p = document.createElement('p');
    p.innerHTML = `<strong>${metadata[prop]['info-label']}</strong>: ${metadata[prop].prefix || ''}`;
    const span = document.createElement('span');
    infoElems[prop] = span;
    p.appendChild(span);
    if (metadata[prop].suffix) {
      const suffix = document.createElement('span');
      suffix.innerHTML = metadata[prop].suffix;
      p.appendChild(suffix);
    }
    return p;
  })));
  let css = Object.keys(metadata).map(prop => '.z' + prop).join(',') + `{
    display: none;
    text-align: center;
    position: absolute;
    left: 0;
    top: 16px;
    width: 100%;
    font-size: 24px;
  }`;
  let defaultCSS = `.card{`
  Object.keys(metadata).forEach(prop => {
    const colourKey = metadata[prop].key;
    if (colourKey.type === 'range') {
      colourScales[prop] = chroma.scale(colourKey.colours).domain(colourKey.domain);
      css += `body.show-${prop} .card {
        background-color: var(--${prop});
      }`;
      if (colourKey.default) {
        defaultCSS += `--${prop}:${colourKey.default};`;
      }
    } else if (colourKey.type === 'individual') {
      if (colourKey.default) {
        css += `body.show-${prop} .card{background-color:${colourKey.default};}`;
      }
      Object.keys(colourKey.colours).forEach(val => {
        css += `body.show-${prop} .z${prop}-${classnameify(val)} {
          background-color: ${colourKey.colours[val]};
        }`;
      });
    }
    css += `body.show-${prop} .z${prop} {
      display: block;
    }`;
  });
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.appendChild(style);

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
      this.statusText.textContent = '';
    },
    infoElems: infoElems,
    metadata: metadata,
    statusText: document.getElementById('status')
  };
  elements = elements.map(data => new Card(cardParent, data));
  cardParent.elements = elements;
  cardsWrapper.appendChild(createFragment(elements.map(card => card.elem)));

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
        cardParent.touchDrags[touch.identifier] = new SelectionBox(cardParent, touch.clientX, touch.clientY, null, true);
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
        cardParent.mouseDrag = new SelectionBox(cardParent, e.clientX, e.clientY, null, true);
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

  elements.sort((a, b) => a.data[defaultSort] - b.data[defaultSort]).forEach((card, i) => {
    card.reposition(i, 0);
  });

  document.body.style.backgroundImage = GRID_URL;
  gridToggler.addEventListener('click', e => {
    options.showGrid = !options.showGrid;
    if (options.showGrid) {
      gridToggler.textContent = 'hide grid';
      document.body.style.backgroundImage = GRID_URL;
    } else {
      gridToggler.textContent = 'show grid';
      document.body.style.backgroundImage = 'none';
    }
  });
  snapToggler.addEventListener('click', e => {
    options.snap = !options.snap;
    snapToggler.textContent = options.snap ? 'disable snapping' : 'enable snapping';
  });

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
    if (!cardsWrapper.contains(e.target) && e.target !== document.body) return;
    if (e.ctrlKey || e.metaKey) {
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
      camera.x += (e.shiftKey ? e.deltaY : e.deltaX) / camera.scale;
      camera.y += (e.shiftKey ? e.deltaX : e.deltaY) / camera.scale;
      if (e.deltaX) e.preventDefault();
    }
  });

  document.addEventListener('contextmenu', e => {
    e.preventDefault();
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

  function load(code) {
    try {
      let vals = JSON.parse(atob(code).trim());
      if (SOURCE === './olam' && vals[0] === 'approved by the sheep') {
        const gmIndex = elements.findIndex(card => card.data.symbol === 'Gm');
        vals.splice(gmIndex * 2 + 1, 0, 50, 0);
      }
      vals = vals.slice(1);
      cardParent.positions = {};
      elements.forEach((card, i) => {
        if (i * 2 >= vals.length) return;
        card.reposition(vals[i * 2], vals[i * 2 + 1]);
        card.toTop();
      });
    } catch (e) {
      console.log(e);
      alert('there was a problem with your save code!');
    }
  }
  function save() {
    const vals = ['sheep-approved'];
    elements.forEach(card => {
      vals.push(Math.round(card.x / GRID_SIZE));
      vals.push(Math.round(card.y / GRID_SIZE));
    });
    return btoa(JSON.stringify(vals));
  }
  if (localStorage.getItem(COOKIE_NAME))
    load(localStorage.getItem(COOKIE_NAME));
  document.getElementById('menu-btn').addEventListener('click', e => {
    menu.classList.add('showing');
    overlayCover.classList.add('showing');
    savecode.value = save();
  });
  localStorage.setItem(COOKIE_NAME, save());
  autosave.addEventListener('click', e => {
    setInterval(() => localStorage.setItem(COOKIE_NAME, save()), 1000);
    autosave.disabled = true;
    autosave.textContent = 'autosave on';
  });
  document.getElementById('save').addEventListener('click', e => {
    localStorage.setItem(COOKIE_NAME, save());
  });
  document.getElementById('load').addEventListener('click', e => {
    load(savecode.value);
  });
  document.addEventListener('keydown', e => {
    if (e.keyCode === 27) {
      const overlayClose = document.querySelector('.overlay.showing .close');
      if (overlayClose) overlayClose.click();
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

  window.brain = cardParent;
}

Promise.all([
  fetch(`${SOURCE}.json`).then(res => res.json()),
  fetch(`${SOURCE}-metadata.json`).then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
