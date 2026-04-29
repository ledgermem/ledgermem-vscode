import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { MnemoSidebarProvider } from "./sidebar";
import { createClient } from "./client";

export const EXTENSION_ID = "getmnemo";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Mnemo");
  output.appendLine("Mnemo extension activated.");

  const client = createClient(context.secrets);

  const sidebarProvider = new MnemoSidebarProvider(client);
  const treeView = vscode.window.createTreeView("getmnemo.recentMemories", {
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
    vscode.commands.registerCommand("getmnemo.setApiKey", async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Enter Mnemo API key",
        password: true,
        ignoreFocusOut: true,
      });
      if (value === undefined) {
        return;
      }
      if (value.length === 0) {
        await context.secrets.delete("getmnemo.apiKey");
        vscode.window.showInformationMessage("Mnemo API key cleared.");
      } else {
        await context.secrets.store("getmnemo.apiKey", value);
        vscode.window.showInformationMessage("Mnemo API key saved to secret storage.");
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
      if (event.key === "getmnemo.apiKey") {
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
  const existing = await context.secrets.get("getmnemo.apiKey");
  if (!existing) {
    await context.secrets.store("getmnemo.apiKey", candidate);
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
