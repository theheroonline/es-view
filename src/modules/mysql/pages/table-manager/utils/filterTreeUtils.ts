/**
 * Filter tree manipulation and building utilities
 */

import type { MysqlFilterConditionNode, MysqlFilterGroupNode, MysqlFilterNode } from "../../../../../state/MysqlContext";
import { operatorNeedsValue } from "./sqlBuilders";

export type FilterConditionDraft = MysqlFilterConditionNode;
export type FilterGroupDraft = MysqlFilterGroupNode;

/**
 * Create a new filter condition node with auto-generated ID
 */
export const createFilterCondition = (
  column = "",
  operator: any = "eq",
  value = ""
): FilterConditionDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind: "condition",
  column,
  operator,
  value
});

/**
 * Create a new filter group node with auto-generated ID
 */
export const createFilterGroup = (mode: "and" | "or" = "and", children: MysqlFilterNode[] = []): FilterGroupDraft => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind: "group",
  mode,
  children
});

/**
 * Count the number of conditions and groups in a filter tree
 * Used for displaying filter summary
 */
export function countFilterStats(node: FilterGroupDraft | null): { groups: number; conditions: number } {
  if (!node) return { groups: 0, conditions: 0 };

  return node.children.reduce(
    (acc, child) => {
      if (child.kind === "group") {
        const nested = countFilterStats(child);
        return {
          groups: acc.groups + 1 + nested.groups,
          conditions: acc.conditions + nested.conditions
        };
      }
      return {
        groups: acc.groups,
        conditions: acc.conditions + 1
      };
    },
    { groups: 0, conditions: 0 }
  );
}

/**
 * Deep clone a filter group with optional fallback column
 * Used when duplicating filter trees
 */
export function cloneFilterGroup(group: FilterGroupDraft, fallbackColumn: string): FilterGroupDraft {
  return {
    ...group,
    children: (group.children.length > 0 ? group.children : [createFilterCondition(fallbackColumn)]).map(
      (child) => {
        if (child.kind === "group") {
          return cloneFilterGroup(child, fallbackColumn);
        }
        return {
          ...child,
          kind: "condition" as const,
          column: child.column || fallbackColumn,
          value: child.value ?? ""
        };
      }
    )
  };
}

/**
 * Update a node in filter tree by ID
 * Used for editing conditions and groups in place
 */
export function updateFilterTreeNode(
  group: FilterGroupDraft,
  nodeId: string,
  updater: (node: MysqlFilterNode) => MysqlFilterNode
): FilterGroupDraft {
  return {
    ...group,
    children: group.children.map((child) => {
      if (child.id === nodeId) {
        return updater(child);
      }
      if (child.kind === "group") {
        return updateFilterTreeNode(child, nodeId, updater);
      }
      return child;
    })
  };
}

/**
 * Remove a node from filter tree by ID
 * Used for deleting conditions and groups
 */
export function removeFilterTreeNode(group: FilterGroupDraft, nodeId: string): FilterGroupDraft {
  return {
    ...group,
    children: group.children
      .filter((child) => child.id !== nodeId)
      .map((child) => (child.kind === "group" ? removeFilterTreeNode(child, nodeId) : child))
  };
}

/**
 * Validate and sanitize filter tree
 * Removes invalid conditions and empty groups
 * Returns null if entire tree becomes empty
 */
export function sanitizeFilterNode(node: MysqlFilterNode): MysqlFilterNode | null {
  if (node.kind === "condition") {
    if (!node.column.trim()) return null;
    if (operatorNeedsValue(node.operator) && (node.value ?? "") === "") return null;
    return {
      ...node,
      kind: "condition" as const,
      value: operatorNeedsValue(node.operator) ? node.value ?? "" : undefined
    };
  }

  const children = node.children
    .map((child) => sanitizeFilterNode(child))
    .filter((child): child is MysqlFilterNode => Boolean(child));

  if (children.length === 0) return null;

  return {
    ...node,
    kind: "group" as const,
    children
  };
}

/**
 * Get human-readable summary of filter stats
 * Example: "3 conditions in 1 group, match all"
 */
export const getFilterStatsText = (
  stats: { groups: number; conditions: number },
  mode: "and" | "or" = "and",
  t?: (key: string, options?: any) => string
): string => {
  if (stats.conditions === 0) {
    return "No filters applied";
  }

  const modeText = mode === "or" ? (t ? t("mysql.tableManager.matchAny") : "match any") : (t ? t("mysql.tableManager.matchAll") : "match all");
  return `${stats.conditions} condition${stats.conditions > 1 ? "s" : ""} in ${stats.groups || 1} group, ${modeText}`;
};
