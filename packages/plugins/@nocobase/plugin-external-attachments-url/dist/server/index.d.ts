import { Plugin } from '@nocobase/server';

export declare class PluginExternalAttachmentsUrlServer extends Plugin {
  private hookedDatabases;
  private shouldHookDataSource;
  private isAttachmentRecord;
  private toAttachmentRecord;
  private processRecordTree;
  private hookDatabase;
  private prepareAttachmentCollection;
  load(): Promise<void>;
}

export default PluginExternalAttachmentsUrlServer;
