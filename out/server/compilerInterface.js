"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSymbolInfoFromCompiler = getSymbolInfoFromCompiler;
const child_process_1 = require("child_process");
/**
 * Call the Volta compiler to get symbol information at a position
 */
async function getSymbolInfoFromCompiler(compilerPath, filePath, line, column) {
    return new Promise((resolve) => {
        const args = ['--lsp-info', filePath, line.toString(), column.toString()];
        const process = (0, child_process_1.spawn)(compilerPath, args);
        let stdout = '';
        let stderr = '';
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        process.on('close', (code) => {
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            }
            catch (e) {
                resolve({
                    success: false,
                    error: {
                        code: 'PARSE_ERROR',
                        message: `Failed to parse compiler output: ${e}`
                    }
                });
            }
        });
        process.on('error', (err) => {
            resolve({
                success: false,
                error: {
                    code: 'SPAWN_ERROR',
                    message: `Failed to spawn compiler: ${err.message}`
                }
            });
        });
    });
}
//# sourceMappingURL=compilerInterface.js.map