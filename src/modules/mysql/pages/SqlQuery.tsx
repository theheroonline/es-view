import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { format as formatSql } from "sql-formatter";
import {
  CodeOutlined,
  DatabaseOutlined,
  TableOutlined,
  FieldStringOutlined,
} from "@ant-design/icons";
import { logError } from "../../../lib/errorLog";
import { useMysqlContext } from "../../../state/MysqlContext";
import { useSharedConnectionState } from "../../../state/SharedConnectionState";
import { mysqlConnect } from "../services/connectionClient";
import { mysqlListDatabases, mysqlListTables, mysqlQuery } from "../services/queryClient";
import { mysqlDescribeTable } from "../services/schemaClient";
import QueryGeneratorModal from "../components/QueryGeneratorModal";
import { getDbTypeCategory } from "../lib/detectValueType";
import { ExcelLikeTable } from "../features/table-manager/components/ExcelLikeTable";
import { SqlResultContextMenu } from "./sql-query/SqlResultContextMenu";
import { SqlResultColumnMenu } from "./sql-query/SqlResultColumnMenu";
import { message } from "antd";
import type { ExecutedStatementResult, ColumnMeta } from "../types";

interface AutocompleteItem {
  label: string;
  insertText: string;
  type: "keyword" | "table" | "column" | "database";
  detail?: string;
  weight?: number;
  /** Fuzzy match score (higher = better). 0 = no match. */
  score?: number;
}

type AutocompleteContext = "mixed" | "keyword" | "table" | "column" | "database";

interface TableAliasEntry {
  table: string;
  alias: string;
}

const MYSQL_KEYWORDS = [
  // 最高频：DML 语句起点和核心子句（权重 10）
  { keyword: "SELECT", weight: 10 },
  { keyword: "FROM", weight: 10 },
  { keyword: "WHERE", weight: 10 },
  { keyword: "JOIN", weight: 10 },
  { keyword: "LEFT JOIN", weight: 10 },
  { keyword: "ORDER BY", weight: 9 },
  { keyword: "GROUP BY", weight: 9 },
  { keyword: "LIMIT", weight: 9 },
  { keyword: "AND", weight: 9 },
  { keyword: "OR", weight: 9 },
  { keyword: "ON", weight: 9 },

  // 高频：DML 语句 + INNER JOIN（权重 7-8）
  { keyword: "INNER JOIN", weight: 8 },
  { keyword: "INSERT INTO", weight: 7 },
  { keyword: "UPDATE", weight: 7 },
  { keyword: "DELETE FROM", weight: 7 },
  { keyword: "NULL", weight: 7 },
  { keyword: "IN", weight: 7 },
  { keyword: "IS", weight: 7 },
  { keyword: "SET", weight: 7 },

  // 中高频：子句连接词 + 聚合函数（权重 5-6）
  { keyword: "CREATE TABLE", weight: 6 },
  { keyword: "ALTER TABLE", weight: 6 },
  { keyword: "DESCRIBE", weight: 6 },
  { keyword: "LIKE", weight: 6 },
  { keyword: "VALUES", weight: 6 },
  { keyword: "COUNT", weight: 6 },
  { keyword: "SUM", weight: 6 },
  { keyword: "AVG", weight: 6 },
  { keyword: "MIN", weight: 6 },
  { keyword: "MAX", weight: 6 },
  { keyword: "RIGHT JOIN", weight: 5 },
  { keyword: "NOT", weight: 5 },
  { keyword: "HAVING", weight: 5 },
  { keyword: "ASC", weight: 5 },
  { keyword: "DESC", weight: 5 },
  { keyword: "AS", weight: 5 },
  { keyword: "DROP TABLE", weight: 5 },
  { keyword: "SHOW TABLES", weight: 5 },
  { keyword: "USE", weight: 5 },
  { keyword: "EXPLAIN", weight: 5 },

  // 中频：控制流 + 特定函数 + 右连接（权重 3-4）
  { keyword: "CASE", weight: 4 },
  { keyword: "WHEN", weight: 4 },
  { keyword: "THEN", weight: 4 },
  { keyword: "END", weight: 4 },
  { keyword: "IFNULL", weight: 4 },
  { keyword: "LENGTH", weight: 4 },
  { keyword: "IF", weight: 4 },
  { keyword: "ELSE", weight: 4 },
  { keyword: "TRUNCATE", weight: 4 },
  { keyword: "BETWEEN", weight: 3 },
  { keyword: "UNION", weight: 3 },
  { keyword: "ALL", weight: 3 },
  { keyword: "DISTINCT", weight: 3 },
  { keyword: "PRIMARY KEY", weight: 3 },
  { keyword: "FOREIGN KEY", weight: 3 },
  { keyword: "AUTO_INCREMENT", weight: 3 },
  { keyword: "DEFAULT", weight: 3 },

  // 低频：特殊函数（权重 1-2）
  { keyword: "CURRENT_TIMESTAMP", weight: 2 },
  { keyword: "NOW()", weight: 2 },
  { keyword: "EXISTS", weight: 2 },
  { keyword: "ANY", weight: 2 },
  { keyword: "SOME", weight: 2 },
  { keyword: "COALESCE", weight: 1 },
  { keyword: "CAST", weight: 1 },
  { keyword: "CONVERT", weight: 1 },
  { keyword: "DATABASE()", weight: 1 },
  { keyword: "VERSION()", weight: 1 },
  { keyword: "CHAR_LENGTH", weight: 1 },
  { keyword: "SUBSTRING", weight: 1 },
  { keyword: "CONCAT", weight: 3 },
  { keyword: "ROUND", weight: 1 },
  { keyword: "FLOOR", weight: 1 },
  { keyword: "CEIL", weight: 1 },
  { keyword: "RAND", weight: 1 },
  { keyword: "DATE", weight: 1 },
  { keyword: "TIME", weight: 1 },
  { keyword: "YEAR", weight: 1 },
  { keyword: "MONTH", weight: 1 },
  { keyword: "DAY", weight: 1 },
  { keyword: "HOUR", weight: 1 },
  { keyword: "MINUTE", weight: 1 },
  { keyword: "SECOND", weight: 1 }
];

function splitSqlStatements(input: string) {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && nextChar === "/") {
        current += nextChar;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (char === "-" && nextChar === "-") {
        current += char + nextChar;
        index += 1;
        inLineComment = true;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        current += char + nextChar;
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote && !inBacktick) {
      const escaped = input[index - 1] === "\\";
      if (!escaped) inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }
    if (char === '"' && !inSingleQuote && !inBacktick) {
      const escaped = input[index - 1] === "\\";
      if (!escaped) inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }
    if (char === "`" && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

function getTokenRange(text: string, caretPosition: number) {
  let start = caretPosition;
  let end = caretPosition;
  while (start > 0 && /[\w$.]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[\w$.]/.test(text[end])) end += 1;
  return { start, end, token: text.slice(start, end) };
}

function detectAutocompleteContext(text: string, caretPosition: number): AutocompleteContext {
  const prefix = text.slice(Math.max(0, caretPosition - 240), caretPosition).replace(/\s+/g, " ").toUpperCase();

  if (/\bUSE\s+[\w$.`]*$/.test(prefix)) {
    return "database";
  }
  if (/\b(FROM|JOIN|UPDATE|INTO|TABLE|DESCRIBE|TRUNCATE|DELETE\s+FROM)\s+[\w$.`]*$/.test(prefix)) {
    return "table";
  }
  if (/\b(SELECT|WHERE|AND|OR|ON|HAVING|SET|ORDER\s+BY|GROUP\s+BY)\s+[\w$.`]*$/.test(prefix)) {
    return "column";
  }
  return "mixed";
}

function getTypePriority(context: AutocompleteContext, type: AutocompleteItem["type"]) {
  switch (context) {
    case "database":
      return type === "database" ? 0 : type === "keyword" ? 2 : 4;
    case "table":
      return type === "table" ? 0 : type === "keyword" ? 2 : type === "column" ? 4 : 5;
    case "column":
      return type === "column" ? 0 : type === "keyword" ? 2 : type === "table" ? 4 : 5;
    case "keyword":
      return type === "keyword" ? 0 : 4;
    default:
      return type === "keyword" ? 0 : type === "table" ? 1 : type === "column" ? 2 : 3;
  }
}

function getVisibleColumns(columns: string[], preferred?: string[]) {
  if (!preferred || preferred.length === 0) {
    return columns;
  }

  const nextColumns = preferred.filter((column) => columns.includes(column));
  return nextColumns.length > 0 ? nextColumns : columns;
}

/** Fuzzy match: returns a score > 0 if query chars appear in order in target.
 *  Score heavily favors full match → prefix match → contiguous → short words. */
function fuzzyMatch(target: string, query: string): number {
  if (!query) return 1;
  const t = target.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  let ti = 0;
  let lastMatch = -1;
  let score = 0;
  const startsWith = t.startsWith(q[0]);
  const isFullMatch = t === q;

  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      const contiguous = lastMatch >= 0 && ti === lastMatch + 1;
      score += contiguous ? 3 : (ti === 0 ? 2 : 1);
      lastMatch = ti;
      qi += 1;
    }
    ti += 1;
  }

  if (qi < q.length) return 0; // not all chars matched
  if (isFullMatch) score += 100;
  if (startsWith) score += 10;
  // Bonus: shorter targets rank higher for same query ("from" > "floor" for "f")
  score += Math.max(0, 20 - t.length);
  return score;
}

/** Extract table aliases from a SQL statement. */
function extractTableAliases(statement: string): TableAliasEntry[] {
  const aliases: TableAliasEntry[] = [];
  const regex = /\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([\w$]+)`?(?:\s+(?:AS\s+)`?([\w$]+)`?)?/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(statement)) !== null) {
    const table = match[1];
    const alias = match[2];
    if (alias && alias.toUpperCase() !== "ON" && alias.toUpperCase() !== "WHERE" &&
        alias.toUpperCase() !== "SET" && alias.toUpperCase() !== "LEFT" &&
        alias.toUpperCase() !== "RIGHT" && alias.toUpperCase() !== "INNER" &&
        alias.toUpperCase() !== "CROSS" && alias.toUpperCase() !== "OUTER") {
      aliases.push({ table, alias });
    }
  }
  return aliases;
}

/** Resolve a table alias to its actual table name. */
function resolveAliasToTable(alias: string, aliases: TableAliasEntry[]): string | null {
  const found = aliases.find((a) => a.alias.toLowerCase() === alias.toLowerCase());
  return found?.table ?? null;
}

function extractMysqlErrorLine(message: string): number | null {
  const match = message.match(/\bline\s+(\d+)\b/i);
  if (!match) return null;
  const line = Number(match[1]);
  return Number.isFinite(line) && line > 0 ? line : null;
}

function getLineStartOffset(source: string, lineNumber: number): number {
  if (lineNumber <= 1) return 0;

  let currentLine = 1;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") {
      currentLine += 1;
      if (currentLine === lineNumber) {
        return index + 1;
      }
    }
  }

  return source.length;
}

export default function MysqlSqlQuery() {
  const { t } = useTranslation();
  const { getActiveConnectionIdByEngine, setActiveConnection, profiles } = useSharedConnectionState();
  const {
    databases,
    setDatabases,
    selectedDatabase,
    setSelectedDatabase,
    tablesByDb,
    setTablesByDb,
    getMysqlConnectionById,
    updateSqlQueryState,
    getSqlQueryState
  } = useMysqlContext();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const autocompleteListRef = useRef<HTMLDivElement | null>(null);
  const autocompleteOptionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorMeasurerRef = useRef<HTMLPreElement | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [columnMap, setColumnMap] = useState<Record<string, string[]>>({});
  const [columnMetaMap, setColumnMetaMap] = useState<Record<string, ColumnMeta[]>>({});
  const [queryGeneratorOpen, setQueryGeneratorOpen] = useState(false);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [autocompleteItems, setAutocompleteItems] = useState<AutocompleteItem[]>([]);
  const [autocompleteRange, setAutocompleteRange] = useState({ start: 0, end: 0 });
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const [loadedConnectionId, setLoadedConnectionId] = useState<string | null>(null);
  const [connectedDatabaseId, setConnectedDatabaseId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [resultVisibleColumns, setResultVisibleColumns] = useState<Record<string, string[]>>({});
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });

  // SQL result table selection state
  const [sqlResultSelectedCells, setSqlResultSelectedCells] = useState<Array<{ key: string; rowIndex: number; columnIndex: number; column: string }>>([]);
  const [sqlResultSelectionAnchor, setSqlResultSelectionAnchor] = useState<{ rowIndex: number; columnIndex: number } | null>(null);
  const [sqlResultSelectedRowIndex, setSqlResultSelectedRowIndex] = useState<number | null>(null);
  const [sqlResultRowContextMenu, setSqlResultRowContextMenu] = useState<{ x: number; y: number; rowIndex: number; columnIndex: number; column: string; value: unknown } | null>(null);
  const [sqlResultColumnMenu, setSqlResultColumnMenu] = useState<{ x: number; y: number } | null>(null);

  const connectionId = getActiveConnectionIdByEngine("mysql");
  const currentActiveMysqlConnection = getMysqlConnectionById(connectionId || "");

  const currentSqlState = useMemo(
    () => getSqlQueryState(connectionId || ""),
    [connectionId, getSqlQueryState]
  );
  const sql = currentSqlState.sql;
  const results = currentSqlState.results;

  const setSql = (value: string) => {
    if (connectionId) {
      updateSqlQueryState(connectionId, { sql: value });
    }
  };

  const setResults = (value: ExecutedStatementResult[]) => {
    if (connectionId) {
      updateSqlQueryState(connectionId, { results: value });
    }
  };

  const selectedText = sql.slice(selectionRange.start, selectionRange.end).trim();
  const mysqlProfiles = useMemo(
    () => profiles.filter((profile) => profile.engine === "mysql"),
    [profiles]
  );

  const selectedDatabaseTables = useMemo(() => {
    if (!selectedDatabase) return [];
    return tablesByDb[selectedDatabase] ?? [];
  }, [selectedDatabase, tablesByDb]);

  const autocompleteSource = useMemo<AutocompleteItem[]>(() => {
    const tableItems = selectedDatabaseTables.map((table) => ({
      label: table,
      insertText: table,
      type: "table" as const,
      detail: selectedDatabase ?? undefined
    }));

    const databaseItems = databases.map((database) => ({
      label: database,
      insertText: database,
      type: "database" as const,
      detail: t("mysql.query.databaseOption")
    }));

    // Only columns from the current database
    const dbPrefix = selectedDatabase ? `${selectedDatabase}::` : "";
    const columnItems = Object.entries(columnMap)
      .filter(([key]) => !selectedDatabase || key.startsWith(dbPrefix))
      .flatMap(([key, columns]) => {
        const table = key.replace(dbPrefix, "");
        return columns.map((column) => ({
          label: column,
          insertText: column,
          type: "column" as const,
          detail: table
        }));
      });

    const keywordItems = MYSQL_KEYWORDS.map(({ keyword, weight }) => ({
      label: keyword,
      insertText: `${keyword} `,
      type: "keyword" as const,
      weight
    }));

    return [...keywordItems, ...databaseItems, ...tableItems, ...columnItems];
  }, [columnMap, databases, selectedDatabase, selectedDatabaseTables, t]);

  const activeResult = useMemo(
    () => results.find((item) => item.id === activeResultId) ?? results[0] ?? null,
    [activeResultId, results]
  );

  const lineCount = useMemo(() => Math.max(1, sql.split("\n").length), [sql]);
  const lineNumbers = useMemo(() => Array.from({ length: lineCount }, (_, index) => index + 1), [lineCount]);
  const editorErrorLine = useMemo(() => extractMysqlErrorLine(error), [error]);

  // Close context menus on outside click
  useEffect(() => {
    if (!sqlResultRowContextMenu && !sqlResultColumnMenu) return;

    const handler = () => {
      setSqlResultRowContextMenu(null);
      setSqlResultColumnMenu(null);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [sqlResultRowContextMenu, sqlResultColumnMenu]);

  useEffect(() => {
    if (!editorErrorLine || !textareaRef.current) {
      return;
    }

    const lineOffset = getLineStartOffset(sql, editorErrorLine);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(lineOffset, lineOffset);

    const lineHeight = 13 * 1.6;
    const nextScrollTop = Math.max(0, (editorErrorLine - 2) * lineHeight);
    textareaRef.current.scrollTop = nextScrollTop;
    if (lineNumberRef.current) {
      lineNumberRef.current.scrollTop = nextScrollTop;
    }
  }, [editorErrorLine, sql]);

  useEffect(() => {
    if (!autocompleteOpen || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    const scrollLeft = textarea.scrollLeft;

    // Use a hidden pre element to measure exact cursor position
    if (cursorMeasurerRef.current) {
      const measurer = cursorMeasurerRef.current;
      const textBeforeCursor = sql.slice(0, selectionRange.start);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines.length;
      const currentLineText = lines[lines.length - 1];

      // Measure line height from actual element
      const lineHeight = measurer.offsetHeight > 0 ? measurer.offsetHeight : 20.8;

      // Measure character width using the measurer
      measurer.textContent = 'M';
      const charWidth = measurer.offsetWidth || 7.8;

      // Calculate position
      const relativeTop = (currentLine - 1) * lineHeight + lineHeight;
      const relativeLeft = 46 + 12 + currentLineText.length * charWidth - scrollLeft;

      const absoluteTop = rect.top + relativeTop + 4;
      const absoluteLeft = rect.left + relativeLeft;

      // Prevent viewport overflow
      const maxLeft = window.innerWidth - 300;
      const finalLeft = Math.max(rect.left + 46 + 12, Math.min(absoluteLeft, maxLeft));

      setAutocompletePosition({
        top: absoluteTop,
        left: finalLeft
      });
    }

    const activeOption = autocompleteOptionRefs.current[autocompleteIndex];
    activeOption?.scrollIntoView({ block: "nearest" });
  }, [autocompleteIndex, autocompleteOpen, sql, selectionRange, textareaRef]);

  const ensureDatabasesLoaded = async (targetConnectionId: string, preferredDatabase?: string) => {
    const dbs = await mysqlListDatabases(targetConnectionId);
    setDatabases(dbs);
    const nextDatabase = preferredDatabase && dbs.includes(preferredDatabase)
      ? preferredDatabase
      : dbs[0];
    setSelectedDatabase(nextDatabase);
    return dbs;
  };

  const ensureConnectionDatabase = async (targetConnectionId: string, database?: string) => {
    const targetConnection = getMysqlConnectionById(targetConnectionId);
    if (!targetConnection) {
      throw new Error("CONNECTION_FAILED");
    }

    const nextDatabase = database?.trim() || undefined;
    const cacheKey = `${targetConnectionId}::${nextDatabase ?? ""}`;
    if (connectedDatabaseId === cacheKey) {
      return;
    }

    await mysqlConnect({
      ...targetConnection,
      database: nextDatabase
    });
    setConnectedDatabaseId(cacheKey);
  };

  const escapeSqlIdentifier = (value: string) => `\`${value.replace(/`/g, "``")}\``;

  const detectUseDatabase = (statement: string) => {
    const match = statement.match(/^\s*USE\s+`?([\w$]+)`?\s*$/i);
    return match?.[1];
  };

  const detectQualifiedDatabase = (statement: string) => {
    const match = statement.match(/`?([\w$]+)`?\s*\.\s*`?[\w$]+`?/);
    return match?.[1];
  };

  const buildExplainSql = (statement: string) => (/^\s*EXPLAIN\b/i.test(statement) ? statement : `EXPLAIN ${statement}`);

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      logError(err, {
        source: "mysqlSqlQuery.copyClipboard",
        message: "Failed to copy MySQL SQL query result to clipboard"
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    async function loadConnectionDatabases() {
      if (!connectionId || loadedConnectionId === connectionId) return;
      try {
        await ensureConnectionDatabase(connectionId, currentActiveMysqlConnection?.database || selectedDatabase);
        await ensureDatabasesLoaded(connectionId, selectedDatabase ?? currentActiveMysqlConnection?.database);
        setLoadedConnectionId(connectionId);
        setColumnMap({});
      } catch (err) {
        logError(err, {
          source: "mysqlSqlQuery.loadDatabases",
          message: `Failed to load databases for MySQL connection ${connectionId}`
        });
      }
    }

    void loadConnectionDatabases();
  }, [currentActiveMysqlConnection?.database, connectionId, loadedConnectionId, selectedDatabase]);

  useEffect(() => {
    async function loadTablesAndColumns() {
      if (!connectionId || !selectedDatabase) return;
      try {
        const tables = tablesByDb[selectedDatabase] ?? await mysqlListTables(connectionId, selectedDatabase);
        if (!tablesByDb[selectedDatabase]) {
          setTablesByDb((prev) => ({ ...prev, [selectedDatabase]: tables }));
        }

        const missingTables = tables.filter((table) => !columnMap[`${selectedDatabase}::${table}`]);
        if (missingTables.length === 0) return;

        setAutocompleteLoading(true);

        // Single query pass - fetch metadata once per table
        const metaEntries = await Promise.all(
          missingTables.map(async (table) => {
            const columnMetas = await mysqlDescribeTable(connectionId, selectedDatabase, table);
            return [table, columnMetas] as const;
          })
        );

        // Derive column names from metadata, keyed by `database::table`
        const entries = metaEntries.map(([table, metas]) =>
          [`${selectedDatabase}::${table}`, metas.map((meta) => meta.field)] as const
        );

        setColumnMap((prev) => ({
          ...prev,
          ...Object.fromEntries(entries)
        }));

        setColumnMetaMap((prev) => ({
          ...prev,
          ...Object.fromEntries(metaEntries)
        }));
      } catch (err) {
        logError(err, {
          source: "mysqlSqlQuery.autocompleteMeta",
          message: `Failed to load autocomplete metadata for ${selectedDatabase}`
        });
      } finally {
        setAutocompleteLoading(false);
      }
    }

    void loadTablesAndColumns();
  }, [columnMap, connectionId, selectedDatabase, setTablesByDb, tablesByDb]);

  const updateAutocomplete = (nextSql: string, caretPosition: number) => {
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current);
    }
    autocompleteDebounceRef.current = setTimeout(() => {
      doUpdateAutocomplete(nextSql, caretPosition);
    }, 150);
  };

  const doUpdateAutocomplete = (nextSql: string, caretPosition: number) => {
    const { start, end, token } = getTokenRange(nextSql, caretPosition);
    const normalized = token.trim().toLowerCase();
    const context = detectAutocompleteContext(nextSql, caretPosition);

    // Check if we have a dot-triggered alias resolution (e.g. "u." or "users.")
    const hasDotPrefix = token.includes(".");
    const dotParts = normalized.split(".");
    const aliasPrefix = dotParts.length >= 2 ? dotParts[dotParts.length - 2] : "";
    const lookupToken = dotParts[dotParts.length - 1] ?? "";

    // For dot-trigger: resolve alias to table name and extract aliases from full SQL
    let aliasColumns: string[] | null = null;
    let aliasDetail = "";
    if (hasDotPrefix && aliasPrefix) {
      const allStatements = splitSqlStatements(nextSql);
      const aliases = allStatements.flatMap(extractTableAliases);
      const resolvedTable = resolveAliasToTable(aliasPrefix, aliases);
      const dbPrefix = selectedDatabase ? `${selectedDatabase}::` : "";
      const targetKey = resolvedTable ? `${dbPrefix}${resolvedTable}` : `${dbPrefix}${aliasPrefix}`;
      if (columnMap[targetKey]) {
        aliasColumns = columnMap[targetKey];
        aliasDetail = resolvedTable || aliasPrefix;
      }
    }

    // If empty token but dot-triggered, show all alias columns
    if (!normalized && hasDotPrefix && aliasColumns) {
      const items = aliasColumns.map((col) => ({
        label: col,
        insertText: col,
        type: "column" as const,
        detail: aliasDetail
      }));
      setAutocompleteRange({ start: caretPosition, end: caretPosition });
      setAutocompleteItems(items.slice(0, 12));
      setAutocompleteIndex(0);
      setAutocompleteOpen(items.length > 0);
      return;
    }

    if (!normalized && !hasDotPrefix) {
      setAutocompleteOpen(false);
      setAutocompleteItems([]);
      return;
    }

    // Build filtered items with fuzzy matching
    const filteredItems: AutocompleteItem[] = [];

    for (const item of autocompleteSource) {
      // Context filtering
      if (context === "database" && item.type !== "database") continue;
      if (context === "table" && item.type !== "table" && item.type !== "keyword") continue;
      if (context === "column" && item.type !== "column" && item.type !== "keyword") continue;

      // For dot-triggered column context, prioritize alias columns
      if (hasDotPrefix && item.type === "column") {
        const score = fuzzyMatch(item.label, lookupToken);
        if (score > 0) {
          const isAliasColumn = aliasColumns?.includes(item.label);
          filteredItems.push({
            ...item,
            detail: isAliasColumn ? aliasDetail : item.detail,
            score: score + (isAliasColumn ? 100 : 0)
          });
        }
        continue;
      }

      const score = fuzzyMatch(item.label, lookupToken);
      if (score > 0) {
        // Keywords: fold weight into score so common keywords outrank obscure ones
        const finalScore = item.type === "keyword" ? score + (item.weight ?? 0) * 100 : score;
        filteredItems.push({ ...item, score: finalScore });
      }
    }

    const sorted = filteredItems
      .sort((left, right) => {
        const typeDiff = getTypePriority(context, left.type) - getTypePriority(context, right.type);
        if (typeDiff !== 0) return typeDiff;
        // Fuzzy score (higher = better)
        const scoreDiff = (right.score ?? 0) - (left.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        // Keywords: higher weight wins
        if (left.type === "keyword" && right.type === "keyword") {
          const weightDiff = (right.weight ?? 0) - (left.weight ?? 0);
          if (weightDiff !== 0) return weightDiff;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, 12);

    setAutocompleteRange({ start, end });
    setAutocompleteItems(sorted);
    setAutocompleteIndex(0);
    setAutocompleteOpen(sorted.length > 0);
  };

  const applyAutocomplete = (item: AutocompleteItem) => {
    const nextSql = `${sql.slice(0, autocompleteRange.start)}${item.insertText}${sql.slice(autocompleteRange.end)}`;
    const nextCaret = autocompleteRange.start + item.insertText.length;
    setSql(nextSql);
    setAutocompleteOpen(false);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaret, nextCaret);
      setSelectionRange({ start: nextCaret, end: nextCaret });
    });
  };

  const executeStatements = async (rawSql: string, mode: "execute" | "explain" = "execute") => {
    if (!connectionId || !rawSql.trim()) return;

    const statements = splitSqlStatements(rawSql);
    if (statements.length === 0) return;

    setLoading(true);
    setError("");
    setResults([]);

    const nextResults: ExecutedStatementResult[] = [];
    let batchDatabase = selectedDatabase;

    if (batchDatabase) {
      try {
        await ensureConnectionDatabase(connectionId, batchDatabase);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLoading(false);
        setError(message);
        return;
      }
    }

    for (const statement of statements) {
      const explicitUseDatabase = detectUseDatabase(statement);
      const explicitQualifiedDatabase = detectQualifiedDatabase(statement);
      const databaseUsed = explicitUseDatabase ?? explicitQualifiedDatabase ?? batchDatabase;
      let effectiveSql = statement;

      try {
        if (explicitUseDatabase) {
          await ensureConnectionDatabase(connectionId, explicitUseDatabase);
          batchDatabase = explicitUseDatabase;
          setSelectedDatabase(explicitUseDatabase);
          nextResults.push({
            id: `${Date.now()}-${nextResults.length}`,
            sql: statement,
            effectiveSql: `-- switch default database to ${explicitUseDatabase}`,
            mode,
            durationMs: 0,
            connectionName: currentActiveMysqlConnection?.name ?? connectionId,
            databaseUsed: explicitUseDatabase,
            result: {
              columns: [],
              rows: [],
              affectedRows: 0,
              isResultSet: false
            }
          });
          continue;
        }

        if (!explicitQualifiedDatabase && batchDatabase) {
          await ensureConnectionDatabase(connectionId, batchDatabase);
          effectiveSql = `-- default database ${escapeSqlIdentifier(batchDatabase)}\n${mode === "explain" ? buildExplainSql(statement) : statement}`;
        } else if (mode === "explain") {
          effectiveSql = buildExplainSql(statement);
        }

        const startedAt = performance.now();
        const querySql = mode === "explain" ? buildExplainSql(statement) : statement;
        const res = await mysqlQuery(connectionId, querySql);
        const durationMs = performance.now() - startedAt;
        nextResults.push({
          id: `${Date.now()}-${nextResults.length}`,
          sql: statement,
          effectiveSql,
          mode,
          durationMs,
          connectionName: currentActiveMysqlConnection?.name ?? connectionId,
          databaseUsed,
          result: res
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(err, {
          source: "mysqlSqlQuery.execute",
          message: `Failed to execute MySQL SQL on connection ${connectionId}`,
          detail: statement
        });
        nextResults.push({
          id: `${Date.now()}-${nextResults.length}`,
          sql: statement,
          effectiveSql,
          mode,
          durationMs: 0,
          connectionName: currentActiveMysqlConnection?.name ?? connectionId,
          databaseUsed,
          error: message
        });
      }
    }

    setResults(nextResults);
    setActiveResultId(nextResults[0]?.id ?? null);
    setResultVisibleColumns(() => Object.fromEntries(
      nextResults
        .filter((item) => item.result?.isResultSet)
        .map((item) => [item.id, item.result?.columns ?? []])
    ));
    if (nextResults.every((item) => item.error)) {
      setError(nextResults[0]?.error ?? "");
    }

    setLoading(false);
  };

  const handleConnectionSwitch = async (nextConnectionId: string) => {
    if (!nextConnectionId || nextConnectionId === connectionId) return;
    const nextConnection = getMysqlConnectionById(nextConnectionId);
    if (!nextConnection) return;

    setMetaLoading(true);
    try {
      await ensureConnectionDatabase(nextConnectionId, nextConnection.database);
      await setActiveConnection(nextConnectionId, "mysql");
      setTablesByDb({});
      setColumnMap({});
      await ensureDatabasesLoaded(nextConnectionId, nextConnection.database);
      setLoadedConnectionId(nextConnectionId);
    } catch (err) {
      logError(err, {
        source: "mysqlSqlQuery.switchConnection",
        message: `Failed to switch MySQL connection to ${nextConnectionId}`
      });
      if (connectionId) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setMetaLoading(false);
    }
  };

  const handleDatabaseSwitch = async (nextDatabase: string) => {
    setSelectedDatabase(nextDatabase || undefined);
    if (!connectionId || !nextDatabase) return;
    try {
      await ensureConnectionDatabase(connectionId, nextDatabase);
    } catch (err) {
      logError(err, {
        source: "mysqlSqlQuery.switchDatabaseConnect",
        message: `Failed to switch MySQL default database to ${nextDatabase}`
      });
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (!tablesByDb[nextDatabase]) {
      try {
        const tables = await mysqlListTables(connectionId, nextDatabase);
        setTablesByDb((prev) => ({ ...prev, [nextDatabase]: tables }));
      } catch (err) {
        logError(err, {
          source: "mysqlSqlQuery.switchDatabase",
          message: `Failed to load tables for database ${nextDatabase}`
        });
      }
    }
  };

  const handleFormatSql = () => {
    if (!sql.trim()) return;
    try {
      const formatted = formatSql(sql, { language: "mysql", tabWidth: 2, keywordCase: "upper" });
      setSql(formatted);
      setAutocompleteOpen(false);
    } catch (err) {
      logError(err, {
        source: "mysqlSqlQuery.formatSql",
        message: "Failed to format SQL in MySQL query editor"
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleExecuteAll = async () => {
    await executeStatements(sql);
  };

  const handleExecuteSelection = async () => {
    if (!selectedText) return;
    await executeStatements(selectedText);
  };

  const handleExplain = async () => {
    const targetSql = selectedText || sql;
    if (!targetSql.trim()) return;
    await executeStatements(targetSql, "explain");
  };

  // ─── SQL result table selection ───

  const sqlResultSelectedCellKeySet = useMemo(() => {
    return new Set(sqlResultSelectedCells.map((c) => c.key));
  }, [sqlResultSelectedCells]);

  const sqlResultSelectedRowsCount = useMemo(() => {
    return new Set(sqlResultSelectedCells.map((c) => c.rowIndex)).size;
  }, [sqlResultSelectedCells]);

  const handleSqlResultCellClick = useCallback(
    (e: MouseEvent<HTMLTableCellElement>, rowIndex: number, columnIndex: number, columns: string[]) => {
      const currentKey = `${rowIndex}:${columnIndex}`;
      const currentCell = { key: currentKey, rowIndex, columnIndex, column: columns[columnIndex] ?? "" };
      if (!currentCell.column) return;

      const isSameSingleSelection =
        sqlResultSelectedCells.length === 1 &&
        sqlResultSelectedCells[0]?.key === currentKey &&
        !e.shiftKey &&
        !(e.ctrlKey || e.metaKey);

      if (isSameSingleSelection) {
        setSqlResultSelectedRowIndex((prev) => (prev === rowIndex ? prev : rowIndex));
        return;
      }

      if (e.shiftKey && sqlResultSelectionAnchor) {
        const rowStart = Math.min(sqlResultSelectionAnchor.rowIndex, rowIndex);
        const rowEnd = Math.max(sqlResultSelectionAnchor.rowIndex, rowIndex);
        const colStart = Math.min(sqlResultSelectionAnchor.columnIndex, columnIndex);
        const colEnd = Math.max(sqlResultSelectionAnchor.columnIndex, columnIndex);
        const cells: typeof sqlResultSelectedCells = [];
        for (let r = rowStart; r <= rowEnd; r++) {
          for (let c = colStart; c <= colEnd; c++) {
            cells.push({ key: `${r}:${c}`, rowIndex: r, columnIndex: c, column: columns[c] ?? "" });
          }
        }
        setSqlResultSelectedCells(cells);
        setSqlResultSelectedRowIndex(null);
      } else if (e.ctrlKey || e.metaKey) {
        setSqlResultSelectedCells((prev) =>
          prev.some((cell) => cell.key === currentKey)
            ? prev.filter((cell) => cell.key !== currentKey)
            : [...prev, currentCell]
        );
        setSqlResultSelectionAnchor({ rowIndex, columnIndex });
        setSqlResultSelectedRowIndex(null);
      } else {
        setSqlResultSelectedCells([currentCell]);
        setSqlResultSelectionAnchor({ rowIndex, columnIndex });
        setSqlResultSelectedRowIndex((prev) => (prev === rowIndex ? prev : rowIndex));
      }
    },
    [sqlResultSelectedCells, sqlResultSelectionAnchor]
  );

  const handleSqlResultContextMenu = useCallback((e: MouseEvent<HTMLTableCellElement>, rowIndex: number, column: string, value: unknown, columns: string[]) => {
    e.preventDefault();
    e.stopPropagation();
    const columnIndex = columns.indexOf(column);
    const currentKey = `${rowIndex}:${columnIndex}`;
    const currentCell = { key: currentKey, rowIndex, columnIndex, column };
    if (currentCell.column && !sqlResultSelectedCellKeySet.has(currentKey)) {
      setSqlResultSelectedCells([currentCell]);
      setSqlResultSelectionAnchor({ rowIndex, columnIndex });
    }
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - 260));
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - 420));
    setSqlResultRowContextMenu({ x, y, rowIndex, columnIndex, column, value });
  }, [sqlResultSelectedCellKeySet]);

  // ─── SQL result cell saving ───

  const [sqlResultData, setSqlResultData] = useState<Record<string, any[][]>>({});

  /**
   * Try to extract table name from SELECT statement.
   * Handles: SELECT ... FROM table, SELECT ... FROM db.table
   */
  const parseSqlResultTableName = useCallback((sql: string): string | null => {
    const match = sql.match(/\bFROM\s+`?([\w.`]+)`?/i);
    if (!match) return null;
    const raw = match[1];
    const parts = raw.split(".");
    if (parts.length === 2) return parts[1].replace(/`/g, "");
    if (parts.length === 1) return parts[0].replace(/`/g, "");
    return null;
  }, []);

  /**
   * Try to find primary key columns from result set by matching column names to DESCRIBE output.
   */
  const findResultPkColumns = useCallback(async (
    connectionId: string,
    database: string,
    tableName: string,
    resultSetColumns: string[]
  ): Promise<string[]> => {
    try {
      const columns = await mysqlDescribeTable(connectionId, database, tableName);
      const pkCols = columns.filter((c) => c.key === "PRI").map((c) => c.field);
      // Only return if ALL pk columns are present in the result set
      if (pkCols.length > 0 && pkCols.every((pk) => resultSetColumns.includes(pk))) {
        return pkCols;
      }
    } catch {
      // DESCRIBE failed — no PK info available
    }
    return [];
  }, []);

  const handleSqlResultSaveCell = useCallback(async (rowIndex: number, columnIndex: number, columnName: string, newValue: string) => {
    if (!activeResult || !connectionId) return;
    const resultSet = activeResult.result;
    if (!resultSet?.isResultSet) return;

    const currentRows = sqlResultData[activeResult.id] ?? resultSet.rows;
    const row = currentRows[rowIndex];
    if (!row) return;

    const oldValue = row[columnIndex];
    const normalizedOldValue = oldValue === null ? "" : String(oldValue);
    const normalizedNewValue = newValue === "" ? null : newValue;

    if (normalizedOldValue === (newValue === "" ? "" : newValue)) {
      return;
    }

    // Build SET clause
    let setClause: string;
    if (normalizedNewValue === null) {
      setClause = `\`${columnName}\` = NULL`;
    } else if (typeof normalizedNewValue === "number") {
      setClause = `\`${columnName}\` = ${normalizedNewValue}`;
    } else if (typeof normalizedNewValue === "boolean") {
      setClause = `\`${columnName}\` = ${normalizedNewValue ? 1 : 0}`;
    } else {
      setClause = `\`${columnName}\` = '${String(normalizedNewValue).replace(/'/g, "''")}'`;
    }

    // Try to execute UPDATE against the database
    let saveFailed = false;
    let saveFailedReason = "";

    if (activeResult.databaseUsed) {
      const tableName = parseSqlResultTableName(activeResult.sql);
      if (tableName) {
        const pkCols = await findResultPkColumns(connectionId, activeResult.databaseUsed, tableName, resultSet.columns);
        if (pkCols.length > 0) {
          // Build WHERE from primary key columns
          const whereParts: string[] = [];
          for (const pkCol of pkCols) {
            const pkIdx = resultSet.columns.indexOf(pkCol);
            const pkVal = pkIdx >= 0 ? row[pkIdx] : null;
            if (pkVal === null) {
              whereParts.push(`\`${pkCol}\` IS NULL`);
            } else {
              whereParts.push(`\`${pkCol}\` = '${String(pkVal).replace(/'/g, "''")}'`);
            }
          }
          const updateSql = `UPDATE \`${activeResult.databaseUsed}\`.\`${tableName}\` SET ${setClause} WHERE ${whereParts.join(" AND ")} LIMIT 1`;
          try {
            await mysqlQuery(connectionId, updateSql);
          } catch {
            saveFailed = true;
            saveFailedReason = "UPDATE 执行失败，请检查表结构";
          }
        } else {
          saveFailed = true;
          saveFailedReason = "无法找到主键列，联表查询或无主键表无法保存";
        }
      } else {
        saveFailed = true;
        saveFailedReason = "联表查询无法识别目标表，无法保存数据";
      }
    }

    if (saveFailed) {
      message.warning(saveFailedReason, 3);
    }

    // Always update local display
    const updatedRow = [...row];
    updatedRow[columnIndex] = normalizedNewValue;
    const nextRows = currentRows.map((r, i) => i === rowIndex ? updatedRow : r);
    setSqlResultData((prev) => ({ ...prev, [activeResult.id]: nextRows }));
  }, [activeResult, connectionId, sqlResultData, parseSqlResultTableName, findResultPkColumns]);

  // ─── SQL result context menu actions ───

  const handleSqlResultCopyRows = useCallback(() => {
    if (!activeResult || sqlResultSelectedCells.length === 0) return;
    const resultSet = activeResult.result;
    if (!resultSet?.isResultSet) return;
    const currentRows = sqlResultData[activeResult.id] ?? resultSet.rows;
    const selectedRows = new Set(sqlResultSelectedCells.map((c) => c.rowIndex));
    const rows = currentRows.filter((_, i) => selectedRows.has(i));
    const data = rows.map((row) =>
      resultSet.columns.map((col) => {
        const idx = resultSet.columns.indexOf(col);
        const val = row[idx];
        return val === null ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val);
      })
    );
    const tsv = data.map((r) => r.join("\t")).join("\n");
    void copyToClipboard(tsv);
    setSqlResultRowContextMenu(null);
  }, [activeResult, sqlResultSelectedCells, sqlResultData, copyToClipboard]);

  const handleSqlResultCopyInsert = useCallback(() => {
    if (!activeResult || sqlResultSelectedCells.length === 0) return;
    const resultSet = activeResult.result;
    if (!resultSet?.isResultSet) return;
    const currentRows = sqlResultData[activeResult.id] ?? resultSet.rows;
    const cols = resultSet.columns.join(", ");
    const rows = currentRows.map((row) =>
      `(${resultSet.columns.map((col) => {
        const idx = resultSet.columns.indexOf(col);
        const val = row[idx];
        return val === null ? "NULL" : typeof val === "string" ? `'${val.replace(/'/g, "''")}'` : String(val);
      }).join(", ")})`
    );
    const sql = `INSERT INTO table_name (${cols}) VALUES\n${rows.join(",\n")};`;
    void copyToClipboard(sql);
    setSqlResultRowContextMenu(null);
  }, [activeResult, sqlResultSelectedCells, sqlResultData, copyToClipboard]);

  const handleSqlResultCopyUpdate = useCallback(() => {
    if (!activeResult || sqlResultSelectedCells.length === 0) return;
    const resultSet = activeResult.result;
    if (!resultSet?.isResultSet) return;
    const currentRows = sqlResultData[activeResult.id] ?? resultSet.rows;
    const pkCol = resultSet.columns.find((col) => col.toLowerCase().includes("id"));
    const lines: string[] = [];
    currentRows.forEach((row) => {
      const updates = resultSet.columns
        .map((col) => {
          const idx = resultSet.columns.indexOf(col);
          const val = row[idx];
          return val === null ? `${col} = NULL` : `${col} = '${typeof val === "string" ? val.replace(/'/g, "''") : val}'`;
        })
        .join(", ");
      const where = pkCol ? ` WHERE ${pkCol} = '${row[resultSet.columns.indexOf(pkCol)]}'` : "";
      lines.push(`UPDATE table_name SET ${updates}${where};`);
    });
    void copyToClipboard(lines.join("\n"));
    setSqlResultRowContextMenu(null);
  }, [activeResult, sqlResultSelectedCells, sqlResultData, copyToClipboard]);

  const handleSqlResultFilterByValue = useCallback(() => {
    if (!sqlResultRowContextMenu || !activeResult) return;
    const { column, value } = sqlResultRowContextMenu;
    const escaped = value === null ? "NULL" : typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
    const filterSql = `WHERE ${column} = ${escaped}`;
    setSql(sql + "\n" + filterSql);
    setSqlResultRowContextMenu(null);
  }, [sqlResultRowContextMenu, activeResult]);

  const handleSqlResultSortAsc = useCallback(() => {
    if (!sqlResultRowContextMenu) return;
    const { column } = sqlResultRowContextMenu;
    setSql(sql + "\nORDER BY " + column + " ASC");
    setSqlResultRowContextMenu(null);
  }, [sqlResultRowContextMenu]);

  const handleSqlResultSortDesc = useCallback(() => {
    if (!sqlResultRowContextMenu) return;
    const { column } = sqlResultRowContextMenu;
    setSql(sql + "\nORDER BY " + column + " DESC");
    setSqlResultRowContextMenu(null);
  }, [sqlResultRowContextMenu]);

  // ─── SQL result column visibility ───

  const getSqlResultVisibleColumns = useCallback((resultSetColumns: string[]) => {
    return resultVisibleColumns[activeResultId ?? ""] ?? resultSetColumns;
  }, [resultVisibleColumns, activeResultId]);

  const toggleSqlResultColumn = useCallback((column: string) => {
    setResultVisibleColumns((prev) => {
      const current = prev[activeResultId ?? ""] ?? [];
      const next = current.includes(column) ? current.filter((c) => c !== column) : [...current, column];
      return { ...prev, [activeResultId ?? ""]: next };
    });
  }, [activeResultId]);

  const selectAllSqlResultColumns = useCallback(() => {
    if (!activeResult?.result?.isResultSet) return;
    setResultVisibleColumns((prev) => ({ ...prev, [activeResultId ?? ""]: activeResult.result!.columns }));
    setSqlResultColumnMenu(null);
  }, [activeResult, activeResultId]);

  const handleCloseResult = (resultId: string) => {
    const nextResults = results.filter((item) => item.id !== resultId);
    const removedIndex = results.findIndex((item) => item.id === resultId);
    setResults(nextResults);
    setActiveResultId((currentActiveId) => {
      if (currentActiveId !== resultId) {
        return currentActiveId;
      }
      if (nextResults.length === 0) {
        return null;
      }
      const nextIndex = Math.min(removedIndex, nextResults.length - 1);
      return nextResults[nextIndex]?.id ?? null;
    });
    setResultVisibleColumns((prevColumns) => {
      const nextColumns = { ...prevColumns };
      delete nextColumns[resultId];
      return nextColumns;
    });
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSql(nextValue);
    setSelectionRange({ start: event.target.selectionStart, end: event.target.selectionEnd });
    updateAutocomplete(nextValue, event.target.selectionStart);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Space / Cmd+Space: manual trigger for autocomplete
    if ((e.ctrlKey || e.metaKey) && e.key === " ") {
      e.preventDefault();
      const target = e.currentTarget;
      doUpdateAutocomplete(target.value, target.selectionStart);
      return;
    }

    if (autocompleteOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setAutocompleteIndex((prev) => {
        if (e.key === "ArrowDown") {
          return (prev + 1) % Math.max(autocompleteItems.length, 1);
        }
        return (prev - 1 + Math.max(autocompleteItems.length, 1)) % Math.max(autocompleteItems.length, 1);
      });
      return;
    }

    if (autocompleteOpen && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      const item = autocompleteItems[autocompleteIndex];
      if (item) {
        applyAutocomplete(item);
      }
      return;
    }

    if (autocompleteOpen && e.key === "Escape") {
      e.preventDefault();
      setAutocompleteOpen(false);
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      void handleExecuteAll();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (selectedText) {
        void handleExecuteSelection();
      } else {
        void handleExecuteAll();
      }
    }
  };

  if (mysqlProfiles.length === 0) {
    return (
      <div className="page">
        <div className="card" style={{ padding: "32px", textAlign: "center" }}>
          <span className="muted">{t("mysql.query.noMysqlConnection")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ position: "relative", flex: 1, minHeight: 0, height: "100%" }}>
      {/* SQL Editor */}
      <div className="card" style={{ flex: "0 0 auto", marginBottom: 0, display: "flex", flexDirection: "column", minHeight: "140px", overflow: "visible", position: "relative", zIndex: 1 }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div className="module-toolbar-grid" style={{ flex: 1 }}>
            <div className="module-toolbar-field" style={{ display: "grid", gap: "6px" }}>
              <select
                className="form-control"
                style={{ width: "100%" }}
                value={connectionId ?? ""}
                disabled={metaLoading || loading}
                onChange={(event) => void handleConnectionSwitch(event.target.value)}
              >
                {mysqlProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </div>
            <div className="module-toolbar-field" style={{ display: "grid", gap: "6px" }}>
              <select
                className="form-control"
                style={{ width: "100%" }}
                value={selectedDatabase ?? ""}
                disabled={!currentActiveMysqlConnection || metaLoading || loading || databases.length === 0}
                onChange={(event) => void handleDatabaseSwitch(event.target.value)}
              >
                {databases.length === 0 ? (
                  <option value="">{t("mysql.query.noDatabaseOptions")}</option>
                ) : (
                  databases.map((database) => (
                    <option key={database} value={database}>{database}</option>
                  ))
                )}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", marginLeft: "auto" }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ background: "transparent" }}
              onClick={() => setQueryGeneratorOpen(true)}
              disabled={!selectedDatabase || !selectedDatabaseTables.length}
            >
              {t("mysql.query.quickGenerate")}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ background: "transparent" }} onClick={() => void handleExplain()} disabled={loading || (!sql.trim() && !selectedText)}>
              {loading ? t("common.loading") : t("mysql.query.explain")}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ background: "transparent" }} onClick={handleFormatSql} disabled={!sql.trim() || loading || metaLoading}>
              {t("mysql.query.formatSql")}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ background: "transparent" }} onClick={() => setSql("")}>
              {t("common.clear")}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ background: "transparent" }} onClick={() => void handleExecuteSelection()} disabled={loading || !selectedText}>
              {loading ? t("common.loading") : t("mysql.query.executeSelection")}
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => void handleExecuteAll()} disabled={loading || !sql.trim()}>
              {loading ? t("common.loading") : t("mysql.query.execute")}
            </button>
          </div>
        </div>
        <div style={{ padding: "12px 16px", position: "relative", display: "grid", gap: "12px", flex: "0 0 auto" }}>
          <div style={{ position: "relative", minHeight: "140px", height: "220px", display: "flex", flexDirection: "column", resize: "vertical", overflow: "hidden", zIndex: 0 }}>
            <div style={{ display: "flex", height: "100%", border: "1px solid #d1d1d6", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
              <div
                ref={lineNumberRef}
                aria-hidden="true"
                style={{
                  width: "46px",
                  flexShrink: 0,
                  background: "#f8fafc",
                  borderRight: "1px solid #e5e7eb",
                  fontFamily: "monospace",
                  fontSize: "12px",
                  lineHeight: 1.6,
                  color: "#94a3b8",
                  textAlign: "right",
                  padding: "12px 8px",
                  overflow: "hidden"
                }}
              >
                {lineNumbers.map((lineNumber) => (
                  <div
                    key={lineNumber}
                    style={{
                      color: editorErrorLine === lineNumber ? "#dc2626" : undefined,
                      fontWeight: editorErrorLine === lineNumber ? 700 : 400
                    }}
                  >
                    {lineNumber}
                  </div>
                ))}
              </div>
            <textarea
              ref={textareaRef}
              className="json-editor sql-query-editor-textarea"
              style={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                fontFamily: "monospace",
                fontSize: "13px",
                padding: "12px",
                border: 0,
                borderRadius: 0,
                resize: "none",
                marginBottom: 0,
                background: "#fff",
                lineHeight: 1.6
              }}
              value={sql}
              disabled={!currentActiveMysqlConnection || metaLoading}
              onChange={handleEditorChange}
              onClick={(e) => {
                const target = e.currentTarget;
                setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
              }}
              onKeyUp={(e) => {
                if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
                  return;
                }
                const target = e.currentTarget;
                setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
                updateAutocomplete(target.value, target.selectionStart);
              }}
              onSelect={(e) => {
                const target = e.currentTarget;
                setSelectionRange({ start: target.selectionStart, end: target.selectionEnd });
              }}
              onBlur={() => {
                window.setTimeout(() => setAutocompleteOpen(false), 120);
              }}
              onFocus={(e) => updateAutocomplete(e.currentTarget.value, e.currentTarget.selectionStart)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              onScroll={(event) => {
                if (lineNumberRef.current) {
                  lineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
                }
              }}
            />
            {/* Hidden element for measuring cursor position */}
            <pre
              ref={cursorMeasurerRef}
              aria-hidden="true"
              style={{
                position: "absolute",
                visibility: "hidden",
                height: "auto",
                fontFamily: "monospace",
                fontSize: "13px",
                lineHeight: 1.6,
                whiteSpace: "pre",
                pointerEvents: "none"
              }}
            />
            </div>
            {autocompleteOpen && autocompleteItems.length > 0 && (
              <div
                ref={autocompleteListRef}
                style={{
                  position: "fixed",
                  top: `${autocompletePosition.top}px`,
                  left: `${autocompletePosition.left}px`,
                  zIndex: 9999,
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  boxShadow: "0 12px 32px rgba(15,23,42,0.16), 0 0 0 1px rgba(0,0,0,0.03)",
                  overflow: "auto",
                  minWidth: "320px",
                  maxWidth: "640px",
                  maxHeight: "350px"
                }}
              >
              {autocompleteLoading && (
                <div style={{ padding: "6px 12px", fontSize: "11px", color: "#6b7280", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "12px", height: "12px", border: "2px solid #e5e7eb", borderTopColor: "#3b82f6", borderRadius: "50%", display: "inline-block", animation: "sql-spinner 0.6s linear infinite" }} />
                  Loading schema...
                </div>
              )}
              {(() => {
                // Render in sorted order, inserting group headers when type changes
                const typeLabels: Record<string, string> = {
                  keyword: "Keywords",
                  table: "Tables",
                  column: "Columns",
                  database: "Databases",
                };

                let lastType = "";
                return autocompleteItems.map((item, index) => {
                  const isActive = index === autocompleteIndex;
                  const typeIcon = item.type === "keyword"
                    ? <CodeOutlined style={{ fontSize: "11px" }} />
                    : item.type === "table"
                      ? <TableOutlined style={{ fontSize: "11px" }} />
                      : item.type === "column"
                        ? <FieldStringOutlined style={{ fontSize: "11px" }} />
                        : <DatabaseOutlined style={{ fontSize: "11px" }} />;

                  const typeColor = item.type === "keyword"
                    ? "#1d4ed8"
                    : item.type === "table"
                      ? "#047857"
                      : item.type === "column"
                        ? "#c2410c"
                        : "#4b5563";

                  const groupHeader = item.type !== lastType ? (
                    <div
                      key={`group-${item.type}-${index}`}
                      style={{
                        padding: "4px 12px",
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        borderBottom: "1px solid #f1f5f9",
                        background: "#fafbfc",
                      }}
                    >
                      {typeLabels[item.type]}
                    </div>
                  ) : null;

                  lastType = item.type;

                  return (
                    <Fragment key={`${item.type}-${item.label}-${index}`}>
                      {groupHeader}
                      <div
                        ref={(element) => {
                          autocompleteOptionRefs.current[index] = element;
                        }}
                        role="option"
                        aria-selected={isActive}
                        style={{
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "10px",
                          padding: "4px 12px",
                          border: 0,
                          background: isActive ? "#f0f7ff" : "#fff",
                          boxShadow: isActive ? "inset 0 0 0 1px #93c5fd" : "none",
                          cursor: "pointer",
                          textAlign: "left",
                          fontSize: "12px",
                          lineHeight: 1.5,
                          color: isActive ? "#0f172a" : "#1e293b",
                          transition: "background-color 100ms ease, box-shadow 100ms ease, color 100ms ease",
                        }}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          applyAutocomplete(item);
                        }}
                        onClick={() => applyAutocomplete(item)}
                        onMouseEnter={() => setAutocompleteIndex(index)}
                      >
                        <span style={{ display: "flex", gap: "8px", alignItems: "center", minWidth: 0, paddingRight: "8px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "22px",
                              height: "22px",
                              borderRadius: "5px",
                              background: item.type === "keyword" ? "#eff6ff"
                                : item.type === "table" ? "#ecfdf5"
                                  : item.type === "column" ? "#fff7ed" : "#f3f4f6",
                              color: typeColor,
                              flexShrink: 0,
                            }}
                          >
                            {typeIcon}
                          </span>
                          <span
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              fontWeight: isActive ? 600 : 400,
                              color: typeColor,
                            }}
                          >
                            {item.label}
                          </span>
                        </span>
                        {item.detail && (
                          <span
                            style={{
                              fontSize: "11px",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "160px",
                              flexShrink: 0,
                              color: isActive ? "#3b82f6" : "#94a3b8",
                              fontStyle: "italic",
                            }}
                          >
                            {item.detail}
                          </span>
                        )}
                      </div>
                    </Fragment>
                  );
                });
              })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-danger" style={{ marginBottom: "12px", padding: "8px 12px", background: "#fef2f2", borderRadius: "8px" }}>
          {t("mysql.query.executeFailed")} {error}
          {editorErrorLine ? <span style={{ marginLeft: "8px" }}>({t("mysql.query.errorLineHint", { line: editorErrorLine })})</span> : null}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div style={{ resize: "vertical", overflow: "auto", minHeight: "220px", height: "100%", flex: 1 }}>
          <div className="card" style={{ height: "100%", minHeight: "220px", display: "flex", flexDirection: "column", marginBottom: 0 }}>
            {results.length > 1 && (
              <div style={{ display: "flex", gap: "0", borderBottom: "1px solid #e5e7eb", overflowX: "auto", padding: "0 16px" }}>
                {results.map((item, index) => (
                  <div
                    key={item.id}
                    className={`btn btn-sm ${activeResult?.id === item.id ? "btn-primary" : "btn-ghost"}`}
                    style={{ borderRadius: "8px 8px 0 0", marginTop: "12px", marginRight: "8px", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: "6px", paddingRight: "6px" }}
                  >
                    <button
                      type="button"
                      style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 0 }}
                      onClick={() => setActiveResultId(item.id)}
                    >
                      {t("mysql.query.resultStatement", { index: index + 1 })}
                    </button>
                    <button
                      type="button"
                      style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
                      title={t("common.close")}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCloseResult(item.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {activeResult && (() => {
              const resultSet = activeResult.result;
              const visibleColumns = resultSet?.isResultSet ? getVisibleColumns(resultSet.columns, resultVisibleColumns[activeResult.id]) : [];
              return (
                <>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <h3 className="card-title">
                      {t("mysql.query.resultStatement", { index: results.findIndex((item) => item.id === activeResult.id) + 1 })}
                      <span className="muted" style={{ fontWeight: 400, fontSize: "13px", marginLeft: "8px" }}>
                        {activeResult.error
                          ? t("mysql.query.statementFailed")
                          : activeResult.mode === "explain"
                            ? t("mysql.query.explainMode")
                            : resultSet?.isResultSet
                              ? `(${resultSet.rows.length} rows)`
                              : t("mysql.query.affectedRows", { count: resultSet?.affectedRows ?? 0 })}
                      </span>
                    </h3>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {resultSet?.isResultSet && (
                        <>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={(e) => setSqlResultColumnMenu({ x: e.clientX, y: e.clientY })}
                          >
                            {t("mysql.tableManager.displayColumns")}
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => {
                              if (sqlResultSelectedCells.length > 0) {
                                handleSqlResultCopyRows();
                              } else {
                                copyToClipboard(JSON.stringify(resultSet.rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column, row[resultSet.columns.indexOf(column)]]))), null, 2));
                              }
                            }}
                          >
                            {sqlResultSelectedCells.length > 0 ? t("mysql.tableManager.copySelectedRows") : t("mysql.query.copyResult")}
                          </button>
                        </>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => void copyToClipboard(activeResult.sql)}>
                        {t("common.copy")}
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "0 16px 12px", display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
                    <span className="pill">{t("mysql.query.executionTime", { ms: activeResult.durationMs.toFixed(1) })}</span>
                    <span className="pill">{t("mysql.query.usedConnection", { name: activeResult.connectionName })}</span>
                    {activeResult.databaseUsed && <span className="pill">{t("mysql.query.usedDatabase", { name: activeResult.databaseUsed })}</span>}
                  </div>

                  {activeResult.error ? (
                    <div className="text-danger" style={{ margin: "0 16px 16px", padding: "8px 12px", background: "#fef2f2", borderRadius: "8px" }}>
                      {activeResult.error}
                    </div>
                  ) : resultSet?.isResultSet ? (
                    <div style={{ margin: "0 16px 16px", flex: 1, minHeight: 0 }}>
                      <ExcelLikeTable
                        key={activeResult.id}
                        columns={visibleColumns}
                        data={sqlResultData[activeResult.id] ?? resultSet.rows}
                        selectedCellKeySet={sqlResultSelectedCellKeySet}
                        selectedRowIndex={sqlResultSelectedRowIndex}
                        onCellClick={(e, ri, ci) => handleSqlResultCellClick(e, ri, ci, visibleColumns)}
                        onRowContextMenu={(e, ri, col, val) => handleSqlResultContextMenu(e, ri, col, val, visibleColumns)}
                        onSaveCell={handleSqlResultSaveCell}
                        columnTypes={(resultSet.columnTypes ?? []).map((t) => getDbTypeCategory(t))}
                        columnTypeLabels={resultSet.columnTypes ?? []}
                        tableKey={`sql-query:${activeResult.id}`}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: "24px", textAlign: "center" }}>
                      <div style={{ fontSize: "14px", color: "#22c55e" }}>
                        {t("mysql.query.statementDone")} {t("mysql.query.affectedRows", { count: resultSet?.affectedRows ?? 0 })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Context menus */}
            <SqlResultContextMenu
              menu={sqlResultRowContextMenu}
              selectedCellsCount={sqlResultSelectedCells.length}
              selectedRowsCount={sqlResultSelectedRowsCount}
              onCopyRows={handleSqlResultCopyRows}
              onCopyInsert={handleSqlResultCopyInsert}
              onCopyUpdate={handleSqlResultCopyUpdate}
              onFilterByValue={handleSqlResultFilterByValue}
              onSortAsc={handleSqlResultSortAsc}
              onSortDesc={handleSqlResultSortDesc}
            />
            <SqlResultColumnMenu
              menu={sqlResultColumnMenu}
              columns={activeResult?.result?.isResultSet ? activeResult.result.columns : []}
              visibleColumns={activeResult?.result?.isResultSet ? getSqlResultVisibleColumns(activeResult.result.columns) : []}
              onToggleColumn={toggleSqlResultColumn}
              onSelectAll={selectAllSqlResultColumns}
            />
          </div>
        </div>
      )}

      {results.length === 0 && !error && (
        <div className="card" style={{ padding: "32px", textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="muted">{t("mysql.query.empty")}</span>
        </div>
      )}

      {/* Query Generator Modal */}
      <QueryGeneratorModal
        isOpen={queryGeneratorOpen}
        databases={databases}
        tablesByDb={tablesByDb}
        columnMetaMap={columnMetaMap}
        selectedDatabase={selectedDatabase}
        onClose={() => setQueryGeneratorOpen(false)}
        onConfirm={(generatedSql) => {
          setSql(generatedSql);
          setQueryGeneratorOpen(false);
        }}
        onConfirmAndExecute={(generatedSql) => {
          setSql(generatedSql);
          setQueryGeneratorOpen(false);
          void executeStatements(generatedSql);
        }}
      />
    </div>
  );
}
