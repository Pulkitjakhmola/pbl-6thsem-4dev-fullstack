import type * as Monaco from 'monaco-editor';

/** AMS-Lang Monarch tokenizer for Monaco Editor -- updated for the new grammar */
export const AMSLanguageDefinition: Monaco.languages.IMonarchLanguage = {
  defaultToken: '',
  ignoreCase: false,

  // Section keywords that define program structure
  sections: [
    'GLOBAL', 'SOURCES', 'SOURCE', 'EVENTS', 'EVENT',
    'OBSERVERS', 'OBSERVER', 'FUNCTIONS', 'FUNCTION',
  ],

  // Data type keywords
  types: [
    'INT', 'FLOAT', 'STRING', 'BOOL', 'VOID',
    'LOG_SOURCE', 'LOG_DATA', 'LOG_RECORD',
  ],

  // Runtime and scheduling keywords
  runtime: [
    'TRACK', 'CHECK', 'EVERY', 'AT', 'CONTINUOUSLY',
    'ON', 'OBSERVS', 'UNSHARE', 'SIGNAL',
  ],

  // Control flow keywords
  control: ['IF', 'ELSE'],

  // Log source operation keywords
  logOps: ['OPEN', 'READ', 'WRITE', 'MODE'],

  // Import / merge keywords
  imports: ['IMPORT', 'MERGE'],

  // Boolean literals
  booleans: ['TRUE', 'FALSE'],

  // Time unit tokens
  timeUnits: ['MS', 'SEC', 'MIN', 'HOUR'],

  // Named operators (word-form)
  namedOperators: [
    'ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'REMAINDER', 'POWER',
    'EQUALS', 'AND', 'OR', 'NOT',
  ],

  // Symbol operators
  operators: ['==', '!=', '>=', '<=', '>', '<', '=', '+', '-', '*', '/', '%', '^', '&', '|', '!'],

  tokenizer: {
    root: [
      // Multi-line comments: ## ... ##
      [/##/, 'comment', '@mlComment'],

      // Single-line comments: # ...
      [/#.*$/, 'comment'],

      // Section headers (keyword followed by colon)
      [/\b(GLOBAL|SOURCES|EVENTS|OBSERVERS|FUNCTIONS)\b(?=\s*:)/, 'keyword.section'],

      // Section-level entity keywords
      [/\b(SOURCE|EVENT|OBSERVER|FUNCTION)\b/, 'keyword.section'],

      // Type keywords
      [/\b(INT|FLOAT|STRING|BOOL|VOID|LOG_SOURCE|LOG_DATA|LOG_RECORD)\b/, 'keyword.type'],

      // Runtime / scheduling keywords
      [/\b(TRACK|CHECK|EVERY|AT|CONTINUOUSLY|ON|OBSERVS|UNSHARE|SIGNAL)\b/, 'keyword.runtime'],

      // Control flow
      [/\b(ELSE)\s+(IF)\b/, { cases: { '@': ['keyword.control', 'keyword.control'] } }],
      [/\b(IF|ELSE)\b/, 'keyword.control'],

      // Import / merge
      [/\b(IMPORT|MERGE)\b/, 'keyword.import'],

      // Log source operations
      [/\b(OPEN|READ|WRITE|MODE)\b/, 'keyword.logop'],

      // Time units
      [/\b(MS|SEC|MIN|HOUR)\b/, 'keyword.time'],

      // Boolean literals
      [/\b(TRUE|FALSE)\b/, 'constant.language'],

      // Named operators
      [/\b(ADD|SUBTRACT|MULTIPLY|DIVIDE|REMAINDER|POWER)\b/, 'keyword.operator'],
      [/\b(EQUALS|AND|OR|NOT)\b/, 'keyword.operator'],
      [/\b(GREATER|LESS)\s+(THAN|EQUAL)\b/, 'keyword.operator'],

      // Time literals (HH:MM)
      [/\b[0-2][0-9]:[0-5][0-9]\b/, 'number.time'],

      // Float literals
      [/\b[0-9]+\.[0-9]+\b/, 'number.float'],

      // Integer literals
      [/\b[0-9]+\b/, 'number'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, 'string', '@string'],

      // Symbol operators
      [/[=!<>]+/, 'operator'],
      [/[+\-*/%^&|!]/, 'operator'],

      // Delimiters
      [/[{}()]/, 'delimiter.bracket'],
      [/[;:,.]/, 'delimiter'],

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

    mlComment: [
      [/[^#]+/, 'comment'],
      [/##/, 'comment', '@pop'],
      [/#/, 'comment'],
    ],
  },
};

/** Autocomplete provider for AMS-Lang keywords + snippets */
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
          // ── Program Structure ──────────────────────────────
          mk('Program Skeleton', K.Snippet,
            [
              'GLOBAL:',
              '    ${1:# global declarations}',
              '',
              'SOURCES:',
              '    SOURCE ${2:MySource} CHECK EVERY ${3:5} ${4|SEC,MIN,HOUR,MS|}',
              '        ${5:# source body}',
              '    ;',
              '',
              'EVENTS:',
              '    EVENT ${6:MyEvent} ON ${2:MySource}',
              '        ${7:# event body}',
              '    ;',
              '',
              'OBSERVERS:',
              '    OBSERVER ${8:MyObserver} OBSERVS ${6:MyEvent}',
              '        ${9:# observer body}',
              '    ;',
              '',
            ].join('\n'),
            'Insert a complete AMS program skeleton with all sections'),

          // ── Section Keywords ───────────────────────────────
          mk('GLOBAL:', K.Keyword, 'GLOBAL:\n    $0', 'Global section for imports and shared declarations'),
          mk('SOURCES:', K.Keyword, 'SOURCES:\n    $0', 'Sources section for log source polling'),
          mk('EVENTS:', K.Keyword, 'EVENTS:\n    $0', 'Events section for reactive handlers'),
          mk('OBSERVERS:', K.Keyword, 'OBSERVERS:\n    $0', 'Observers section for event watchers'),
          mk('FUNCTIONS:', K.Keyword, 'FUNCTIONS:\n    $0', 'Functions section for reusable logic'),

          // ── Entity Definitions ─────────────────────────────
          mk('SOURCE block (braces)', K.Snippet,
            'SOURCE ${1:name} CHECK EVERY ${2:5} ${3|SEC,MIN,HOUR,MS|} {\n    $0\n}',
            'Define a SOURCE with a periodic schedule (brace syntax)'),

          mk('SOURCE block (semicolon)', K.Snippet,
            'SOURCE ${1:name} CHECK EVERY ${2:5} ${3|SEC,MIN,HOUR,MS|}\n    $0\n;',
            'Define a SOURCE with a periodic schedule (semicolon syntax)'),

          mk('SOURCE CONTINUOUSLY', K.Snippet,
            'SOURCE ${1:name} CHECK CONTINUOUSLY {\n    $0\n}',
            'Define a SOURCE that runs continuously'),

          mk('EVENT block', K.Snippet,
            'EVENT ${1:name} ON ${2:sourceName}\n    $0\n;',
            'Define an EVENT triggered by a SOURCE signal'),

          mk('EVENT with SIGNAL condition', K.Snippet,
            'EVENT ${1:name} ON ${2:sourceName} SIGNAL ${3:condition}\n    $0\n;',
            'Define an EVENT with a specific signal condition'),

          mk('OBSERVER block', K.Snippet,
            'OBSERVER ${1:name} OBSERVS ${2:eventName}\n    $0\n;',
            'Define an OBSERVER that watches an EVENT'),

          mk('FUNCTION block', K.Snippet,
            'FUNCTION ${1:name}(${2:params}) {\n    $0\n}',
            'Define a reusable FUNCTION'),

          // ── Variable Declarations ──────────────────────────
          mk('INT', K.Keyword, 'INT ${1:name} = ${2:0}', 'Declare an integer variable'),
          mk('FLOAT', K.Keyword, 'FLOAT ${1:name} = ${2:0.0}', 'Declare a floating-point variable'),
          mk('STRING', K.Keyword, 'STRING ${1:name} = "${2:}"', 'Declare a string variable'),
          mk('BOOL', K.Keyword, 'BOOL ${1:name} = ${2|TRUE,FALSE|}', 'Declare a boolean variable'),
          mk('TRACK INT', K.Snippet, 'TRACK INT ${1:name} = ${2:0}', 'Declare a TRACK variable (persists across SOURCE invocations)'),
          mk('TRACK STRING', K.Snippet, 'TRACK STRING ${1:name} = "${2:}"', 'Declare a tracked string variable'),
          mk('UNSHARE', K.Keyword, 'UNSHARE ${1|INT,FLOAT,STRING,BOOL|} ${2:name} = ${3:value}', 'Declare a private EVENT variable (not shared with observers)'),

          // ── LOG_SOURCE Operations ──────────────────────────
          mk('LOG_SOURCE (read)', K.Snippet,
            'LOG_SOURCE ${1:name} = OPEN LOG_SOURCE "${2:path/to/log}" READ MODE',
            'Open a log source file for reading'),
          mk('LOG_SOURCE (write)', K.Snippet,
            'LOG_SOURCE ${1:name} = OPEN LOG_SOURCE "${2:path/to/log}" WRITE MODE',
            'Open a log source file for writing'),
          mk('LOG_DATA', K.Keyword, 'LOG_DATA ${1:name} = ${2:source}.filter(${3:criteria})', 'Filter log data from a LOG_SOURCE'),
          mk('LOG_RECORD', K.Keyword, 'LOG_RECORD ${1:name} = ${2:data}.first()', 'Get the first record from LOG_DATA'),

          // ── Runtime Keywords ───────────────────────────────
          mk('SIGNAL', K.Keyword, 'SIGNAL ${1:condition}', 'Emit a signal (optionally conditional)'),
          mk('SIGNAL TRUE', K.Keyword, 'SIGNAL TRUE', 'Always emit a signal'),
          mk('CHECK EVERY', K.Snippet, 'CHECK EVERY ${1:5} ${2|SEC,MIN,HOUR,MS|}', 'Schedule periodic execution'),
          mk('CHECK CONTINUOUSLY', K.Keyword, 'CHECK CONTINUOUSLY', 'Run source continuously'),

          // ── Control Flow ───────────────────────────────────
          mk('IF (braces)', K.Snippet, 'IF ${1:condition} {\n    $0\n}', 'Conditional statement (brace syntax)'),
          mk('IF-ELSE', K.Snippet, 'IF ${1:condition} {\n    ${2:body}\n}\nELSE {\n    ${3:body}\n}', 'If-else conditional'),

          // ── Import / Merge ─────────────────────────────────
          mk('IMPORT', K.Keyword, 'IMPORT "${1:module}"', 'Import an external module'),
          mk('MERGE', K.Keyword, 'MERGE "${1:file}"', 'Merge another AMS file'),

          // ── Common Built-in Functions ──────────────────────
          mk('PRINTLN', K.Function, 'PRINTLN(${1:"message"})', 'Print a line to console'),
          mk('PRINT', K.Function, 'PRINT(${1:"message"})', 'Print to console without newline'),

          // ── Boolean and Operators ──────────────────────────
          mk('TRUE', K.Keyword, 'TRUE', 'Boolean true'),
          mk('FALSE', K.Keyword, 'FALSE', 'Boolean false'),
          mk('AND', K.Keyword, 'AND', 'Logical AND operator'),
          mk('OR', K.Keyword, 'OR', 'Logical OR operator'),
          mk('NOT', K.Keyword, 'NOT', 'Logical NOT operator'),
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
    { token: 'keyword.section',    foreground: 'bc8cff', fontStyle: 'bold' },
    { token: 'keyword.type',       foreground: '79c0ff' },
    { token: 'keyword.runtime',    foreground: '39c5cf' },
    { token: 'keyword.control',    foreground: 'bc8cff' },
    { token: 'keyword.import',     foreground: 'f78166' },
    { token: 'keyword.logop',      foreground: 'ffa657' },
    { token: 'keyword.time',       foreground: '39c5cf' },
    { token: 'keyword.operator',   foreground: 'ff7b72' },
    { token: 'constant.language',  foreground: '56d364' },
    { token: 'number',             foreground: 'd2a679' },
    { token: 'number.float',       foreground: 'd2a679' },
    { token: 'number.time',        foreground: '39c5cf' },
    { token: 'string',             foreground: 'a5d6ff' },
    { token: 'string.escape',      foreground: 'ffa657' },
    { token: 'string.invalid',     foreground: 'f85149' },
    { token: 'operator',           foreground: 'ff7b72' },
    { token: 'identifier',         foreground: 'e6edf3' },
    { token: 'delimiter.bracket',  foreground: 'ffa657' },
    { token: 'delimiter',          foreground: '8b949e' },
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
