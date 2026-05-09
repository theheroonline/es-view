import type { Dayjs } from "dayjs";
import type { FieldFilterState } from "./components/FieldFilterButton";

export type ViewMode = "table" | "json";

export type BoolType = "must" | "should" | "must_not" | "sort";

export type EsOperator = "term" | "match" | "range" | "time_range";

export interface ConditionItem {
  field: string;
  operator: EsOperator;
  value: string;
  boolType: BoolType;
  enabled: boolean;
  sortDirection?: "asc" | "desc";
  rangeValue?: [Dayjs | null, Dayjs | null] | null;
}

export type SortDirection = "asc" | "desc";

export interface SearchRow {
  _id: string;
  _index: string;
  _source?: Record<string, unknown>;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  row: SearchRow | null;
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
  fields?: string[];
}
