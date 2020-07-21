import {promises as fs} from 'fs';

const squareLineRegex = /([0-9a-z]+) (?:(\d+)|\((\d+)\))/i;

async function main() {
  const filePath = new URL('./squares.txt', import.meta.url);
  const outputPath = new URL('./squares.json', import.meta.url);
  const metadataPath = new URL('./squares-metadata.json', import.meta.url);
  const elements = [];
  const metadata = {
    _DEFAULT_SORT_: '_random_',
    symbol: {
      'show-btn': 'Atomic mass (I should hide this?)',
      'info-label': 'Number',
      'colours-only': true,
      key: {
        type: 'individual',
        colours: {}
      }
    }
  };
  const coloursRef = metadata.symbol.key.colours;
  for (const line of (await fs.readFile(filePath, 'utf8')).split(/\r?\n/)) {
    if (!line) continue;
    const [, hexColour, cardMassStr, hiddenMassStr] = squareLineRegex.exec(line);
    const massStr = cardMassStr || hiddenMassStr;
    coloursRef[massStr] = `#${hexColour}`;
    elements.push({
      symbol: massStr,
      name: '',
      hidden: !!hiddenMassStr
    });
  }
  await fs.writeFile(outputPath, JSON.stringify(elements, null, 2));
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

main();
