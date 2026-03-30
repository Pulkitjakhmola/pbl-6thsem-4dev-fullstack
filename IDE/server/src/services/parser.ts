/**
 * AMS-Lang Parser Service
 * Parses AMS source code into a JSON AST without invoking the compiler,
 * giving instant feedback for the live AST visualizer panel.
 */

export interface ASTNode {
  type: string;
  name?: string;
  value?: string;
  children?: ASTNode[];
  line?: number;
}

interface Token {
  type: string;
  value: string;
  line: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split('\n');

  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo].replace(/\/\/.*$/, '').trim(); // strip comments
    if (!line) continue;

    // Tokenize each line word by word, respecting quoted strings
    const raw = line.match(/"[^"]*"|[^\s]+/g) ?? [];
    for (const val of raw) {
      tokens.push({ type: classify(val), value: val, line: lineNo + 1 });
    }
  }
  return tokens;
}

function classify(val: string): string {
  const keywords = [
    'MONITOR', 'WATCH', 'SET', 'RULE', 'SEVERITY', 'WHEN', 'AND', 'OR',
    'NOT', 'OCCURS', 'TIMES', 'IN', 'WITHIN', 'MINUTES', 'SECONDS', 'HOURS',
    'IF', 'DO', 'END', 'regex', 'TRUE', 'FALSE',
    'LOW', 'MEDIUM', 'HIGH', 'CRITICAL',
  ];
  const actions = [
    'SEND_EMAIL', 'ALERT', 'LOG', 'CALL_API', 'EXECUTE_SCRIPT', 'CONSOLE', 'BLOCK_IP',
  ];
  if (keywords.includes(val)) return 'keyword';
  if (actions.some((a) => val.startsWith(a))) return 'action';
  if (/^".*"$/.test(val)) return 'string';
  if (/^\d+$/.test(val)) return 'number';
  if (/^[=!<>]+$/.test(val)) return 'operator';
  return 'identifier';
}

/** Simple recursive descent parser for AMS source → AST JSON */
export function parseAMS(source: string): ASTNode {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];
  const expect = (type: string, value?: string) => {
    const t = tokens[pos];
    if (!t || (type && t.type !== type) || (value && t.value !== value)) return null;
    return tokens[pos++];
  };

  function parseProgram(): ASTNode {
    const children: ASTNode[] = [];
    while (pos < tokens.length) {
      const t = peek();
      if (!t) break;
      if (t.value === 'MONITOR') children.push(parseMonitor());
      else if (t.value === 'WATCH') children.push(parseWatch());
      else if (t.value === 'SET') children.push(parseSet());
      else if (t.value === 'RULE') children.push(parseRule());
      else { consume(); } // skip unknown
    }
    return { type: 'Program', children };
  }

  function parseMonitor(): ASTNode {
    const t = consume(); // MONITOR
    const src = peek()?.type === 'string' ? consume() : null;
    return {
      type: 'MonitorStmt',
      value: src?.value ?? '',
      line: t.line,
    };
  }

  function parseWatch(): ASTNode {
    const t = consume(); // WATCH
    const fmt = peek()?.type === 'identifier' ? consume() : null;
    const src = peek()?.type === 'string' ? consume() : null;
    return {
      type: 'WatchStmt',
      children: [
        { type: 'format', value: fmt?.value ?? '' },
        { type: 'source', value: src?.value ?? '' },
      ],
      line: t.line,
    };
  }

  function parseSet(): ASTNode {
    const t = consume(); // SET
    const id = peek()?.type === 'identifier' ? consume() : null;
    if (peek()?.value === '=') consume(); // =
    const val = consume();
    return {
      type: 'SetStmt',
      name: id?.value,
      value: val?.value,
      line: t.line,
    };
  }

  function parseRule(): ASTNode {
    const t = consume(); // RULE
    const name = peek()?.type === 'identifier' ? consume() : null;
    const children: ASTNode[] = [];

    // Optional SEVERITY
    if (peek()?.value === 'SEVERITY') {
      consume();
      const level = consume();
      children.push({ type: 'Severity', value: level?.value });
    }

    // WHEN clauses
    while (pos < tokens.length && (peek()?.value === 'WHEN' || peek()?.value === 'AND')) {
      children.push(parseWhen());
    }

    // Optional IF
    if (peek()?.value === 'IF') {
      children.push(parseIf());
    }

    // DO block
    if (peek()?.value === 'DO') {
      children.push(parseDo());
    }

    // END
    if (peek()?.value === 'END') consume();

    return { type: 'RuleBlock', name: name?.value, children, line: t.line };
  }

  function parseWhen(): ASTNode {
    const t = consume(); // WHEN or AND
    const children: ASTNode[] = [];

    // event pattern
    if (peek()?.type === 'string') {
      children.push({ type: 'EventPattern', value: consume().value });
    } else if (peek()?.value === 'regex') {
      consume(); // regex
      if (peek()?.value === '(') consume();
      const pat = peek()?.type === 'string' ? consume() : null;
      if (peek()?.value === ')') consume();
      children.push({ type: 'RegexPattern', value: pat?.value ?? '' });
    }

    // time window
    if (peek()?.value === 'OCCURS') {
      consume();
      const count = consume();
      if (peek()?.value === 'TIMES') consume();
      if (peek()?.value === 'IN') consume();
      const amount = consume();
      const unit = consume();
      children.push({
        type: 'TimeWindow',
        value: `${count?.value} TIMES IN ${amount?.value} ${unit?.value}`,
      });
    } else if (peek()?.value === 'WITHIN') {
      consume();
      const amount = consume();
      const unit = consume();
      children.push({ type: 'TimeWindow', value: `WITHIN ${amount?.value} ${unit?.value}` });
    } else if (peek()?.value === 'IN') {
      consume();
      const amount = consume();
      const unit = consume();
      children.push({ type: 'TimeWindow', value: `IN ${amount?.value} ${unit?.value}` });
    }

    return { type: t.value === 'WHEN' ? 'WhenClause' : 'AndClause', children, line: t.line };
  }

  function parseIf(): ASTNode {
    const t = consume(); // IF
    const parts: string[] = [];
    // Collect tokens until DO or END
    while (pos < tokens.length && peek()?.value !== 'DO' && peek()?.value !== 'END') {
      parts.push(consume().value);
    }
    return { type: 'IfClause', value: parts.join(' '), line: t.line };
  }

  function parseDo(): ASTNode {
    const t = consume(); // DO
    const actions: ASTNode[] = [];
    const actionKws = ['SEND_EMAIL', 'ALERT', 'LOG', 'CALL_API', 'EXECUTE_SCRIPT', 'CONSOLE', 'BLOCK_IP'];

    while (pos < tokens.length && peek()?.value !== 'END') {
      const cur = peek();
      if (cur && actionKws.includes(cur.value)) {
        consume(); // action name
        if (peek()?.value === '(') consume();
        const arg = peek()?.type === 'string' ? consume() : null;
        if (peek()?.value === ')') consume();
        actions.push({ type: 'Action', name: cur.value, value: arg?.value });
      } else {
        consume();
      }
    }

    return { type: 'DoBlock', children: actions, line: t.line };
  }

  return parseProgram();
}
