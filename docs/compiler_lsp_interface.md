# Volta Compiler LSP Interface Specification

**Version:** 1.0
**Purpose:** Define the command-line interface between the Volta compiler and the LSP server

---

## Overview

The Volta compiler will provide LSP (Language Server Protocol) information through command-line flags that output structured JSON. This allows the TypeScript LSP server to query the compiler for semantic information without reimplementing the parser and type checker.

---

## General Principles

### Output Format
- All LSP commands output JSON to **stdout**
- Errors and warnings go to **stderr**
- Exit code 0 = success, non-zero = error

### JSON Response Structure

All responses follow this structure:

```json
{
  "success": true,
  "result": { /* feature-specific data */ },
  "error": null
}
```

**On error:**
```json
{
  "success": false,
  "result": null,
  "error": {
    "message": "Symbol not found at position",
    "code": "SYMBOL_NOT_FOUND"
  }
}
```

---

## Command 1: `--lsp-info <file> <line> <column>`

**Purpose:** Get information about the symbol at a specific position (for hover tooltips)

**Usage:**
```bash
./bin/volta --lsp-info test.vlt 5 10
```

**Input:**
- `<file>`: Path to .vlt file
- `<line>`: Line number (1-indexed, as shown in editors)
- `<column>`: Column number (0-indexed, character position)

**Output:**

### For a Function:
```json
{
  "success": true,
  "result": {
    "kind": "function",
    "name": "add",
    "signature": "fn add(x: int, y: int) -> int",
    "type": "fn(int, int) -> int",
    "documentation": {
      "summary": "Calculates the sum of two integers.",
      "params": [
        {"name": "x", "type": "int", "doc": "The first number to add"},
        {"name": "y", "type": "int", "doc": "The second number to add"}
      ],
      "returns": {
        "type": "int",
        "doc": "The sum of x and y"
      },
      "examples": [
        "result := add(5, 3)  # Returns 8"
      ]
    },
    "location": {
      "file": "test.vlt",
      "line": 5,
      "column": 4
    }
  },
  "error": null
}
```

### For a Variable:
```json
{
  "success": true,
  "result": {
    "kind": "variable",
    "name": "counter",
    "type": "int",
    "mutable": true,
    "value": null,
    "documentation": null,
    "location": {
      "file": "test.vlt",
      "line": 10,
      "column": 5
    }
  },
  "error": null
}
```

### For a Struct:
```json
{
  "success": true,
  "result": {
    "kind": "struct",
    "name": "Point",
    "type": "Point",
    "documentation": {
      "summary": "Represents a 2D point in space.",
      "fields": [
        {"name": "x", "type": "float", "doc": "The x coordinate"},
        {"name": "y", "type": "float", "doc": "The y coordinate"}
      ]
    },
    "location": {
      "file": "test.vlt",
      "line": 15,
      "column": 8
    }
  },
  "error": null
}
```

### For a Type:
```json
{
  "success": true,
  "result": {
    "kind": "type",
    "name": "int",
    "type": "int",
    "documentation": {
      "summary": "64-bit signed integer"
    },
    "builtin": true
  },
  "error": null
}
```

---

## Command 2: `--lsp-definition <file> <line> <column>`

**Purpose:** Get the location where a symbol is defined (for "Go to Definition")

**Usage:**
```bash
./bin/volta --lsp-definition test.vlt 20 15
```

**Output:**

```json
{
  "success": true,
  "result": {
    "name": "add",
    "kind": "function",
    "location": {
      "file": "/absolute/path/to/test.vlt",
      "line": 5,
      "column": 4,
      "endLine": 7,
      "endColumn": 1
    }
  },
  "error": null
}
```

**Notes:**
- Return absolute file paths
- If symbol is in a different file (imports), return that file's path
- For built-in types/functions, return `"builtin": true` instead of location

---

## Command 3: `--lsp-symbols <file>`

**Purpose:** Get all symbols in a file (for Outline view)

**Usage:**
```bash
./bin/volta --lsp-symbols test.vlt
```

**Output:**

```json
{
  "success": true,
  "result": {
    "symbols": [
      {
        "name": "add",
        "kind": "function",
        "location": {
          "line": 5,
          "column": 4,
          "endLine": 7,
          "endColumn": 1
        },
        "signature": "fn add(x: int, y: int) -> int",
        "documentation": "Calculates the sum of two integers."
      },
      {
        "name": "Point",
        "kind": "struct",
        "location": {
          "line": 15,
          "column": 8,
          "endLine": 18,
          "endColumn": 1
        },
        "documentation": "Represents a 2D point in space.",
        "children": [
          {
            "name": "x",
            "kind": "field",
            "location": {"line": 16, "column": 5},
            "type": "float"
          },
          {
            "name": "y",
            "kind": "field",
            "location": {"line": 17, "column": 5},
            "type": "float"
          }
        ]
      }
    ]
  },
  "error": null
}
```

**Symbol Kinds:**
- `"function"`
- `"struct"`
- `"field"` (struct field)
- `"variable"`
- `"type"` (type alias)
- `"parameter"`

---

## Command 4: `--lsp-references <file> <line> <column>`

**Purpose:** Find all references to a symbol (for "Find All References")

**Usage:**
```bash
./bin/volta --lsp-references test.vlt 5 10
```

**Output:**

```json
{
  "success": true,
  "result": {
    "symbol": "add",
    "kind": "function",
    "definition": {
      "file": "/path/to/test.vlt",
      "line": 5,
      "column": 4
    },
    "references": [
      {
        "file": "/path/to/test.vlt",
        "line": 20,
        "column": 15,
        "context": "result := add(5, 3)"
      },
      {
        "file": "/path/to/main.vlt",
        "line": 8,
        "column": 10,
        "context": "x := add(a, b)"
      }
    ]
  },
  "error": null
}
```

---

## Command 5: `--lsp-workspace-symbols <query>`

**Purpose:** Search for symbols across entire workspace (for Ctrl+T quick open)

**Usage:**
```bash
./bin/volta --lsp-workspace-symbols "calc" --workspace-root /path/to/project
```

**Output:**

```json
{
  "success": true,
  "result": {
    "symbols": [
      {
        "name": "calculate",
        "kind": "function",
        "file": "/path/to/math.vlt",
        "location": {"line": 5, "column": 4},
        "signature": "fn calculate(x: int) -> int",
        "documentation": "Performs calculation"
      },
      {
        "name": "Calculator",
        "kind": "struct",
        "file": "/path/to/types.vlt",
        "location": {"line": 20, "column": 8}
      }
    ]
  },
  "error": null
}
```

---

## Command 6: `--lsp-signature-help <file> <line> <column>`

**Purpose:** Get function signature for parameter hints (while typing function calls)

**Usage:**
```bash
./bin/volta --lsp-signature-help test.vlt 25 20
```

**Output:**

```json
{
  "success": true,
  "result": {
    "function": "add",
    "signatures": [
      {
        "signature": "fn add(x: int, y: int) -> int",
        "documentation": "Calculates the sum of two integers",
        "parameters": [
          {
            "label": "x: int",
            "documentation": "The first number to add"
          },
          {
            "label": "y: int",
            "documentation": "The second number to add"
          }
        ]
      }
    ],
    "activeParameter": 0,
    "activeSignature": 0
  },
  "error": null
}
```

**Note:** `activeParameter` indicates which parameter the cursor is currently at (0-indexed)

---

## Implementation Stages

### Stage 1: Foundation (Essential)
1. ✅ `--lsp-info` - Hover information
2. ✅ `--lsp-definition` - Go to definition
3. ✅ `--lsp-symbols` - Document outline

### Stage 2: Navigation (Nice to have)
4. `--lsp-references` - Find all references
5. `--lsp-workspace-symbols` - Workspace symbol search

### Stage 3: Advanced (Future)
6. `--lsp-signature-help` - Parameter hints
7. `--lsp-rename` - Rename refactoring
8. `--lsp-code-actions` - Quick fixes

---

## Error Codes

**Standard error codes:**
- `FILE_NOT_FOUND` - Input file doesn't exist
- `PARSE_ERROR` - Syntax error in file
- `SEMANTIC_ERROR` - Semantic analysis failed
- `SYMBOL_NOT_FOUND` - No symbol at given position
- `POSITION_OUT_OF_BOUNDS` - Line/column invalid
- `INTERNAL_ERROR` - Compiler internal error

**Example error response:**
```json
{
  "success": false,
  "result": null,
  "error": {
    "code": "SYMBOL_NOT_FOUND",
    "message": "No symbol found at position 5:10",
    "file": "test.vlt",
    "line": 5,
    "column": 10
  }
}
```

---

## Testing

### Test Commands

```bash
# Test hover on function
./bin/volta --lsp-info examples/documentation_test.vlt 14 4

# Test hover on variable
./bin/volta --lsp-info examples/documentation_test.vlt 35 5

# Test go-to-definition
./bin/volta --lsp-definition examples/documentation_test.vlt 36 20

# Test document symbols
./bin/volta --lsp-symbols examples/documentation_test.vlt
```

---

## Integration with LSP Server

The TypeScript LSP server will:
1. Receive LSP request from VSCode
2. Call appropriate `./bin/volta --lsp-*` command
3. Parse JSON response
4. Convert to LSP response format
5. Send back to VSCode

**Example flow:**
```
User hovers over "add" → VSCode sends hover request → LSP server calls
`./bin/volta --lsp-info file.vlt 5 10` → Compiler outputs JSON →
LSP server formats as markdown → VSCode displays tooltip
```

---

## Next Steps for Implementation

1. **Add CLI argument parsing** for LSP flags
2. **Create LSP module** in compiler (e.g., `src/lsp/LSPProvider.cpp`)
3. **Implement position-to-AST lookup** (find symbol at line/column)
4. **Extract symbol information** from semantic analyzer
5. **Format as JSON** and output to stdout
6. **Test with example files**

Let's start with Stage 1 - implementing `--lsp-info`! 🚀
