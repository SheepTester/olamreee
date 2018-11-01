// URL PARAMETERS
// source - where to load JSON data from
// key    - localStorage name for the save code
// code   - the code to load (+: -; =: _)
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

const SOURCE = params.source ? params.source : '../olam';
const COOKIE_NAME = params.key ? '[olamreee] savecode.custom.' + params.key : '[olamreee] savecode' + SOURCE;

class Editor {

  constructor() {
    //
  }

}

function init([elements, metadata]) {
  function load(code) {
    try {
      let vals = JSON.parse(atob(code).trim());
      if (SOURCE === '../olam') {
        switch (vals[0]) {
          case 'approved by the sheep':
            const gmIndex = elements.findIndex(card => card.data.symbol === 'Gm');
            vals.splice(gmIndex * 2 + 1, 0, 50, 0);
        }
      }
      if (!Array.isArray(vals[1])) vals.splice(1, 0, []);
      const notes = vals[1];
      vals = vals.slice(2);
      //
    } catch (e) {
      console.log(e);
      alert('There was a problem with your save code! Please send it to Sean, and he might be able to fix it.');
    }
  }
}

Promise.all([
  fetch(`${SOURCE}.json`).then(res => res.json()),
  fetch(`${SOURCE}-metadata.json`).then(res => res.json()),
  new Promise(res => document.addEventListener('DOMContentLoaded', res, {once: true}))
]).then(init);
