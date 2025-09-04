import * as path from 'path';
import * as fs from 'fs/promises';
import * as R from 'ramda';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const rankedWords = JSON.parse(await fs.readFile(path.join(__dirname, '../ranks.json'), 'utf-8'));

  const allMappings = JSON.parse(
    await fs.readFile(path.join(__dirname, '../static/assets/cj.json'), 'utf-8')
  );

  const additionalCommonChars = JSON.parse(
    await fs.readFile(path.join(__dirname, '../static/assets/additionalCommonChars.json'), 'utf-8')
  );

  const smallerMapping = R.pipe(
    R.map((char) => ({ [char]: allMappings[char] })),
    R.mergeAll
  )([...rankedWords, ...R.take(200)(additionalCommonChars)]);

  // Convert to line-separated format (char code per line)
  const lineSeparated = Object.entries(smallerMapping)
    .map(([char, code]) => `${char} ${code}`)
    .join('\n');

  fs.writeFile(path.join(__dirname, '../src/lib/cj_small.txt'), lineSeparated);
}

run();
