import type { Database, Model } from '@nocobase/database';
import type PluginFileManagerServer from '@nocobase/plugin-file-manager';
import { Plugin } from '@nocobase/server';

const DATA_SOURCE_NAME = 'fios-test';
const ATTACHMENT_COLLECTION_NAME = 'attachments';

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
  const collectionName = model?.collection?.name || getValue(record, '__collection');
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
    };

    dataSource.acl?.allow?.(ATTACHMENT_COLLECTION_NAME, ['upload', 'create'], 'loggedIn');
  }

  private fillAttachmentTimestamps(instance: any) {
    if (!this.isAttachmentRecord(instance)) {
      return;
    }

    const now = new Date();
    if (getValue(instance, 'createdAt') == null) {
      setValue(instance, 'createdAt', now);
    }
    if (getValue(instance, 'updatedAt') == null) {
      setValue(instance, 'updatedAt', now);
    }
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

      db.on(`${ATTACHMENT_COLLECTION_NAME}.beforeValidate`, (instance) => {
        this.fillAttachmentTimestamps(instance);
      });

      this.hookDatabase(db, dataSource.name);
    });
  }
}

export default PluginExternalAttachmentsUrlServer;
