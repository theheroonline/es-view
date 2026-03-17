export interface MysqlCharsetOption {
  value: string;
  label: string;
  defaultCollation: string;
  collations: string[];
}

export const MYSQL_CHARSET_OPTIONS: MysqlCharsetOption[] = [
  {
    value: "utf8mb4",
    label: "utf8mb4 (UTF-8 Unicode)",
    defaultCollation: "utf8mb4_0900_ai_ci",
    collations: [
      "utf8mb4_0900_ai_ci",
      "utf8mb4_0900_as_cs",
      "utf8mb4_general_ci",
      "utf8mb4_unicode_ci",
      "utf8mb4_unicode_520_ci",
      "utf8mb4_bin",
    ],
  },
  {
    value: "utf8mb3",
    label: "utf8mb3 (Legacy UTF-8)",
    defaultCollation: "utf8mb3_general_ci",
    collations: ["utf8mb3_general_ci", "utf8mb3_unicode_ci", "utf8mb3_bin"],
  },
  {
    value: "latin1",
    label: "latin1 (West European)",
    defaultCollation: "latin1_swedish_ci",
    collations: ["latin1_swedish_ci", "latin1_general_ci", "latin1_general_cs", "latin1_bin"],
  },
  {
    value: "ascii",
    label: "ascii",
    defaultCollation: "ascii_general_ci",
    collations: ["ascii_general_ci", "ascii_bin"],
  },
  {
    value: "gbk",
    label: "gbk (Simplified Chinese)",
    defaultCollation: "gbk_chinese_ci",
    collations: ["gbk_chinese_ci", "gbk_bin"],
  },
  {
    value: "gb18030",
    label: "gb18030 (Chinese National Standard)",
    defaultCollation: "gb18030_chinese_ci",
    collations: ["gb18030_chinese_ci", "gb18030_bin"],
  },
  {
    value: "big5",
    label: "big5 (Traditional Chinese)",
    defaultCollation: "big5_chinese_ci",
    collations: ["big5_chinese_ci", "big5_bin"],
  },
  {
    value: "binary",
    label: "binary",
    defaultCollation: "binary",
    collations: ["binary"],
  },
];

export const getCharsetOption = (charset: string) =>
  MYSQL_CHARSET_OPTIONS.find((item) => item.value === charset) ?? MYSQL_CHARSET_OPTIONS[0];