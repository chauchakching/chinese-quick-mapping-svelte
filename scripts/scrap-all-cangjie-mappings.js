import axios from 'axios';
import {
  filter,
  equals,
  splitWhen,
  map,
  split,
  last,
  takeWhile,
  pipe,
  join,
  takeLastWhile,
  complement,
  fromPairs,
  tail
} from 'ramda';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function downloadAndGenerateAllMappingJson() {
  // download file
  const { data } = await axios.get(
    'https://raw.githubusercontent.com/Arthurmcarthur/Cangjie3-Plus/master/cj3-30000.txt'
  );

  // convert to json
  const isNotSpace = complement(equals(' '));
  const takeFirstWord = pipe(split(''), takeWhile(isNotSpace), join(''));
  const takeLastWord = pipe(split(''), takeLastWhile(isNotSpace), join(''));
  const jsonData = pipe(
    (s) => s.replaceAll('\r\n', '\n'),
    split('\n'),
    splitWhen(equals('[DATA]')),
    last,
    tail,
    filter(Boolean),
    map((s) => [takeLastWord(s), takeFirstWord(s)]),
    fromPairs
  )(data);

  // write file
  await fs.writeFile(
    path.join(__dirname, '../static/assets/ChineseQuickMapping.json'),
    JSON.stringify(jsonData),
    'utf-8'
  );
}

downloadAndGenerateAllMappingJson();
