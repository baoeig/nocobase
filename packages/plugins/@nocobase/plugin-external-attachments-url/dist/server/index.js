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
var TIMESTAMP_FIELDS = ["createdAt", "updatedAt"];
var PLUGIN_VERSION = "1.7.19-fios-test.14-debug";
function requireFileManagerCreateMiddleware() {
  const candidates = [
    "@nocobase/plugin-file-manager/dist/server/actions/attachments",
    "@nocobase/plugin-file-manager/lib/server/actions/attachments",
    "@nocobase/plugin-file-manager/src/server/actions/attachments"
  ];
  for (const name of candidates) {
    try {
      return require(name).createMiddleware;
    } catch (error) {
    }
  }
  throw new Error("[fios-attach-url] file-manager createMiddleware not found");
}
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
  const collectionName = model?.collection?.name || getValue(record, "__collection") || model?.tableName || model?.getTableName?.()?.tableName || model?.getTableName?.();
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
    db.on("afterFind", async (instances) => {
      if (!this.shouldHookDataSource(dataSourceName) || !instances) {
        return;
      }
      const filePlugin = this.pm.get("file-manager");
      if (!filePlugin) {
        return;
      }
      await this.processRecordTree(db, instances, filePlugin);
    });
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
      template: "file",
      timestamps: true
    };
    const model = collection.model;
    if (model) {
      model.options.timestamps = true;
      model._timestampAttributes = {
        ...model._timestampAttributes,
        createdAt: "createdAt",
        updatedAt: "updatedAt"
      };
      model.refreshAttributes?.();
    }
    dataSource.acl?.allow?.(ATTACHMENT_COLLECTION_NAME, ["upload", "create"], "loggedIn");
  }
  fillAttachmentTimestamps(instance) {
    const now = /* @__PURE__ */ new Date();
    for (const field of TIMESTAMP_FIELDS) {
      if (getValue(instance, field) == null) {
        setValue(instance, field, now);
      }
    }
  }
  fillAttachmentTimestampValues(values) {
    if (!values || typeof values !== "object") {
      return;
    }
    const now = /* @__PURE__ */ new Date();
    for (const field of TIMESTAMP_FIELDS) {
      if (values[field] == null) {
        values[field] = now;
      }
    }
  }
  isFiosAttachmentCreateAction(ctx) {
    const { resourceName, actionName } = ctx.action || {};
    return ctx.dataSource?.name === DATA_SOURCE_NAME && resourceName === ATTACHMENT_COLLECTION_NAME && ["create", "upload"].includes(actionName);
  }
  registerAttachmentMiddlewares(dataSource) {
    const createMiddleware = requireFileManagerCreateMiddleware();
    const externalDb = dataSource.collectionManager?.db;
    dataSource.resourceManager?.use?.(
      async (ctx, next) => {
        if (!this.isFiosAttachmentCreateAction(ctx)) {
          await next();
          return;
        }
        const previousDb = ctx.db;
        if (externalDb) {
          ctx.db = externalDb;
        }
        try {
          await createMiddleware(ctx, next);
        } finally {
          ctx.db = previousDb;
        }
      },
      { tag: "createMiddleware", after: "auth" }
    );
    dataSource.resourceManager?.use?.(
      async (ctx, next) => {
        const shouldHandle = this.isFiosAttachmentCreateAction(ctx);
        const { resourceName, actionName } = ctx.action || {};
        if (shouldHandle) {
          ctx.action.params.values = ctx.action.params.values || {};
          this.fillAttachmentTimestampValues(ctx.action.params.values);
          ctx.app?.logger?.warn?.("[fios-attach-url] fill attachment timestamps before create", {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName,
            actionName,
            hasCreatedAt: !!ctx.action.params.values.createdAt,
            hasUpdatedAt: !!ctx.action.params.values.updatedAt
          });
        }
        await next();
        if (!shouldHandle || !ctx.body || typeof ctx.body.reload !== "function") {
          return;
        }
        try {
          ctx.body = await ctx.body.reload();
          ctx.app?.logger?.warn?.("[fios-attach-url] reload attachment response after create", {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName: ctx.action?.resourceName,
            actionName: ctx.action?.actionName,
            hasUrl: !!getValue(ctx.body, "url"),
            hasPreview: !!getValue(ctx.body, "preview")
          });
        } catch (error) {
          ctx.app?.logger?.warn?.("[fios-attach-url] failed to reload attachment response after create", {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName: ctx.action?.resourceName,
            actionName: ctx.action?.actionName,
            error: error?.message
          });
        }
      },
      { tag: "fiosAttachmentTimestamps", after: "createMiddleware" }
    );
  }
  async load() {
    this.app.logger?.warn?.("[fios-attach-url] server plugin loaded", {
      pluginVersion: PLUGIN_VERSION,
      dataSource: DATA_SOURCE_NAME,
      attachmentCollection: ATTACHMENT_COLLECTION_NAME
    });
    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      if (!this.shouldHookDataSource(dataSource.name)) {
        return;
      }
      this.prepareAttachmentCollection(dataSource);
      this.registerAttachmentMiddlewares(dataSource);
      this.app.logger?.warn?.("[fios-attach-url] server middlewares registered", {
        pluginVersion: PLUGIN_VERSION,
        dataSource: DATA_SOURCE_NAME,
        attachmentCollection: ATTACHMENT_COLLECTION_NAME
      });
      const db = dataSource.collectionManager?.db;
      if (!db) {
        return;
      }
      db.on("beforeValidate", (instance) => {
        if (!this.isAttachmentRecord(instance)) {
          return;
        }
        this.fillAttachmentTimestamps(instance);
      });
      this.hookDatabase(db, dataSource.name);
    });
  }
};
var server_default = PluginExternalAttachmentsUrlServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PluginExternalAttachmentsUrlServer
});
