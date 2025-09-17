# Contributing

## Setup
- `nvm use` (see `.nvmrc`)
- `npm ci`

## Commands
- `npm run build`
- `npm run validate:schemas`
- `npm run smoke`
- `npm test`

## Code style
- ESM only (`"type":"module"`). Use 2 spaces.
- Keep schemas governed via `SCHEMA_CHANGELOG.md` in PRs.

## Releases
- RC: `npm version 0.9.0-rc.X && npm publish --tag next --provenance`
- Stable: tag `vX.Y.Z` to trigger `release.yml`.
