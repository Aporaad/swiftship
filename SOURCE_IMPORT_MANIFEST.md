# SwiftShip `exe` Source Import Manifest

## Imported source

The primary application source from `Aporaad/swiftship` branch `exe` now lives in the repository-native root layout. The complete `src` tree is present at `src/`, including `components/`, `pages/`, `services/`, `lib/`, `context/`, `hooks/`, and `reports/`.

| Scope | Verification result |
|---|---|
| `src/` | 10 directories and 74 files; recursive content comparison matches the `exe` branch exactly. |
| Root application files | `server.ts`, `loadEnv.ts`, `index.html`, `package.json`, `package-lock.json`, Vite configuration, and TypeScript configuration are present. |
| Supporting code | `electron/main.cjs`, `electron/preload.cjs`, `app/applet/scripts/migrate_shein.ts`, seed scripts, manual test scripts, editor settings, and utility scripts are present. |
| Documentation | The tracked technical and operational Markdown/text documents have been imported. |

## Managed-web adaptations

The managed-web runtime keeps its own `pnpm-lock.yaml` alongside the original `package-lock.json`. `server.ts`, `vite.config.ts`, and `tsconfig.json` preserve the original application paths while adding the minimum required managed-web runtime behavior, including safe environment loading and the protected scheduled synchronization endpoint. The production `dist/` directory is always regenerated from the current source and is not copied from the original build output.

## Intentional exclusions

| Original path | Handling |
|---|---|
| `alx_web` | Excluded explicitly by the project owner. It is a Gitlink without a repository URL in the `exe` branch. |
| `.env.example` | Not copied; environment configuration is maintained through managed secrets to prevent accidental credential exposure. |
| `electron/assets/` | Stored outside the deployed web package at `/home/ubuntu/webdev-static-assets/swiftship-electron-assets/`; these desktop-only icons are not referenced by the website. |
| `dist/` from `exe` | Rebuilt from the imported source to avoid shipping stale generated assets. |
