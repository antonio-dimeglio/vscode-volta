# Implementing Signature Help (Parameter Hints)

This guide will walk you through implementing signature help in your Volta VSCode extension. Signature help shows function parameters and their documentation while typing function calls.

## What You'll Build

When a user types `factorial(` they'll see:
```
factorial(n: int) -> int
  n - The number to calculate factorial for
```

## Part 1: Enhance C++ Compiler to Store Documentation

### Step 1.1: Add Documentation Fields to AST

**File**: `/home/quantum/coding/Volta/include/ast/Statement.hpp`

Add a `documentation` field to `FnDeclaration`:

```cpp
struct FnDeclaration : Statement {
    std::string identifier;
    std::vector<std::string> typeParams;
    std::vector<std::unique_ptr<Parameter>> parameters;
    std::unique_ptr<Type> returnType;
    std::unique_ptr<Block> body;
    std::unique_ptr<Expression> expressionBody;

    // Documentation
    std::optional<std::string> documentation;  // ADD THIS

    // Method information (empty if regular function)
    std::string receiverType;
    bool isMethod = false;

    FnDeclaration(
        std::string identifier,
        std::vector<std::string> typeParams,
        std::vector<std::unique_ptr<Parameter>> parameters,
        std::unique_ptr<Type> returnType,
        std::unique_ptr<Block> body,
        std::unique_ptr<Expression> expressionBody,
        volta::errors::SourceLocation location,
        std::string receiverType = "",
        bool isMethod = false,
        std::optional<std::string> documentation = std::nullopt  // ADD THIS PARAMETER
    ) : Statement(location),
        identifier(std::move(identifier)),
        typeParams(std::move(typeParams)),
        parameters(std::move(parameters)),
        returnType(std::move(returnType)),
        body(std::move(body)),
        expressionBody(std::move(expressionBody)),
        receiverType(std::move(receiverType)),
        isMethod(isMethod),
        documentation(std::move(documentation)) {}  // ADD THIS
};
```

Also add to `StructDeclaration`:

```cpp
struct StructDeclaration : Statement {
    std::string identifier;
    std::vector<std::unique_ptr<StructField>> fields;
    std::optional<std::string> documentation;  // ADD THIS

    StructDeclaration(
        std::string identifier,
        std::vector<std::unique_ptr<StructField>> fields,
        volta::errors::SourceLocation location,
        std::optional<std::string> documentation = std::nullopt  // ADD THIS
    ) : Statement(location),
        identifier(identifier),
        fields(std::move(fields)),
        documentation(std::move(documentation)) {}  // ADD THIS
};
```

### Step 1.2: Parse Documentation Comments

**Concept**: When the parser encounters a `#[doc]` ... `#[/doc]` block followed by a function/struct declaration, it should extract the documentation and attach it to the AST node.

**File**: Look at your Parser implementation (likely `src/parser/Parser.cpp`)

You need to:

1. **Track the last seen doc comment**: Before parsing functions/structs, check if the previous token(s) formed a doc block
2. **Extract doc text**: Get the text between `#[doc]` and `#[/doc]`
3. **Pass to constructor**: When creating `FnDeclaration` or `StructDeclaration`, pass the doc string

**Example approach**:
```cpp
// In Parser class, add a member:
std::optional<std::string> pendingDocumentation_;

// When you see a #[doc] comment:
std::optional<std::string> Parser::parseDocumentation() {
    if (!match(TokenType::DOC_COMMENT_START)) return std::nullopt;

    std::string docText;
    while (!check(TokenType::DOC_COMMENT_END) && !isAtEnd()) {
        docText += current().lexeme;
        advance();
    }

    consume(TokenType::DOC_COMMENT_END, "Expected #[/doc]");
    return docText;
}

// Before parsing function:
std::unique_ptr<FnDeclaration> Parser::parseFnDeclaration() {
    auto doc = pendingDocumentation_;
    pendingDocumentation_ = std::nullopt;  // Clear it

    // ... parse function ...

    return std::make_unique<FnDeclaration>(
        identifier, typeParams, params, returnType,
        body, exprBody, location, receiverType, isMethod, doc  // Pass doc
    );
}
```

**Note**: You may need to add token types for `DOC_COMMENT_START` and `DOC_COMMENT_END` in your lexer, OR you could treat doc blocks as regular comments during lexing and parse them in a preprocessing step.

### Step 1.3: Parse @param and @returns Tags

**Concept**: Parse documentation text to extract structured information about parameters.

**File**: Create `/home/quantum/coding/Volta/include/lsp/DocParser.hpp`

```cpp
#pragma once
#include <string>
#include <vector>
#include <optional>

namespace volta::lsp {

struct ParamDoc {
    std::string name;
    std::string description;
};

struct ParsedDocumentation {
    std::string summary;  // Text before first @tag
    std::vector<ParamDoc> params;
    std::optional<std::string> returns;

    static ParsedDocumentation parse(const std::string& docText);
};

} // namespace volta::lsp
```

**File**: Create `/home/quantum/coding/Volta/src/lsp/DocParser.cpp`

```cpp
#include "lsp/DocParser.hpp"
#include <sstream>
#include <regex>

namespace volta::lsp {

ParsedDocumentation ParsedDocumentation::parse(const std::string& docText) {
    ParsedDocumentation result;

    std::istringstream stream(docText);
    std::string line;
    std::string currentSection;

    while (std::getline(stream, line)) {
        // Trim leading/trailing whitespace and # symbols
        size_t start = line.find_first_not_of(" \t#");
        if (start == std::string::npos) continue;
        line = line.substr(start);

        // Check for @param tag
        if (line.find("@param ") == 0) {
            // Extract: @param name - description
            std::regex paramRegex(R"(@param\s+(\w+)\s*-\s*(.+))");
            std::smatch match;
            if (std::regex_search(line, match, paramRegex)) {
                ParamDoc param;
                param.name = match[1];
                param.description = match[2];
                result.params.push_back(param);
            }
        }
        // Check for @returns tag
        else if (line.find("@returns ") == 0) {
            result.returns = line.substr(9);  // Skip "@returns "
        }
        // Summary text
        else if (result.params.empty() && !result.returns) {
            if (!result.summary.empty()) result.summary += " ";
            result.summary += line;
        }
    }

    return result;
}

} // namespace volta::lsp
```

### Step 1.4: Update extractFunctionInfo to Include Parameter Details

**File**: `/home/quantum/coding/Volta/src/lsp/LSPProvider.cpp`

Update `extractFunctionInfo`:

```cpp
#include "lsp/DocParser.hpp"  // Add this include

SymbolInfo LSPProvider::extractFunctionInfo(const volta::ast::FnDeclaration* func) {
    SymbolInfo info;
    info.kind = "function";
    info.name = func->identifier;
    info.location = func->location;
    info.isMutable = false;

    // Build parameter list string
    std::string paramStr = "";
    for (size_t i = 0; i < func->parameters.size(); i++) {
        const auto& param = func->parameters[i];
        paramStr += param->identifier + ": " + typeToString(param->type.get());
        if (i < func->parameters.size() - 1) paramStr += ", ";
    }

    // Build return type string
    std::string returnTypeStr = typeToString(func->returnType.get());

    // Build full signature
    info.signature = "fn " + func->identifier + "(" + paramStr + ") -> " + returnTypeStr;
    info.type = "fn(" + paramStr + ") -> " + returnTypeStr;

    // Parse documentation if present
    if (func->documentation) {
        auto parsed = ParsedDocumentation::parse(*func->documentation);
        info.documentation = parsed.summary;
        info.returnDoc = parsed.returns;

        // Match parameters with their documentation
        for (const auto& param : func->parameters) {
            std::string paramDoc = "";
            for (const auto& pdoc : parsed.params) {
                if (pdoc.name == param->identifier) {
                    paramDoc = pdoc.description;
                    break;
                }
            }
            info.parameters.push_back({param->identifier, paramDoc});
        }
    } else {
        // No documentation - just add parameter names
        for (const auto& param : func->parameters) {
            info.parameters.push_back({param->identifier, ""});
        }
    }

    return info;
}
```

### Step 1.5: Update JSON Output to Include Parameters

**File**: `/home/quantum/coding/Volta/src/lsp/LSPProvider.cpp`

Update `outputSuccessJSON`:

```cpp
void outputSuccessJSON(const SymbolInfo& info) {
    std::cout << "{\n";
    std::cout << "  \"success\": true,\n";
    std::cout << "  \"result\": {\n";
    std::cout << "    \"kind\": \"" << info.kind << "\",\n";
    std::cout << "    \"name\": \"" << info.name << "\",\n";
    std::cout << "    \"type\": \"" << info.type << "\",\n";
    std::cout << "    \"signature\": \"" << info.signature << "\"";

    // Add parameters array
    if (!info.parameters.empty()) {
        std::cout << ",\n    \"parameters\": [\n";
        for (size_t i = 0; i < info.parameters.size(); i++) {
            const auto& [name, doc] = info.parameters[i];
            std::cout << "      {\n";
            std::cout << "        \"name\": \"" << name << "\",\n";
            std::cout << "        \"documentation\": \"" << doc << "\"\n";
            std::cout << "      }";
            if (i < info.parameters.size() - 1) std::cout << ",";
            std::cout << "\n";
        }
        std::cout << "    ]";
    }

    // Add documentation if present
    if (info.documentation) {
        std::cout << ",\n    \"documentation\": \"" << *info.documentation << "\"";
    }

    // Add return documentation if present
    if (info.returnDoc) {
        std::cout << ",\n    \"returnDoc\": \"" << *info.returnDoc << "\"";
    }

    std::cout << "\n  },\n";
    std::cout << "  \"error\": null\n";
    std::cout << "}\n";
}
```

### Step 1.6: Update Makefile

**File**: `/home/quantum/coding/Volta/Makefile`

Add `src/lsp/DocParser.cpp` to your source files list if not already included via wildcard.

### Step 1.7: Test the C++ Compiler

Create a test file with documentation:

**File**: `/home/quantum/coding/Volta/examples/doc_test.vlt`

```volta
#[doc]
# Calculates the factorial of a number
#
# @param n - The number to calculate factorial for
# @returns The factorial of n
#[/doc]
fn factorial(n: int) -> int {
    if n <= 1 {
        return 1
    } else {
        return n * factorial(n - 1)
    }
}

result := factorial(5)
```

Compile and test:
```bash
cd /home/quantum/coding/Volta
make
./bin/volta --lsp-info examples/doc_test.vlt 7 4
```

You should see JSON output with `parameters`, `documentation`, and `returnDoc` fields.

---

## Part 2: Implement Signature Help in TypeScript LSP Server

### Step 2.1: Update CompilerSymbolInfo Interface

**File**: `/home/quantum/coding/vscode-volta/src/server/compilerInterface.ts`

Update the interface to include parameter information:

```typescript
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
```

### Step 2.2: Add Signature Help Provider

**File**: `/home/quantum/coding/vscode-volta/src/server/server.ts`

Add signature help capability:

```typescript
connection.onInitialize((params: InitializeParams) => {
    const capabilities: ServerCapabilities = {
        textDocumentSync: TextDocumentSyncKind.Full,
        hoverProvider: true,
        definitionProvider: true,
        signatureHelpProvider: {
            triggerCharacters: ['(', ','],  // Trigger on ( and ,
            retriggerCharacters: [',']
        }
    };

    return { capabilities };
});
```

### Step 2.3: Implement Signature Help Handler

**File**: `/home/quantum/coding/vscode-volta/src/server/server.ts`

Add the handler after your existing handlers:

```typescript
import { SignatureHelp, SignatureInformation, ParameterInformation } from 'vscode-languageserver';

connection.onSignatureHelp(async (params): Promise<SignatureHelp | null> => {
    const filePath = params.textDocument.uri.replace('file://', '');
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    // Find the function call we're currently inside
    const line = params.position.line;
    const column = params.position.character;
    const text = document.getText();

    // Simple approach: Search backwards for the function name
    // Find the opening '(' before cursor
    const lines = text.split('\n');
    const currentLine = lines[line];
    const textBeforeCursor = currentLine.substring(0, column);

    // Find last '(' before cursor
    const openParenIndex = textBeforeCursor.lastIndexOf('(');
    if (openParenIndex === -1) return null;

    // Find function name before '('
    const beforeParen = textBeforeCursor.substring(0, openParenIndex).trim();
    const functionNameMatch = beforeParen.match(/(\w+)$/);
    if (!functionNameMatch) return null;

    const functionName = functionNameMatch[1];

    // Search for function definition in the file
    // We need to find where this function is defined
    let functionDefLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`fn ${functionName}(`)) {
            functionDefLine = i + 1;  // Convert to 1-indexed
            break;
        }
    }

    if (functionDefLine === -1) return null;

    // Get symbol info for the function definition
    const symbolInfo = await getSymbolInfoFromCompiler(
        voltaCompilerPath,
        filePath,
        functionDefLine,
        lines[functionDefLine - 1].indexOf('fn') + 3  // Position at function name
    );

    if (!symbolInfo.success || !symbolInfo.result || !symbolInfo.result.parameters) {
        return null;
    }

    const result = symbolInfo.result;

    // Build parameter information
    const parameters: ParameterInformation[] = result.parameters.map(param => ({
        label: `${param.name}`,
        documentation: param.documentation || undefined
    }));

    // Build signature label
    const paramLabels = result.parameters.map(p => p.name).join(', ');
    const signatureLabel = `${result.name}(${paramLabels})`;

    // Create signature information
    const signature: SignatureInformation = {
        label: signatureLabel,
        documentation: result.documentation || undefined,
        parameters: parameters
    };

    // Determine which parameter we're currently at
    // Count commas before cursor
    const textInCall = textBeforeCursor.substring(openParenIndex + 1);
    const commaCount = (textInCall.match(/,/g) || []).length;
    const activeParameter = Math.min(commaCount, parameters.length - 1);

    return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: activeParameter
    };
});
```

### Step 2.4: Compile and Test

```bash
cd /home/quantum/coding/vscode-volta
npm run compile
```

Then reload your VSCode extension and test by typing:

```volta
factorial(
```

You should see parameter hints appear!

---

## Part 3: Support for Struct Methods

The great news is that this implementation already supports struct methods! When you defined methods in your AST with:

```cpp
struct FnDeclaration {
    std::string receiverType;  // e.g., "Point"
    bool isMethod = false;
    // ...
};
```

The same LSP code will work because:

1. Struct methods are just `FnDeclaration` nodes with `isMethod = true`
2. The search for `fn methodName(` will find method definitions
3. The parameter extraction works identically

Example that will work:

```volta
#[doc]
# Calculates distance from origin
#
# @param self - The point instance
# @returns The distance
#[/doc]
fn Point.distance() -> float {
    return sqrt(self.x * self.x + self.y * self.y)
}

p := Point { x: 3.0, y: 4.0 }
p.distance(  # <-- Signature help will work here!
```

---

## Summary

You've now implemented:

1. ✅ Documentation parsing in C++ compiler
2. ✅ Parameter extraction with `@param` tags
3. ✅ JSON output with parameter information
4. ✅ TypeScript signature help provider
5. ✅ Support for both functions and struct methods

When complete, users typing function calls will see parameter hints with documentation!

## Testing Checklist

- [ ] Compile C++ compiler with documentation support
- [ ] Test `--lsp-info` outputs parameters and documentation
- [ ] Compile TypeScript LSP server
- [ ] Reload VSCode extension
- [ ] Type a function call - verify signature help appears
- [ ] Test with function that has `@param` documentation
- [ ] Test with struct method calls
- [ ] Verify parameter highlighting as you type past commas
