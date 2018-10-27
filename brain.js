const GRID_SIZE = 70;

const camera = {x: 0, y: 0, vel: false, smooth: false};

function init([elements]) {
  const gridLines = document.getElementById('gridlines');

  document.addEventListener('wheel', e => {
    camera.x += e.shiftKey ? e.deltaY : e.deltaX;
    camera.y += e.shiftKey ? 0 : e.deltaY;
  });

  function paint() {
    const height = window.innerHeight;
    const width = window.innerWidth;

    if (camera.vel) {
      camera.xv *= 0.9;
      camera.yv *= 0.9;
      camera.x += camera.xv;
      camera.y += camera.yv;
      if (Math.abs(camera.xv) < 1 && Math.abs(camera.yv) < 1) {
        camera.vel = false;
      }
    } else if (camera.smooth) {
      const dX = camera.destX - camera.x;
      const dY = camera.destY - ;
    }
    let path = '';
    for (let i = -camera.x % GRID_SIZE; i < width; i += GRID_SIZE) {
      path += `M${i} 0V${height}`;
    }
    for (let i = -camera.y % GRID_SIZE; i < height; i += GRID_SIZE) {
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
