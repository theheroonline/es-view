import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { format as formatSql } from "sql-formatter";
import { logError } from "../../../lib/errorLog";
import { useMysqlContext } from "../../../state/MysqlContext";
import { useSharedConnectionState } from "../../../state/SharedConnectionState";
import { mysqlConnect } from "../services/connectionClient";
import { mysqlListDatabases, mysqlListTables, mysqlQuery } from "../services/queryClient";
import { mysqlDescribeTable } from "../services/schemaClient";
import QueryGeneratorModal from "../components/QueryGeneratorModal";
import type { ExecutedStatementResult, ColumnMeta } from "../types";

interface AutocompleteItem {
  label: string;
  insertText: string;
  type: "keyword" | "table" | "column" | "database";
  detail?: string;
  weight?: number;
}

type AutocompleteContext = "mixed" | "keyword" | "table" | "column" | "database";

const MYSQL_KEYWORDS = [
  // 常用关键词（权重 10）
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
  { keyword: "AS", weight: 8 },

  // 次常用关键词（权重 6-8）
  { keyword: "INSERT INTO", weight: 7 },
  { keyword: "UPDATE", weight: 7 },
  { keyword: "DELETE FROM", weight: 7 },
  { keyword: "CREATE TABLE", weight: 6 },
  { keyword: "ALTER TABLE", weight: 6 },
  { keyword: "DESCRIBE", weight: 6 },
  { keyword: "INNER JOIN", weight: 6 },
  { keyword: "RIGHT JOIN", weight: 6 },
  { keyword: "CASE", weight: 6 },
  { keyword: "WHEN", weight: 6 },
  { keyword: "THEN", weight: 6 },
  { keyword: "END", weight: 6 },
  { keyword: "NULL", weight: 7 },
  { keyword: "IN", weight: 7 },
  { keyword: "IS", weight: 7 },
  { keyword: "COUNT", weight: 7 },
  { keyword: "SUM", weight: 7 },
  { keyword: "AVG", weight: 7 },
  { keyword: "MIN", weight: 7 },
  { keyword: "MAX", weight: 7 },
  { keyword: "IFNULL", weight: 7 },
  { keyword: "LENGTH", weight: 7 },

  // 不常用关键词（权重 3-5）
  { keyword: "DROP TABLE", weight: 5 },
  { keyword: "SHOW TABLES", weight: 5 },
  { keyword: "USE", weight: 5 },
  { keyword: "EXPLAIN", weight: 5 },
  { keyword: "TRUNCATE", weight: 4 },
  { keyword: "IF", weight: 4 },
  { keyword: "ELSE", weight: 4 },
  { keyword: "NOT", weight: 4 },
  { keyword: "LIKE", weight: 4 },
  { keyword: "BETWEEN", weight: 3 },
  { keyword: "UNION", weight: 3 },
  { keyword: "ALL", weight: 3 },
  { keyword: "DISTINCT", weight: 3 },
  { keyword: "HAVING", weight: 3 },
  { keyword: "VALUES", weight: 3 },
  { keyword: "SET", weight: 3 },
  { keyword: "PRIMARY KEY", weight: 3 },
  { keyword: "FOREIGN KEY", weight: 3 },
  { keyword: "AUTO_INCREMENT", weight: 3 },
  { keyword: "DEFAULT", weight: 3 },

  // 函数和特殊关键词（权重 1-2）
  { keyword: "CURRENT_TIMESTAMP", weight: 2 },
  { keyword: "NOW()", weight: 2 },
  { keyword: "EXISTS", weight: 2 },
  { keyword: "ANY", weight: 2 },
  { keyword: "SOME", weight: 2 },
  { keyword: "ASC", weight: 2 },
  { keyword: "DESC", weight: 2 },
  { keyword: "COALESCE", weight: 1 },
  { keyword: "CAST", weight: 1 },
  { keyword: "CONVERT", weight: 1 },
  { keyword: "DATABASE()", weight: 1 },
  { keyword: "VERSION()", weight: 1 },
  { keyword: "CHAR_LENGTH", weight: 1 },
  { keyword: "SUBSTRING", weight: 1 },
  { keyword: "CONCAT", weight: 1 },
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
  const autocompleteOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
  const [loadedConnectionId, setLoadedConnectionId] = useState<string | null>(null);
  const [connectedDatabaseId, setConnectedDatabaseId] = useState<string | null>(null);
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [resultVisibleColumns, setResultVisibleColumns] = useState<Record<string, string[]>>({});
  const [expandedRowsByResult, setExpandedRowsByResult] = useState<Record<string, Set<number>>>({});
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });

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

    const columnItems = Object.entries(columnMap).flatMap(([table, columns]) =>
      columns.map((column) => ({
        label: column,
        insertText: column,
        type: "column" as const,
        detail: table
      }))
    );

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
    const scrollTop = textarea.scrollTop;

    // 计算光标在文本中的行列
    const textBeforeCursor = sql.slice(0, selectionRange.start);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length;

    // 计算实际像素位置
    const lineHeight = 13 * 1.6;
    const charWidth = 7.8;

    // 相对于 textarea 内部的位置
    const relativeTop = (currentLine - 1) * lineHeight + lineHeight;
    const relativeLeft = 46 + 12 + currentCol * charWidth; // 46px 行号 + 12px padding + 列偏移

    // 相对于视口的位置（考虑 textarea 滚动）
    const absoluteTop = rect.top + relativeTop - scrollTop + 4; // 光标下方 4px
    const absoluteLeft = rect.left + relativeLeft;

    // 防止超出视口
    const maxLeft = window.innerWidth - 300; // 预留最小宽度空间
    const finalLeft = Math.min(absoluteLeft, maxLeft);

    setAutocompletePosition({
      top: absoluteTop,
      left: finalLeft
    });

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

        const missingTables = tables.filter((table) => !columnMap[table]);
        if (missingTables.length === 0) return;

        // Single query pass - fetch metadata once per table
        const metaEntries = await Promise.all(
          missingTables.map(async (table) => {
            const columnMetas = await mysqlDescribeTable(connectionId, selectedDatabase, table);
            return [table, columnMetas] as const;
          })
        );

        // Derive column names from metadata
        const entries = metaEntries.map(([table, metas]) =>
          [table, metas.map((meta) => meta.field)] as const
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
      }
    }

    void loadTablesAndColumns();
  }, [columnMap, connectionId, selectedDatabase, setTablesByDb, tablesByDb]);

  const updateAutocomplete = (nextSql: string, caretPosition: number) => {
    const { start, end, token } = getTokenRange(nextSql, caretPosition);
    const normalized = token.trim().toLowerCase();
    const lookupToken = normalized.split(".").pop() ?? normalized;
    const context = detectAutocompleteContext(nextSql, caretPosition);
    if (!normalized) {
      setAutocompleteOpen(false);
      setAutocompleteItems([]);
      return;
    }

    // 根据上下文智能过滤
    let contextFiltered = autocompleteSource.filter((item) => {
      // database 上下文：只显示数据库
      if (context === "database") {
        return item.type === "database";
      }
      // table 上下文：只显示表和关键词
      if (context === "table") {
        return item.type === "table" || item.type === "keyword";
      }
      // column 上下文：只显示列、关键词和函数
      if (context === "column") {
        return item.type === "column" || item.type === "keyword";
      }
      // mixed 上下文：全部显示
      return true;
    });

    const filtered = contextFiltered
      .filter((item) => item.label.toLowerCase().includes(lookupToken))
      .sort((left, right) => {
        const leftStarts = left.label.toLowerCase().startsWith(lookupToken) ? 0 : 1;
        const rightStarts = right.label.toLowerCase().startsWith(lookupToken) ? 0 : 1;
        const typeDiff = getTypePriority(context, left.type) - getTypePriority(context, right.type);
        if (typeDiff !== 0) return typeDiff;
        if (leftStarts !== rightStarts) return leftStarts - rightStarts;
        // 如果都是关键词，按权重排序（权重高的在前）
        if (left.type === "keyword" && right.type === "keyword") {
          const weightDiff = (right.weight ?? 0) - (left.weight ?? 0);
          if (weightDiff !== 0) return weightDiff;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, 12);

    setAutocompleteRange({ start, end });
    setAutocompleteItems(filtered);
    setAutocompleteIndex(0);
    setAutocompleteOpen(filtered.length > 0);
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
      await setActiveConnection(nextConnectionId);
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
    setExpandedRowsByResult((prevExpanded) => {
      const nextExpanded = { ...prevExpanded };
      delete nextExpanded[resultId];
      return nextExpanded;
    });
  };

  const toggleResultRowExpand = (resultId: string, rowIndex: number) => {
    setExpandedRowsByResult((prev) => {
      const next = { ...prev };
      const expandedSet = new Set(next[resultId] ?? []);
      if (expandedSet.has(rowIndex)) {
        expandedSet.delete(rowIndex);
      } else {
        expandedSet.add(rowIndex);
      }
      next[resultId] = expandedSet;
      return next;
    });
  };

  const renderResultCellValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="muted">NULL</span>;
    }

    const content = typeof value === "object" ? JSON.stringify(value) : String(value);
    const shouldTruncate = content.length > 80;
    const preview = shouldTruncate ? `${content.slice(0, 80)}...` : content;

    return (
      <span className="truncated-cell" title={content} data-truncated={shouldTruncate ? "true" : "false"}>
        <span className="truncated-text">{preview}</span>
      </span>
    );
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    setSql(nextValue);
    setSelectionRange({ start: event.target.selectionStart, end: event.target.selectionEnd });
    updateAutocomplete(nextValue, event.target.selectionStart);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  boxShadow: "0 10px 28px rgba(15,23,42,0.14)",
                  overflow: "auto",
                  minWidth: "260px",
                  maxWidth: "600px",
                  maxHeight: "200px"
                }}
              >
              {autocompleteItems.map((item, index) => (
                <button
                  key={`${item.type}-${item.label}-${index}`}
                  type="button"
                  ref={(element) => {
                    autocompleteOptionRefs.current[index] = element;
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "3px 8px",
                    border: 0,
                    background: index === autocompleteIndex ? "#dbeafe" : "#fff",
                    boxShadow: index === autocompleteIndex ? "inset 0 0 0 1px #60a5fa" : "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "11px",
                    lineHeight: 1.3,
                    color: index === autocompleteIndex ? "#0f172a" : "#1f2937",
                    transition: "background-color 120ms ease, box-shadow 120ms ease, color 120ms ease"
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyAutocomplete(item);
                  }}
                  onMouseEnter={() => setAutocompleteIndex(index)}
                >
                  <span style={{ display: "flex", gap: "8px", alignItems: "center", minWidth: 0, paddingRight: "8px" }}>
                    <span
                      style={{
                        fontSize: "9px",
                        lineHeight: 1,
                        padding: "2px 3px",
                        borderRadius: "4px",
                        background: item.type === "keyword" ? "#eff6ff" : item.type === "table" ? "#ecfdf5" : item.type === "column" ? "#fff7ed" : "#f3f4f6",
                        color: item.type === "keyword" ? "#1d4ed8" : item.type === "table" ? "#047857" : item.type === "column" ? "#c2410c" : "#4b5563",
                        textTransform: "uppercase",
                        flexShrink: 0
                      }}
                    >
                      {item.type === "keyword" ? "K" : item.type === "table" ? "T" : item.type === "column" ? "C" : "DB"}
                    </span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: index === autocompleteIndex ? 600 : 500 }}>{item.label}</span>
                  </span>
                  <span className="muted" style={{ fontSize: "10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px", flexShrink: 0, color: index === autocompleteIndex ? "#1d4ed8" : "#6b7280" }}>
                    {item.detail}
                  </span>
                </button>
              ))}
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
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => void copyToClipboard(JSON.stringify(resultSet.rows.map((row) => Object.fromEntries(visibleColumns.map((column) => [column, row[resultSet.columns.indexOf(column)]]))), null, 2))}
                        >
                          {t("mysql.query.copyResult")}
                        </button>
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
                    <div className="table-wrapper" style={{ margin: "0 16px 16px", flex: 1, minHeight: 0 }}>
                      <table className="table">
                        <thead style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10 }}>
                          <tr>
                            <th style={{ width: "48px", textAlign: "center" }}> </th>
                            {visibleColumns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultSet.rows.length > 0 ? resultSet.rows.map((row, rowIndex) => {
                            const expandedRows = expandedRowsByResult[activeResult.id] ?? new Set<number>();
                            const isExpanded = expandedRows.has(rowIndex);
                            const detailObject = Object.fromEntries(
                              visibleColumns.map((column) => [column, row[resultSet.columns.indexOf(column)]])
                            );

                            return (
                              <Fragment key={`${activeResult.id}-${rowIndex}`}>
                                <tr>
                                  <td style={{ textAlign: "center" }}>
                                    <button
                                      className="btn btn-ghost btn-icon"
                                      onClick={() => toggleResultRowExpand(activeResult.id, rowIndex)}
                                      style={{ fontSize: "10px", padding: "2px 6px" }}
                                      title={isExpanded ? t("dataBrowser.collapseRow") : t("dataBrowser.expandRow")}
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                  </td>
                                  {visibleColumns.map((column) => (
                                    <td key={`${rowIndex}-${column}`}>
                                      {renderResultCellValue(row[resultSet.columns.indexOf(column)])}
                                    </td>
                                  ))}
                                </tr>
                                {isExpanded && (
                                  <tr className="expanded-row">
                                    <td colSpan={visibleColumns.length + 1} style={{ background: "#f8fafc", padding: "12px 16px" }}>
                                      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                                        <button
                                          className="btn btn-sm btn-ghost"
                                          onClick={() => void copyToClipboard(JSON.stringify(detailObject, null, 2))}
                                        >
                                          {t("dataBrowser.copyRow")}
                                        </button>
                                      </div>
                                      <pre style={{ margin: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                        {JSON.stringify(detailObject, null, 2)}
                                      </pre>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          }) : (
                            <tr>
                              <td colSpan={visibleColumns.length + 1} className="muted" style={{ textAlign: "center", padding: "32px" }}>
                                {t("mysql.query.noRows")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
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
