import * as vscode from "vscode";
import { ClientHandle, Memory } from "./client";
import { MnemoSidebarProvider, MemoryTreeItem } from "./sidebar";

interface MemoryQuickPickItem extends vscode.QuickPickItem {
  memory: Memory;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  client: ClientHandle,
  sidebar: MnemoSidebarProvider,
  output: vscode.OutputChannel,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("getmnemo.search", () =>
      runSearch(client, output),
    ),
    vscode.commands.registerCommand("getmnemo.add", () =>
      runAddSelection(client, sidebar, output),
    ),
    vscode.commands.registerCommand("getmnemo.deleteMemory", (item?: MemoryTreeItem) =>
      runDelete(client, sidebar, output, item),
    ),
    vscode.commands.registerCommand("getmnemo.refresh", () => sidebar.refresh()),
    vscode.commands.registerCommand("getmnemo.openMemory", (memory: Memory) =>
      openMemoryInEditor(memory),
    ),
  );
}

async function runSearch(
  client: ClientHandle,
  output: vscode.OutputChannel,
): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: "Search Mnemo",
    placeHolder: "what did I learn about pgvector tuning?",
    ignoreFocusOut: true,
  });
  if (!query) {
    return;
  }
  try {
    const results = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Searching Mnemo..." },
      () => client.search(query),
    );
    if (results.length === 0) {
      vscode.window.showInformationMessage("No matches found.");
      return;
    }
    const picks: MemoryQuickPickItem[] = results.map((memory) => ({
      label: trimLabel(memory.content),
      description: memory.score !== undefined ? `score ${memory.score.toFixed(2)}` : "",
      detail: memory.content,
      memory,
    }));
    const selected = await vscode.window.showQuickPick(picks, {
      matchOnDetail: true,
      placeHolder: `${results.length} result(s)`,
    });
    if (selected) {
      await openMemoryInEditor(selected.memory);
    }
  } catch (err) {
    reportError(output, "search", err);
  }
}

async function runAddSelection(
  client: ClientHandle,
  sidebar: MnemoSidebarProvider,
  output: vscode.OutputChannel,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a file and select text to add to memory.");
    return;
  }
  const selection = editor.document.getText(editor.selection).trim();
  if (!selection) {
    vscode.window.showWarningMessage("Select some text first.");
    return;
  }
  try {
    const memory = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Adding to Mnemo..." },
      () =>
        client.add(selection, {
          source: "vscode",
          file: editor.document.uri.fsPath,
          language: editor.document.languageId,
          line: editor.selection.start.line + 1,
        }),
    );
    sidebar.refresh();
    vscode.window.showInformationMessage(`Saved memory ${memory.id.slice(0, 8)}.`);
  } catch (err) {
    reportError(output, "add", err);
  }
}

async function runDelete(
  client: ClientHandle,
  sidebar: MnemoSidebarProvider,
  output: vscode.OutputChannel,
  item?: MemoryTreeItem,
): Promise<void> {
  let id = item?.memory.id;
  if (!id) {
    id = await vscode.window.showInputBox({
      prompt: "Memory ID to delete",
      ignoreFocusOut: true,
    });
  }
  if (!id) {
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `Delete memory ${id.slice(0, 8)}? This cannot be undone.`,
    { modal: true },
    "Delete",
  );
  if (confirm !== "Delete") {
    return;
  }
  try {
    await client.delete(id);
    sidebar.refresh();
    vscode.window.showInformationMessage("Memory deleted.");
  } catch (err) {
    reportError(output, "delete", err);
  }
}

async function openMemoryInEditor(memory: Memory): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    content: memory.content,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}

function trimLabel(content: string): string {
  const firstLine = content.split("\n", 1)[0] ?? "";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function reportError(output: vscode.OutputChannel, op: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  output.appendLine(`[${op}] ${message}`);
  vscode.window.showErrorMessage(`Mnemo ${op} failed: ${message}`);
}
