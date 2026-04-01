import { useRef } from 'react';
import MonacoEditor, { OnMount, BeforeMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { AMSLanguageDefinition, AMSTheme, registerAMSCompletions } from '../../languages/ams-language';
import type { OpenFile } from '../../App';
import { X, FolderOpen, Check } from 'lucide-react';

export interface CompileOutputLine {
  stage: string;
  message: string;
  time: string;
}

interface CodeEditorProps {
  openFiles: OpenFile[];
  activeFile: string | null;
  onFileChange: (value: string) => void;
  onSave: () => void;
  onTabChange: (path: string) => void;
  onTabClose: (path: string) => void;
}

export function CodeEditor({
  openFiles, activeFile, onFileChange, onSave, onTabChange, onTabClose,
}: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const currentFile = openFiles.find((f) => f.path === activeFile);

  const beforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    if (!monaco.languages.getLanguages().some((l: { id: string }) => l.id === 'ams')) {
      monaco.languages.register({ id: 'ams', extensions: ['.ams'], aliases: ['AMS', 'AutomonScript'] });
      monaco.languages.setMonarchTokensProvider('ams', AMSLanguageDefinition);
      monaco.editor.defineTheme('ams-dark', AMSTheme);
      registerAMSCompletions(monaco);
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => { onSave(); });
    editor.focus();
  };

  if (openFiles.length === 0) {
    return (
      <div className="editor-area" style={{ alignItems:'center', justifyContent:'center' }}>
        <div className="empty-state">
          <div className="empty-state__icon"><FolderOpen size={48} /></div>
          <div className="empty-state__title">No file open</div>
          <div className="empty-state__desc">
            Select a <code style={{ color:'var(--accent)' }}>.ams</code> file from the Explorer, or open a file with <kbd>Ctrl+O</kbd>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-area">
      {/* Tabs */}
      <div className="editor-tabs">
        {openFiles.map((f) => (
          <div
            key={f.path}
            className={`editor-tab${f.path === activeFile ? ' editor-tab--active' : ''}`}
            onClick={() => onTabChange(f.path)}
          >
            <span style={{ color: f.name.endsWith('.ams') ? 'var(--accent)' : undefined }}>
              {f.name}{f.isDirty ? ' ●' : ''}
            </span>
            <span
              className="editor-tab__close"
              onClick={(e) => { e.stopPropagation(); onTabClose(f.path); }}
            >
              <X size={10} />
            </span>
          </div>
        ))}
      </div>

      {/* Monaco Editor */}
      <div className="editor-monaco">
        <MonacoEditor
          height="100%"
          language="ams"
          theme="ams-dark"
          value={currentFile?.content ?? ''}
          onChange={(v) => onFileChange(v ?? '')}
          beforeMount={beforeMount}
          onMount={onMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontLigatures: true,
            lineNumbers: 'on',
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            suggest: { showKeywords: true, showSnippets: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            padding: { top: 8, bottom: 8 },
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
          }}
        />
      </div>
    </div>
  );
}

/* ─── Output Panel (extracted for independent positioning) ─── */

const STAGES = ['Lexing', 'Parsing', 'Code Gen', 'Done'];

function ProgressBar({ progress, stage }: { progress: number; stage: string }) {
  const stageIdx = stage === 'lexing' ? 0 : stage === 'parsing' ? 1 : stage === 'codegen' ? 2 : stage === 'done' ? 3 : -1;
  return (
    <div className="compile-progress">
      <div className="compile-progress__stages">
        {STAGES.map((s, i) => (
          <span
            key={s}
            className={`compile-progress__stage${i < stageIdx ? ' compile-progress__stage--done' : i === stageIdx ? ' compile-progress__stage--active' : ''}`}
          >
            {i < stageIdx && <Check size={10} style={{ marginRight: 2 }} />}{s}
            {i < STAGES.length - 1 && <span style={{ marginLeft: 8, color:'var(--border)' }}>/</span>}
          </span>
        ))}
      </div>
      <div className="compile-progress__bar">
        <div className="compile-progress__fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

interface OutputPanelProps {
  compileOutput: CompileOutputLine[];
  isCompiling: boolean;
  progress: number;
}

export function OutputPanel({ compileOutput, isCompiling, progress }: OutputPanelProps) {
  return (
    <div className="terminal">
      {(isCompiling || compileOutput.length > 0) && (
        <ProgressBar
          progress={progress}
          stage={compileOutput.length ? compileOutput[compileOutput.length - 1].stage : 'lexing'}
        />
      )}
      <div className="terminal__header">
        <span>●</span>
        <span>Output</span>
        {isCompiling && <span style={{ fontSize:10, color:'var(--orange)' }}>Compiling…</span>}
      </div>
      <div className="terminal__body" id="terminal-output">
        {compileOutput.length === 0 ? (
          <span style={{ color:'var(--text-muted)' }}>Ready. Hit Compile to start.</span>
        ) : (
          compileOutput.map((line, i) => (
            <div key={i} className="terminal__line">
              <span className="terminal__time">{line.time}</span>
              <span className={`terminal__stage terminal__stage--${line.stage}`}>
                [{line.stage.toUpperCase()}]
              </span>
              <span className="terminal__msg">{line.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

