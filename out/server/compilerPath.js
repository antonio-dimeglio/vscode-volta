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
exports.findVoltaCompiler = findVoltaCompiler;
exports.getCompilerNotFoundMessage = getCompilerNotFoundMessage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
/**
 * Finds the Volta compiler executable using multiple strategies
 */
function findVoltaCompiler(configuredPath) {
    // Strategy 1: User-configured path
    if (configuredPath && configuredPath !== 'volta') {
        if (isExecutable(configuredPath)) {
            return configuredPath;
        }
        console.warn(`Configured Volta compiler path not found or not executable: ${configuredPath}`);
    }
    // Strategy 2: Check if 'volta' is in PATH
    try {
        const result = (0, child_process_1.execSync)('which volta', { encoding: 'utf-8' }).trim();
        if (result && isExecutable(result)) {
            return result;
        }
    }
    catch (e) {
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
function isExecutable(filePath) {
    try {
        fs.accessSync(filePath, fs.constants.X_OK);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Gets a helpful error message when compiler is not found
 */
function getCompilerNotFoundMessage() {
    return `Volta compiler not found. Please:
1. Install Volta compiler and ensure it's in your PATH, or
2. Set "volta.compilerPath" in your VSCode settings to point to the Volta executable.

Example settings.json:
{
  "volta.compilerPath": "/path/to/volta"
}`;
}
//# sourceMappingURL=compilerPath.js.map