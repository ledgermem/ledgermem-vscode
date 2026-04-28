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
      command: "ledgermem.openMemory",
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

export class LedgerMemSidebarProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly client: ClientHandle) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }
    if (!this.client.config.apiKey || !this.client.config.workspaceId) {
      return [new StatusItem("Configure ledgermem.apiKey and ledgermem.workspaceId in Settings.")];
    }
    try {
      const memories = await this.client.recent();
      if (memories.length === 0) {
        return [new StatusItem("No memories yet — use 'LedgerMem: Add Selection' to start.")];
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
