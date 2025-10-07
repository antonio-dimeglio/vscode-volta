# VSCode Extension Implementation Roadmap for Volta

**Version:** 1.0
**Project:** vscode-volta
**Goal:** Build a fully-fledged, professional VSCode extension for the Volta programming language

---

## Overview

This document outlines the complete implementation roadmap for building a comprehensive VSCode extension for Volta. Each phase builds incrementally on the previous, following the teaching approach of starting simple and growing in complexity.

---

## Phase 1: Foundation - Syntax Highlighting ⚡

**Duration:** 1-2 sessions
**Complexity:** ⭐ Beginner

### Objectives
- Fix existing syntax highlighting bugs
- Add complete language feature coverage
- Ensure Volta code renders beautifully in the editor

### Deliverables

#### 1.1 Fixed Language Configuration
**File:** `language-configuration.json`

- ✅ Correct comment syntax (`#` for line comments, `#[` `]#` for block comments)
- ✅ Proper bracket pairs: `{}`, `[]`, `()`
- ✅ Auto-closing pairs for quotes and brackets
- ✅ Surrounding pairs configuration
- ✅ Word pattern definition (for word selection)

#### 1.2 Complete TextMate Grammar
**File:** `syntaxes/volta.tmLanguage.json`

**Token Categories to Implement:**

1. **Keywords** (control flow, declarations, modifiers)
   - Control: `if`, `else`, `while`, `for`, `in`, `match`, `return`
   - Declarations: `fn`, `struct`, `import`, `type`
   - Modifiers: `mut`
   - Values: `Some`, `None` (capitalized!)
   - Logical: `and`, `or`, `not`

2. **Types** (built-in and user-defined)
   - Primitives: `int`, `float`, `bool`, `str`
   - Containers: `Array`, `Matrix`, `Option`
   - Generic syntax: `Array[T]`, `Option[int]`

3. **Operators**
   - Arithmetic: `+`, `-`, `*`, `/`, `%`, `**`
   - Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
   - Logical: `and`, `or`, `not`
   - Assignment: `=`, `+=`, `-=`, `*=`, `/=`, `:=`
   - Range: `..`, `..=`
   - Arrow: `->`, `=>`

4. **Literals**
   - Numbers: integers (`42`), floats (`3.14`), scientific (`1e-10`)
   - Strings: double-quoted with escape sequences
   - Booleans: `true`, `false`

5. **Comments**
   - Line comments: `#`
   - Block comments: `#[` ... `]#` (with nesting support)

6. **Functions & Types**
   - Function declarations: `fn name(params) -> type`
   - Function types: `fn(int, float) -> bool`
   - Type annotations: `x: int`, `arr: Array[float]`
   - Generic parameters: `[T]`, `[T, U]`

7. **Delimiters & Punctuation**
   - Brackets: `(`, `)`, `[`, `]`, `{`, `}`
   - Separators: `,`, `:`, `;`, `.`
   - Arrows: `->`, `=>`

### Success Criteria
- All Volta keywords are correctly highlighted
- Type annotations are visually distinct
- Operators are properly recognized
- Comments work correctly (single and multi-line)
- String escape sequences are highlighted
- Function definitions stand out clearly
- No false positives (e.g., `some_variable` shouldn't highlight as `Some`)

### Testing
Create test file: `examples/syntax_test.vlt` with:
- All keywords and operators
- All literal types
- Function declarations
- Type annotations
- Comments (nested blocks)
- Edge cases (keywords in strings, identifiers with keyword prefixes)

---

## Phase 2: Code Snippets & Basic Intelligence 🧠

**Duration:** 1-2 sessions
**Complexity:** ⭐⭐ Beginner-Intermediate

### Objectives
- Provide quick code templates
- Basic keyword completions
- Improve typing efficiency

### Deliverables

#### 2.1 Snippet Library
**File:** `snippets/volta.json`

**Snippets to Create:**

1. **Function Declarations**
   - `fn` → function definition
   - `fnexpr` → single-expression function
   - `fnlambda` → lambda function

2. **Control Flow**
   - `if` → if statement
   - `ifelse` → if-else statement
   - `match` → match expression
   - `for` → for loop
   - `forin` → for-in loop
   - `while` → while loop

3. **Data Structures**
   - `struct` → struct definition
   - `array` → array literal
   - `matrix` → matrix creation

4. **Common Patterns**
   - `option` → Option type pattern match
   - `unwrap` → unwrap_or pattern
   - `map` → map operation
   - `filter` → filter operation

5. **Imports & Types**
   - `import` → import statement
   - `type` → type alias

#### 2.2 Basic Completion Provider
**File:** `src/completionProvider.ts` (new)

- Keyword completions
- Built-in type completions
- Standard library module names
- Common method names (`.len()`, `.map()`, `.filter()`, etc.)

#### 2.3 Extension Activation
**File:** `src/extension.ts` (new)

- Register snippet provider
- Register completion provider
- Set up activation events

### Success Criteria
- Typing `fn<tab>` creates a function template
- IntelliSense shows Volta keywords
- Built-in types appear in completions
- Cursor positions are correctly placed in snippets (tab stops)

### Testing
- Test each snippet manually
- Verify tab stops work correctly
- Test completions in various contexts

---

## Phase 3: Language Server Protocol Integration 🔧

**Duration:** 4-6 sessions
**Complexity:** ⭐⭐⭐⭐ Advanced

### Objectives
- Real-time type checking
- Semantic understanding of code
- Navigation features (go-to-definition, find references)
- Hover information

### Architecture Decision

**Option A: TypeScript-based LSP**
- Implement parser in TypeScript
- Full control, easier debugging
- More work upfront

**Option B: External LSP**
- Use your existing C++ compiler as language server
- Requires LSP protocol wrapper
- Reuses existing semantic analysis

**Recommendation:** Start with Option B (reuse your compiler work!)

### Deliverables

#### 3.1 LSP Server Setup
**File:** `server/` directory (new)

**Components:**
1. **LSP Protocol Handler**
   - Initialize/shutdown
   - Document sync (open, change, close)
   - Capabilities negotiation

2. **Compiler Integration**
   - Interface with Volta compiler frontend
   - Parse source code
   - Run semantic analysis
   - Extract type information

3. **Diagnostic Provider**
   - Convert compiler errors to LSP diagnostics
   - Syntax errors
   - Type errors
   - Semantic errors

#### 3.2 LSP Client Setup
**File:** `src/extension.ts` (update)

- Launch language server process
- Manage server lifecycle
- Handle crashes/restarts

#### 3.3 Core LSP Features

**3.3.1 Diagnostics (Errors & Warnings)**
- Real-time error reporting
- Type mismatches
- Undefined variables
- Syntax errors

**3.3.2 Go to Definition**
- Jump to function definitions
- Jump to variable declarations
- Jump to type definitions
- Jump to struct fields

**3.3.3 Hover Information**
- Show inferred types on hover
- Show function signatures
- Show documentation comments
- Show value information

**3.3.4 Find References**
- Find all usages of a symbol
- Highlight references in current file
- Show references in sidebar

**3.3.5 Rename Symbol**
- Rename variables
- Rename functions
- Rename types
- Update all references

**3.3.6 Code Completion (Semantic)**
- Context-aware completions
- Struct field completions
- Module member completions
- Type-based suggestions

**3.3.7 Signature Help**
- Show parameter info while typing
- Highlight current parameter
- Show parameter types

#### 3.4 Symbol Providers

**Document Symbols**
- Show outline of current file
- Functions, structs, types
- Breadcrumbs support

**Workspace Symbols**
- Search symbols across workspace
- Quick navigation

### Success Criteria
- Red squiggles appear for type errors
- F12 (Go to Definition) works
- Hover shows type information
- Rename refactoring works correctly
- Completions are context-aware
- Outline view shows document structure

### Testing
- Create comprehensive test suite
- Test all LSP features independently
- Test error recovery
- Test with large files
- Performance benchmarks

---

## Phase 4: Formatting & Code Actions ✨

**Duration:** 2-3 sessions
**Complexity:** ⭐⭐⭐ Intermediate-Advanced

### Objectives
- Automatic code formatting
- Style consistency
- Quick fixes for common issues

### Deliverables

#### 4.1 Document Formatter
**File:** `server/formatting.ts` (new)

**Formatting Rules:**
- Indentation (4 spaces default, configurable)
- Bracket placement (K&R vs Allman style)
- Spacing around operators
- Line wrapping for long expressions
- Blank line rules (between functions, imports)

**Features:**
- Format on save (configurable)
- Format selection
- Format document
- Format on type (e.g., auto-indent on `}`)

#### 4.2 Code Actions Provider

**Quick Fixes:**
1. **Import missing module**
2. **Add missing type annotation**
3. **Convert `if` to `match`**
4. **Extract function**
5. **Extract variable**
6. **Add missing return statement**
7. **Fix Option unwrap** (add error handling)

**Refactorings:**
1. **Convert immutable to mutable** (add `mut`)
2. **Inline variable**
3. **Inline function**

### Success Criteria
- Code formats consistently
- Quick fixes appear as lightbulbs
- Format on save works
- User preferences are respected

### Testing
- Format various code samples
- Verify edge cases (comments, strings)
- Test all code actions
- Performance testing

---

## Phase 5: Debugging Support 🚀

**Duration:** 3-4 sessions
**Complexity:** ⭐⭐⭐⭐ Advanced

### Objectives
- Set breakpoints and step through code
- Inspect variables at runtime
- Evaluate expressions in debug console

### Deliverables

#### 5.1 Debug Adapter Protocol Implementation
**File:** `debugger/` directory (new)

**Components:**
1. **DAP Server**
   - Launch/attach configurations
   - Breakpoint management
   - Stepping control (step in, over, out)
   - Stack traces
   - Variable inspection

2. **VM Integration**
   - Instrumentation hooks in bytecode VM
   - Pause execution at breakpoints
   - Variable value extraction
   - Expression evaluation

#### 5.2 Launch Configurations
**File:** `.vscode/launch.json` template

- Run current file
- Run with arguments
- Attach to running process

#### 5.3 Debug Features

**Breakpoints:**
- Line breakpoints
- Conditional breakpoints
- Logpoints (print without stopping)

**Stepping:**
- Step over
- Step into
- Step out
- Continue
- Pause

**Inspection:**
- Variables view (locals, globals)
- Watch expressions
- Call stack
- Hover evaluation

**Debug Console:**
- Evaluate expressions
- Modify variables
- Call functions

### Success Criteria
- Breakpoints work reliably
- Variables display correct values
- Step debugging works smoothly
- Call stack is accurate
- Debug console evaluates expressions

### Testing
- Test all stepping modes
- Test breakpoint conditions
- Test with recursive functions
- Test error handling during debug

---

## Phase 6: Advanced Features & Polish 💎

**Duration:** 2-3 sessions
**Complexity:** ⭐⭐⭐ Intermediate

### Objectives
- Professional appearance
- Enhanced user experience
- Community readiness

### Deliverables

#### 6.1 Extension Icon & Branding
**Files:** `images/` directory (new)

- Extension icon (Volta logo/lightning bolt)
- File type icon (`.vlt` files)
- Syntax theme optimized for Volta

#### 6.2 Integrated REPL
**File:** `src/repl.ts` (new)

- Terminal-based REPL
- Evaluate expressions quickly
- Show types and values
- Load files into REPL

#### 6.3 Task Provider
**File:** `src/taskProvider.ts` (new)

**Tasks:**
- Build project
- Run file
- Run tests
- Type check

#### 6.4 Documentation Provider
**File:** `docs/` integration

- Rich hover documentation
- Code examples in hover
- Link to web documentation

#### 6.5 Syntax Theme
**File:** `themes/volta-theme.json` (new)

- Custom color scheme for Volta
- Optimized contrast for keywords/types
- Support for light and dark themes

#### 6.6 Configuration Options
**File:** `package.json` (update contribution points)

**Settings:**
- `volta.format.indentSize`
- `volta.format.bracketStyle`
- `volta.linter.enabled`
- `volta.typeCheck.onSave`
- `volta.compiler.path`

### Success Criteria
- Extension looks professional
- REPL is usable and helpful
- Tasks integrate with VSCode
- Configuration is intuitive
- Documentation is accessible

---

## Phase 7: Testing, Documentation & Publishing 📦

**Duration:** 2-3 sessions
**Complexity:** ⭐⭐ Intermediate

### Objectives
- Comprehensive testing
- Professional documentation
- Publish to marketplace

### Deliverables

#### 7.1 Test Suite
**File:** `src/test/` directory

**Tests:**
- Unit tests for all components
- Integration tests for LSP
- End-to-end tests
- Regression tests

#### 7.2 Documentation

**README.md** (update):
- Feature showcase with GIFs
- Installation instructions
- Usage guide
- Configuration reference
- Troubleshooting

**CHANGELOG.md** (update):
- Version history
- Feature additions
- Bug fixes

**Contributing Guide**:
- How to build from source
- Development setup
- Testing procedures
- PR guidelines

#### 7.3 Marketplace Preparation

**Files:**
- High-quality screenshots
- Feature demonstration GIFs
- Extension banner
- Categories and tags
- Keywords for search

#### 7.4 CI/CD Pipeline
**File:** `.github/workflows/` (new)

- Automated testing
- Build verification
- Release automation

### Success Criteria
- All tests pass
- Documentation is complete
- Extension packages successfully
- Marketplace listing is professional

---

## Complete Feature Matrix

| Feature | Phase | Complexity | Status |
|---------|-------|------------|--------|
| Syntax Highlighting | 1 | ⭐ | 🚧 In Progress |
| Language Configuration | 1 | ⭐ | 🚧 In Progress |
| Code Snippets | 2 | ⭐⭐ | ⏳ Planned |
| Basic Completions | 2 | ⭐⭐ | ⏳ Planned |
| Diagnostics (Errors) | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Go to Definition | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Hover Information | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Find References | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Rename Symbol | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Semantic Completions | 3 | ⭐⭐⭐⭐ | ⏳ Planned |
| Document Symbols | 3 | ⭐⭐⭐ | ⏳ Planned |
| Code Formatting | 4 | ⭐⭐⭐ | ⏳ Planned |
| Code Actions | 4 | ⭐⭐⭐ | ⏳ Planned |
| Quick Fixes | 4 | ⭐⭐⭐ | ⏳ Planned |
| Debugging | 5 | ⭐⭐⭐⭐ | ⏳ Planned |
| Breakpoints | 5 | ⭐⭐⭐⭐ | ⏳ Planned |
| Variable Inspection | 5 | ⭐⭐⭐⭐ | ⏳ Planned |
| Integrated REPL | 6 | ⭐⭐⭐ | ⏳ Planned |
| Task Provider | 6 | ⭐⭐ | ⏳ Planned |
| Custom Theme | 6 | ⭐⭐ | ⏳ Planned |
| Extension Icon | 6 | ⭐ | ⏳ Planned |

---

## Dependencies & Prerequisites

### For All Phases
- Node.js 18+ and npm
- VSCode extension development knowledge
- TypeScript

### For Phase 3+ (LSP)
- Your Volta compiler (frontend: parser, semantic analyzer)
- Understanding of LSP protocol
- JSON-RPC communication

### For Phase 5 (Debugging)
- Your Volta VM with debug hooks
- Understanding of DAP protocol

---

## Estimated Timeline

**Minimum Viable Extension (Phases 1-2):** 2-4 sessions
**Professional Extension (Phases 1-4):** 6-12 sessions
**Complete Extension (All phases):** 15-20 sessions

---

## Learning Outcomes

By completing this roadmap, you will learn:

1. **TextMate Grammars** - How syntax highlighting works
2. **VSCode Extension API** - Extension architecture and lifecycle
3. **Language Server Protocol** - Client-server architecture for language tools
4. **Debug Adapter Protocol** - How debugging tools work
5. **Compiler Integration** - Connecting language tools to IDEs
6. **User Experience Design** - Making tools intuitive and delightful
7. **Software Distribution** - Publishing and maintaining extensions

---

## Success Metrics

**User Experience:**
- ✅ Code is readable with proper highlighting
- ✅ Errors appear immediately (within 1 second)
- ✅ Navigation is instant (go-to-definition < 100ms)
- ✅ Completions are relevant and fast

**Quality:**
- ✅ No false positive errors
- ✅ No crashes or freezes
- ✅ Works with large files (1000+ lines)
- ✅ Memory efficient

**Community:**
- ✅ Published to marketplace
- ✅ Documentation is clear
- ✅ Issue templates ready
- ✅ Contributing guide available

---

## Next Steps

1. **Start Phase 1** - Fix syntax highlighting
2. **Create test files** - Examples of all Volta features
3. **Iterate and improve** - Get feedback, refine

Let's begin! 🚀⚡

**Motto:** *"Charge forward with clarity"*
