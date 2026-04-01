import { useState, useEffect, useRef, useCallback } from 'react';
import { ASTNodeView } from './ASTNode';
import { GitBranch, Search, ZoomIn, ZoomOut, AlertTriangle } from 'lucide-react';

export interface ASTNode {
  type: string;
  name?: string;
  value?: string;
  children?: ASTNode[];
  line?: number;
}

interface ASTPanelProps {
  source: string;
  serverUrl: string;
}

function countNodes(node: ASTNode): number {
  return 1 + (node.children?.reduce((acc, c) => acc + countNodes(c), 0) ?? 0);
}

function maxDepth(node: ASTNode, d = 0): number {
  if (!node.children?.length) return d;
  return Math.max(...node.children.map((c) => maxDepth(c, d + 1)));
}

export function ASTPanel({ source, serverUrl }: ASTPanelProps) {
  const [ast, setAst] = useState<ASTNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parseMs, setParseMs] = useState(0);
  const [scale, setScale] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced parse: 400ms after each keystroke
  const parse = useCallback(
    async (src: string) => {
      if (!src.trim()) { setAst(null); setError(null); return; }
      const t0 = performance.now();
      try {
        const res = await fetch(`${serverUrl}/api/parse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: src }),
        });
        const data = await res.json() as { ast: ASTNode; error?: string };
        setParseMs(Math.round(performance.now() - t0));
        if (data.ast) { setAst(data.ast); setError(null); }
        else setError(data.error ?? 'Parse error');
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [serverUrl]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => parse(source), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [source, parse]);

  const nodeCount = ast ? countNodes(ast) : 0;
  const depth     = ast ? maxDepth(ast) : 0;

  return (
    <div className="ast-panel">
      <div className="ast-panel__header">
        <GitBranch size={12} />
        <span>AST</span>
        <div style={{ display:'flex', gap:2, marginLeft:'auto' }}>
          <button className="btn btn--icon" style={{ padding:2 }} onClick={() => setScale((s) => Math.min(s + 0.1, 1.5))} title="Zoom in">
            <ZoomIn size={11} />
          </button>
          <button className="btn btn--icon" style={{ padding:2 }} onClick={() => setScale((s) => Math.max(s - 0.1, 0.6))} title="Zoom out">
            <ZoomOut size={11} />
          </button>
        </div>
      </div>

      {ast && (
        <div className="ast-panel__stats">
          <span style={{ padding:'2px 12px', fontSize:10, color:'var(--text-muted)' }}>
            {nodeCount} nodes · depth {depth} · {parseMs}ms
          </span>
        </div>
      )}

      <div className="ast-panel__body" style={{ fontSize: `${scale}em` }}>
        {error ? (
          <div style={{ color:'var(--red)', fontSize:11, padding:4, display:'flex', alignItems:'center', gap:4 }}>
            <AlertTriangle size={12} /> {error}
          </div>
        ) : ast ? (
          <ASTNodeView node={ast} depth={0} />
        ) : (
          <div style={{ color:'var(--text-muted)', fontSize:11, textAlign:'center', paddingTop:24 }}>
            Write or open an <span style={{ color:'var(--accent)' }}>.ams</span> file to see the AST
          </div>
        )}
      </div>
    </div>
  );
}
