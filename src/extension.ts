import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { LedgerMemSidebarProvider } from "./sidebar";
import { createClient } from "./client";

export const EXTENSION_ID = "ledgermem";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("LedgerMem");
  output.appendLine("LedgerMem extension activated.");

  const client = createClient(context.secrets);

  const sidebarProvider = new LedgerMemSidebarProvider(client);
  const treeView = vscode.window.createTreeView("ledgermem.recentMemories", {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false,
  });
  // Register the provider as a disposable too — its internal EventEmitter
  // would otherwise leak across extension reloads.
  context.subscriptions.push(treeView, sidebarProvider);

  registerCommands(context, client, sidebarProvider, output);

  // Migrate any plain-text API key from settings to SecretStorage on activation.
  void migrateApiKeyToSecrets(context).catch((err: unknown) => {
    output.appendLine(`migration: ${err instanceof Error ? err.message : String(err)}`);
  });

  // Set API Key command — stores in SecretStorage.
  context.subscriptions.push(
    vscode.commands.registerCommand("ledgermem.setApiKey", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Enter LedgerMem API key",
        password: true,
        ignoreFocusOut: true,
      });
      if (value === undefined) {
        return;
      }
      if (value.length === 0) {
        await context.secrets.delete("ledgermem.apiKey");
        vscode.window.showInformationMessage("LedgerMem API key cleared.");
      } else {
        await context.secrets.store("ledgermem.apiKey", value);
        vscode.window.showInformationMessage("LedgerMem API key saved to secret storage.");
      }
      sidebarProvider.refresh();
    }),
  );

  // React to settings changes — rebuild the client with fresh config.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(EXTENSION_ID)) {
        sidebarProvider.refresh();
      }
    }),
  );

  // React to secret changes (e.g., another window updates the key).
  context.subscriptions.push(
    context.secrets.onDidChange((event) => {
      if (event.key === "ledgermem.apiKey") {
        sidebarProvider.refresh();
      }
    }),
  );

  context.subscriptions.push(output);
}

export function deactivate(): void {
  // Connections are short-lived HTTPS calls — nothing to tear down.
}

async function migrateApiKeyToSecrets(context: vscode.ExtensionContext): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(EXTENSION_ID);
  const inspected = cfg.inspect<string>("apiKey");
  const candidate =
    inspected?.workspaceFolderValue ??
    inspected?.workspaceValue ??
    inspected?.globalValue ??
    "";
  if (!candidate) {
    return;
  }
  const existing = await context.secrets.get("ledgermem.apiKey");
  if (!existing) {
    await context.secrets.store("ledgermem.apiKey", candidate);
  }
  // Clear the plaintext setting from EVERY scope it appears in. Updating only
  // ConfigurationTarget.Global left the key sitting in `.vscode/settings.json`
  // (workspace) or in a folder-scoped settings file — exactly the place the
  // SecretStorage migration is supposed to evict it from.
  if (inspected?.globalValue !== undefined) {
    await cfg.update("apiKey", undefined, vscode.ConfigurationTarget.Global);
  }
  if (inspected?.workspaceValue !== undefined) {
    await cfg.update("apiKey", undefined, vscode.ConfigurationTarget.Workspace);
  }
  if (inspected?.workspaceFolderValue !== undefined) {
    await cfg.update("apiKey", undefined, vscode.ConfigurationTarget.WorkspaceFolder);
  }
}
