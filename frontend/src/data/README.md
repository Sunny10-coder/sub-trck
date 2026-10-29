# Optional private data

Personal workbook data, pasted audits and API-key seeds are intentionally not published.
`npm install` creates empty local defaults through `scripts/prepare-local-data.mjs`.
Existing local seed files are never overwritten. Add provider keys through Profile.

For a private prefilled build, supply `personal-workbook.json` and `pasted-audit.json`
in this folder using collections `subscriptions`, `accounts`, `watchlist`, `promos`,
and `inbox`. The app merges that data once without replacing existing records.
These files and exported backups are ignored by Git.
