#!/usr/bin/env node

/**
 * Combines part_1.svg through part_5.svg into parts.svg for all character folders
 *
 * This script processes all character folders in the chars directory and combines
 * all the path elements from part_1.svg through part_5.svg into a single "parts.svg"
 * file in each character folder. It preserves the original SVG structure, dimensions, and styling.
 *
 * Usage:
 *   node combine-svg-parts.js [chars_directory]
 *
 * Arguments:
 *   chars_directory - Optional path to the chars directory (default: static/chars)
 *
 * Examples:
 *   node combine-svg-parts.js
 *   node combine-svg-parts.js static/chars
 *   node combine-svg-parts.js /path/to/custom/chars
 *
 * The script will:
 * - Process all character folders in the specified directory
 * - For each character folder, read part_1.svg through part_5.svg
 * - Extract all <path> elements from each part file
 * - Combine them into a single SVG with the same dimensions and structure
 * - Save the result as "parts.svg" in the same character folder
 * - Skip characters with no valid part files
 * - Provide progress feedback and summary statistics
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const charsDirectory = args[0] ? path.resolve(args[0]) : path.resolve('static/chars');

// Validate chars directory
if (!fs.existsSync(charsDirectory)) {
  console.error(`Error: Chars directory not found: ${charsDirectory}`);
  process.exit(1);
}

const charsStats = fs.statSync(charsDirectory);
if (!charsStats.isDirectory()) {
  console.error(`Error: Not a directory: ${charsDirectory}`);
  process.exit(1);
}

/**
 * Extracts path elements from an SVG file
 * @param {string} svgContent - The SVG file content
 * @returns {string[]} Array of path element strings
 */
function extractPaths(svgContent) {
  const paths = [];
  const pathRegex = /<path[^>]*>/g;
  let match;

  while ((match = pathRegex.exec(svgContent)) !== null) {
    paths.push(match[0]);
  }

  return paths;
}

/**
 * Extracts SVG metadata (width, height, viewBox) from the first SVG
 * @param {string} svgContent - The SVG file content
 * @returns {object} Object containing SVG attributes
 */
function extractSVGMetadata(svgContent) {
  const widthMatch = svgContent.match(/width="([^"]+)"/);
  const heightMatch = svgContent.match(/height="([^"]+)"/);
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  const preserveAspectRatioMatch = svgContent.match(/preserveAspectRatio="([^"]+)"/);

  return {
    width: widthMatch ? widthMatch[1] : '100pt',
    height: heightMatch ? heightMatch[1] : '100pt',
    viewBox: viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100',
    preserveAspectRatio: preserveAspectRatioMatch ? preserveAspectRatioMatch[1] : 'xMidYMid meet'
  };
}

/**
 * Extracts the transform attribute from the g element
 * @param {string} svgContent - The SVG file content
 * @returns {string} Transform attribute value
 */
function extractTransform(svgContent) {
  const transformMatch = svgContent.match(/<g[^>]*transform="([^"]+)"/);
  return transformMatch ? transformMatch[1] : '';
}

/**
 * Combines part_1.svg through part_5.svg for a single character folder
 * @param {string} characterFolderPath - Path to the character folder
 * @param {string} characterName - Name of the character (for logging)
 * @returns {object} Result object with success status and stats
 */
async function combineCharacterParts(characterFolderPath, characterName) {
  const allPaths = [];
  let svgMetadata = null;
  let transform = '';
  let partsFound = 0;

  // Read part_1.svg through part_5.svg
  for (let i = 1; i <= 5; i++) {
    const partFile = path.join(characterFolderPath, `part_${i}.svg`);

    if (!fs.existsSync(partFile)) {
      continue;
    }

    try {
      const svgContent = fs.readFileSync(partFile, 'utf8');

      // Extract metadata from the first file
      if (!svgMetadata) {
        svgMetadata = extractSVGMetadata(svgContent);
        transform = extractTransform(svgContent);
      }

      // Extract paths from this part
      const paths = extractPaths(svgContent);
      if (paths.length > 0) {
        allPaths.push(...paths);
        partsFound++;
      }
    } catch (error) {
      console.error(`    Error processing part_${i}.svg for ${characterName}:`, error.message);
    }
  }

  if (allPaths.length === 0) {
    return { success: false, paths: 0, parts: 0 };
  }

  // Create combined SVG
  const combinedSVG = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="${svgMetadata.width}" height="${svgMetadata.height}" viewBox="${svgMetadata.viewBox}"
 preserveAspectRatio="${svgMetadata.preserveAspectRatio}">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
Combined from part_1.svg through part_5.svg
</metadata>
<g transform="${transform}"
fill="#000000" stroke="none">
${allPaths.join('\n')}
</g>
</svg>`;

  // Write the combined SVG as parts.svg in the character folder
  const outputPath = path.join(characterFolderPath, 'parts.svg');
  fs.writeFileSync(outputPath, combinedSVG);

  return { success: true, paths: allPaths.length, parts: partsFound };
}

/**
 * Process all character folders in the chars directory
 */
async function processAllCharacters() {
  console.log(`Processing all character folders in: ${charsDirectory}`);
  console.log('');

  let processedCount = 0;
  let successCount = 0;
  let totalPaths = 0;
  let totalParts = 0;

  try {
    const entries = fs.readdirSync(charsDirectory, { withFileTypes: true });
    const characterFolders = entries.filter((entry) => entry.isDirectory());

    console.log(`Found ${characterFolders.length} character folders`);
    console.log('');

    for (const folder of characterFolders) {
      const characterName = folder.name;
      const characterFolderPath = path.join(charsDirectory, characterName);

      processedCount++;

      const result = await combineCharacterParts(characterFolderPath, characterName);

      if (result.success) {
        successCount++;
        totalPaths += result.paths;
        totalParts += result.parts;
        console.log(
          `✓ ${characterName} - Combined ${result.paths} paths from ${result.parts} part files`
        );
      } else {
        console.log(`⚠ ${characterName} - No valid part files found`);
      }
    }

    console.log('');
    console.log('=== Summary ===');
    console.log(`Total character folders processed: ${processedCount}`);
    console.log(`Successfully combined: ${successCount}`);
    console.log(`Skipped (no valid parts): ${processedCount - successCount}`);
    console.log(`Total paths combined: ${totalPaths}`);
    console.log(`Total part files processed: ${totalParts}`);
  } catch (error) {
    console.error('Error reading chars directory:', error.message);
    process.exit(1);
  }
}

// Run the script
processAllCharacters().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
