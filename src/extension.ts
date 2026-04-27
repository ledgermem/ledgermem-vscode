import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { LedgerMemSidebarProvider } from "./sidebar";
import { createClient } from "./client";

export const EXTENSION_ID = "ledgermem";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("LedgerMem");
  output.appendLine("LedgerMem extension activated.");

  const client = createClient();

  const sidebarProvider = new LedgerMemSidebarProvider(client);
  const treeView = vscode.window.createTreeView("ledgermem.recentMemories", {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView);

  registerCommands(context, client, sidebarProvider, output);

  // React to settings changes — rebuild the client with fresh config.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(EXTENSION_ID)) {
        sidebarProvider.refresh();
      }
    }),
  );

  context.subscriptions.push(output);
}

export function deactivate(): void {
  // Connections are short-lived HTTPS calls — nothing to tear down.
}
