// URL PARAMETERS
// source   - where to load JSON data from
// room     - live editing room ID
// key      - localStorage name for the save code
// code     - the code to load (+: -; =: _)
// show     - filter to show by default
// override - base64 encoded JSON to override/add properties (+: -; =: _)
const params = {};
if (window.location.search) {
  window.location.search.slice(1).split('&').forEach(entry => {
    const equalSignLoc = entry.indexOf('=');
    if (~equalSignLoc) {
      params[entry.slice(0, equalSignLoc)] = entry.slice(equalSignLoc + 1);
    } else {
      params[entry] = true;
    }
  });
}

const SOURCE = params.source ? params.source : './olam';
const COOKIE_NAME = params.key ? '[olamreee] savecode.custom.' + params.key : '[olamreee] savecode' + SOURCE;

const OLAMREEE_GENESIS = new Date(2018, 9, 26);
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25; // good enough approximation

let multiplayerScriptTag;
if (params.room) {
  window.TogetherJSConfig_siteName = 'OlamREEE';
  window.TogetherJSConfig_toolName = 'Happy Sheep Collaboration Tool';
  window.TogetherJSConfig_dontShowClicks = true;
  window.TogetherJSConfig_findRoom = params.room;
  window.TogetherJSConfig_autoStart = true;
  window.TogetherJSConfig_suppressJoinConfirmation = true;
  window.TogetherJSConfig_suppressInvite = true;
  window.TogetherJSConfig_youtube = false;
  window.TogetherJSConfig_ignoreMessages = true;
  window.TogetherJSConfig_ignoreForms = true;
  multiplayerScriptTag = document.createElement('script');
  multiplayerScriptTag.src = 'https://togetherjs.com/togetherjs-min.js';
  document.head.appendChild(multiplayerScriptTag);
  sessionStorage.removeItem('togetherjs-session.status');
  sessionStorage.removeItem('togetherjs-session.peerCache');
}

const GRID_SIZE = 150;
const SCROLL_THRESHOLD = GRID_SIZE * 100;
const AUTO_SCROLL_SPEED = 10;
const DRAG_DIST = 4;
function getGrid(dark) {
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${GRID_SIZE}' height='${GRID_SIZE}' fill='none' stroke='${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)'}' stroke-width='2'%3E%3Cpath d='M0 0V${GRID_SIZE}H${GRID_SIZE}V0z'/%3E%3C/svg%3E")`;
}

const options = {
  showGrid: true,
  drag: true,
  snap: true,
  multiple: true,
  multipleTouch: false,
  notes: true
};

const colourScales = {};

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
  return value
    .toString()
    .toLowerCase()
    .replace(/^([0-9-])/g, 'z$1')
    .replace(/[^a-z0-9-]/g, '') || 'z' + value.charCodeAt();
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i >= 1; i--) {
    const index = Math.floor(Math.random() * i);
    // Swap ith item with a random item before it
    [array[i], array[index]] = [array[index], array[i]];
  }
  return array;
}

class Card {

  constructor(parent) {
    this.parent = parent;
    this.x = 0, this.y = 0;
    this.dragData = null;
    this.selected = false;
    const elem = document.createElement('div');
    elem.classList.add('card');
    this.elem = elem;
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

  becomeDragged() {
    this.elem.classList.add('dragged');
    this.elem.classList.remove('stacked');
    if (this.snapped)
      this.unposition();
    this.snapped = false;
    this.lastIdentifier = this.identifier;
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

  handleClick() {
    return;
  }

  stopDragging() {
    if (!this.dragData.dragging) {
      this.handleClick();
    }
    const selected = this.dragData.selected || [];
    const dragging = this.dragData.dragging;
    this.becomeDropped(dragging);
    if (this.selected) {
      selected.forEach(card => card.becomeDropped(dragging));
    }
    if (this.parent.multiplayer) {
      this.parent.newPositions([this, ...selected].map(card => {
        const obj = {identifier: card.lastIdentifier};
        [obj.x, obj.y] = card.getIntPos(false);
        return obj;
      }));
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
      const selected = this.parent.cards.filter(card => card.selected && card !== this);
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

  getIntPos(strNotation) {
    const x = Math.round(this.x / GRID_SIZE);
    const y = Math.round(this.y / GRID_SIZE);
    if (strNotation) return x + '.' + y;
    else return [x, y];
  }

  reposition(x, y, move = false) {
    if (move && this.snapped) {
      this.unposition();
    }
    this.setPos(x * GRID_SIZE, y * GRID_SIZE);
    this.snap();
  }

  unposition() {
    const pos = this.getIntPos(true);
    this.parent.positions[pos]--;
    this.parent.cards.find(card => card.getIntPos(true) === pos).elem.classList.remove('stacked');
  }

  hide() {
    this.elem.classList.add('hidden');
  }

  show() {
    this.elem.classList.remove('hidden')
  }

}

class ElementCard extends Card {

  constructor(parent, data) {
    super(parent);

    this.data = data;
    const metadata = parent.metadata;
    const elem = this.elem;
    if (data._OVERRIDEN_ === true)
      this.elem.classList.add('predicted');
    let innerHTML = `<span class="name">${data.name}</span><span class="symbol">${data.symbol}</span>`;
    Object.keys(metadata).forEach(prop => {
      if (data[prop] === undefined) return;
      if (metadata[prop].key.type === 'range') {
        elem.style.setProperty('--' + prop, colourScales[prop](data[prop]).css());
      } else {
        elem.classList.add(`z${prop}-${classnameify(data[prop])}`);
      }
      if (!metadata[prop]['colours-only']) {
        if (Array.isArray(data._OVERRIDEN_) && data._OVERRIDEN_.includes(prop)) {
          innerHTML += `<span class="z${prop} overriden">${data[prop]}*</span>`;
        } else {
          innerHTML += `<span class="z${prop}">${data[prop]}</span>`;
        }
      }
    });
    elem.innerHTML = innerHTML;
    this.identifier = this.data.symbol;
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

  handleClick() {
    this.parent.openOverlay(this.parent.infoElems.overlay);
    this.setInformation(this.parent.infoElems);
  }

}

class NoteCard extends Card {

  constructor(parent, noteContent = '') {
    super(parent);

    this.setNoteContent = noteContent;
    const asterisk = document.createElement('span');
    asterisk.textContent = '*';
    this.elem.appendChild(asterisk);
    this.elem.classList.add('note');

    parent.notes.push(this);
    parent.wrapper.appendChild(this.elem);
  }

  handleClick() {
    this.parent.openOverlay(this.parent.infoElems.noteOverlay);
    this.parent.infoElems.noteContent.value = this.noteContent;
    this.parent.editingNote = this;
  }

  get identifier() {
    return `--${this.getIntPos(true)}-` + this.noteContent;
  }

  poof() {
    this.unposition();
    this.parent.wrapper.removeChild(this.elem);
    const index = this.parent.notes.indexOf(this);
    if (~index) this.parent.notes.splice(index, 1);
  }

  set setNoteContent(noteContent) {
    this.noteContent = noteContent;
    this.elem.title = noteContent;
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
        this.parent.updateSelectionStatus();
      } else {
        this.parent.clearSelection();
      }
      return;
    }
    const setTo = this.setTo;
    const [minX, minY, maxX, maxY] = this.state.map((n, i) => (i < 2 ? Math.floor : Math.ceil)(n / GRID_SIZE) * GRID_SIZE);
    this.parent.cards.filter(card =>
      (setTo ? !card.selected : card.selected) && card.x >= minX && card.y >= minY && card.x < maxX && card.y < maxY)
    .forEach(card => {
      card.selected = setTo;
      setTo ? card.elem.classList.add('selected') : card.elem.classList.remove('selected');
    });
    this.parent.updateSelectionStatus();
  }

  cancel() {
    this.parent.wrapper.removeChild(this.elem);
    this.canceled = true;
  }

}

function init([elements, metadata, , multiplayer]) {
  const gridLines = document.getElementById('gridlines');
  const cardsWrapper = document.getElementById('cards');
  const mouseTooltip = document.getElementById('mouse-tooltip');
  const showBar = document.getElementById('show-bar');
  const overlayCover = document.getElementById('overlay-cover');
  const menu = document.getElementById('menu');
  const savecode = document.getElementById('savecode');
  const gridToggler = document.getElementById('grid-toggle');
  const snapToggler = document.getElementById('snap-toggle');
  const urlRoom = document.getElementById('url-room');
  const urlSource = document.getElementById('url-source');
  const urlKey = document.getElementById('url-key');
  const urlShow = document.getElementById('url-show');
  const generateURL = document.getElementById('gen-url');
  const noteEditor = document.getElementById('note-content');
  const disableNotesBtn = document.getElementById('notes-disable');

  [urlRoom, urlSource, urlKey, urlShow].forEach(input => input.addEventListener('keydown', e => {
    if (e.keyCode === 13) {
      generateURL.click();
    }
  }));
  if (params.room) urlRoom.value = params.room;
  if (params.source) urlSource.value = params.source;
  if (params.key) urlKey.value = params.key;
  if (params.show) urlShow.value = params.show;
  document.getElementById('predict-url').href = './override-editor.html' + window.location.search;
  document.getElementById('age').textContent = Math.round((Date.now() - OLAMREEE_GENESIS) / MS_PER_YEAR * 10) / 10;
  generateURL.addEventListener('click', e => {
    if (urlRoom.value) params.room = urlRoom.value;
    if (urlSource.value) params.source = urlSource.value;
    if (urlKey.value) params.key = urlKey.value;
    if (urlShow.value) params.show = urlShow.value;
    window.location = `?` + Object.keys(params).map(prop => prop + '=' + params[prop]).join('&');
  });

  if (params.override) try {
    const overrides = JSON.parse(atob(params.override.replace(/_/g, '=').replace(/-/g, '+')));
    const replace = overrides[0] === 'replace';
    if (replace) overrides.splice(0, 1);
    overrides.forEach(elem => {
      const sourceElem = elements.find(el => elem.symbol === el.symbol);
      if (sourceElem) {
        Object.keys(elem).forEach(val => {
          if (val !== '_REPLACE_')
            sourceElem[val] = elem[val];
        });
        if (!replace && !elem._REPLACE_) {
          sourceElem._OVERRIDEN_ = Object.keys(elem);
          sourceElem._OVERRIDEN_.splice(sourceElem._OVERRIDEN_.indexOf('symbol'), 1);
        }
      } else {
        if (!replace && !elem._REPLACE_) elem._OVERRIDEN_ = true;
        elements.push(elem);
      }
    });
  } catch (e) {
    console.log(e);
    alert('There was a problem with your overrides.');
  }

  const defaultSort = metadata._DEFAULT_SORT_;
  delete metadata._DEFAULT_SORT_;
  const infoElems = {
    overlayCover: overlayCover,
    overlay: document.getElementById('element-info'),
    name: document.getElementById('element-name'),
    noteOverlay: document.getElementById('note-editor'),
    noteContent: noteEditor
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
      css += `.show-${prop} .card {
        background-color: var(--${prop});
      }`;
      if (colourKey.default) {
        defaultCSS += `--${prop}:${colourKey.default};`;
      }
    } else if (colourKey.type === 'individual') {
      if (colourKey.default) {
        css += `.show-${prop} .card{background-color:${colourKey.default};}`;
      }
      Object.keys(colourKey.colours).forEach(val => {
        css += `.show-${prop} .z${prop}-${classnameify(val)} {
          background-color: ${colourKey.colours[val]};
        }`;
      });
    }
    css += `.show-${prop} .z${prop} {
      display: block;
    }`;
  });
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.appendChild(style);
  if (params.show) cardsWrapper.classList.add('show-' + params.show);
  else cardsWrapper.classList.add('show-name');

  noteEditor.addEventListener('change', e => {
    if (cardParent.editingNote) {
      const note = cardParent.editingNote;
      if (multiplayer) {
        TogetherJS.send({
          type: 'note-edit',
          x: note.x,
          y: note.y,
          oldContent: cardParent.editingNote.noteContent,
          newContent: noteEditor.value
        });
      }
      cardParent.editingNote.setNoteContent = noteEditor.value;
    }
  });
  document.getElementById('remove-note').addEventListener('click', e => {
    if (cardParent.editingNote) {
      const note = cardParent.editingNote;
      if (multiplayer) {
        TogetherJS.send({
          type: 'note-poof',
          x: note.x,
          y: note.y,
          content: cardParent.editingNote.noteContent
        });
      }
      note.poof();
      cardParent.editingNote = null;
      cardParent.closeOverlay(cardParent.infoElems.noteOverlay);
      cardParent.updateSelectionStatus();
    }
  });
  document.getElementById('remove-selected').addEventListener('click', e => {
    deleteSelectedNotes();
  });

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
      this.cards.filter(card => card.selected).forEach(card => {
        card.selected = false;
        card.elem.classList.remove('selected');
      });
      this.updateSelectionStatus();
    },
    infoElems: infoElems,
    metadata: metadata,
    statusText: document.getElementById('status'),
    updateSelectionStatus() {
      const selected = this.cards.filter(card => card.selected);
      this.statusText.textContent = selected.length ? selected.length + ' element(s) selected' : '';
      if (multiplayer) {
        TogetherJS.send({type: 'reselect', selected: selected.map(card => card.identifier)});
      }
    },
    multiplayer: multiplayer,
    newPositions(positions) {
      TogetherJS.send({type: 'move', positions: positions});
    },
    notes: [],
    editingNote: null,
    openOverlay(overlay) {
      overlayCover.classList.add('showing');
      overlay.classList.add('showing');
      [...overlay.getElementsByTagName('input'), ...overlay.getElementsByTagName('textarea'), ...overlay.getElementsByTagName('button'), ...overlay.getElementsByTagName('a')]
        .forEach(elem => elem.removeAttribute('tabindex'));
    },
    closeOverlay(overlay) {
      overlayCover.classList.remove('showing');
      overlay.classList.remove('showing');
      if (document.activeElement !== document.body)
        document.activeElement.blur();
      [...overlay.getElementsByTagName('input'), ...overlay.getElementsByTagName('textarea'), ...overlay.getElementsByTagName('button'), ...overlay.getElementsByTagName('a')]
        .forEach(elem => elem.setAttribute('tabindex', '-1'));
    },
    get cards() {
      return [...this.elements, ...this.notes];
    }
  };
  function deleteSelectedNotes() {
    if (multiplayer) {
      TogetherJS.send({
        type: 'note-many-went-poof',
        poofers: cardParent.notes.filter(note => note.selected).map(note => {
          note.poof();
          return {
            x: note.x,
            y: note.y,
            content: note.noteContent
          };
        })
      });
    } else {
      cardParent.notes.filter(note => note.selected).forEach(note => note.poof());
    }
    cardParent.updateSelectionStatus();
  }
  document.querySelectorAll('.overlay input, .overlay textarea, .overlay button, .overlay a')
    .forEach(elem => elem.setAttribute('tabindex', '-1'));
  elements = elements.map(data => {
    const card = new ElementCard(cardParent, data);
    if (!params.showAll && data.hidden) {
      // card.unposition();
      card.hide();
    }
    return card;
  });
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
        partner.stopDragging = null;
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
          },
          stopDragging() {
            if (!this.dragging) {
              if (options.multiple && options.multipleTouch) {
                cardParent.clearSelection();
              } else if (options.notes) {
                const x = Math.floor((touch.clientX / camera.scale + camera.x) / GRID_SIZE);
                const y = Math.floor((touch.clientY / camera.scale + camera.y) / GRID_SIZE);
                const note = new NoteCard(cardParent);
                note.reposition(x, y);
                cardParent.openOverlay(cardParent.infoElems.noteOverlay);
                cardParent.editingNote = note;
                if (multiplayer) {
                  TogetherJS.send({type: 'note-new', x: x, y: y});
                }
              }
            }
          }
        };
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
          },
          stopDragging(...args) {
            if (options.notes && !this.dragging && (e.ctrlKey || e.metaKey)) {
              const x = Math.floor((e.clientX / camera.scale + camera.x) / GRID_SIZE);
              const y = Math.floor((e.clientY / camera.scale + camera.y) / GRID_SIZE);
              const note = new NoteCard(cardParent);
              note.reposition(x, y);
              cardParent.openOverlay(cardParent.infoElems.noteOverlay);
              cardParent.editingNote = note;
              if (multiplayer) {
                TogetherJS.send({type: 'note-new', x: x, y: y});
              }
            }
          }
        };
        e.preventDefault();
        cardParent.createMouseListeners();
      }
    }
  });

  const visibleElements = elements.filter(elem => !elem.data.hidden);
  if (defaultSort === '_random_') {
    const width = Math.ceil(Math.sqrt(visibleElements.length));
    shuffleInPlace(visibleElements).forEach((card, i) => {
      card.reposition(i % width, Math.floor(i / width));
    });
  } else {
    visibleElements.sort((a, b) => a.data[defaultSort] - b.data[defaultSort]).forEach((card, i) => {
      card.reposition(i, 0);
    });
  }

  document.body.style.backgroundImage = getGrid(localStorage.getItem('[olamreee] theme') === 'dark');
  document.body.className = localStorage.getItem('[olamreee] theme') === 'dark' ? 'dark' : 'light';
  gridToggler.addEventListener('click', e => {
    options.showGrid = !options.showGrid;
    if (options.showGrid) {
      gridToggler.textContent = 'hide grid';
      document.body.style.backgroundImage = getGrid(localStorage.getItem('[olamreee] theme') === 'dark');
      document.body.style.backgroundColor = null;
    } else {
      gridToggler.textContent = 'show grid';
      document.body.style.backgroundImage = 'none';
      document.body.style.backgroundColor = 'white';
    }
  });
  document.getElementById('toggle-theme').addEventListener('click', e => {
    localStorage.setItem('[olamreee] theme', document.body.className = localStorage.getItem('[olamreee] theme') === 'dark' ? 'light' : 'dark');
    document.body.style.backgroundImage = getGrid(localStorage.getItem('[olamreee] theme') === 'dark');
  });
  snapToggler.addEventListener('click', e => {
    options.snap = !options.snap;
    snapToggler.textContent = options.snap ? 'disable snapping' : 'enable snapping';
  });
  disableNotesBtn.addEventListener('click', e => {
    options.notes = !options.notes;
    disableNotesBtn.textContent = options.notes ? 'disable adding notes' : 'enable adding notes';
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
  }, {passive: false});

  document.addEventListener('contextmenu', e => {
    e.preventDefault();
  });

  if (params.hideShowBar) {
    showBar.classList.add('hidden');
  }
  showBar.addEventListener('click', e => {
    if (e.target.dataset.prop) {
      cardsWrapper.className = 'show-' + e.target.dataset.prop;
    }
  });

  Array.from(document.getElementsByClassName('close')).forEach(closeBtn => closeBtn.addEventListener('click', e => {
    cardParent.closeOverlay(closeBtn.parentNode);
  }));

  function load(code) {
    try {
      let vals = JSON.parse(atob(code).trim());
      if (SOURCE === './olam') {
        switch (vals[0]) {
          case 'approved by the sheep':
            const gmIndex = elements.findIndex(card => card.data.symbol === 'Gm');
            vals.splice(gmIndex * 2 + 1, 0, 50, 0);
        }
      }
      if (!Array.isArray(vals[1])) vals.splice(1, 0, []);
      const notes = vals[1];
      vals = vals.slice(2);
      cardParent.positions = {};
      [...cardParent.notes].forEach(note => note.poof());
      notes.forEach(([content, x, y]) => {
        const note = new NoteCard(cardParent, content);
        note.reposition(x, y);
      });
      elements.forEach((card, i) => {
        if (i * 2 >= vals.length) return;
        card.reposition(vals[i * 2], vals[i * 2 + 1]);
        card.toTop();
      });
    } catch (e) {
      console.log(e);
      alert('There was a problem with your save code! Please send it to Sean, and he might be able to fix it.');
    }
  }
  function save() {
    const vals = [
      'happy sheep',
      cardParent.notes.map(note => [note.noteContent, ...note.getIntPos(false)])
    ];
    elements.forEach(card => {
      vals.push(...card.getIntPos(false));
    });
    return btoa(JSON.stringify(vals));
  }
  if (params.code)
    load(params.code.replace(/_/g, '=').replace(/-/g, '+'));
  else if (localStorage.getItem(COOKIE_NAME))
    load(localStorage.getItem(COOKIE_NAME));
  document.getElementById('menu-btn').addEventListener('click', e => {
    cardParent.openOverlay(menu);
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
    if (multiplayer)
      TogetherJS.send({type: 'load-entire-thing', code: save()});
  });
  document.addEventListener('keydown', e => {
    if (e.keyCode === 27) {
      const overlayClose = document.querySelector('.overlay.showing .close');
      if (overlayClose) overlayClose.click();
    } else if (e.keyCode === 8 || e.keyCode === 46) {
      deleteSelectedNotes();
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

    window.requestAnimationFrame(paint);
  }
  camera.scale = 0.5;
  camera.x = -GRID_SIZE / 2;
  camera.y = -(window.innerHeight - GRID_SIZE) / 2 / camera.scale;
  paint();

  if (multiplayer) {
    const styles = {};
    function createFor(userID) {
      if (styles[userID]) return;
      const style = document.createElement('style');
      document.head.insertBefore(style, document.head.firstChild);
      styles[userID] = style;
    }
    function userIDtoClass(userID) {
      return 'q' + userID.toLowerCase().replace(/^[0-9]|[^0-9a-z-]/g, '-');
    }
    TogetherJS.hub.on('load-entire-thing', msg => {
      load(msg.code);
    });
    TogetherJS.hub.on('move', msg => {
      const positions = msg.positions;
      positions.forEach(({identifier, x, y}) => {
        const card = cardParent.cards.find(card => card.identifier === identifier);
        card.reposition(x, y, true);
        card.toTop();
      });
    });
    TogetherJS.hub.on('reselect', msg => {
      const user = userIDtoClass(msg.peer.id);
      Array.from(document.getElementsByClassName(user)).forEach(card => card.classList.remove(user));
      msg.selected.forEach(identifier => {
        cardParent.cards.find(card => card.identifier === identifier).elem.classList.add(user);
      });
      createFor(msg.peer.id);
      styles[msg.peer.id].innerHTML = `.${userIDtoClass(msg.peer.id)}{box-shadow:0 0 20px ${msg.peer.color},inset 0 0 10px ${msg.peer.color};}`;
    });
    TogetherJS.hub.on('togetherjs.hello', msg => {
      createFor(msg.clientId);
      TogetherJS.send({type: 'load-entire-thing', code: save()});
      TogetherJS.send({type: 'hi-i-also-exist'});
      cardParent.updateSelectionStatus();
    });
    TogetherJS.hub.on('hi-i-also-exist', msg => {
      createFor(msg.peer.id);
    });
    TogetherJS.hub.on('note-new', msg => {
      const note = new NoteCard(cardParent);
      note.reposition(msg.x, msg.y);
    });
    TogetherJS.hub.on('note-edit', msg => {
      cardParent.notes.find(note => note.x === msg.x && note.y === msg.y
        && note.noteContent === msg.oldContent).setNoteContent = msg.newContent;
    });
    TogetherJS.hub.on('note-poof', msg => {
      cardParent.notes.find(note => note.x === msg.x && note.y === msg.y
        && note.noteContent === msg.content).poof();
    });
    TogetherJS.hub.on('note-many-went-poof', msg => {
      const xPoses = msg.poofers.map(note => note.x);
      const yPoses = msg.poofers.map(note => note.y);
      const contents = msg.poofers.map(note => note.content);
      cardParent.notes.filter(note => xPoses.includes(note.x) && yPoses.includes(note.y)
        && contents.includes(note.noteContent)).map(note => note.poof());
    });
  }

  window.brain = cardParent;
}

Promise.all([
  fetch(`${SOURCE}.json`).then(res => res.json()),
  fetch(`${SOURCE}-metadata.json`).then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true})),
  params.room && new Promise(res => multiplayerScriptTag.onload = res)
]).then(init);
