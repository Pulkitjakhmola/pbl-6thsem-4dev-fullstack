import type * as Monaco from 'monaco-editor';

/** AMS-Lang Monarch tokenizer for Monaco Editor */
export const AMSLanguageDefinition: Monaco.languages.IMonarchLanguage = {
  keywords: [
    'MONITOR', 'WATCH', 'SET', 'RULE', 'SEVERITY', 'WHEN', 'AND', 'OR', 'NOT',
    'OCCURS', 'TIMES', 'IN', 'WITHIN', 'MINUTES', 'SECONDS', 'HOURS',
    'IF', 'DO', 'END', 'TRUE', 'FALSE', 'regex',
  ],
  severities: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  actions: ['SEND_EMAIL', 'ALERT', 'LOG', 'CALL_API', 'EXECUTE_SCRIPT', 'CONSOLE', 'BLOCK_IP'],
  operators: ['==', '!=', '>', '<', '>=', '<=', '='],

  tokenizer: {
    root: [
      // Comments
      [/\/\/.*$/, 'comment'],

      // Keywords
      [/\b(MONITOR|WATCH|SET|RULE|SEVERITY|WHEN|AND|OR|NOT)\b/, 'keyword.control'],
      [/\b(OCCURS|TIMES|IN|WITHIN|WITHIN|IF|DO|END)\b/, 'keyword.other'],
      [/\b(MINUTES|SECONDS|HOURS)\b/, 'keyword.time'],
      [/\b(TRUE|FALSE)\b/, 'constant.language'],
      [/\b(LOW|MEDIUM|HIGH|CRITICAL)\b/, 'keyword.severity'],
      [/\b(regex)\b/, 'keyword.special'],

      // Actions
      [/\b(SEND_EMAIL|ALERT|LOG|CALL_API|EXECUTE_SCRIPT|CONSOLE|BLOCK_IP)\b/, 'entity.name.function'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],

      // Numbers
      [/\d+/, 'number'],

      // Operators
      [/[=!<>]+/, 'operator'],

      // Parens / punctuation
      [/[(){}[\]]/, 'delimiter.bracket'],

      // Identifiers
      [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'],

      // Whitespace
      [/\s+/, 'white'],
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop'],
    ],
  },
};

/** Autocomplete provider for AMS DSL keywords + snippets */
export function registerAMSCompletions(monaco: typeof Monaco): void {
  monaco.languages.registerCompletionItemProvider('ams', {
    provideCompletionItems(model, position) {
      const wordInfo = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: wordInfo.startColumn,
        endColumn: wordInfo.endColumn,
      };

      const mk = (label: string, kind: Monaco.languages.CompletionItemKind, insert: string, doc?: string) => ({
        label, kind, insertText: insert, insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet, range, documentation: doc,
      });

      const K = monaco.languages.CompletionItemKind;
      return {
        suggestions: [
          mk('MONITOR', K.Keyword, 'MONITOR "${1:filename}"', 'Monitor a log file'),
          mk('WATCH json', K.Keyword, 'WATCH json "${1:file.json}"', 'Watch a JSON data source'),
          mk('WATCH csv', K.Keyword, 'WATCH csv "${1:file.csv}"', 'Watch a CSV data source'),
          mk('WATCH html', K.Keyword, 'WATCH html "${1:https://example.com}"', 'Watch an HTML page'),
          mk('SET', K.Keyword, 'SET ${1:var} = ${2:value}', 'Set a variable'),
          mk('RULE block', K.Snippet,
            'RULE ${1:RuleName} SEVERITY ${2|LOW,MEDIUM,HIGH,CRITICAL|}\nWHEN "${3:PATTERN}"\nOCCURS ${4:5} TIMES IN ${5:10} MINUTES\nDO\n\t${6:ALERT("${7:message}")}\nEND',
            'Insert a full RULE block'),
          mk('WHEN', K.Keyword, 'WHEN "${1:PATTERN}"', 'Event pattern match'),
          mk('WHEN regex', K.Keyword, 'WHEN regex("${1:.*pattern.*}")', 'Regex pattern match'),
          mk('OCCURS', K.Keyword, 'OCCURS ${1:5} TIMES IN ${2:10} MINUTES', 'Time-window occurrence'),
          mk('WITHIN', K.Keyword, 'WITHIN ${1:30} SECONDS', 'Time window (within)'),
          mk('IF', K.Keyword, 'IF ${1:field} ${2|==,!=,>,<,>=,<=|} ${3:value}', 'Field condition'),
          mk('DO', K.Keyword, 'DO\n\t$0\nEND', 'Action block'),
          mk('SEND_EMAIL', K.Function, 'SEND_EMAIL("${1:email@example.com}")', 'Send an email alert'),
          mk('ALERT', K.Function, 'ALERT("${1:alert message}")', 'Trigger an alert'),
          mk('LOG', K.Function, 'LOG("${1:alerts.log}")', 'Log to a file'),
          mk('CALL_API', K.Function, 'CALL_API("${1:https://api.example.com}")', 'Call an API endpoint'),
          mk('EXECUTE_SCRIPT', K.Function, 'EXECUTE_SCRIPT("${1:script.sh}")', 'Execute a shell script'),
          mk('CONSOLE', K.Function, 'CONSOLE("${1:message}")', 'Print to console'),
          mk('BLOCK_IP', K.Function, 'BLOCK_IP("${1:192.168.1.100}")', 'Block an IP address'),
          mk('AND', K.Keyword, 'AND "${1:PATTERN}"', 'Additional event pattern'),
          mk('END', K.Keyword, 'END', 'End a RULE block'),
          // Severity levels
          ...(['LOW','MEDIUM','HIGH','CRITICAL'] as const).map((s) => mk(s, K.EnumMember, s, `Severity: ${s}`)),
        ],
      };
    },
  });
}

/** AMS color theme for Monaco */
export const AMSTheme: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment',            foreground: '484f58', fontStyle: 'italic' },
    { token: 'keyword.control',    foreground: 'bc8cff', fontStyle: 'bold' },
    { token: 'keyword.other',      foreground: '79c0ff' },
    { token: 'keyword.time',       foreground: '39c5cf' },
    { token: 'keyword.severity',   foreground: 'ff9f43', fontStyle: 'bold' },
    { token: 'keyword.special',    foreground: 'f78166' },
    { token: 'constant.language',  foreground: '56d364' },
    { token: 'entity.name.function', foreground: 'ffa657', fontStyle: 'bold' },
    { token: 'string',             foreground: 'a5d6ff' },
    { token: 'string.escape',      foreground: 'ffa657' },
    { token: 'string.invalid',     foreground: 'f85149' },
    { token: 'number',             foreground: 'd2a679' },
    { token: 'operator',           foreground: 'ff7b72' },
    { token: 'identifier',         foreground: 'e6edf3' },
    { token: 'delimiter.bracket',  foreground: 'ffa657' },
    { token: 'white',              foreground: 'e6edf3' },
  ],
  colors: {
    'editor.background':               '#0d1117',
    'editor.foreground':               '#e6edf3',
    'editor.lineHighlightBackground':  '#161b22',
    'editor.selectionBackground':      '#264f78',
    'editorLineNumber.foreground':     '#484f58',
    'editorLineNumber.activeForeground': '#8b949e',
    'editorCursor.foreground':         '#00d4aa',
    'editorIndentGuide.background':    '#21262d',
    'editorGutter.background':         '#0d1117',
    'scrollbarSlider.background':      '#30363d',
    'scrollbarSlider.hoverBackground': '#484f58',
  },
};
