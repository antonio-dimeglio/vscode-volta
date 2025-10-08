# LSP Phase 3: Advanced Features Implementation Plan

**Status:** In Progress
**Goal:** Complete the Volta LSP with hover info, go-to-definition, symbols, and documentation support

---

## Overview

We've completed the core LSP features (diagnostics/type checking). Now we'll add the advanced features that make the developer experience exceptional.

---

## Feature 1: Documentation System 📝

### Volta Documentation Syntax

**Syntax:** `#[doc]` ... `#[/doc]` blocks

**Example:**
```volta
#[doc]
# Calculates the sum of two integers.
# @param x - The first number
# @param y - The second number
# @returns The sum of x and y
#[/doc]
fn calculate(x: int, y: int) -> int {
    return x + y
}

#[doc]
# Represents a 2D point in space.
# @field x - The x coordinate
# @field y - The y coordinate
#[/doc]
struct Point {
    x: float,
    y: float
}
```

### Documentation Tags

- `@param name - description` - Parameter documentation
- `@returns description` - Return value documentation
- `@field name - description` - Struct field documentation
- `@example` - Usage example
- `@throws` - Error conditions (future)

### Implementation Steps

**Step 1: Update Syntax Highlighting**
- Add `#[doc]` and `#[/doc]` as special comment markers
- Highlight doc tags like `@param`, `@returns` differently

**Step 2: Parser Changes (C++ Compiler)**
- Parse doc comments and attach to AST nodes
- Store documentation metadata with functions/structs
- Output documentation in compiler's JSON/structured format

**Step 3: LSP Integration**
- Parse documentation from compiler output
- Store in symbol table
- Return on hover requests

---

## Feature 2: Hover Information 🔍

### What to Show on Hover

**For Variables:**
```
(hover over x)
┌─────────────────────┐
│ x: int              │
│ Immutable variable  │
└─────────────────────┘
```

**For Functions:**
```
(hover over calculate)
┌──────────────────────────────────────┐
│ fn calculate(x: int, y: int) -> int  │
│                                      │
│ Calculates the sum of two integers.  │
│                                      │
│ Parameters:                          │
│   x: The first number               │
│   y: The second number              │
│                                      │
│ Returns: The sum of x and y          │
└──────────────────────────────────────┘
```

**For Types:**
```
(hover over Point)
┌──────────────────────────────────────┐
│ struct Point                         │
│                                      │
│ Represents a 2D point in space.      │
│                                      │
│ Fields:                              │
│   x: float - The x coordinate       │
│   y: float - The y coordinate       │
└──────────────────────────────────────┘
```

### LSP Protocol

**Request:** `textDocument/hover`
**Input:**
- Document URI
- Cursor position (line, character)

**Output:**
- Hover content (markdown string)
- Range to highlight

### Implementation

**In C++ Compiler:**
Add a `--lsp-info <file> <line> <column>` flag that outputs:
```json
{
  "kind": "function",
  "name": "calculate",
  "signature": "fn calculate(x: int, y: int) -> int",
  "documentation": "Calculates the sum of two integers...",
  "parameters": [
    {"name": "x", "type": "int", "doc": "The first number"},
    {"name": "y", "type": "int", "doc": "The second number"}
  ],
  "returnType": "int",
  "returnDoc": "The sum of x and y"
}
```

**In LSP Server (TypeScript):**
- Receive hover request
- Call compiler with position info
- Parse JSON response
- Format as markdown
- Return to VSCode

---

## Feature 3: Go to Definition 🎯

### Behavior

**User Action:** Press F12 or Ctrl+Click on a symbol

**Expected Result:** Jump to where it's defined

**Examples:**
- Click on function call → Jump to function definition
- Click on variable usage → Jump to variable declaration
- Click on type name → Jump to struct/type definition
- Click on parameter → Jump to function signature

### LSP Protocol

**Request:** `textDocument/definition`
**Input:**
- Document URI
- Cursor position

**Output:**
- Target location (URI, line, character)

### Implementation

**In C++ Compiler:**
Add `--lsp-definition <file> <line> <column>` flag:
```json
{
  "found": true,
  "definitionFile": "/path/to/file.vlt",
  "line": 42,
  "column": 5,
  "name": "calculate",
  "kind": "function"
}
```

**In LSP Server:**
- Receive definition request
- Call compiler
- Convert response to LSP Location
- Return to VSCode

---

## Feature 4: Find References 🔗

### Behavior

**User Action:** Right-click → Find All References (or Shift+F12)

**Expected Result:** List all places where symbol is used

### LSP Protocol

**Request:** `textDocument/references`
**Input:**
- Document URI
- Cursor position
- Include declaration? (boolean)

**Output:**
- Array of locations

### Implementation

**In C++ Compiler:**
Add `--lsp-references <file> <line> <column>` flag:
```json
{
  "symbol": "calculate",
  "references": [
    {"file": "main.vlt", "line": 10, "column": 5},
    {"file": "main.vlt", "line": 15, "column": 12},
    {"file": "utils.vlt", "line": 3, "column": 8}
  ]
}
```

---

## Feature 5: Document Symbols (Outline View) 📋

### Behavior

**User Action:** Open Outline view (Ctrl+Shift+O)

**Expected Result:** List of all functions, structs, types in current file

### LSP Protocol

**Request:** `textDocument/documentSymbol`
**Input:**
- Document URI

**Output:**
- Hierarchical list of symbols

### Symbol Types
- Functions
- Structs
- Type aliases
- Constants
- Variables (top-level)

### Implementation

**In C++ Compiler:**
Add `--lsp-symbols <file>` flag:
```json
{
  "symbols": [
    {
      "name": "calculate",
      "kind": "function",
      "line": 5,
      "column": 4,
      "documentation": "Calculates sum..."
    },
    {
      "name": "Point",
      "kind": "struct",
      "line": 15,
      "column": 8,
      "children": [
        {"name": "x", "kind": "field", "line": 16, "column": 5},
        {"name": "y", "kind": "field", "line": 17, "column": 5}
      ]
    }
  ]
}
```

---

## Feature 6: Workspace Symbols 🌍

### Behavior

**User Action:** Ctrl+T (search symbol across entire workspace)

**Expected Result:** Find symbols in all files

### LSP Protocol

**Request:** `workspace/symbol`
**Input:**
- Query string (partial symbol name)

**Output:**
- List of matching symbols across all files

---

## Feature 7: Rename Symbol ✏️

### Behavior

**User Action:** F2 on a symbol

**Expected Result:** Rename all occurrences in workspace

### LSP Protocol

**Request:** `textDocument/rename`
**Input:**
- Document URI
- Position
- New name

**Output:**
- WorkspaceEdit (changes to all files)

### Implementation

**Safety Checks:**
- New name must be valid identifier
- Must not conflict with existing symbols
- Must respect scope rules

---

## Feature 8: Semantic Highlighting 🎨

### Behavior

Different syntax highlighting based on semantic analysis (not just text patterns)

**Examples:**
- Function calls vs function definitions (different colors)
- Mutable vs immutable variables
- Type names vs values
- Parameters vs local variables

---

## Feature 9: Signature Help 💡

### Behavior

**User Action:** Type `calculate(`

**Expected Result:** Show parameter info while typing

```
calculate(█
         ↓
┌──────────────────────────────┐
│ calculate(x: int, y: int)    │
│           ^^^^^^              │
│ x: The first number          │
└──────────────────────────────┘
```

### LSP Protocol

**Request:** `textDocument/signatureHelp`
**Input:**
- Document URI
- Cursor position

**Output:**
- Function signatures
- Active parameter index
- Parameter documentation

---

## Feature 10: Code Actions (Quick Fixes) 🔧

### Examples

**Add Missing Import:**
```volta
# Error: 'math' is not imported
x := math.sqrt(16.0)
     ^^^^
# Quick fix: Add 'import math'
```

**Add Type Annotation:**
```volta
# Warning: Type could be explicit
x := 42
# Quick fix: Change to 'x: int = 42'
```

**Convert Immutable to Mutable:**
```volta
x: int = 0
x = x + 1  # Error: x is immutable
# Quick fix: Change to 'x: mut int = 0'
```

---

## Implementation Priority

### Phase 3A: Core Information (This Session)
1. ✅ Diagnostics (DONE!)
2. 🔄 Hover information
3. 🔄 Go to definition
4. 🔄 Document symbols

### Phase 3B: Advanced Navigation
5. Find references
6. Workspace symbols
7. Rename symbol

### Phase 3C: Developer Experience
8. Signature help
9. Semantic highlighting
10. Code actions

---

## Compiler Changes Needed

### New CLI Flags

```bash
# Get information about symbol at position
./bin/volta --lsp-info <file> <line> <column>

# Get definition location
./bin/volta --lsp-definition <file> <line> <column>

# Get all references
./bin/volta --lsp-references <file> <line> <column>

# Get document symbols
./bin/volta --lsp-symbols <file>

# Get workspace symbols (all files)
./bin/volta --lsp-workspace-symbols <query>
```

### JSON Output Format

All LSP commands should output structured JSON that's easy to parse in TypeScript.

**Example response format:**
```json
{
  "success": true,
  "result": {
    // Feature-specific data
  },
  "error": null
}
```

---

## Testing Plan

### Test Files

Create `tests/lsp/` directory with:
- `hover_test.vlt` - Test hover on various symbols
- `definition_test.vlt` - Test go-to-definition
- `symbols_test.vlt` - Test outline/symbols
- `documentation_test.vlt` - Test doc comments

### Manual Testing Checklist

For each feature:
- ✅ Works with valid code
- ✅ Handles errors gracefully
- ✅ Performance is acceptable (< 100ms)
- ✅ Works across files
- ✅ Documentation displays correctly

---

## Success Metrics

**When are we done?**

- ✅ Hover shows types and documentation
- ✅ F12 jumps to definitions
- ✅ Outline view shows all symbols
- ✅ Documentation displays beautifully
- ✅ Performance feels instant
- ✅ No crashes or freezes

---

## Next Steps

1. Update syntax highlighting for `#[doc]` blocks
2. Design C++ compiler LSP flags
3. Implement hover information
4. Implement go-to-definition
5. Implement document symbols
6. Test everything thoroughly!

Let's build the best Volta development experience! ⚡
