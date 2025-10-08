"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const compilerPath_1 = require("./compilerPath");
const voltaCompiler_1 = require("./voltaCompiler");
const compilerInterface_1 = require("./compilerInterface");
// Create a connection for the server using Node's IPC as a transport
// Also include all preview / proposed LSP features
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
// Create a simple text document manager that syncs documents with VSCode
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
// Path to the Volta compiler (will be resolved dynamically)
let voltaCompilerPath = null;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    // Does the client support the `workspace/configuration` request?
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    hasDiagnosticRelatedInformationCapability = !!(capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
            // Tell the client that this server supports code completion
            completionProvider: {
                resolveProvider: true
            },
            // Tell the client that this server supports hover
            hoverProvider: true,
            // Tell the client that this server supports go-to-definition
            definitionProvider: true,
            // Tell the client that this server supports signature help
            signatureHelpProvider: {
                triggerCharacters: ['(', ','],
                retriggerCharacters: [',']
            }
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
    // Initialize compiler path
    voltaCompilerPath = (0, compilerPath_1.findVoltaCompiler)(globalSettings.compilerPath);
    if (!voltaCompilerPath) {
        connection.window.showErrorMessage((0, compilerPath_1.getCompilerNotFoundMessage)());
        connection.console.log('Volta compiler not found!');
    }
    else {
        connection.console.log(`Volta compiler found at: ${voltaCompilerPath}`);
    }
});
// The global settings, used when the `workspace/configuration` request is not supported
const defaultSettings = {
    maxNumberOfProblems: 1000,
    compilerPath: 'volta'
};
let globalSettings = defaultSettings;
// Cache the settings of all open documents
const documentSettings = new Map();
connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.volta || defaultSettings));
    }
    // Re-resolve compiler path with new settings
    const oldPath = voltaCompilerPath;
    voltaCompilerPath = (0, compilerPath_1.findVoltaCompiler)(globalSettings.compilerPath);
    if (!voltaCompilerPath) {
        connection.window.showErrorMessage((0, compilerPath_1.getCompilerNotFoundMessage)());
    }
    else {
        connection.console.log(`Volta compiler found at: ${voltaCompilerPath}`);
    }
    // Only revalidate if compiler path actually changed
    if (oldPath !== voltaCompilerPath) {
        documents.all().forEach(validateTextDocument);
    }
});
function getDocumentSettings(resource) {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'volta'
        });
        documentSettings.set(resource, result);
    }
    return result;
}
// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
    // Clear validation timer for closed document
    const timer = validationTimers.get(e.document.uri);
    if (timer) {
        clearTimeout(timer);
        validationTimers.delete(e.document.uri);
    }
});
// Track which documents have been validated at least once
const validatedDocuments = new Set();
// Debounce validation to avoid running on every keystroke
const validationTimers = new Map();
// When a document is opened, validate it immediately (only once)
documents.onDidOpen(change => {
    const uri = change.document.uri;
    if (!validatedDocuments.has(uri)) {
        validatedDocuments.add(uri);
        validateTextDocument(change.document);
    }
});
// The content of a text document has changed
documents.onDidChangeContent(change => {
    const uri = change.document.uri;
    // Clear existing timer for this document
    const existingTimer = validationTimers.get(uri);
    if (existingTimer) {
        clearTimeout(existingTimer);
    }
    // Set new timer to validate after 1000ms of no changes (increased from 500ms)
    const timer = setTimeout(() => {
        validateTextDocument(change.document);
        validationTimers.delete(uri);
    }, 1000);
    validationTimers.set(uri, timer);
});
/**
 * Validates a Volta document by calling the C++ compiler
 */
async function validateTextDocument(textDocument) {
    const text = textDocument.getText();
    const settings = await getDocumentSettings(textDocument.uri);
    connection.console.log(`Validating document: ${textDocument.uri}`);
    // Check if compiler is available
    if (!voltaCompilerPath) {
        connection.console.log('Compiler not available, skipping validation');
        return;
    }
    try {
        // Call the Volta compiler
        const result = await (0, voltaCompiler_1.runVoltaCompiler)(voltaCompilerPath, text, textDocument.uri);
        // Send the diagnostics to VSCode
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: result.diagnostics });
        if (result.success) {
            connection.console.log(`✓ Document validated successfully: ${textDocument.uri}`);
        }
        else {
            connection.console.log(`✗ Document has ${result.diagnostics.length} error(s): ${textDocument.uri}`);
        }
    }
    catch (error) {
        connection.console.log(`Error validating document: ${error}`);
    }
}
connection.onDidChangeWatchedFiles(_change => {
    // Monitored files have change in VSCode
    connection.console.log('We received a file change event');
});
// Hover handler - show symbol information on hover
connection.onHover(async (params) => {
    if (!voltaCompilerPath) {
        return null;
    }
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    // Convert URI to file path
    const filePath = params.textDocument.uri.replace('file://', '');
    // LSP uses 0-indexed lines, compiler uses 1-indexed
    const line = params.position.line + 1;
    const column = params.position.character;
    connection.console.log(`Hover request at ${filePath}:${line}:${column}`);
    try {
        const symbolInfo = await (0, compilerInterface_1.getSymbolInfoFromCompiler)(voltaCompilerPath, filePath, line, column);
        if (symbolInfo.success && symbolInfo.result) {
            const info = symbolInfo.result;
            // Format as markdown
            let markdown = `**${info.name}**: \`${info.type}\`\n\n`;
            markdown += `\`\`\`volta\n${info.signature}\n\`\`\``;
            // Add documentation if present
            if (info.documentation) {
                markdown += `\n\n${info.documentation}`;
            }
            // Add parameter documentation if present
            if (info.parameters && info.parameters.length > 0) {
                const paramsWithDocs = info.parameters.filter(p => p.documentation);
                if (paramsWithDocs.length > 0) {
                    markdown += `\n\n**Parameters:**\n`;
                    for (const param of paramsWithDocs) {
                        markdown += `- \`${param.name}\`: ${param.documentation}\n`;
                    }
                }
            }
            // Add return documentation if present
            if (info.returnDoc) {
                markdown += `\n\n**Returns:** ${info.returnDoc}`;
            }
            return {
                contents: {
                    kind: 'markdown',
                    value: markdown
                }
            };
        }
        return null;
    }
    catch (error) {
        connection.console.log(`Hover error: ${error}`);
        return null;
    }
});
// Go to definition handler
connection.onDefinition(async (params) => {
    if (!voltaCompilerPath) {
        return null;
    }
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const filePath = params.textDocument.uri.replace('file://', '');
    const line = params.position.line + 1;
    const column = params.position.character;
    connection.console.log(`Definition request at ${filePath}:${line}:${column}`);
    try {
        const symbolInfo = await (0, compilerInterface_1.getSymbolInfoFromCompiler)(voltaCompilerPath, filePath, line, column);
        if (symbolInfo.success && symbolInfo.result) {
            // For now, return the same location (definition at declaration)
            // In the future, you could implement proper definition lookup in the compiler
            return {
                uri: params.textDocument.uri,
                range: {
                    start: params.position,
                    end: params.position
                }
            };
        }
        return null;
    }
    catch (error) {
        connection.console.log(`Definition error: ${error}`);
        return null;
    }
});
// Signature help handler - show function parameters while typing
connection.onSignatureHelp(async (params) => {
    if (!voltaCompilerPath) {
        return null;
    }
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }
    const filePath = params.textDocument.uri.replace('file://', '');
    const text = document.getText();
    const lines = text.split('\n');
    // Get current position
    const line = params.position.line;
    const column = params.position.character;
    const currentLine = lines[line];
    const textBeforeCursor = currentLine.substring(0, column);
    connection.console.log(`Signature help request at line ${line}, column ${column}`);
    connection.console.log(`Text before cursor: "${textBeforeCursor}"`);
    // Find the opening '(' before cursor
    const openParenIndex = textBeforeCursor.lastIndexOf('(');
    if (openParenIndex === -1) {
        connection.console.log('No opening paren found');
        return null;
    }
    // Find function name before '('
    const beforeParen = textBeforeCursor.substring(0, openParenIndex).trim();
    const functionNameMatch = beforeParen.match(/(\w+)$/);
    if (!functionNameMatch) {
        connection.console.log('No function name found');
        return null;
    }
    const functionName = functionNameMatch[1];
    connection.console.log(`Found function call: ${functionName}`);
    // Search for function definition in the file
    let functionDefLine = -1;
    let functionDefColumn = -1;
    for (let i = 0; i < lines.length; i++) {
        const fnMatch = lines[i].match(/fn\s+(\w+)\s*\(/);
        if (fnMatch && fnMatch[1] === functionName) {
            functionDefLine = i + 1; // Convert to 1-indexed
            functionDefColumn = lines[i].indexOf('fn') + 3; // Position at function name
            break;
        }
    }
    if (functionDefLine === -1) {
        connection.console.log(`Function definition for ${functionName} not found`);
        return null;
    }
    connection.console.log(`Found function definition at line ${functionDefLine}, column ${functionDefColumn}`);
    try {
        // Get symbol info for the function definition
        const symbolInfo = await (0, compilerInterface_1.getSymbolInfoFromCompiler)(voltaCompilerPath, filePath, functionDefLine, functionDefColumn);
        if (!symbolInfo.success || !symbolInfo.result || !symbolInfo.result.parameters) {
            connection.console.log('Failed to get symbol info or no parameters');
            return null;
        }
        const result = symbolInfo.result;
        // Build parameter information
        const parameters = (result.parameters || []).map(param => ({
            label: param.name,
            documentation: param.documentation || undefined
        }));
        // Build signature label
        const paramLabels = (result.parameters || []).map(p => p.name).join(', ');
        const signatureLabel = `${result.name}(${paramLabels})`;
        connection.console.log(`Built signature: ${signatureLabel}`);
        // Create signature information
        const signature = {
            label: signatureLabel,
            documentation: result.documentation || undefined,
            parameters: parameters
        };
        // Determine which parameter we're currently at
        // Count commas before cursor
        const textInCall = textBeforeCursor.substring(openParenIndex + 1);
        const commaCount = (textInCall.match(/,/g) || []).length;
        const activeParameter = Math.min(commaCount, parameters.length - 1);
        connection.console.log(`Active parameter: ${activeParameter} (comma count: ${commaCount})`);
        return {
            signatures: [signature],
            activeSignature: 0,
            activeParameter: activeParameter >= 0 ? activeParameter : 0
        };
    }
    catch (error) {
        connection.console.log(`Signature help error: ${error}`);
        return null;
    }
});
// This handler provides the initial list of completion items
connection.onCompletion((_textDocumentPosition) => {
    // Return basic keyword completions for now
    return [
        {
            label: 'fn',
            kind: node_1.CompletionItemKind.Keyword,
            data: 1
        },
        {
            label: 'if',
            kind: node_1.CompletionItemKind.Keyword,
            data: 2
        },
        {
            label: 'else',
            kind: node_1.CompletionItemKind.Keyword,
            data: 3
        },
        {
            label: 'while',
            kind: node_1.CompletionItemKind.Keyword,
            data: 4
        },
        {
            label: 'for',
            kind: node_1.CompletionItemKind.Keyword,
            data: 5
        },
        {
            label: 'return',
            kind: node_1.CompletionItemKind.Keyword,
            data: 6
        },
        {
            label: 'match',
            kind: node_1.CompletionItemKind.Keyword,
            data: 7
        }
    ];
});
// This handler resolves additional information for the item selected in the completion list
connection.onCompletionResolve((item) => {
    if (item.data === 1) {
        item.detail = 'Function declaration';
        item.documentation = 'Creates a new function';
    }
    else if (item.data === 2) {
        item.detail = 'If statement';
        item.documentation = 'Conditional execution';
    }
    return item;
});
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// Listen on the connection
connection.listen();
connection.console.log('Volta Language Server is running!');
//# sourceMappingURL=server.js.map