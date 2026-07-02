# FIOS attach URL

Applies NocoBase file-manager handling to attachment records in the `attachments` collection of the `fios` external data source.

The plugin delegates URL generation to `@nocobase/plugin-file-manager`, so `storageId`, `storages.baseUrl`, `APP_PUBLIC_PATH`, absolute `url`, and preview URL handling follow the main data source attachment logic.

It also overrides the `AttachmentUrl` client component so uploads and file selection for `fios.attachments` use the `x-data-source: fios` request header.

## Scope

- Data source: `fios`
- Collection: `attachments`
- Component: `AttachmentUrl`
