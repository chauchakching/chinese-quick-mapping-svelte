/**
 * Extract frequent chinese words from publication,
 * for generating a smaller mapping.
 *
 * Frequent chinese words: ~7000
 * All mappings: ~28000
 */
import * as path from 'path';
import * as fs from 'fs';
import * as R from 'ramda';
import { scrape } from 'scrape-brrr';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  const { links } = await scrape('http://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/faq.php', [
    {
      name: 'links',
      selector: 'p > a',
      attr: 'href',
      many: true
    }
  ]);
  console.log(links);

  const dict = await (async () => {
    let arr = [];
    for await (const link of links) {
      const { pairs } = await scrape(`http://humanum.arts.cuhk.edu.hk/Lexis/lexi-can/${link}`, [
        {
          name: 'pairs',
          selector: 'tr:not(:first-child)',
          many: true,
          nested: [
            {
              name: 'rank1',
              selector: 'td:nth-child(1)'
            },
            {
              name: 'text1',
              selector: 'td:nth-child(3) a'
            },
            {
              name: 'rank2',
              selector: 'td:nth-child(4)'
            },
            {
              name: 'text2',
              selector: 'td:nth-child(6) a'
            }
          ],
          transform: R.pipe(
            R.map(({ rank1, text1, rank2, text2 }) => [
              // { rank: rank1, text: text1 },
              // { rank: rank2, text: text2 },
              text1,
              text2
            ]),
            R.flatten
          )
        }
      ]);
      arr = arr.concat(pairs);
    }
    return arr;
  })();

  fs.writeFileSync(path.join(__dirname, '..', 'ranks.json'), JSON.stringify(dict), 'utf8');
}

run();
