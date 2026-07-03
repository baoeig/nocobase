import type { Database, Model } from '@nocobase/database';
import type PluginFileManagerServer from '@nocobase/plugin-file-manager';
import { Plugin } from '@nocobase/server';

const DATA_SOURCE_NAME = 'fios-test';
const ATTACHMENT_COLLECTION_NAME = 'attachments';
const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'];
const PLUGIN_VERSION = '1.7.19-fios-test.16-debug';

function requireFileManagerCreateMiddleware() {
  const candidates = [
    '@nocobase/plugin-file-manager/dist/server/actions/attachments',
    '@nocobase/plugin-file-manager/lib/server/actions/attachments',
    '@nocobase/plugin-file-manager/src/server/actions/attachments',
  ];

  for (const name of candidates) {
    try {
      return require(name).createMiddleware;
    } catch (error) {
      // try the next package layout
    }
  }

  throw new Error('[fios-attach-url] file-manager createMiddleware not found');
}

function getValue(record: any, key: string) {
  if (!record) {
    return undefined;
  }
  if (typeof record.get === 'function') {
    return record.get(key);
  }
  return record[key];
}

function setValue(record: any, key: string, value: any) {
  if (!record) {
    return;
  }
  if (typeof record.setDataValue === 'function') {
    record.setDataValue(key, value);
    return;
  }
  if (typeof record.set === 'function') {
    record.set(key, value, { raw: true });
    return;
  }
  record[key] = value;
}

function recordValues(record: any) {
  if (!record) {
    return undefined;
  }
  return record.dataValues || record;
}

function valueKeys(values: any) {
  return values && typeof values === 'object' ? Object.keys(values) : [];
}

function pickValues(values: any, keys: string[]) {
  if (!values || typeof values !== 'object') {
    return {};
  }

  return keys.reduce((carry, key) => {
    carry[key] = getValue(values, key);
    return carry;
  }, {});
}

function summarizeValues(values: any) {
  return {
    keys: valueKeys(values),
    sample: pickValues(values, [
      'id',
      'title',
      'filename',
      'extname',
      'path',
      'size',
      'mimetype',
      'storageId',
      'storage_id',
      'url',
      'preview',
      'createdAt',
      'updatedAt',
    ]),
  };
}

function summarizeModel(model: any) {
  return {
    name: model?.name,
    tableName: model?.tableName,
    rawAttributes: valueKeys(model?.rawAttributes),
    timestampAttributes: model?._timestampAttributes,
    timestamps: model?.options?.timestamps,
  };
}

function summarizeCollection(collection: any) {
  return {
    name: collection?.name,
    tableName: collection?.model?.tableName,
    template: collection?.options?.template,
    fields: valueKeys(collection?.fields),
    optionsKeys: valueKeys(collection?.options),
    model: summarizeModel(collection?.model),
  };
}

function collectionNameOf(record: any) {
  const model = record?.constructor;
  const collectionName =
    model?.collection?.name ||
    getValue(record, '__collection') ||
    model?.tableName ||
    model?.getTableName?.()?.tableName ||
    model?.getTableName?.();
  if (collectionName) {
    return collectionName;
  }
  return record?.dataValues ? model?.name : undefined;
}

export class PluginExternalAttachmentsUrlServer extends Plugin {
  private hookedDatabases = new WeakSet<Database>();

  private shouldHookDataSource(dataSourceName: string) {
    return dataSourceName === DATA_SOURCE_NAME;
  }

  private isAttachmentRecord(record: Model | any) {
    const collectionName = collectionNameOf(record);
    if (!collectionName) {
      return false;
    }

    return collectionName === ATTACHMENT_COLLECTION_NAME;
  }

  private toAttachmentRecord(record: any) {
    const values = recordValues(record) || {};
    return {
      title: getValue(record, 'title'),
      filename: getValue(record, 'filename'),
      mimetype: getValue(record, 'mimetype'),
      path: getValue(record, 'path'),
      url: getValue(record, 'url'),
      storageId:
        getValue(record, 'storageId') ||
        getValue(record, 'storage_id') ||
        getValue(record, 'storage')?.id ||
        values.storageId ||
        values.storage_id,
    };
  }

  private async processRecordTree(
    db: Database,
    record: any,
    filePlugin: PluginFileManagerServer,
    visited = new WeakSet(),
  ) {
    if (!record || typeof record !== 'object' || visited.has(record)) {
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
      const url = await filePlugin.getFileURL(attachment as any);
      const previewUrl = await filePlugin.getFileURL(attachment as any, true);
      if (url) {
        setValue(record, 'url', url);
      }
      if (previewUrl) {
        setValue(record, 'preview', previewUrl);
      }
    }

    const values = recordValues(record);
    if (!values || typeof values !== 'object') {
      return;
    }

    for (const value of Object.values(values)) {
      if (value && typeof value === 'object') {
        await this.processRecordTree(db, value, filePlugin, visited);
      }
    }
  }

  private hookDatabase(db: Database, dataSourceName: string) {
    if (this.hookedDatabases.has(db)) {
      return;
    }

    this.hookedDatabases.add(db);

    db.on('afterFind', async (instances) => {
      if (!this.shouldHookDataSource(dataSourceName) || !instances) {
        return;
      }

      const filePlugin = this.pm.get('file-manager') as PluginFileManagerServer;
      if (!filePlugin) {
        return;
      }

      await this.processRecordTree(db, instances, filePlugin);
    });

    db.on('afterRepositoryFind', async ({ data }) => {
      if (!this.shouldHookDataSource(dataSourceName)) {
        return;
      }

      const filePlugin = this.pm.get('file-manager') as PluginFileManagerServer;
      if (!filePlugin) {
        return;
      }

      await this.processRecordTree(db, data, filePlugin);
    });
  }

  private prepareAttachmentCollection(dataSource: any) {
    const collection = dataSource.collectionManager?.getCollection?.(ATTACHMENT_COLLECTION_NAME);
    if (!collection) {
      return;
    }

    collection.options = {
      ...collection.options,
      template: 'file',
      timestamps: true,
    };

    const model = collection.model;
    if (model) {
      model.options.timestamps = true;
      model._timestampAttributes = {
        ...model._timestampAttributes,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      };
      model.refreshAttributes?.();
    }

    dataSource.acl?.allow?.(ATTACHMENT_COLLECTION_NAME, ['upload', 'create'], 'loggedIn');
  }

  private fillAttachmentTimestamps(instance: any) {
    const now = new Date();
    for (const field of TIMESTAMP_FIELDS) {
      if (getValue(instance, field) == null) {
        setValue(instance, field, now);
      }
    }
  }

  private fillAttachmentTimestampValues(values: any) {
    if (!values || typeof values !== 'object') {
      return;
    }

    const now = new Date();
    for (const field of TIMESTAMP_FIELDS) {
      if (values[field] == null) {
        values[field] = now;
      }
    }
  }

  private isFiosAttachmentCreateAction(ctx: any) {
    const { resourceName, actionName } = ctx.action || {};
    return (
      ctx.dataSource?.name === DATA_SOURCE_NAME &&
      resourceName === ATTACHMENT_COLLECTION_NAME &&
      ['create', 'upload'].includes(actionName)
    );
  }

  private registerAttachmentMiddlewares(dataSource: any) {
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
          const collection = ctx.db?.getCollection?.(ctx.action?.resourceName);
          ctx.app?.logger?.warn?.('[fios-attach-url] before file-manager createMiddleware', {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            ctxDataSource: ctx.dataSource?.name,
            dbDialect: ctx.db?.sequelize?.getDialect?.(),
            resourceName: ctx.action?.resourceName,
            actionName: ctx.action?.actionName,
            paramsKeys: valueKeys(ctx.action?.params),
            attachmentField: ctx.action?.params?.attachmentField,
            query: ctx.query,
            contentType: ctx.request?.headers?.['content-type'],
            contentLength: ctx.request?.headers?.['content-length'],
            isMultipart: !!ctx.request?.is?.('multipart/*'),
            requestBody: summarizeValues(ctx.request?.body),
            collection: summarizeCollection(collection),
            values: summarizeValues(ctx.action?.params?.values),
          });

          await createMiddleware(ctx, async () => {
            ctx.app?.logger?.warn?.('[fios-attach-url] after file-manager createMiddleware', {
              pluginVersion: PLUGIN_VERSION,
              dataSource: DATA_SOURCE_NAME,
              ctxDataSource: ctx.dataSource?.name,
              resourceName: ctx.action?.resourceName,
              actionName: ctx.action?.actionName,
              paramsKeys: valueKeys(ctx.action?.params),
              values: summarizeValues(ctx.action?.params?.values),
              hasFilename: !!ctx.action?.params?.values?.filename,
              hasStorageId: !!ctx.action?.params?.values?.storageId,
              hasPath: ctx.action?.params?.values?.path !== undefined,
              hasMimetype: !!ctx.action?.params?.values?.mimetype,
              file: summarizeValues(ctx.file),
              storageName: ctx.storage?.name,
              storageId: ctx.storage?.id,
              storageType: ctx.storage?.type,
              storageBaseUrl: ctx.storage?.baseUrl,
            });
            await next();
            ctx.app?.logger?.warn?.('[fios-attach-url] after repository create handler', {
              pluginVersion: PLUGIN_VERSION,
              dataSource: DATA_SOURCE_NAME,
              resourceName: ctx.action?.resourceName,
              actionName: ctx.action?.actionName,
              bodyType: ctx.body?.constructor?.name,
              bodyCollection: collectionNameOf(ctx.body),
              body: summarizeValues(ctx.body),
              bodyDataValues: summarizeValues(ctx.body?.dataValues),
              values: summarizeValues(ctx.action?.params?.values),
            });
          });
        } finally {
          ctx.db = previousDb;
        }
      },
      { tag: 'createMiddleware', after: 'auth' },
    );

    dataSource.resourceManager?.use?.(
      async (ctx, next) => {
        const shouldHandle = this.isFiosAttachmentCreateAction(ctx);
        const { resourceName, actionName } = ctx.action || {};

        if (shouldHandle) {
          ctx.action.params.values = ctx.action.params.values || {};
          this.fillAttachmentTimestampValues(ctx.action.params.values);
          ctx.app?.logger?.warn?.('[fios-attach-url] fill attachment timestamps before create', {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName,
            actionName,
            values: summarizeValues(ctx.action.params.values),
            hasCreatedAt: !!ctx.action.params.values.createdAt,
            hasUpdatedAt: !!ctx.action.params.values.updatedAt,
            hasFilename: !!ctx.action.params.values.filename,
            hasStorageId: !!ctx.action.params.values.storageId,
          });
        }
        await next();

        if (!shouldHandle || !ctx.body || typeof ctx.body.reload !== 'function') {
          return;
        }

        try {
          ctx.body = await ctx.body.reload();

          ctx.app?.logger?.warn?.('[fios-attach-url] reload attachment response after create', {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName: ctx.action?.resourceName,
            actionName: ctx.action?.actionName,
            hasUrl: !!getValue(ctx.body, 'url'),
            hasPreview: !!getValue(ctx.body, 'preview'),
            body: summarizeValues(ctx.body),
            bodyDataValues: summarizeValues(ctx.body?.dataValues),
          });
        } catch (error) {
          ctx.app?.logger?.warn?.('[fios-attach-url] failed to reload attachment response after create', {
            pluginVersion: PLUGIN_VERSION,
            dataSource: DATA_SOURCE_NAME,
            resourceName: ctx.action?.resourceName,
            actionName: ctx.action?.actionName,
            error: error?.message,
          });
        }
      },
      { tag: 'fiosAttachmentTimestamps', after: 'createMiddleware' },
    );
  }

  async load() {
    this.app.logger?.warn?.('[fios-attach-url] server plugin loaded', {
      pluginVersion: PLUGIN_VERSION,
      dataSource: DATA_SOURCE_NAME,
      attachmentCollection: ATTACHMENT_COLLECTION_NAME,
    });

    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      if (!this.shouldHookDataSource(dataSource.name)) {
        return;
      }

      this.prepareAttachmentCollection(dataSource);
      this.registerAttachmentMiddlewares(dataSource);
      this.app.logger?.warn?.('[fios-attach-url] server middlewares registered', {
        pluginVersion: PLUGIN_VERSION,
        dataSource: DATA_SOURCE_NAME,
        attachmentCollection: ATTACHMENT_COLLECTION_NAME,
      });

      const db = dataSource.collectionManager?.db;
      if (!db) {
        return;
      }

      db.on('beforeValidate', (instance) => {
        if (!this.isAttachmentRecord(instance)) {
          return;
        }

        this.fillAttachmentTimestamps(instance);
      });

      this.hookDatabase(db, dataSource.name);
    });
  }
}

export default PluginExternalAttachmentsUrlServer;
