# LedgerMem for VS Code

Persistent memory for your AI coding workflow. Works in **VS Code, Cursor, Windsurf, and code-server** (any VS Code-compatible host).

Capture snippets, decisions, and gotchas as you code, then recall them by semantic search without leaving the editor.

## Features

- **Search Memory** — `Cmd+Alt+M` / `Ctrl+Alt+M` opens a quick search across your workspace memories.
- **Add Selection to Memory** — `Cmd+Alt+A` / `Ctrl+Alt+A` saves the highlighted text with file/line metadata.
- **Sidebar** — LedgerMem icon in the activity bar shows your most recent memories. Right-click to delete.
- **Multi-host** — single extension, ships in the VS Code Marketplace and Open VSX so Cursor / Windsurf / code-server users get it too.

## Install

### From the Marketplace

Search for `LedgerMem` in the Extensions panel, or run:

```
ext install ledgermem.ledgermem-vscode
```

### Sideload from a `.vsix`

```
git clone https://github.com/ledgermem/ledgermem-vscode
cd ledgermem-vscode
npm install
npm run package        # produces ledgermem-vscode-<version>.vsix
code --install-extension ledgermem-vscode-*.vsix
```

In Cursor / Windsurf the same `.vsix` works via *Extensions > Install from VSIX*.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `ledgermem.apiKey` | `""` | API key from https://ledgermem.dev/settings/api-keys |
| `ledgermem.workspaceId` | `""` | Workspace to scope reads/writes to |
| `ledgermem.defaultLimit` | `10` | Default result count for search and sidebar |
| `ledgermem.endpoint` | `https://api.ledgermem.dev` | Override for self-hosted deployments |

## Keybindings

| Action | macOS | Linux / Windows |
| --- | --- | --- |
| Search Memory | `Cmd+Alt+M` | `Ctrl+Alt+M` |
| Add Selection | `Cmd+Alt+A` | `Ctrl+Alt+A` |

## Commands

All commands are namespaced under `LedgerMem:` in the Command Palette.

- `LedgerMem: Search Memory`
- `LedgerMem: Add Selection to Memory`
- `LedgerMem: Delete Memory`
- `LedgerMem: Refresh Sidebar`

## Development

```
npm install
npm run watch          # tsc in watch mode
npm test               # vitest
npm run package        # build a .vsix
```

The test suite mocks the `vscode` module and the `@ledgermem/memory` SDK so it runs without a real editor host.

## License

MIT — see [LICENSE](./LICENSE).
