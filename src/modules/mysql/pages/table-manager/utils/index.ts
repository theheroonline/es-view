/**
 * TableManager utility functions and constants
 * Re-exports from all utility modules
 */

// Type definitions
export type {
  FilterConditionDraft,
  FilterGroupDraft,
  TableInfo,
  TableDetailInfo,
  DataState,
  RightPanelTab,
  MysqlColumnTypeOption,
  TreeContextMenu,
  DatabaseContextMenu,
  ExportSelectionModalState,
  CreateTableColumn,
  CreateTableModalState,
  RowContextMenu,
  ColumnHeaderContextMenu,
  CellEditorState,
  SelectedCell,
  BatchEditMode,
  ColumnEditMode,
  ColumnEditForm
} from "./typeHelpers";

// Constants
export { defaultDataState, mysqlColumnTypeOptions, getColumnTypeOption } from "./constants";

// SQL builders and escapers
export {
  escapeSqlIdentifier,
  escapeSqlLiteral,
  escapeSqlLikeLiteral,
  formatSqlValue,
  buildConditionSql,
  operatorNeedsValue,
  buildDefaultClause
} from "./sqlBuilders";

// Column type utilities
export { parseColumnType, buildColumnType } from "./columnEditors";

// Data formatters
export { formatInfoDate, formatInfoText, toSafeNumber, formatBytes, getSingleResultRow } from "./dataFormatters";

// Filter tree utilities
export {
  createFilterCondition,
  createFilterGroup,
  countFilterStats,
  cloneFilterGroup,
  updateFilterTreeNode,
  removeFilterTreeNode,
  sanitizeFilterNode,
  getFilterStatsText
} from "./filterTreeUtils";

// Cell utilities
export { createSelectedCell, buildSelectedCells } from "./cellUtils";
