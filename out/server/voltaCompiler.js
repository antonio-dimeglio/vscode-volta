"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVoltaCompiler = runVoltaCompiler;
const child_process_1 = require("child_process");
const node_1 = require("vscode-languageserver/node");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Runs the Volta compiler on a file and returns diagnostics
 */
async function runVoltaCompiler(compilerPath, fileContent, documentUri) {
    // Create a temporary file with the content
    const tempFile = await createTempFile(fileContent);
    try {
        const diagnostics = await compileFile(compilerPath, tempFile);
        return {
            diagnostics,
            success: diagnostics.length === 0
        };
    }
    finally {
        // Clean up temp file
        try {
            fs.unlinkSync(tempFile);
        }
        catch (e) {
            // Ignore cleanup errors
        }
    }
}
/**
 * Creates a temporary .vlt file with the given content
 */
async function createTempFile(content) {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `volta_lsp_${Date.now()}_${Math.random().toString(36).substring(7)}.vlt`);
    return new Promise((resolve, reject) => {
        fs.writeFile(tempFile, content, 'utf8', (err) => {
            if (err)
                reject(err);
            else
                resolve(tempFile);
        });
    });
}
/**
 * Compiles a file and parses the output for errors
 */
function compileFile(compilerPath, filePath) {
    return new Promise((resolve) => {
        const diagnostics = [];
        // Run the compiler with --no-execute flag
        const process = (0, child_process_1.spawn)(compilerPath, ['--no-execute', filePath]);
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
            const diagnostic = {
                severity: node_1.DiagnosticSeverity.Error,
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
function parseCompilerErrors(stderr) {
    const diagnostics = [];
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
                ? node_1.DiagnosticSeverity.Error
                : node_1.DiagnosticSeverity.Warning;
            const diagnostic = {
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
//# sourceMappingURL=voltaCompiler.js.map