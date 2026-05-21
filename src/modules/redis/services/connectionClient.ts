import { logError } from "../../../lib/errorLog";
import type { RedisConnection } from "../types";
import { invokeRedis, requireRedisDesktopMode } from "./runtime";

export async function redisConnect(connection: RedisConnection): Promise<void> {
  await requireRedisDesktopMode();
  try {
    const sshAuthMethod = connection.ssh?.authMethod ?? "password";
    await invokeRedis<void>("redis_connect", {
      connectionId: connection.id,
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username || undefined,
      password: connection.password || undefined,
      sshEnabled: connection.ssh?.enabled ?? false,
      sshHost: connection.ssh?.host ?? "",
      sshPort: connection.ssh?.port ?? 22,
      sshUsername: connection.ssh?.username ?? "",
      sshPassword: connection.sshPassword ?? "",
      // SSH key auth
      sshPrivateKeyPath: (sshAuthMethod === "key" ? connection.ssh?.privateKeyPath : "") ?? "",
      sshPrivateKeyPem: (sshAuthMethod === "key" ? connection.ssh?.privateKeyPem : "") ?? "",
      sshPassphrase: connection.ssh?.passphrase ?? "",
      sshUseAgent: sshAuthMethod === "agent",
      // Host key verification
      sshHostKeyMode: connection.ssh?.hostKeyMode ?? "accept-new",
      sshKnownHostsPath: connection.ssh?.knownHostsPath ?? "",
      // TLS
      tlsMode: connection.tlsMode ?? "",
      tlsCaCertPath: connection.tlsCaCertPath ?? "",
      tlsClientCertPath: connection.tlsClientCertPath ?? "",
      tlsClientKeyPath: connection.tlsClientKeyPath ?? "",
    }, {
      errorMessage: `Redis connect failed for ${connection.name}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.connect",
      message: `Failed to connect to Redis ${connection.name}`
    });
    throw error;
  }
}

export async function redisDisconnect(connectionId: string): Promise<void> {
  await requireRedisDesktopMode();
  try {
    await invokeRedis<void>("redis_disconnect", { connectionId }, {
      errorMessage: `Redis disconnect failed for ${connectionId}`,
    });
  } catch (error) {
    logError(error, {
      source: "redisClient.disconnect",
      message: `Failed to disconnect Redis connection ${connectionId}`
    });
    throw error;
  }
}
