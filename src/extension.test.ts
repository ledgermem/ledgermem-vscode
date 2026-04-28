import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the vscode API surface we touch.
vi.mock("vscode", () => {
  const subscriptions: unknown[] = [];
  return {
    EventEmitter: class<T> {
      public readonly listeners: ((value: T | undefined) => void)[] = [];
      public readonly event = (fn: (v: T | undefined) => void): void => {
        this.listeners.push(fn);
      };
      public fire(value: T | undefined): void {
        this.listeners.forEach((fn) => fn(value));
      }
    },
    TreeItem: class {
      constructor(
        public label: string,
        public collapsibleState: number,
      ) {}
    },
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon: class {
      constructor(public readonly id: string) {}
    },
    Uri: { parse: (s: string): { toString: () => string } => ({ toString: () => s }) },
    workspace: {
      getConfiguration: () => ({
        get: <T>(_key: string, fallback: T): T => fallback,
        update: vi.fn(async () => undefined),
      }),
      onDidChangeConfiguration: (): { dispose: () => void } => ({ dispose: (): void => {} }),
      openTextDocument: vi.fn(),
    },
    window: {
      createOutputChannel: () => ({
        appendLine: vi.fn(),
        dispose: vi.fn(),
      }),
      createTreeView: () => ({ dispose: vi.fn() }),
      showInputBox: vi.fn(),
      showQuickPick: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      withProgress: <T>(_opts: unknown, fn: () => Promise<T>): Promise<T> => fn(),
      activeTextEditor: undefined,
      showTextDocument: vi.fn(),
    },
    commands: {
      registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    },
    ProgressLocation: { Notification: 15 },
    ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
    ExtensionContext: class {
      public subscriptions = subscriptions;
    },
  };
});

vi.mock("@ledgermem/memory", () => {
  return {
    LedgerMemClient: class {
      async search(): Promise<unknown[]> {
        return [{ id: "m1", content: "result A", createdAt: "2026-01-01" }];
      }
      async add(args: { content: string }): Promise<unknown> {
        return { id: "m2", content: args.content, createdAt: "2026-01-01" };
      }
      async list(): Promise<unknown[]> {
        return [{ id: "m3", content: "recent A", createdAt: "2026-01-01" }];
      }
      async delete(): Promise<void> {
        // no-op
      }
    },
  };
});

import * as vscode from "vscode";
import { activate, deactivate } from "./extension";
import { createClient } from "./client";

describe("extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("activates without throwing", () => {
    const ctx = {
      subscriptions: [],
      secrets: {
        get: vi.fn(async () => undefined),
        store: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        onDidChange: () => ({ dispose: (): void => {} }),
      },
    } as unknown as vscode.ExtensionContext;
    expect(() => activate(ctx)).not.toThrow();
    expect(ctx.subscriptions.length).toBeGreaterThan(0);
  });

  it("deactivates cleanly", () => {
    expect(() => deactivate()).not.toThrow();
  });
});

describe("client", () => {
  it("throws when API key is missing", async () => {
    const c = createClient();
    await expect(c.search("hello")).rejects.toThrow(/API key/);
  });
});
