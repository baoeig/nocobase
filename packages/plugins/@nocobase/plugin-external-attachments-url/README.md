# FIOS attach URL

Applies NocoBase file-manager URL handling to attachment records returned from the `attachments` collection in the `fios` external data source.

The plugin delegates URL generation to `@nocobase/plugin-file-manager`, so `storageId`, `storages.baseUrl`, `APP_PUBLIC_PATH`, absolute `url`, and preview URL handling follow the main data source attachment logic.

## Scope

- Data source: `fios`
- Collection: `attachments`
