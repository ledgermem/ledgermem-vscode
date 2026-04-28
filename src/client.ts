import * as vscode from "vscode";
import { LedgerMemClient } from "@ledgermem/memory";
import { EXTENSION_ID } from "./extension";

export interface LedgerMemConfig {
  apiKey: string;
  workspaceId: string;
  defaultLimit: number;
  endpoint: string;
}

export interface Memory {
  id: string;
  content: string;
  createdAt: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

export interface ClientHandle {
  readonly config: LedgerMemConfig;
  /** Force a fresh read of settings + secrets and return the latest snapshot. */
  refreshConfig(): Promise<LedgerMemConfig>;
  search(query: string, limit?: number): Promise<readonly Memory[]>;
  add(content: string, metadata?: Record<string, unknown>): Promise<Memory>;
  delete(id: string): Promise<void>;
  recent(limit?: number): Promise<readonly Memory[]>;
}

const SECRET_API_KEY = "ledgermem.apiKey";

async function readConfig(secrets?: vscode.SecretStorage): Promise<LedgerMemConfig> {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  // Prefer SecretStorage; fall back to settings only as a one-time migration source.
  const secretKey = secrets ? await secrets.get(SECRET_API_KEY) : undefined;
  const settingKey = cfg.get<string>("apiKey", "");
  const apiKey = secretKey ?? settingKey ?? "";
  return {
    apiKey,
    workspaceId: cfg.get<string>("workspaceId", ""),
    defaultLimit: cfg.get<number>("defaultLimit", 10),
    endpoint: cfg.get<string>("endpoint", "https://api.ledgermem.dev"),
  };
}

export function createClient(secrets?: vscode.SecretStorage): ClientHandle {
  // Re-read config on every call so settings changes take effect immediately.
  let cachedConfig: LedgerMemConfig = {
    apiKey: "",
    workspaceId: "",
    defaultLimit: 10,
    endpoint: "https://api.ledgermem.dev",
  };
  // Refresh cache eagerly; getters expose the latest snapshot synchronously.
  const refresh = async (): Promise<LedgerMemConfig> => {
    cachedConfig = await readConfig(secrets);
    return cachedConfig;
  };
  void refresh();
  const handle: ClientHandle = {
    get config(): LedgerMemConfig {
      return cachedConfig;
    },
    refreshConfig: refresh,
    async search(query: string, limit?: number): Promise<readonly Memory[]> {
      const cfg = await refresh();
      assertConfigured(cfg);
      const sdk = new LedgerMemClient({ apiKey: cfg.apiKey, baseUrl: cfg.endpoint });
      const results = await sdk.search({
        query,
        workspaceId: cfg.workspaceId,
        limit: limit ?? cfg.defaultLimit,
      });
      return results.map(toMemory);
    },
    async add(content: string, metadata?: Record<string, unknown>): Promise<Memory> {
      const cfg = await refresh();
      assertConfigured(cfg);
      const sdk = new LedgerMemClient({ apiKey: cfg.apiKey, baseUrl: cfg.endpoint });
      const created = await sdk.add({
        content,
        workspaceId: cfg.workspaceId,
        metadata: metadata ?? {},
      });
      return toMemory(created);
    },
    async delete(id: string): Promise<void> {
      const cfg = await refresh();
      assertConfigured(cfg);
      const sdk = new LedgerMemClient({ apiKey: cfg.apiKey, baseUrl: cfg.endpoint });
      await sdk.delete({ id, workspaceId: cfg.workspaceId });
    },
    async recent(limit?: number): Promise<readonly Memory[]> {
      const cfg = await refresh();
      assertConfigured(cfg);
      const sdk = new LedgerMemClient({ apiKey: cfg.apiKey, baseUrl: cfg.endpoint });
      const results = await sdk.list({
        workspaceId: cfg.workspaceId,
        limit: limit ?? cfg.defaultLimit,
        orderBy: "createdAt",
        order: "desc",
      });
      return results.map(toMemory);
    },
  };
  return handle;
}

function assertConfigured(cfg: LedgerMemConfig): void {
  if (!cfg.apiKey) {
    throw new Error(
      "LedgerMem API key is not set. Run 'LedgerMem: Set API Key' to store it securely.",
    );
  }
  if (!cfg.workspaceId) {
    throw new Error(
      "LedgerMem workspace ID is not set. Open Settings and configure 'ledgermem.workspaceId'.",
    );
  }
}

function toMemory(raw: unknown): Memory {
  const r = raw as Record<string, unknown>;
  return {
    id: String(r.id ?? ""),
    content: String(r.content ?? ""),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    score: typeof r.score === "number" ? r.score : undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? undefined,
  };
}
