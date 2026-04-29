import * as vscode from "vscode";
import { ClientHandle, Memory } from "./client";

export class MemoryTreeItem extends vscode.TreeItem {
  constructor(public readonly memory: Memory) {
    super(formatLabel(memory), vscode.TreeItemCollapsibleState.None);
    this.id = memory.id;
    this.tooltip = memory.content;
    this.description = formatDescription(memory);
    this.contextValue = "memory";
    this.iconPath = new vscode.ThemeIcon("note");
    this.command = {
      command: "getmnemo.openMemory",
      title: "Open Memory",
      arguments: [memory],
    };
  }
}

class StatusItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon("info");
    this.contextValue = "status";
  }
}

export class MnemoSidebarProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly client: ClientHandle) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  // Implement Disposable so the EventEmitter is torn down when the extension
  // host unloads or the user disables the extension. Without this the emitter
  // leaks across reloads (e.g. when the user reloads the window during dev).
  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }
    // Force a fresh read of settings + SecretStorage. The cached snapshot
    // exposed by `client.config` is populated asynchronously after activate(),
    // so the very first getChildren() call (which VS Code makes before that
    // promise resolves) used to see an empty config and tell the user to
    // configure the extension even when it was already configured.
    const config = await this.client.refreshConfig();
    if (!config.apiKey || !config.workspaceId) {
      return [new StatusItem("Configure getmnemo.apiKey and getmnemo.workspaceId in Settings.")];
    }
    try {
      const memories = await this.client.recent();
      if (memories.length === 0) {
        return [new StatusItem("No memories yet — use 'Mnemo: Add Selection' to start.")];
      }
      return memories.map((m) => new MemoryTreeItem(m));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [new StatusItem(`Error: ${msg}`)];
    }
  }
}

function formatLabel(memory: Memory): string {
  const first = memory.content.split("\n", 1)[0] ?? "";
  return first.length > 60 ? `${first.slice(0, 57)}...` : first || "(empty)";
}

function formatDescription(memory: Memory): string {
  const date = new Date(memory.createdAt);
  if (Number.isNaN(date.getTime())) {
    return memory.id.slice(0, 8);
  }
  return date.toLocaleDateString();
}
