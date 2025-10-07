"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const compilerPath_1 = require("./compilerPath");
const voltaCompiler_1 = require("./voltaCompiler");
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
    voltaCompilerPath = (0, compilerPath_1.findVoltaCompiler)(globalSettings.compilerPath);
    if (!voltaCompilerPath) {
        connection.window.showErrorMessage((0, compilerPath_1.getCompilerNotFoundMessage)());
    }
    else {
        connection.console.log(`Volta compiler found at: ${voltaCompilerPath}`);
    }
    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
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
});
// The content of a text document has changed
// This event is emitted when the text document is first opened or when its content has changed
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
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