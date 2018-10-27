const GRID_SIZE = 100;

function init([elements]) {
  const gridLines = document.getElementById('gridlines');
  const cardsWrapper = document.getElementById('cards');

  const cards = document.createDocumentFragment();
  elements = elements.map(data => {
    data.elem = document.createElement('div');
    data.elem.classList.add('card');
    data.elem.innerHTML = data.symbol;
    cards.appendChild(data.elem);
    return data;
  });
  cardsWrapper.appendChild(cards);

  function paint() {
    const height = window.innerHeight;
    const width = window.innerWidth;
    const scrollX = document.body.scrollLeft;
    const scrollY = document.body.scrollTop;

    let path = '';
    for (let i = -scrollX % GRID_SIZE; i < width; i += GRID_SIZE) {
      path += `M${i} 0V${height}`;
    }
    for (let i = -scrollY % GRID_SIZE; i < height; i += GRID_SIZE) {
      path += `M0 ${i}H${width}`;
    }
    gridLines.setAttributeNS(null, 'd', path);

    window.requestAnimationFrame(paint);
  }
  paint();
}

Promise.all([
  fetch('./olam.json').then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
