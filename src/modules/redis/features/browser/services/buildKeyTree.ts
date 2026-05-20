import type { RedisKeySummary } from "../../../types";

export const DEFAULT_KEY_SEPARATOR = ":";

export interface RedisTreeNode {
  key: string;
  label: string;
  isLeaf: boolean;
  children: RedisTreeNode[];
  keyType?: string;
}

interface TreeBuildNode {
  key: string;
  label: string;
  isLeaf: boolean;
  childrenMap: Map<string, TreeBuildNode>;
  keyType?: string;
}

export function buildKeyTree(
  keys: RedisKeySummary[],
  separator: string = DEFAULT_KEY_SEPARATOR,
): RedisTreeNode[] {
  const root: TreeBuildNode = {
    key: "",
    label: "",
    isLeaf: false,
    childrenMap: new Map(),
  };

  for (const item of keys) {
    const parts = item.name.split(separator);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;

      let child = current.childrenMap.get(part);
      if (!child) {
        child = {
          key: parts.slice(0, i + 1).join(separator),
          label: part,
          isLeaf,
          childrenMap: new Map(),
          keyType: isLeaf ? item.keyType : undefined,
        };
        current.childrenMap.set(part, child);
      }

      if (isLeaf) {
        child.keyType = item.keyType;
      }

      current = child;
    }
  }

  return mapToSortedArray(root.childrenMap);
}

function mapToSortedArray(nodes: Map<string, TreeBuildNode>): RedisTreeNode[] {
  const result: RedisTreeNode[] = [];
  const sorted = [...nodes.values()].sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
  for (const node of sorted) {
    result.push({
      key: node.key,
      label: node.label,
      isLeaf: node.isLeaf,
      children: mapToSortedArray(node.childrenMap),
      keyType: node.keyType,
    });
  }
  return result;
}
