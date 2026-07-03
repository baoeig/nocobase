import type { Database, Model } from '@nocobase/database';
import type PluginFileManagerServer from '@nocobase/plugin-file-manager';
import { Plugin } from '@nocobase/server';

const DATA_SOURCE_NAME = 'fios-test';
const ATTACHMENT_COLLECTION_NAME = 'attachments';
const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt'];

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

  private bodyValues(body: any) {
    if (!body) {
      return {};
    }
    if (typeof body.toJSON === 'function') {
      return body.toJSON();
    }
    return recordValues(body) || {};
  }

  private async normalizeAttachmentCreateResponse(ctx: any, filePlugin: PluginFileManagerServer) {
    const response = {
      ...(ctx.action?.params?.values || {}),
      ...this.bodyValues(ctx.body),
    };
    const url = await filePlugin.getFileURL(this.toAttachmentRecord(response) as any);
    const preview = await filePlugin.getFileURL(this.toAttachmentRecord(response) as any, true);

    if (url) {
      response.url = url;
    }
    if (preview) {
      response.preview = preview;
    }

    if (ctx.body && typeof ctx.body === 'object') {
      for (const [key, value] of Object.entries(response)) {
        setValue(ctx.body, key, value);
      }
      return;
    }

    ctx.body = response;
  }

  private registerAttachmentCreateMiddleware() {
    this.app.dataSourceManager?.use?.(
      async (ctx, next) => {
        const { resourceName, actionName } = ctx.action || {};
        const shouldHandle =
          ctx.dataSource?.name === DATA_SOURCE_NAME &&
          resourceName === ATTACHMENT_COLLECTION_NAME &&
          ['create', 'upload'].includes(actionName);

        if (shouldHandle) {
          ctx.action.params.values = ctx.action.params.values || {};
          this.fillAttachmentTimestampValues(ctx.action.params.values);
          ctx.app?.logger?.warn?.('[fios-attach-url] fill attachment timestamps before create', {
            dataSource: DATA_SOURCE_NAME,
            resourceName,
            actionName,
            hasCreatedAt: !!ctx.action.params.values.createdAt,
            hasUpdatedAt: !!ctx.action.params.values.updatedAt,
          });
        }
        await next();

        if (!shouldHandle || !ctx.body) {
          return;
        }

        try {
          if (typeof ctx.body.reload === 'function') {
            ctx.body = await ctx.body.reload();
          }

          const filePlugin = this.pm.get('file-manager') as PluginFileManagerServer;
          if (filePlugin) {
            await this.normalizeAttachmentCreateResponse(ctx, filePlugin);
          }

          ctx.app?.logger?.warn?.('[fios-attach-url] reload attachment response after create', {
            dataSource: DATA_SOURCE_NAME,
            resourceName,
            actionName,
            hasUrl: !!getValue(ctx.body, 'url'),
            hasPreview: !!getValue(ctx.body, 'preview'),
            keys: Object.keys(this.bodyValues(ctx.body)),
          });
        } catch (error) {
          ctx.app?.logger?.warn?.('[fios-attach-url] failed to reload attachment response after create', {
            dataSource: DATA_SOURCE_NAME,
            resourceName,
            actionName,
            error: error?.message,
          });
        }
      },
      { tag: 'fiosAttachmentTimestamps', after: 'dataTemplate' },
    );
  }

  async load() {
    this.registerAttachmentCreateMiddleware();

    this.app.dataSourceManager.afterAddDataSource((dataSource) => {
      if (!this.shouldHookDataSource(dataSource.name)) {
        return;
      }

      this.prepareAttachmentCollection(dataSource);

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
