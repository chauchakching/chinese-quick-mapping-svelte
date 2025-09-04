/**
 * Utility to load and parse the line-separated character mapping file
 */

// Import the mapping file as raw text
import mappingText from './cj_small.txt?raw';

/**
 * Parse line-separated character mapping format
 * Format: "char code\nchar code\n..."
 */
function parseLineMapping(content: string): Record<string, string> {
  const lines = content.trim().split('\n');
  const mapping: Record<string, string> = {};

  for (const line of lines) {
    if (!line.trim()) continue; // Skip empty lines

    const spaceIndex = line.indexOf(' ');
    if (spaceIndex === -1) continue; // Skip malformed lines

    const char = line.slice(0, spaceIndex);
    const code = line.slice(spaceIndex + 1);

    mapping[char] = code;
  }

  return mapping;
}

// Export the parsed mapping
export const quickMapping = parseLineMapping(mappingText);

// Export the parser function for other uses
export { parseLineMapping };
