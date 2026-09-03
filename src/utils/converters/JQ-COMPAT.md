# JQ Expression Compatibility Guide

This document specifies exactly which JQ syntax is supported by the visual flow converters, how to write compatible expressions, and what to avoid.

The converters translate **bidirectionally** between JQ text and a visual node graph:

```
JQ Text  ──convertJQToFlow──►  Visual Flow Graph
JQ Text  ◄──convertFlowToJQ──  Visual Flow Graph
```

Every expression you write must be parseable by `convertJQToFlow` and must produce a valid graph that `convertFlowToJQ` can convert back to semantically equivalent JQ.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Value Types](#2-value-types)
3. [Path Expressions](#3-path-expressions)
4. [Pipe Operator](#4-pipe-operator)
5. [Operators](#5-operators)
6. [Functions](#6-functions)
7. [Conditionals](#7-conditionals)
8. [Try-Catch](#8-try-catch)
9. [Variables](#9-variables)
10. [Arrays and Objects](#10-arrays-and-objects)
11. [Function Declarations](#11-function-declarations)
12. [Comments](#12-comments)
13. [Connection Rules (Graph Structure)](#13-connection-rules-graph-structure)
14. [Restrictions and Unsupported Syntax](#14-restrictions-and-unsupported-syntax)
15. [Standard JQ vs Compatible JQ](#15-standard-jq-vs-compatible-jq)
16. [Limits](#16-limits)
17. [Common Patterns](#17-common-patterns)

---

## 1. Quick Start

A compatible expression looks like standard JQ with a few constraints. Here is a valid complex expression:

```jq
def classify(threshold):
  if . >= threshold then "high" else "low" end;

# Filter and classify items
. | .items
  | map(select(.active == true))
  | sort_by(.name)
  # Apply classification to each item's score
  | map({name: .name, rating: .score | classify(75)})
```

**Golden rules:**

- Start with `.` (identity) or a `def` block
- Use `|` to pipe stages together
- Use only the [registered functions](#6-functions) and [supported operators](#5-operators)
- Use `key: value` syntax for objects (no shorthand `{name}`)
- Use `;` to separate function arguments, not `,`
- End conditionals with `end`
- Use `# text` for comments (standalone lines or inline after expressions)
- Maximum expression length: **10,000 characters**

---

## 2. Value Types

Seven value types are supported. Each becomes a **Value** node in the graph.

### Strings

Double-quoted only. Single quotes are NOT valid.

```jq
"hello world"
"line1\nline2"
"tab\there"
"escaped \"quotes\""
"unicode \u4e16\u754c"
""
```

**Supported escape sequences:** `\\`, `\"`, `\n`, `\r`, `\t`, `\f`, `\b`, `\v`, `\uXXXX`

**NOT supported:** String interpolation `\(expr)`.

| Standard JQ        | Compatible JQ                                  |
| ------------------ | ---------------------------------------------- |
| `"Hello \(.name)"` | Not supported — use `"Hello " + .name` instead |

### Numbers

Integers and decimals. Negative numbers supported.

```jq
42
-99
3.14159
0
```

### Booleans

```jq
true
false
```

### Null

```jq
null
```

### Paths

See [Path Expressions](#3-path-expressions).

### Arrays

See [Arrays and Objects](#10-arrays-and-objects).

### Objects

See [Arrays and Objects](#10-arrays-and-objects).

---

## 3. Path Expressions

Paths start with `.` and access data within the input.

### Supported Path Syntax

| Syntax          | Meaning                | Example                     |
| --------------- | ---------------------- | --------------------------- |
| `.`             | Identity (whole input) | `. \| .`                    |
| `.field`        | Field access           | `.name`                     |
| `.field.nested` | Nested field access    | `.data.users.email`         |
| `.[N]`          | Array index            | `.[0]`, `.[42]`             |
| `.[N:M]`        | Array slice            | `.[0:5]`, `.[2:]`, `.[:10]` |
| `.[]`           | Array iterator         | `.items \| .[]`             |
| `.field[N]`     | Mixed path             | `.users[0].name`            |
| `.field[N:M]`   | Mixed with range       | `.data[1:3].value`          |
| `.["key"]`      | Quoted field access    | `.x["a:b"].y`               |

### NOT Supported Path Syntax

| Syntax    | Why                                                | Workaround               |
| --------- | -------------------------------------------------- | ------------------------ |
| `..`      | Recursive descent not implemented                  | Use `recurse(.children)` |
| `.field?` | Parsed as path + `?` operator, not optional access | Use `try .field` instead |
| `.[expr]` | Dynamic index not supported                        | Use `nth(expr; .[])`     |

---

## 4. Pipe Operator

The pipe `|` chains expressions left-to-right. It has the **lowest precedence** of all operators.

```jq
. | .items | map(.name) | sort | join(", ")
```

Each pipe stage becomes a separate node connected by flow edges. The output of the left side becomes the input to the right side.

**Rules:**

- `.` at the start is always required as the entry point (it represents the input data)
- You can pipe any expression into any other
- Named nodes in a chain create variables automatically (see [Variables](#9-variables))

---

## 5. Operators

### Binary Operators

All binary operators take two operands: `LEFT op RIGHT`.

| Operator | Category   | Description                                  |
| -------- | ---------- | -------------------------------------------- |
| `+`      | Arithmetic | Addition, string concatenation, object merge |
| `-`      | Arithmetic | Subtraction, array difference                |
| `*`      | Arithmetic | Multiplication, string repetition            |
| `/`      | Arithmetic | Division, string splitting                   |
| `%`      | Arithmetic | Modulo (remainder)                           |
| `==`     | Comparison | Equality                                     |
| `!=`     | Comparison | Inequality                                   |
| `<`      | Comparison | Less than                                    |
| `<=`     | Comparison | Less than or equal                           |
| `>`      | Comparison | Greater than                                 |
| `>=`     | Comparison | Greater than or equal                        |
| `and`    | Logic      | Logical AND                                  |
| `or`     | Logic      | Logical OR                                   |
| `//`     | Flow       | Alternative (default if null/false)          |

### Unary Operators

| Operator | Position | Description                  |
| -------- | -------- | ---------------------------- |
| `not`    | Prefix   | Logical NOT — `not .active`  |
| `?`      | Postfix  | Error suppression — `.data?` |

### Operator Precedence (Lowest to Highest)

```
1. or, and          (logical)
2. //               (alternative)
3. ==, !=, <=, >=, <, >  (comparison)
4. +, -             (addition/subtraction)
5. *, /, %          (multiplication/division/modulo)
```

Use parentheses `()` to override precedence:

```jq
. | (.x + .y) * .z
. | .a > 0 and (.b + .c) == 10
```

### NOT Supported Operators

| Operator                     | Why                                  |
| ---------------------------- | ------------------------------------ |
| `\|=`                        | Assignment operators not implemented |
| `+=`, `-=`, `*=`, `/=`, `%=` | Assignment operators not implemented |
| `//=`                        | Assignment operators not implemented |

---

## 6. Functions

Only functions registered in the function registry are recognized. There are **66 unique function names** (some with multiple arities). Function arguments are separated by **semicolons** `;`, not commas.

```jq
map(.x)              # 1 argument
sub("old"; "new")    # 2 arguments, separated by ;
range(0; 100; 10)    # 3 arguments, separated by ;
```

### Zero-Parameter Functions

These are called as bare names without parentheses:

| Function         | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `length`         | Length of string, array, or object                                   |
| `utf8bytelength` | UTF-8 byte length of string                                          |
| `keys`           | Object keys (sorted)                                                 |
| `keys_unsorted`  | Object keys (original order)                                         |
| `tostring`       | Convert to string                                                    |
| `tonumber`       | Convert to number                                                    |
| `fromjson`       | Parse JSON string                                                    |
| `tojson`         | Serialize to JSON string                                             |
| `type`           | Type name ("string", "number", "array", "object", "boolean", "null") |
| `halt`           | Stop execution                                                       |
| `add`            | Sum array (numbers), concatenate (strings/arrays), merge (objects)   |
| `ascii_downcase` | Lowercase string                                                     |
| `ascii_upcase`   | Uppercase string                                                     |
| `now`            | Current Unix timestamp                                               |
| `fromdate`       | ISO 8601 string to timestamp                                         |
| `todate`         | Timestamp to ISO 8601 string                                         |
| `floor`          | Floor of number                                                      |
| `sqrt`           | Square root                                                          |
| `min`            | Minimum of array                                                     |
| `max`            | Maximum of array                                                     |
| `debug`          | Print to stderr, pass through                                        |
| `stderr`         | Print to stderr                                                      |
| `sort`           | Sort array                                                           |
| `unique`         | Remove duplicates                                                    |
| `inputs`         | All remaining inputs                                                 |
| `paths`          | All paths in structure                                               |
| `leaf_paths`     | Paths to all leaf values                                             |
| `transpose`      | Transpose array of arrays                                            |
| `combinations`   | All combinations from input arrays (0-arg variant)                   |

### One-Parameter Functions

Called with parentheses and a single argument:

| Function          | Parameter   | Description                          |
| ----------------- | ----------- | ------------------------------------ |
| `map(f)`          | filter      | Apply filter to each array element   |
| `map_values(f)`   | filter      | Apply filter to each object value    |
| `select(cond)`    | condition   | Keep element if condition is true    |
| `sort_by(path)`   | path        | Sort array by path                   |
| `group_by(path)`  | path        | Group array by path                  |
| `unique_by(path)` | path        | Deduplicate by path                  |
| `min_by(path)`    | path        | Element with minimum at path         |
| `max_by(path)`    | path        | Element with maximum at path         |
| `has(key)`        | key         | Check if key/index exists            |
| `in(obj)`         | object      | Check if input key is in object      |
| `del(path)`       | path        | Delete at path                       |
| `contains(val)`   | value       | Containment check                    |
| `startswith(s)`   | string      | String prefix check                  |
| `endswith(s)`     | string      | String suffix check                  |
| `split(sep)`      | separator   | Split string                         |
| `join(sep)`       | separator   | Join array to string                 |
| `test(regex)`     | regex       | Regex match test (boolean)           |
| `match(regex)`    | regex       | Regex match (object)                 |
| `error(msg)`      | message     | Raise error                          |
| `range(n)`        | upper bound | Numbers 0..n-1                       |
| `recurse(f)`      | filter      | Recursive filter application         |
| `repeat(f)`       | filter      | Infinite repetition                  |
| `path(expr)`      | path expr   | Path as array                        |
| `first(f)`        | filter      | First output value                   |
| `last(f)`         | filter      | Last output value                    |
| `isempty(f)`      | filter      | True if filter produces nothing      |
| `all(f)`          | filter      | True if all elements satisfy filter  |
| `any(f)`          | filter      | True if any element satisfies filter |
| `combinations(n)` | length      | Combinations of length n             |
| `strftime(fmt)`   | format      | Format timestamp                     |
| `strptime(fmt)`   | format      | Parse time string                    |

### Two-Parameter Functions

Called with two arguments separated by `;`:

| Function              | Parameters         | Description                   |
| --------------------- | ------------------ | ----------------------------- |
| `sub(regex; repl)`    | regex, replacement | Replace first match           |
| `gsub(regex; repl)`   | regex, replacement | Replace all matches           |
| `range(from; upto)`   | start, end         | Numbers from..upto-1          |
| `limit(n; f)`         | count, filter      | At most n outputs             |
| `nth(n; f)`           | index, filter      | N-th output                   |
| `while(cond; update)` | condition, update  | Loop while true               |
| `until(cond; update)` | condition, update  | Loop until true               |
| `pow(base; exp)`      | base, exponent     | Exponentiation                |
| `recurse(f; cond)`    | filter, condition  | Recursive with stop condition |

### Three-Parameter Functions

| Function                | Parameters       | Description       |
| ----------------------- | ---------------- | ----------------- |
| `range(from; upto; by)` | start, end, step | Numbers with step |

### Critical Function Syntax Rules

1. **Semicolons separate arguments**, not commas:

   ```jq
   # CORRECT:
   sub("old"; "new")
   range(0; 100; 10)

   # WRONG (will be parsed as array elements, not function args):
   sub("old", "new")
   ```

2. **Zero-param functions have NO parentheses**:

   ```jq
   # CORRECT:
   . | keys | sort | length

   # WRONG:
   . | keys() | sort() | length()
   ```

3. **Any bare identifier is treated as a function call** (unless it's `true`, `false`, or `null`):

   ```jq
   . | keys          # calls the function "keys"
   . | my_custom_fn  # calls "my_custom_fn"
   ```

4. **Only registered functions are available in the UI sidebar**. Unregistered names will still parse but won't be selectable in the visual editor.

5. **Nested `;` arguments are read as part of the inner call.** The parser splits an argument list on the `;` characters that stand outside every bracket, string literal and comment, so a call with its own `;` arguments can appear inside another call's arguments:

   ```jq
   . | map(gsub("[^a-z]"; ""))
   . | map(sub("^a"; "b"))
   ```

---

## 7. Conditionals

### Syntax

```
if CONDITION then RESULT end
if CONDITION then RESULT else RESULT end
if COND1 then RES1 elif COND2 then RES2 else RES3 end
if COND1 then RES1 elif COND2 then RES2 elif COND3 then RES3 else RES4 end
```

### Rules

1. **Must start with `if `** (with a trailing space)
2. **Must end with the `end` keyword**, separated from the branch before it by whitespace — a space or a line break
3. **`then` is required** after every condition
4. **`else` is required** in the visual editor (validator will flag a missing else)
5. **Any number of `elif` branches** is allowed
6. Each branch expression can be any valid expression, including pipes, function calls, operators, nested conditionals, and try-catch blocks
7. **`if … end` bounds its own text**, the way brackets bound theirs: the parser steps over a conditional when it looks for the pipes, operators and branch keywords of the level around it. A pipe inside a condition or a branch therefore stays in the conditional, and needs no parentheses of its own:

   ```jq
   . | if .value | tonumber > 5 then "big" else "small" end
   . | if has("x") and (.config | has("y")) then "ok" else "no" end
   ```

### Examples

```jq
# Simple
. | if .x > 5 then "big" else "small" end

# Multi-branch
. | if .score >= 90 then "A"
    elif .score >= 80 then "B"
    elif .score >= 70 then "C"
    else "F" end

# Nested conditionals
. | if .type == "user" then
      (if .age >= 18 then "adult" else "minor" end)
    else "not a user" end

# Branch with pipe chain
. | if .items | length > 0 then
      .items | map(.name) | sort
    else
      "empty" end

# Function calls in conditions
. | if has("name") and has("email") then "valid" else "invalid" end
```

### Nested Conditionals

A conditional nested in a branch is matched by its own `if` / `end` keywords, so
the branch keywords of the conditional around it are read past it. Both of these
parse the same way:

```jq
. | if .a then (if .b then "ab" else "a" end) else "none" end
. | if .a then if .b then "ab" else "a" end else "none" end
```

The converter still parenthesises a conditional where jq's grammar needs a single
term — an object field value, an array item, an operator operand, a try or catch
branch.

---

## 8. Try-Catch

### Syntax

```
try EXPRESSION
try EXPRESSION catch EXPRESSION
```

### Rules

1. **Must start with `try `** (with a trailing space)
2. **`catch` is optional** — the visual editor will show a warning (not error) if catch is missing
3. The try expression and catch expression can each be any valid expression
4. Try-catch can be nested, piped, and combined with other constructs

### Examples

```jq
# Basic try-catch
. | try .name catch "unknown"

# Try without catch (silent error suppression)
. | try tonumber

# Complex expression in try
. | try (.data | fromjson | .value) catch "parse error"

# Try-catch in a pipe chain
. | .raw | try fromjson catch {} | .data | keys

# Nested try-catch
. | try (try .deep.path catch .shallow) catch "all failed"

# Try-catch inside map
. | .items | map(try .value catch 0)
```

---

## 9. Variables

Variables let you capture intermediate values and reference them later.

### Syntax

```jq
EXPRESSION as $VARIABLE_NAME
```

### Rules

1. Variable names must match `[a-zA-Z_][a-zA-Z0-9_]*` (letters, numbers, underscores; must start with letter or underscore)
2. Variables are prefixed with `$` when referencing: `$myVar`
3. The `as $var` pattern must appear at the end of the expression (before the next `|`)
4. In the visual graph, **named nodes automatically create variables** — any node with a non-empty name generates the `as $name | $name` pattern
5. A reference may carry a **postfix path** — `$var.field`, `$var["key"]`, `$var.items[0].name` — which composes onto the reference exactly as it would onto `.`. It draws as the same Path value node a dot path draws, rooted at the variable, and round-trips back to the postfix form.

### Variable Round-Trip Behavior

When you write `EXPR as $var | $var`, the converter:

1. Creates a node for `EXPR`
2. Sets the node's **name** to `var`
3. On round-trip back to JQ, the named node emits `EXPR as $var | $var`

**Important:** Only `Value` and `FunctionCall` nodes create variables. `Operator`, `Condition`, and `TryCatch` nodes **never** create variables — they are always inlined.

### Examples

```jq
# Single variable
. | .name as $name | $name

# Chained variables
. | .first as $first | .last as $last | $first + " " + $last

# Variable from function result
. | .items | map(.price) | add as $total | $total * 1.1

# Variables in object construction
. | .x as $x | .y as $y | {sum: $x + $y, product: $x * $y}

# Multiple variables building toward a result
. | .name as $name | .items | length as $count | {name: $name, count: $count}
```

### What Does NOT Create a Variable

```jq
# Unnamed node — no variable created, expression passes through:
. | .items | map(.x) | sort

# Operator — always inline:
. | .a + .b

# Condition — always inline:
. | if .x then .y else .z end

# TryCatch — always inline:
. | try .x catch "default"
```

---

## 10. Arrays and Objects

### Array Construction

```jq
[ELEM1, ELEM2, ...]
```

Elements are separated by **commas** `,`. Each element can be any valid expression.

```jq
# Literal values
. | [1, 2, 3]
. | ["a", "b", "c"]

# Mixed types
. | [.name, .age, true, null]

# Function calls as elements
. | [keys, length, type]

# Nested arrays
. | [[1, 2], [3, 4]]

# Empty array
. | []
```

**NOT supported:**

- Array comprehension / generators: `[.[] | select(. > 5)]` — use `map(select(. > 5))` instead
- Spread operator: there is no `..` or `...` syntax

### Object Construction

```jq
{KEY: VALUE, KEY: VALUE, ...}
```

Fields are separated by **commas** `,`. Keys can be unquoted identifiers or double-quoted strings. Values can be any valid expression.

```jq
# Literal values
. | {name: "John", age: 30}

# Path references as values
. | {first: .firstName, last: .lastName}

# Function calls as values
. | {count: length, fields: keys}

# Nested objects
. | {user: {name: .name, meta: {role: .role}}}

# Quoted keys
. | {"my-key": .value, "another key": 42}

# Keyword keys — jq accepts a keyword as an unquoted key
. | {start: .from, end: .to, if: .flag}

# Empty object
. | {}
```

**NOT supported:**

| Standard JQ        | Why                                 | Compatible Alternative  |
| ------------------ | ----------------------------------- | ----------------------- |
| `{name}`           | Shorthand not supported             | `{name: .name}`         |
| `{(.key): .value}` | Dynamic/computed keys not supported | No direct workaround    |
| `{a, b, c}`        | Shorthand not supported             | `{a: .a, b: .b, c: .c}` |

### Object Keys Must Use Explicit `key: value`

Every field in an object literal **must** have an explicit colon and value:

```jq
# CORRECT:
. | {name: .name, count: length}

# WRONG (shorthand — will throw parse error):
. | {name, count}
```

---

## 11. Function Declarations

Function declarations use `def` syntax and appear **before** the main expression.

### Syntax

```jq
def NAME(): BODY;
def NAME(PARAM): BODY;
def NAME(PARAM1; PARAM2): BODY;
```

### Rules

1. Declarations must appear at the **top** of the expression, before the main flow
2. Multiple declarations are allowed, each terminated by `;`
3. The main expression follows after all declarations (separated by whitespace)
4. Parameters are separated by **semicolons** `;`
5. Parameter names must be valid identifiers
6. The body can be any valid expression (including conditionals, operators, function calls, etc.)
7. **Declarations are supported bidirectionally.** The JQ → Flow parser extracts `def` blocks and creates `FunctionDecl` nodes with their names and parameters. The Flow → JQ converter generates `def name(params): body;` text output. Round-trip conversion preserves function declarations.

### Examples

```jq
# No parameters
def double(): . * 2;

. | .values | map(double)
```

```jq
# One parameter
def addN(n): . + n;

. | .values | map(addN(10))
```

```jq
# Two parameters
def clamp(lo; hi): if . < lo then lo elif . > hi then hi else . end;

. | .scores | map(clamp(0; 100))
```

```jq
# Multiple declarations
def inc(): . + 1;
def double(): . * 2;
def process(): inc | double;

. | .values | map(process)
```

```jq
# Body with builtins
def summarize(): {count: length, sorted: sort, total: add};

. | .data | summarize
```

---

## 12. Comments

Comments use the `#` character. Everything after `#` to the end of the line is a comment (unless the `#` is inside a string literal).

### Syntax

```jq
# Standalone comment on its own line
. | .field          # Inline comment after an expression
```

### Rules

1. **Standalone comments** occupy their own line and become a Comment node between the stages of the chain they are written in
2. **Inline comments** appear after an expression on the same line — they become a Comment node right after that expression's stage
3. **Consecutive `#` lines** with no expression between them are merged into a single Comment node with multiline text
4. **Comment→Comment connections are not allowed** — use multiline text within a single Comment node instead
5. Comments inside string literals are NOT treated as comments: `"hello # world"` has no comment
6. A comment belongs to the chain it is written in — a branch, a call argument, an array item, an object field or an operator operand keeps its own comments, and the round-trip (JQ → Flow → JQ) returns each one to the chain and the position it came from
7. A comment written above a `def` declaration moves to the head of the main chain: a declaration hangs off the Start node's `functions` handle, which is no chain, and the main chain is the nearest one that can hold the comment
8. A comment written on an object field's key side — before the key or between the key and its colon — joins that field's value chain ahead of the value: a field is a key and a value, with no place of its own for a comment

### Examples

```jq
# Leading comment before the pipeline
. | .items
# Filter active items only
| map(select(.active == true))
| sort_by(.name)    # Sort alphabetically
# Final transformation step
| map(.name)
```

```jq
# Data Processing Pipeline
# Transforms raw sensor readings
# into a clean summary report
. | .readings
| map(select(. > 0))
| sort
| {min: .[0], max: .[-1], count: length}
```

The three consecutive `#` lines at the top become a single Comment node with text:

```
Data Processing Pipeline
Transforms raw sensor readings
into a clean summary report
```

### Graph Representation

In the visual flow graph, each comment becomes a **Comment** node that sits directly in the pipe chain:

```
Start → Comment("Leading comment") → .items → Comment("Filter active...") → map(select(...)) → ...
```

Comment nodes use standard top/bottom handles (same as other pipeline nodes) and pass data through unchanged.

---

## 13. Connection Rules (Graph Structure)

The visual graph enforces specific connection rules between node types. Understanding these helps when debugging why an expression might not load correctly.

### Node Types

| Node             | Role                                     |
| ---------------- | ---------------------------------------- |
| **Start**        | Entry point (exactly one per flow)       |
| **Value**        | Literals, paths, arrays, objects         |
| **FunctionCall** | Built-in or custom function invocations  |
| **Operator**     | Binary and unary operators               |
| **Condition**    | if/elif/else/end blocks                  |
| **TryCatch**     | try/catch blocks                         |
| **FunctionDecl** | Custom function definitions (def blocks) |
| **Comment**      | `# text` annotations in the pipe chain   |

### Handle Types and What They Connect To

| Source Handle                                 | Valid Target Node Types                                     |
| --------------------------------------------- | ----------------------------------------------------------- |
| **flow** (Start →)                            | Value, FunctionCall, Condition, TryCatch, Comment           |
| **bottom** (main chain)                       | Value, FunctionCall, Condition, TryCatch, Operator, Comment |
| **param:N** (function params)                 | Value, FunctionCall, Condition, TryCatch                    |
| **item:N** (array elements)                   | Value, FunctionCall                                         |
| **field:N** (object values)                   | Value, FunctionCall                                         |
| **root:N** (function input)                   | Value, FunctionCall                                         |
| **if:N / then:N / else** (condition branches) | Value, FunctionCall, Condition, TryCatch                    |
| **try / catch** (try-catch branches)          | Value, FunctionCall, Condition, TryCatch                    |
| **functions** (Start →)                       | FunctionDecl only                                           |
| **logic** (FunctionDecl body)                 | Value, FunctionCall, Condition, TryCatch, Comment           |
| **operatorLeft / operatorRight** (Value →)    | Operator only                                               |

### Key Connection Constraints

1. **Start node** has no incoming connections — it is always the root
2. **FunctionDecl** can only connect from Start's `functions` handle
3. **Operator** nodes only accept **Value** nodes as operands (left/right)
4. **Array item** and **object field** handles only accept Value or FunctionCall
5. **Condition/TryCatch branch** handles accept Value, FunctionCall, Condition, or TryCatch (enabling nesting)
6. **Comment** nodes are a stage of a chain, and every chain the converter walks carries them: the main chain, a function-declaration body, and the chains that start at a `param`, `item`, `field`, `root`, `operatorLeft` / `operatorRight`, `if` / `then` / `else` or `try` / `catch` handle. A comment round-trips in each of those positions — JQ → Flow reads it into the chain it was written in, and Flow → JQ emits it back there. A chain of nothing but Comment nodes is a conversion error in every one of those positions, since a comment annotates a value and produces none. The canvas validator accepts a Comment **connection** only on the main-chain handles (`flow`, `bottom`, `logic`), so a comment reaches the other chains by importing jq that carries one there
7. **Comment→Comment connections are not allowed** — multiline comments use `\n` within a single Comment node's text

---

## 14. Restrictions and Unsupported Syntax

### Syntax That Will Fail to Parse

| Syntax                   | Error       | Why                                                                                                            |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `..`                     | Parse error | Recursive descent not implemented                                                                              |
| `"Hello \(.name)"`       | Parse error | String interpolation not implemented                                                                           |
| `.x \|= . + 1`           | Parse error | Assignment operators not implemented                                                                           |
| `.x += 5`                | Parse error | Assignment operators not implemented                                                                           |
| `{(.key): .value}`       | Parse error | Dynamic/computed keys not implemented                                                                          |
| `{name}`                 | Parse error | Object shorthand not implemented                                                                               |
| `@base64`                | Parse error | Format strings not implemented                                                                                 |
| `@csv`, `@html`, `@uri`  | Parse error | Format strings not implemented                                                                                 |
| `label $out \| ...`      | Parse error | Labels/break not implemented                                                                                   |
| `$ENV.PATH`              | Error       | Environment variables not implemented                                                                          |
| `(.a)[.b]`               | Parse error | A computed index on a parenthesised group reads the original input — the graph has no faithful drawing for it  |
| `((.a \| f) == 1) as $v` | Parse error | The name cannot bind an operator whose leftmost operand is a pipe — drawing it would rebind `$v` to a fragment |
| `input`                  | Parse error | stdin functions not implemented                                                                                |
| `'single quotes'`        | Parse error | Only double quotes                                                                                             |
| Empty expression         | Error       | Expression cannot be empty                                                                                     |
| > 10,000 chars           | Error       | Exceeds maximum length                                                                                         |

### Syntax That Parses but May Not Round-Trip Perfectly

| Syntax                    | Behavior                                                                                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra whitespace          | Trimmed — `".  \|  .x"` becomes `". \| .x"`                                                                                                                                                                                |
| Redundant parentheses     | Stripped — `"((.x))"` becomes `".x"`                                                                                                                                                                                       |
| Unnecessary identity pipe | May be simplified — `". \| ."` may become `"."`                                                                                                                                                                            |
| Group with a postfix path | Lowered to the pipe it means — `"(.a \| .b).c"` becomes `".a \| .b \| .c"`. Only input-free postfixes (literal fields, string keys, numbers, ranges, `[]`, `$vars`) are accepted; a computed index parse-fails (see above) |

### Functions NOT in the Registry

The following common JQ builtins are NOT registered and will parse as generic function calls (no parameter validation in UI):

- `to_entries`, `from_entries`, `with_entries` — not registered
- `flatten` — not registered
- `indices`, `index`, `rindex` — not registered
- `ltrimstr`, `rtrimstr` — not registered
- `explode`, `implode` — not registered
- `env`, `$ENV` — not supported
- `getpath`, `setpath`, `delpaths` — not registered
- `builtins` — not registered
- `ascii` — not registered
- `scan`, `splits`, `capture` — not registered
- `foreach`, `reduce`, `label-break` — not supported at parser level
- `try-catch` as expression vs `?` operator — both supported separately

> **Note:** Unregistered function names will still **parse** correctly and appear as FunctionCall nodes, but the UI sidebar won't list them, and the visual editor won't validate their parameters.

---

## 15. Standard JQ vs Compatible JQ

Side-by-side comparison of common JQ patterns and their compatible equivalents.

### String Interpolation

```jq
# Standard JQ:
"Hello \(.name), you are \(.age) years old"

# Compatible JQ:
"Hello " + .name + ", you are " + (.age | tostring) + " years old"
```

### Object Shorthand

```jq
# Standard JQ:
{name, age, email}

# Compatible JQ:
{name: .name, age: .age, email: .email}
```

### Dynamic Keys

```jq
# Standard JQ:
{(.key): .value}

# Compatible JQ:
# No direct equivalent — restructure your logic
```

### Array Comprehension

```jq
# Standard JQ:
[.[] | select(. > 5)]

# Compatible JQ:
. | map(select(. > 5))
```

### Recursive Descent

```jq
# Standard JQ:
.. | .name

# Compatible JQ:
. | recurse(.children) | .name
# (requires knowing the recursive field name)
```

### Optional Field Access

```jq
# Standard JQ:
.data.nested?

# Compatible JQ:
try .data.nested
```

### Assignment Operators

```jq
# Standard JQ:
.name |= ascii_upcase

# Compatible JQ:
. | {name: .name | ascii_upcase}
# (must reconstruct the object manually)
```

### Reduce

```jq
# Standard JQ:
reduce .[] as $x (0; . + $x)

# Compatible JQ:
. | add
# (for simple cases — reduce is not supported for complex accumulators)
```

### Format Strings

```jq
# Standard JQ:
@base64
@csv
@html

# Compatible JQ:
# Not supported — no equivalent
```

### Multiple Outputs / Comma Operator

```jq
# Standard JQ:
.name, .age

# Compatible JQ:
[.name, .age]
# (wrap in array to collect multiple outputs)
```

---

## 16. Limits

| Limit                     | Value                                    |
| ------------------------- | ---------------------------------------- |
| Maximum expression length | 10,000 characters                        |
| Maximum graph size        | 1,000 nodes                              |
| Node name format          | `[a-zA-Z_][a-zA-Z0-9_]*`                 |
| Node name uniqueness      | Duplicates produce warnings (not errors) |
| Start nodes               | Exactly 1 required                       |
| Circular dependencies     | Not allowed (throws error)               |

---

## 17. Common Patterns

### Filter, Transform, Sort

```jq
. | .items
  | map(select(.active == true))
  | sort_by(.name)
  | map({name: .name, email: .email})
```

### Group and Aggregate

```jq
. | .orders
  | group_by(.status)
  | map({
      status: .[0].status,
      count: length,
      total: map(.amount) | add
    })
```

### Safe Parse with Fallback

```jq
. | try (.raw | fromjson | .data) catch "parse error"
```

### Multi-Variable Pipeline

```jq
. | .name as $name
  | .items | length as $count
  | .items | map(.price) | add as $total
  | {name: $name, count: $count, total: $total}
```

### Conditional Transformation

```jq
. | if .type == "string" then
      length
    elif .type == "array" then
      map(length) | add
    else
      0
    end
```

### Nested Conditionals

```jq
. | if .category == "user" then
      (if .age >= 18 then "adult" else "minor" end)
    else
      "non-user"
    end
```

### Error-Resilient Pipeline

```jq
. | .records
  | map(try fromjson catch {error: true})
  | map(select(has("error") | not))
  | map(select(has("id") and has("name")))
  | sort_by(.id)
```

### String Cleanup

```jq
. | .input
  | gsub("[^a-zA-Z0-9 ]"; "")
  | split(" ")
  | map(select(length > 0))
  | map(ascii_downcase)
  | unique
  | sort
  | join(", ")
```

### Custom Function with Conditional Body

```jq
def classify(threshold):
  if . >= threshold then "high"
  elif . >= threshold / 2 then "medium"
  else "low" end;

. | .scores | map(classify(75))
```

### Commented Pipeline

```jq
# Data ingestion pipeline
# Processes raw user records into clean output
. | .users
  # Remove inactive accounts
  | map(select(.active == true))
  # Normalize names to lowercase
  | map({name: .name | ascii_downcase, email: .email})
  | sort_by(.name)
  # Deduplicate by name
  | unique_by(.name)
```

### Full Pipeline: Parse, Validate, Transform, Summarize

```jq
def normalize():
  ascii_downcase | gsub(" "; "_");

. | .raw_records
  | map(try fromjson catch {error: true})
  | map(select(has("error") | not))
  | map(select(has("name") and has("amount")))
  | map({name: .name | normalize, amount: .amount})
  | sort_by(.name)
```
