import { useState, useCallback, useMemo } from "react";
import { FolderOutlined, FolderOpenOutlined, CaretRightOutlined, CaretDownOutlined } from "@ant-design/icons";
import type { RedisKeySummary } from "../../../types";
import type { RedisTreeNode } from "../services/buildKeyTree";
import { buildKeyTree } from "../services/buildKeyTree";

// Compact type dot: first letter only, subtle color
const TYPE_DOT: Record<string, { label: string; color: string }> = {
  string: { label: "S", color: "#5b8ff9" },
  hash:   { label: "H", color: "#7873ff" },
  list:   { label: "L", color: "#5ad8a6" },
  set:    { label: "E", color: "#f6bd16" },
  zset:   { label: "Z", color: "#ff6b6b" },
};

interface RedisKeyTreeProps {
  keys: RedisKeySummary[];
  selectedKey: string | null;
  separator?: string;
  onSelectKey: (key: string) => void;
  onExpandChange?: (expandedKeys: Set<string>) => void;
}

export function RedisKeyTree({
  keys,
  selectedKey,
  separator = ":",
  onSelectKey,
}: RedisKeyTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildKeyTree(keys, separator), [keys, separator]);

  const toggleFolder = useCallback(
    (folderKey: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderKey)) next.delete(folderKey);
        else next.add(folderKey);
        return next;
      });
    },
    [],
  );

  return (
    <div className="redis-key-tree">
      {tree.map((node) => (
        <RedisTreeNodeItem
          key={node.key}
          node={node}
          depth={0}
          selectedKey={selectedKey}
          expandedFolders={expandedFolders}
          onToggleFolder={toggleFolder}
          onSelectKey={onSelectKey}
        />
      ))}
    </div>
  );
}

interface TreeNodeItemProps {
  node: RedisTreeNode;
  depth: number;
  selectedKey: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (key: string) => void;
  onSelectKey: (key: string) => void;
}

function RedisTreeNodeItem({
  node,
  depth,
  selectedKey,
  expandedFolders,
  onToggleFolder,
  onSelectKey,
}: TreeNodeItemProps) {
  const isExpanded = expandedFolders.has(node.key);
  const isSelected = selectedKey === node.key;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleFolder(node.key);
    },
    [node.key, onToggleFolder],
  );

  const handleSelect = useCallback(() => {
    onSelectKey(node.key);
  }, [node.key, onSelectKey]);

  if (node.isLeaf) {
    const dot = TYPE_DOT[node.keyType || ""] || { label: node.keyType?.[0] || "?", color: "#999" };
    return (
      <div
        className={`redis-tree-leaf ${isSelected ? "is-selected" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 20}px` }}
        onClick={handleSelect}
        title={node.key}
      >
        <span className="redis-tree-leaf-dot" style={{ color: dot.color }} aria-hidden="true">
          {dot.label}
        </span>
        <span className="redis-tree-leaf-label">{node.label}</span>
      </div>
    );
  }

  const childCount = countAllLeaves(node);
  return (
    <div className="redis-tree-folder">
      <div
        className={`redis-tree-folder-header ${isExpanded ? "is-expanded" : ""}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleToggle}
      >
        <span className="redis-tree-folder-chevron" aria-hidden="true">
          {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
        <span className="redis-tree-folder-icon" aria-hidden="true">
          {isExpanded ? <FolderOpenOutlined /> : <FolderOutlined />}
        </span>
        <span className="redis-tree-folder-label">{node.label}</span>
        {childCount > 0 && (
          <span className="redis-tree-folder-count">{childCount}</span>
        )}
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <RedisTreeNodeItem
            key={child.key}
            node={child}
            depth={depth + 1}
            selectedKey={selectedKey}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onSelectKey={onSelectKey}
          />
        ))}
    </div>
  );
}

function countAllLeaves(node: RedisTreeNode): number {
  if (node.isLeaf) return 1;
  let count = 0;
  for (const child of node.children) {
    count += countAllLeaves(child);
  }
  return count;
}
