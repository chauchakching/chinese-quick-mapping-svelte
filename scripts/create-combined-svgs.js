#!/usr/bin/env node

/**
 * Creates combined SVG files with named groups for each character
 *
 * This script processes all character folders in the chars directory and combines
 * part_0.svg through part_5.svg into a single "combined.svg" file with named groups.
 * Each part becomes a <g> element with id="part-N" for individual styling.
 *
 * This reduces file count from ~7 files per character to 1 file per character,
 * enabling Cloudflare Workers deployment (under 20,000 file limit).
 *
 * Usage:
 *   node create-combined-svgs.js [chars_directory]
 *
 * Arguments:
 *   chars_directory - Optional path to the chars directory (default: static/chars)
 *
 * The script will:
 * - Process all character folders in the specified directory
 * - For each character folder, read part_0.svg through part_5.svg
 * - Extract all <path> elements from each part file
 * - Combine them into a single SVG with named <g> groups
 * - Save the result as "combined.svg" in the same character folder
 * - Optionally delete original files if --delete-originals flag is used
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const deleteOriginals = args.includes('--delete-originals');
const charsDirectory = args.find((arg) => !arg.startsWith('--')) || 'static/chars';
const charsPath = path.resolve(charsDirectory);

// Validate chars directory
if (!fs.existsSync(charsPath)) {
  console.error(`Error: Chars directory not found: ${charsPath}`);
  process.exit(1);
}

const charsStats = fs.statSync(charsPath);
if (!charsStats.isDirectory()) {
  console.error(`Error: Not a directory: ${charsPath}`);
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
 * Creates a combined SVG for a single character folder
 * @param {string} characterFolderPath - Path to the character folder
 * @param {string} characterName - Name of the character (for logging)
 * @returns {object} Result object with success status and stats
 */
async function createCombinedSVG(characterFolderPath, characterName) {
  const partGroups = [];
  let svgMetadata = null;
  let transform = '';
  let partsFound = 0;

  // Read part_0.svg through part_5.svg
  for (let i = 0; i <= 5; i++) {
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
        partGroups.push({
          id: i,
          paths: paths
        });
        partsFound++;
      }
    } catch (error) {
      console.error(`    Error processing part_${i}.svg for ${characterName}:`, error.message);
    }
  }

  if (partGroups.length === 0) {
    return { success: false, paths: 0, parts: 0 };
  }

  // Create combined SVG with named groups
  const groupElements = partGroups
    .map((group) => {
      return `<g id="part-${group.id}" class="char-part">
${group.paths.map((path) => `  ${path}`).join('\n')}
</g>`;
    })
    .join('\n');

  const combinedSVG = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN"
 "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="${svgMetadata.width}" height="${svgMetadata.height}" viewBox="${svgMetadata.viewBox}"
 preserveAspectRatio="${svgMetadata.preserveAspectRatio}">
<metadata>
Created by potrace 1.16, written by Peter Selinger 2001-2019
Combined from part_0.svg through part_5.svg with named groups
</metadata>
<g transform="${transform}" fill="#000000" stroke="none">
${groupElements}
</g>
</svg>`;

  // Write the combined SVG
  const outputPath = path.join(characterFolderPath, 'combined.svg');
  fs.writeFileSync(outputPath, combinedSVG);

  // Optionally delete original files
  if (deleteOriginals) {
    const filesToDelete = [
      'char.svg',
      'part_0.svg',
      'part_1.svg',
      'part_2.svg',
      'part_3.svg',
      'part_4.svg',
      'part_5.svg'
    ];
    let deletedCount = 0;

    for (const fileName of filesToDelete) {
      const filePath = path.join(characterFolderPath, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    console.log(`    Deleted ${deletedCount} original files`);
  }

  const totalPaths = partGroups.reduce((sum, group) => sum + group.paths.length, 0);
  return { success: true, paths: totalPaths, parts: partsFound };
}

/**
 * Process all character folders in the chars directory
 */
async function processAllCharacters() {
  console.log(`Processing all character folders in: ${charsPath}`);
  console.log(`Delete originals: ${deleteOriginals}`);
  console.log('');

  let processedCount = 0;
  let successCount = 0;
  let totalPaths = 0;
  let totalParts = 0;

  try {
    const entries = fs.readdirSync(charsPath, { withFileTypes: true });
    const characterFolders = entries.filter((entry) => entry.isDirectory());

    console.log(`Found ${characterFolders.length} character folders`);
    console.log('');

    for (const folder of characterFolders) {
      const characterName = folder.name;
      const characterFolderPath = path.join(charsPath, characterName);

      processedCount++;

      const result = await createCombinedSVG(characterFolderPath, characterName);

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

      // Show progress every 100 characters
      if (processedCount % 100 === 0) {
        console.log(
          `  Progress: ${processedCount}/${characterFolders.length} characters processed`
        );
      }
    }

    console.log('');
    console.log('=== Summary ===');
    console.log(`Total character folders processed: ${processedCount}`);
    console.log(`Successfully combined: ${successCount}`);
    console.log(`Skipped (no valid parts): ${processedCount - successCount}`);
    console.log(`Total paths combined: ${totalPaths}`);
    console.log(`Total part files processed: ${totalParts}`);

    if (deleteOriginals) {
      const originalFileCount = successCount * 7; // Estimate: ~7 files per character
      const newFileCount = successCount * 1; // 1 combined file per character
      console.log(`File count reduced from ~${originalFileCount} to ${newFileCount} files`);
      console.log(`Reduction: ${Math.round((1 - newFileCount / originalFileCount) * 100)}%`);
    }
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
