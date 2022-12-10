import * as path from 'path';
import * as fs from 'fs/promises';
import * as R from 'ramda';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const imageFolderPath = path.join(__dirname, '..', 'static', 'chars');

async function run() {
  const chars = await fs.readdir(imageFolderPath);
  await fs.writeFile(path.join(__dirname, '..', 'chars.json'), JSON.stringify(chars), 'utf-8');
}

run();
