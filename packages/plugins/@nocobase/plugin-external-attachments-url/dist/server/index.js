var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/plugins/@nocobase/plugin-external-attachments-url/src/server/index.ts
var server_exports = {};
__export(server_exports, {
  PluginExternalAttachmentsUrlServer: () => PluginExternalAttachmentsUrlServer,
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_server = require("@nocobase/server");
var DATA_SOURCE_NAME = "fios-test";
var ATTACHMENT_COLLECTION_NAME = "attachments";
function getValue(record, key) {
  if (!record) {
    return void 0;
  }
  if (typeof record.get === "function") {
    return record.get(key);
  }
  return record[key];
}
function setValue(record, key, value) {
  if (!record) {
    return;
  }
  if (typeof record.setDataValue === "function") {
    record.setDataValue(key, value);
    return;
  }
  if (typeof record.set === "function") {
    record.set(key, value, { raw: true });
    return;
  }
  record[key] = value;
}
function recordValues(record) {
  if (!record) {
    return void 0;
  }
  return record.dataValues || record;
}
function collectionNameOf(record) {
  const model = record?.constructor;
  const collectionName = model?.collection?.name || getValue(record, "__collection");
  if (collectionName) {
    return collectionName;
  }
  return record?.dataValues ? model?.name : void 0;
}
var PluginExternalAttachmentsUrlServer = class extends import_server.Plugin {
  hookedDatabases = /* @__PURE__ */ new WeakSet();
  shouldHookDataSource(dataSourceName) {
    return dataSourceName === DATA_SOURCE_NAME;
  }
  isAttachmentRecord(record) {
    const collectionName = collectionNameOf(record);
    if (!collectionName) {
      return false;
    }
    return collectionName === ATTACHMENT_COLLECTION_NAME;
  }
  toAttachmentRecord(record) {
    const values = recordValues(record) || {};
    return {
      title: getValue(record, "title"),
      filename: getValue(record, "filename"),
      mimetype: getValue(record, "mimetype"),
      path: getValue(record, "path"),
      url: getValue(record, "url"),
      storageId: getValue(record, "storageId") || getValue(record, "storage_id") || getValue(record, "storage")?.id || values.storageId || values.storage_id
    };
  }
  async processRecordTree(db, record, filePlugin, visited = /* @__PURE__ */ new WeakSet()) {
    if (!record || typeof record !== "object" || visited.has(record)) {
      return;
    }
    visited.add(record);
    if (Array.isArray(record)) {
      for (const item of record) {
        await this.processRecordTree(db, item, filePlugin, visited);
      }
      return;
    }
    if (this.isAttachmentRecord(record)) {
      const attachment = this.toAttachmentRecord(record);
      const url = await filePlugin.getFileURL(attachment);
      const previewUrl = await filePlugin.getFileURL(attachment, true);
      if (url) {
        setValue(record, "url", url);
      }
      if (previewUrl) {
        setValue(record, "preview", previewUrl);
      }
    }
    const values = recordValues(record);
    if (!values || typeof values !== "object") {
      return;
    }
    for (const value of Object.values(values)) {
      if (value && typeof value === "object") {
        await this.processRecordTree(db, value, filePlugin, visited);
      }
    }
  }
  hookDatabase(db, dataSourceName) {
    if (this.hookedDatabases.has(db)) {
      return;
    }
    this.hookedDatabases.add(db);
    db.on("afterRepositoryFind", async ({ data }) => {
      if (!this.shouldHookDataSource(dataSourceName)) {
        return;
      }
      const filePlugin = this.pm.get("file-manager");
      if (!filePlugin) {
        return;
      }
      await this.processRecordTree(db, data, filePlugin);
    });
  }
  prepareAttachmentCollection(dataSource) {
    const collection = dataSource.collectionManager?.getCollection?.(ATTACHMENT_COLLECTION_NAME);
    if (!collection) {
      return;
    }
    collection.options = {
      ...collection.options,
      template: "file"
    };
    dataSource.acl?.allow?.(ATTACHMENT_COLLECTION_NAME, ["upload", "create"], "loggedIn");
  }
  async load() {
    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      if (!this.shouldHookDataSource(dataSource.name)) {
        return;
      }
      this.prepareAttachmentCollection(dataSource);
      const db = dataSource.collectionManager?.db;
      if (!db) {
        return;
      }
      this.hookDatabase(db, dataSource.name);
    });
  }
};
var server_default = PluginExternalAttachmentsUrlServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginExternalAttachmentsUrlServer
});
