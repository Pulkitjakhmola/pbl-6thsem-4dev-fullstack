import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import type { ASTNode } from './ASTPanel';

const SERVER_URL_DEFAULT = 'http://localhost:3001';

interface ASTNodeViewProps {
  node: ASTNode;
  depth: number;
}

function getBadgeClass(type: string): string {
  if (type === 'Program') return 'ast-node__badge ast-node__badge--Program';
  if (type.includes('Monitor')) return 'ast-node__badge ast-node__badge--Monitor';
  if (type.includes('Watch'))   return 'ast-node__badge ast-node__badge--Watch';
  if (type.includes('Rule'))    return 'ast-node__badge ast-node__badge--Rule';
  if (type.includes('When') || type.includes('And')) return 'ast-node__badge ast-node__badge--When';
  if (type.includes('If'))      return 'ast-node__badge ast-node__badge--If';
  if (type.includes('Do'))      return 'ast-node__badge ast-node__badge--Do';
  if (type === 'Action')        return 'ast-node__badge ast-node__badge--Action';
  if (type === 'Severity')      return 'ast-node__badge ast-node__badge--Severity';
  if (type.includes('Set'))     return 'ast-node__badge ast-node__badge--Set';
  return 'ast-node__badge ast-node__badge--default';
}

function ASTNodeView({ node, depth }: ASTNodeViewProps) {
  const [isOpen, setIsOpen] = useState(depth < 3);
  const hasChildren = node.children && node.children.length > 0;

  const shortType = node.type.replace('Stmt', '').replace('Block', '').replace('Clause', '');

  return (
    <div className="ast-node">
      <div className="ast-node__row" onClick={() => hasChildren && setIsOpen((v) => !v)}>
        {/* Indent lines */}
        {Array.from({ length: depth }).map((_, i) => (
          <div key={i} style={{ width:12, borderLeft: '1px solid var(--border)', flexShrink:0, alignSelf:'stretch' }} />
        ))}
        <span style={{ fontSize:9, color:'var(--text-muted)', width:10, textAlign:'center', flexShrink:0 }}>
          {hasChildren ? (isOpen ? '▼' : '▶') : ''}
        </span>
        <span className={getBadgeClass(node.type)}>{shortType}</span>
        {(node.name || node.value) && (
          <span className="ast-node__value" title={node.name ?? node.value}>
            {(node.name ?? node.value ?? '').replace(/"/g, '')}
          </span>
        )}
        {node.line && (
          <span style={{ fontSize:9, color:'var(--text-muted)', marginLeft:'auto', flexShrink:0 }}>
            :{node.line}
          </span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className="ast-node__children">
          {node.children!.map((child, i) => (
            <ASTNodeView key={i} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export { ASTNodeView };
