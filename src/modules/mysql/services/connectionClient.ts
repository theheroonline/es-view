import { logError } from "../../../lib/errorLog";
import type { MysqlConnection } from "../types";
import { invokeMysql, requireMysqlDesktopMode } from "./runtime";

export async function mysqlConnect(connection: MysqlConnection): Promise<void> {
  await requireMysqlDesktopMode();
  try {
    await invokeMysql<void>("mysql_connect", {
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
      username: connection.username ?? "",
      password: connection.password ?? "",
      database: connection.database || undefined,
      sshEnabled: connection.ssh?.enabled ?? false,
      sshHost: connection.ssh?.host ?? "",
      sshPort: connection.ssh?.port ?? 22,
      sshUsername: connection.ssh?.username ?? "",
      sshPassword: connection.sshPassword ?? "",
    });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.connect",
      message: `Failed to connect to MySQL ${connection.name}`
    });
    throw error;
  }
}

export async function mysqlDisconnect(connectionId: string): Promise<void> {
  await requireMysqlDesktopMode();
  try {
    await invokeMysql<void>("mysql_disconnect", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.disconnect",
      message: `Failed to disconnect MySQL connection ${connectionId}`
    });
    throw error;
  }
}

export async function mysqlPing(connectionId: string): Promise<void> {
  await requireMysqlDesktopMode();
  try {
    await invokeMysql<void>("mysql_ping", { connectionId });
  } catch (error) {
    logError(error, {
      source: "mysqlClient.ping",
      message: `Failed to ping MySQL connection ${connectionId}`
    });
    throw error;
  }
}