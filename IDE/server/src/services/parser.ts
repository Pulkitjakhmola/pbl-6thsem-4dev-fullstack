/**
 * AMS-Lang Parser Service (Updated for new grammar)
 * Parses AMS source code into a JSON AST without invoking the compiler,
 * giving instant feedback for the live AST visualizer panel.
 *
 * This is a lightweight fallback parser. The authoritative AST comes from
 * the external compiler's --dump-ast flag when a compilerPath is configured.
 */

export interface ASTNode {
  type: string;
  name?: string;
  value?: string;
  children?: ASTNode[];
  line?: number;
}

// ── Token Types ─────────────────────────────────────────────
interface Token {
  type: string;
  value: string;
  line: number;
}

const SECTION_KW = new Set(['GLOBAL', 'SOURCES', 'EVENTS', 'OBSERVERS', 'FUNCTIONS']);
const ENTITY_KW = new Set(['SOURCE', 'EVENT', 'OBSERVER', 'FUNCTION']);
const TYPE_KW = new Set(['INT', 'FLOAT', 'STRING', 'BOOL', 'VOID', 'LOG_SOURCE', 'LOG_DATA', 'LOG_RECORD']);
const RUNTIME_KW = new Set([
  'TRACK', 'CHECK', 'EVERY', 'AT', 'CONTINUOUSLY', 'ON', 'OBSERVS',
  'UNSHARE', 'SIGNAL', 'OPEN', 'READ', 'WRITE', 'MODE',
]);
const CONTROL_KW = new Set(['IF', 'ELSE']);
const IMPORT_KW = new Set(['IMPORT', 'MERGE']);
const BOOL_KW = new Set(['TRUE', 'FALSE']);
const TIME_KW = new Set(['MS', 'SEC', 'MIN', 'HOUR']);
const OPERATOR_KW = new Set(['AND', 'OR', 'NOT', 'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'REMAINDER', 'POWER', 'EQUALS']);

const ALL_KW = new Set([
  ...SECTION_KW, ...ENTITY_KW, ...TYPE_KW, ...RUNTIME_KW,
  ...CONTROL_KW, ...IMPORT_KW, ...BOOL_KW, ...TIME_KW, ...OPERATOR_KW,
]);

// ── Tokenizer ───────────────────────────────────────────────
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');
  let inMLComment = false;

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let line = lines[lineNo];

    // Handle multi-line comments: ## ... ##
    if (inMLComment) {
      const endIdx = line.indexOf('##');
      if (endIdx >= 0) {
        inMLComment = false;
        line = line.substring(endIdx + 2);
      } else {
        continue;
      }
    }

    // Check for multi-line comment start
    const mlStart = line.indexOf('##');
    if (mlStart >= 0) {
      const mlEnd = line.indexOf('##', mlStart + 2);
      if (mlEnd >= 0) {
        // Single-line ## ... ## comment
        line = line.substring(0, mlStart) + line.substring(mlEnd + 2);
      } else {
        // Multi-line comment starts here
        line = line.substring(0, mlStart);
        inMLComment = true;
      }
    }

    // Strip single-line comments: # ...
    const commentIdx = line.indexOf('#');
    if (commentIdx >= 0) {
      // Make sure it's not inside a string
      let inStr = false;
      for (let i = 0; i < commentIdx; i++) {
        if (line[i] === '"') inStr = !inStr;
      }
      if (!inStr) {
        line = line.substring(0, commentIdx);
      }
    }

    line = line.trim();
    if (!line) continue;

    // Tokenize: respect quoted strings, punctuation, and words
    const regex = /"[^"]*"|[{}();:,.=!<>+\-*/%^&|]|[a-zA-Z_][a-zA-Z0-9_]*|\d+\.\d+|\d+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line)) !== null) {
      const val = match[0];
      tokens.push({ type: classify(val), value: val, line: lineNo + 1 });
    }
  }
  return tokens;
}

function classify(val: string): string {
  const upper = val.toUpperCase();
  if (ALL_KW.has(upper)) return 'keyword';
  if (/^".*"$/.test(val)) return 'string';
  if (/^\d+\.\d+$/.test(val)) return 'float';
  if (/^\d+$/.test(val)) return 'number';
  if (/^[=!<>]+$/.test(val)) return 'operator';
  if (/^[+\-*/%^&|!]$/.test(val)) return 'operator';
  if (/^[{}();:,.]$/.test(val)) return 'punctuation';
  return 'identifier';
}

// ── Parser ──────────────────────────────────────────────────
/** Lightweight recursive descent parser for AMS source -> AST JSON */
export function parseAMS(source: string): ASTNode {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => tokens[pos++];
  const at = (value: string): boolean => peek()?.value.toUpperCase() === value;
  const atAny = (...values: string[]): boolean => {
    const v = peek()?.value.toUpperCase();
    return v !== undefined && values.includes(v);
  };
  const expect = (value: string): Token | null => {
    if (at(value)) return consume();
    return null;
  };

  function parseProgram(): ASTNode {
    const children: ASTNode[] = [];
    while (pos < tokens.length) {
      if (at('GLOBAL')) children.push(parseGlobalSection());
      else if (at('SOURCES')) children.push(parseSourcesSection());
      else if (at('EVENTS')) children.push(parseEventsSection());
      else if (at('OBSERVERS')) children.push(parseObserversSection());
      else if (at('FUNCTIONS')) children.push(parseFunctionsSection());
      else consume(); // skip unknown
    }
    return { type: 'Program', children };
  }

  function parseGlobalSection(): ASTNode {
    const t = consume(); // GLOBAL
    expect(':');
    const children: ASTNode[] = [];
    while (pos < tokens.length && !atAny('SOURCES', 'EVENTS', 'OBSERVERS', 'FUNCTIONS')) {
      if (at('IMPORT')) children.push(parseImport());
      else if (at('MERGE')) children.push(parseMerge());
      else if (peek()?.type === 'keyword' && TYPE_KW.has(peek()!.value.toUpperCase())) {
        children.push(parseVarDecl());
      } else if (peek()?.type === 'identifier') {
        children.push(parseFuncCallOrAssignment());
      } else {
        consume();
      }
    }
    return { type: 'GlobalSection', children, line: t.line };
  }

  function parseImport(): ASTNode {
    const t = consume(); // IMPORT
    const path = peek()?.type === 'string' ? consume() : null;
    return { type: 'Import', value: path?.value?.replace(/"/g, '') ?? '', line: t.line };
  }

  function parseMerge(): ASTNode {
    const t = consume(); // MERGE
    const path = peek()?.type === 'string' ? consume() : null;
    return { type: 'Merge', value: path?.value?.replace(/"/g, '') ?? '', line: t.line };
  }

  function parseSourcesSection(): ASTNode {
    const t = consume(); // SOURCES
    expect(':');
    const children: ASTNode[] = [];
    while (pos < tokens.length && !atAny('EVENTS', 'OBSERVERS', 'FUNCTIONS')) {
      if (at('SOURCE')) children.push(parseSourceDef());
      else consume();
    }
    return { type: 'SourcesSection', children, line: t.line };
  }

  function parseSourceDef(): ASTNode {
    const t = consume(); // SOURCE
    const name = peek()?.type === 'identifier' ? consume() : null;
    const children: ASTNode[] = [];

    // Parse optional schedule: CHECK EVERY n UNIT | CHECK CONTINUOUSLY
    if (at('CHECK')) {
      consume();
      if (at('EVERY')) {
        consume();
        const val = peek()?.type === 'number' ? consume() : null;
        const unit = peek()?.type === 'keyword' && TIME_KW.has(peek()!.value.toUpperCase()) ? consume() : null;
        children.push({
          type: 'TimeStatement',
          value: `EVERY ${val?.value ?? '?'} ${unit?.value ?? '?'}`,
          line: val?.line,
        });
      } else if (at('CONTINUOUSLY')) {
        const c = consume();
        children.push({ type: 'TimeStatement', value: 'CONTINUOUSLY', line: c.line });
      }
    }

    // Parse body (brace or semicolon delimited)
    const bodyChildren = parseEntityBody();
    children.push(...bodyChildren);

    return { type: 'SourceDefinition', name: name?.value, children, line: t.line };
  }

  function parseEventsSection(): ASTNode {
    const t = consume(); // EVENTS
    expect(':');
    const children: ASTNode[] = [];
    while (pos < tokens.length && !atAny('OBSERVERS', 'FUNCTIONS')) {
      if (at('EVENT')) children.push(parseEventDef());
      else consume();
    }
    return { type: 'EventsSection', children, line: t.line };
  }

  function parseEventDef(): ASTNode {
    const t = consume(); // EVENT
    const name = peek()?.type === 'identifier' ? consume() : null;
    const children: ASTNode[] = [];
    let sourceName = '';

    // Parse ON <sourceName>
    if (at('ON')) {
      consume();
      if (peek()?.type === 'identifier') {
        sourceName = consume().value;
      }
    }

    // Parse optional SIGNAL condition
    if (at('SIGNAL')) {
      const sig = consume();
      const sigChildren: ASTNode[] = [];
      // Consume tokens until newline context or block start
      while (pos < tokens.length && !atAny('{') && peek()?.type !== 'punctuation') {
        if (peek()?.value === ';' || at('EVENT') || at('OBSERVER') || at('FUNCTION')) break;
        sigChildren.push({ type: 'Expression', value: consume().value });
      }
      children.push({ type: 'SignalCondition', children: sigChildren, line: sig.line });
    }

    const bodyChildren = parseEntityBody();
    children.push(...bodyChildren);

    return {
      type: 'EventDefinition',
      name: name?.value,
      value: sourceName,
      children,
      line: t.line,
    };
  }

  function parseObserversSection(): ASTNode {
    const t = consume(); // OBSERVERS
    expect(':');
    const children: ASTNode[] = [];
    while (pos < tokens.length && !at('FUNCTIONS')) {
      if (at('OBSERVER')) children.push(parseObserverDef());
      else consume();
    }
    return { type: 'ObserversSection', children, line: t.line };
  }

  function parseObserverDef(): ASTNode {
    const t = consume(); // OBSERVER
    const name = peek()?.type === 'identifier' ? consume() : null;
    let eventName = '';

    if (at('OBSERVS')) {
      consume();
      if (peek()?.type === 'identifier') {
        eventName = consume().value;
      }
    }

    const bodyChildren = parseEntityBody();

    return {
      type: 'ObserverDefinition',
      name: name?.value,
      value: eventName,
      children: bodyChildren,
      line: t.line,
    };
  }

  function parseFunctionsSection(): ASTNode {
    const t = consume(); // FUNCTIONS
    expect(':');
    const children: ASTNode[] = [];
    while (pos < tokens.length) {
      if (at('FUNCTION')) children.push(parseFunctionDef());
      else consume();
    }
    return { type: 'FunctionsSection', children, line: t.line };
  }

  function parseFunctionDef(): ASTNode {
    const t = consume(); // FUNCTION
    const name = peek()?.type === 'identifier' ? consume() : null;
    const children: ASTNode[] = [];

    // Parse parameters
    if (peek()?.value === '(') {
      consume();
      while (pos < tokens.length && peek()?.value !== ')') {
        if (peek()?.type === 'keyword' && TYPE_KW.has(peek()!.value.toUpperCase())) {
          const pType = consume();
          const pName = peek()?.type === 'identifier' ? consume() : null;
          children.push({ type: 'Parameter', name: pName?.value, value: pType.value });
        } else if (peek()?.value === ',') {
          consume();
        } else {
          consume();
        }
      }
      expect(')');
    }

    const bodyChildren = parseEntityBody();
    children.push(...bodyChildren);

    return { type: 'FunctionDefinition', name: name?.value, children, line: t.line };
  }

  // ── Shared Helpers ────────────────────────────────────────

  function parseEntityBody(): ASTNode[] {
    const children: ASTNode[] = [];
    const useBraces = peek()?.value === '{';

    if (useBraces) {
      consume(); // {
      while (pos < tokens.length && peek()?.value !== '}') {
        const stmt = parseStatement();
        if (stmt) children.push(stmt);
      }
      expect('}');
    } else {
      // Semicolon-delimited body: statements until ';' or next entity/section
      while (pos < tokens.length) {
        if (peek()?.value === ';') { consume(); break; }
        if (atAny('SOURCE', 'EVENT', 'OBSERVER', 'FUNCTION', 'SOURCES', 'EVENTS', 'OBSERVERS', 'FUNCTIONS')) break;
        const stmt = parseStatement();
        if (stmt) children.push(stmt);
      }
    }
    return children;
  }

  function parseStatement(): ASTNode | null {
    if (!peek()) return null;

    // SIGNAL statement
    if (at('SIGNAL')) {
      const sig = consume();
      const children: ASTNode[] = [];
      // Collect condition tokens (simple approach)
      while (pos < tokens.length && peek()?.value !== ';' && peek()?.value !== '}' &&
             !atAny('SOURCE', 'EVENT', 'OBSERVER', 'FUNCTION', 'SIGNAL', 'IF')) {
        if (peek()?.value === '\n') { consume(); break; }
        children.push({ type: 'Expression', value: consume().value, line: peek()?.line });
      }
      return { type: 'Signal', children: children.length > 0 ? children : undefined, line: sig.line };
    }

    // IF statement
    if (at('IF')) return parseIf();

    // TRACK / UNSHARE variable declaration
    if (atAny('TRACK', 'UNSHARE')) {
      const modifier = consume();
      if (peek()?.type === 'keyword' && TYPE_KW.has(peek()!.value.toUpperCase())) {
        const decl = parseVarDecl();
        decl.children = [{ type: 'Modifier', value: modifier.value }, ...(decl.children ?? [])];
        return decl;
      }
      return { type: 'Unknown', value: modifier.value, line: modifier.line };
    }

    // Variable declaration (starts with a type keyword)
    if (peek()?.type === 'keyword' && TYPE_KW.has(peek()!.value.toUpperCase())) {
      return parseVarDecl();
    }

    // Function call or assignment (starts with identifier)
    if (peek()?.type === 'identifier') {
      return parseFuncCallOrAssignment();
    }

    // Skip semicolons and unknown tokens
    consume();
    return null;
  }

  function parseVarDecl(): ASTNode {
    const typeTok = consume(); // type keyword
    const nameTok = peek()?.type === 'identifier' ? consume() : null;
    const children: ASTNode[] = [];

    if (peek()?.value === '=') {
      consume(); // =
      const exprTokens = collectExprTokens();
      if (exprTokens.length > 0) {
        children.push({ type: 'Expression', value: exprTokens.map(t => t.value).join(' '), line: exprTokens[0].line });
      }
    }

    return {
      type: 'VariableDeclaration',
      name: nameTok?.value,
      value: typeTok.value,
      children: children.length > 0 ? children : undefined,
      line: typeTok.line,
    };
  }

  function parseFuncCallOrAssignment(): ASTNode {
    const nameTok = consume(); // identifier

    // Method call: id.id(...)
    if (peek()?.value === '.') {
      consume(); // .
      const method = peek()?.type === 'identifier' ? consume() : null;
      if (peek()?.value === '(') {
        consume();
        const args = collectUntilClose(')');
        return {
          type: 'MethodCall',
          name: `${nameTok.value}.${method?.value ?? ''}`,
          children: args.length > 0 ? [{ type: 'Arguments', value: args.map(t => t.value).join(' ') }] : undefined,
          line: nameTok.line,
        };
      }
      // Data access: id.id
      return { type: 'DataAccess', name: nameTok.value, value: method?.value, line: nameTok.line };
    }

    // Function call: id(...)
    if (peek()?.value === '(') {
      consume();
      const args = collectUntilClose(')');
      return {
        type: 'FunctionCall',
        name: nameTok.value,
        children: args.length > 0 ? [{ type: 'Arguments', value: args.map(t => t.value).join(' ') }] : undefined,
        line: nameTok.line,
      };
    }

    // Assignment: id = expr
    if (peek()?.value === '=') {
      consume();
      const exprTokens = collectExprTokens();
      return {
        type: 'Assignment',
        name: nameTok.value,
        children: exprTokens.length > 0
          ? [{ type: 'Expression', value: exprTokens.map(t => t.value).join(' '), line: exprTokens[0].line }]
          : undefined,
        line: nameTok.line,
      };
    }

    return { type: 'Variable', name: nameTok.value, line: nameTok.line };
  }

  function parseIf(): ASTNode {
    const t = consume(); // IF
    const children: ASTNode[] = [];

    // Collect condition
    const condTokens: Token[] = [];
    // Optional parens around condition
    const hasParen = peek()?.value === '(';
    if (hasParen) consume();
    while (pos < tokens.length) {
      if (hasParen && peek()?.value === ')') { consume(); break; }
      if (!hasParen && (peek()?.value === '{' || peek()?.value === ';' || atAny('ELSE'))) break;
      condTokens.push(consume());
    }
    children.push({ type: 'Condition', value: condTokens.map(t => t.value).join(' '), line: t.line });

    // Body
    const body = parseEntityBody();
    children.push({ type: 'Body', children: body });

    // ELSE IF / ELSE
    while (at('ELSE')) {
      consume();
      if (at('IF')) {
        consume();
        const eiCond: Token[] = [];
        const eip = peek()?.value === '(';
        if (eip) consume();
        while (pos < tokens.length) {
          if (eip && peek()?.value === ')') { consume(); break; }
          if (!eip && (peek()?.value === '{' || peek()?.value === ';' || atAny('ELSE'))) break;
          eiCond.push(consume());
        }
        const eiBody = parseEntityBody();
        children.push({
          type: 'ElseIfBranch',
          children: [
            { type: 'Condition', value: eiCond.map(t => t.value).join(' ') },
            { type: 'Body', children: eiBody },
          ],
        });
      } else {
        const elseBody = parseEntityBody();
        children.push({ type: 'ElseBranch', children: [{ type: 'Body', children: elseBody }] });
        break;
      }
    }

    return { type: 'IfStatement', children, line: t.line };
  }

  function collectExprTokens(): Token[] {
    const result: Token[] = [];
    let depth = 0;
    while (pos < tokens.length) {
      const t = peek()!;
      if (t.value === '(') depth++;
      if (t.value === ')') {
        if (depth === 0) break;
        depth--;
      }
      if (depth === 0 && (t.value === ';' || t.value === '}')) break;
      if (depth === 0 && atAny('SOURCE', 'EVENT', 'OBSERVER', 'FUNCTION', 'SIGNAL', 'IF',
        'SOURCES', 'EVENTS', 'OBSERVERS', 'FUNCTIONS', 'GLOBAL')) break;
      result.push(consume());
    }
    return result;
  }

  function collectUntilClose(close: string): Token[] {
    const result: Token[] = [];
    let depth = 1;
    while (pos < tokens.length) {
      if (peek()?.value === '(') depth++;
      if (peek()?.value === close) {
        depth--;
        if (depth === 0) { consume(); break; }
      }
      result.push(consume());
    }
    return result;
  }

  return parseProgram();
}
