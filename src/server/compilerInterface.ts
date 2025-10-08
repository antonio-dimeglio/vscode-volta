import { spawn } from 'child_process';
import * as path from 'path';

export interface CompilerSymbolInfo {
    success: boolean;
    result?: {
        kind: string;
        name: string;
        type: string;
        signature: string;
        parameters?: Array<{
            name: string;
            documentation: string;
        }>;
        documentation?: string;
        returnDoc?: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

/**
 * Call the Volta compiler to get symbol information at a position
 */
export async function getSymbolInfoFromCompiler(
    compilerPath: string,
    filePath: string,
    line: number,
    column: number
): Promise<CompilerSymbolInfo> {
    return new Promise((resolve) => {
        const args = ['--lsp-info', filePath, line.toString(), column.toString()];
        const process = spawn(compilerPath, args);

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
                const result: CompilerSymbolInfo = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
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
