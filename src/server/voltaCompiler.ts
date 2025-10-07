import { spawn } from 'child_process';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CompilerResult {
  diagnostics: Diagnostic[];
  success: boolean;
}

/**
 * Runs the Volta compiler on a file and returns diagnostics
 */
export async function runVoltaCompiler(
  compilerPath: string,
  fileContent: string,
  documentUri: string
): Promise<CompilerResult> {
  // Create a temporary file with the content
  const tempFile = await createTempFile(fileContent);

  try {
    const diagnostics = await compileFile(compilerPath, tempFile);
    return {
      diagnostics,
      success: diagnostics.length === 0
    };
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Creates a temporary .vlt file with the given content
 */
async function createTempFile(content: string): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `volta_lsp_${Date.now()}_${Math.random().toString(36).substring(7)}.vlt`);

  return new Promise((resolve, reject) => {
    fs.writeFile(tempFile, content, 'utf8', (err) => {
      if (err) reject(err);
      else resolve(tempFile);
    });
  });
}

/**
 * Compiles a file and parses the output for errors
 */
function compileFile(compilerPath: string, filePath: string): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const diagnostics: Diagnostic[] = [];

    // Run the compiler with --no-execute flag
    const process = spawn(compilerPath, ['--no-execute', filePath]);

    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      // Parse stderr for errors
      const errors = parseCompilerErrors(stderr);
      diagnostics.push(...errors);

      resolve(diagnostics);
    });

    process.on('error', (err) => {
      // Compiler failed to start
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 }
        },
        message: `Failed to run Volta compiler: ${err.message}`,
        source: 'volta'
      };
      diagnostics.push(diagnostic);
      resolve(diagnostics);
    });
  });
}

/**
 * Parses compiler error output into LSP diagnostics
 *
 * Format: :line:col-col: error: Error message
 * Example: :2:3-4: error: Type mismatch in variable declaration Expected type: str actual: int
 */
function parseCompilerErrors(stderr: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Split by lines
  const lines = stderr.split('\n');

  // Regex to match error format: :line:col-col: error: message
  // or :line:col: error: message (for single position)
  const errorRegex = /:(\d+):(\d+)(?:-(\d+))?: (error|warning): (.+)/;

  for (const line of lines) {
    const match = line.match(errorRegex);

    if (match) {
      const lineNum = parseInt(match[1], 10) - 1; // LSP lines are 0-indexed
      const startCol = parseInt(match[2], 10);
      const endCol = match[3] ? parseInt(match[3], 10) : startCol + 1;
      const severityStr = match[4];
      const message = match[5];

      const severity = severityStr === 'error'
        ? DiagnosticSeverity.Error
        : DiagnosticSeverity.Warning;

      const diagnostic: Diagnostic = {
        severity,
        range: {
          start: { line: lineNum, character: startCol },
          end: { line: lineNum, character: endCol }
        },
        message: message.trim(),
        source: 'volta'
      };

      diagnostics.push(diagnostic);
    }
  }

  return diagnostics;
}
