const GRID_SIZE = 150;
const SCROLL_THRESHOLD = GRID_SIZE * 100;
const AUTO_SCROLL_SPEED = 10;

const options = {
  showGrid: true,
  drag: true,
  snap: true
};

const win = {};

const camera = {x: 0, y: 0, scale: 1};

let globalOffsetX = 0, globalOffsetY = 0;

class Card {

  constructor(parent, data) {
    this.parent = parent;
    this.data = data;
    this.x = 0, this.y = 0;
    this.dragData = null;
    const elem = document.createElement('div');
    this.elem = elem;
    elem.classList.add('card');
    elem.innerHTML = data.name;
    elem.addEventListener('touchstart', e => {
      if (!options.drag) return;
      const touch = e.changedTouches[0];
      this.initDragData(touch.clientX, touch.clientY);
      parent.touchDrags[touch.identifier] = this;
      e.preventDefault();
      this.parent.createTouchListeners();
      this.toTop();
    }, {passive: false});
    elem.addEventListener('mousedown', e => {
      if (!options.drag) return;
      if (this.dragData === null) { // make sure it hasn't been touched beforehand
        this.initDragData(e.clientX, e.clientY);
        parent.mouseDrag = this;
        e.preventDefault();
        this.parent.createMouseListeners();
        this.toTop();
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
    if (this.snap)
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
  }

  stopDragging() {
    this.dragData = null;
    this.elem.classList.remove('dragged');
  }

  initDragData(mouseX, mouseY) {
    const visualGridSize = GRID_SIZE * camera.scale;
    this.dragData = {
      dragging: false,
      offsetX: (mouseX - this.x) / visualGridSize,
      offsetY: (mouseY - this.y) / visualGridSize,
      imitX: mouseX, initY: mouseY
    };
  }

  setDragPos(mouseX, mouseY) {
    const visualGridSize = GRID_SIZE * camera.scale;
    if (!this.dragData.dragging) {
      if (Math.abs(this.dragData.initX - mouseX) > 4 || Math.abs(this.dragData.initY - mouseY) > 4) {
        this.dragData.dragging = true;
        this.startDragging();
      } else {
        return;
      }
    }
    this.setPos(mouseX - this.dragData.offsetX * visualGridSize, mouseY - this.dragData.offsetY * visualGridSize);
  }

}

function init([elements]) {
  const gridLines = document.getElementById('gridlines');
  const cardsWrapper = document.getElementById('cards');

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
      card.stopDragging();
      card.snap();
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
    card.stopDragging();
    card.snap();
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
    }
  };
  elements = elements.map(data => new Card(cardParent, data));
  cardsWrapper.appendChild(cardParent.fragment);

  elements.sort((a, b) => a.data.mass - b.data.mass).forEach((card, i) => {
    card.setPos(i * GRID_SIZE, 0);
  });

  document.body.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='rgba(0,0,0,0.1)'%3E%3Cpath d='M0 ${GRID_SIZE}H${GRID_SIZE}V0'/%3E%3C/svg%3E")`;

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

  function paint() {
    win.height = window.innerHeight;
    win.width = window.innerWidth;
    win.scrollX = window.scrollX;
    win.scrollY = window.scrollY;

    cardsWrapper.style.transform = `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`;
    document.body.style.backgroundPosition = `${-(camera.x % GRID_SIZE) * camera.scale}px ${-(camera.y % GRID_SIZE) * camera.scale}px`;
    document.body.style.backgroundSize = GRID_SIZE * camera.scale + 'px';

    // if (cardParent.mouseDrag) cardParent.mouseDrag.checkAutoScroll();

    window.requestAnimationFrame(paint);
  }
  paint();
}

Promise.all([
  fetch('./olam.json').then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
