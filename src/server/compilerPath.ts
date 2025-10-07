import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Finds the Volta compiler executable using multiple strategies
 */
export function findVoltaCompiler(configuredPath?: string): string | null {
  // Strategy 1: User-configured path
  if (configuredPath && configuredPath !== 'volta') {
    if (isExecutable(configuredPath)) {
      return configuredPath;
    }
    console.warn(`Configured Volta compiler path not found or not executable: ${configuredPath}`);
  }

  // Strategy 2: Check if 'volta' is in PATH
  try {
    const result = execSync('which volta', { encoding: 'utf-8' }).trim();
    if (result && isExecutable(result)) {
      return result;
    }
  } catch (e) {
    // 'which' failed, volta not in PATH
  }

  // Strategy 3: Check common installation locations
  const commonPaths = [
    '/usr/local/bin/volta',
    '/usr/bin/volta',
    path.join(process.env.HOME || '', '.local', 'bin', 'volta'),
    '/home/quantum/coding/Volta/bin/volta', // Your development path
  ];

  for (const compilerPath of commonPaths) {
    if (isExecutable(compilerPath)) {
      return compilerPath;
    }
  }

  // Not found
  return null;
}

/**
 * Checks if a file exists and is executable
 */
function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a helpful error message when compiler is not found
 */
export function getCompilerNotFoundMessage(): string {
  return `Volta compiler not found. Please:
1. Install Volta compiler and ensure it's in your PATH, or
2. Set "volta.compilerPath" in your VSCode settings to point to the Volta executable.

Example settings.json:
{
  "volta.compilerPath": "/path/to/volta"
}`;
}
