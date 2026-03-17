/**
 * TableManager utility functions and constants
 * Re-exports from all utility modules
 */

// Type definitions
export type {
    BatchEditMode, CellEditorState, ColumnEditForm, ColumnEditMode, ColumnHeaderContextMenu, CreateTableColumn,
    CreateTableModalState, DataState, DatabaseContextMenu,
    ExportSelectionModalState, FilterConditionDraft,
    FilterGroupDraft, MysqlColumnTypeOption, RightPanelTab, RowContextMenu, SelectedCell, TableDetailInfo, TableInfo, TreeContextMenu
} from "./typeHelpers";

// Constants
export { defaultDataState, getColumnTypeOption, mysqlColumnTypeOptions } from "./constants";

// SQL builders and escapers
export {
    buildConditionSql, buildDefaultClause, escapeSqlIdentifier, escapeSqlLikeLiteral, escapeSqlLiteral, formatSqlValue, joinBetweenValue,
    operatorNeedsValue, splitBetweenValue
} from "./sqlBuilders";

// Column type utilities
export { buildColumnType, parseColumnType } from "./columnEditors";

// Data formatters
export { formatBytes, formatInfoDate, formatInfoText, getSingleResultRow, toSafeNumber } from "./dataFormatters";

// Filter tree utilities
export {
    cloneFilterGroup, countFilterStats, createFilterCondition,
    createFilterGroup, getFilterStatsText, removeFilterTreeNode,
    sanitizeFilterNode, updateFilterTreeNode
} from "./filterTreeUtils";

// Cell utilities
export { buildSelectedCells, createSelectedCell } from "./cellUtils";

