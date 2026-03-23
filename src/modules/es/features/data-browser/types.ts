import type { Dayjs } from "dayjs";
import type { FieldFilterState } from "../../../../components/FieldFilterButton";

export type ViewMode = "table" | "json";

export type BoolType = "must" | "should" | "must_not" | "sort";

export interface ConditionItem {
  field: string;
  operator: string;
  value: string;
  boolType: BoolType;
  enabled: boolean;
  sortDirection?: "asc" | "desc";
  rangeValue?: [Dayjs | null, Dayjs | null] | null;
}

export type SortDirection = "asc" | "desc";

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  row: any;
  field?: string;
  value?: unknown;
}

export interface DataBrowserCacheState {
  selectedIndex?: string;
  result: any;
  page: number;
  size: number;
  conditions: ConditionItem[];
  viewMode: ViewMode;
  fieldFilter: FieldFilterState;
}
