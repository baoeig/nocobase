import { RecursionField, connect, mapReadPretty, useField, useFieldSchema } from '@formily/react';
import {
  ActionContextProvider,
  AssociationField,
  CollectionProvider_deprecated,
  EllipsisWithTooltip,
  FormProvider,
  Input,
  Plugin,
  RecordPickerContext,
  RecordPickerProvider,
  SchemaComponentOptions,
  TableSelectorParamsProvider,
  Upload,
  useActionContext,
  useApp,
  useCollectionField,
  useCollection_deprecated,
  useCollectionManager_deprecated,
  useDataBlockProps,
  useDataSourceKey,
  useDesignable,
  useFieldNames,
  useRequest,
  useTableSelectorProps as useTsp,
} from '@nocobase/client';
import React, { useCallback, useContext, useEffect, useState } from 'react';

const DATA_SOURCE_NAME = 'fios-test';
const ATTACHMENT_COLLECTION_NAME = 'attachments';

const defaultToValueItem = (data) => {
  return data?.thumbnailRule ? `${data?.url}${data?.thumbnailRule}` : data?.url;
};

function useStorageRules(storage) {
  const name = storage ?? '';
  const { loading, data } = useRequest<any>(
    {
      url: `storages:getBasicInfo/${name}`,
    },
    {
      refreshDeps: [name],
    },
  );
  return (!loading && data?.data) || null;
}

function getFieldPathParts(field: any, fieldSchema?: any) {
  const collectionField = fieldSchema?.['x-collection-field'];
  const parts = typeof collectionField === 'string' ? collectionField.split('.').filter(Boolean) : [];
  const collectionName = field?.collectionName || (parts.length >= 2 ? parts[parts.length - 2] : undefined);
  const fieldName = field?.name || fieldSchema?.name || (parts.length >= 2 ? parts[parts.length - 1] : undefined);

  return {
    collectionName,
    fieldName,
    dataSourceName: parts.length >= 3 && parts[0] === DATA_SOURCE_NAME ? parts[0] : undefined,
  };
}

function isFieldInDataSource(app: any, field: any, fieldSchema?: any) {
  const { collectionName, fieldName } = getFieldPathParts(field, fieldSchema);
  if (!collectionName || !fieldName) {
    return false;
  }

  const dataSource = app?.dataSourceManager?.getDataSource?.(DATA_SOURCE_NAME);
  const collection = dataSource?.collectionManager?.getCollection?.(collectionName);
  const dataSourceField = collection?.getField?.(fieldName);
  return !!dataSourceField && (dataSourceField.target || ATTACHMENT_COLLECTION_NAME) === ATTACHMENT_COLLECTION_NAME;
}

function isFiosAttachmentField(options: {
  app?: any;
  field?: any;
  collection?: any;
  dataSourceKey?: string;
  dataBlockDataSource?: string;
  fieldSchema?: any;
}) {
  const { app, field, collection, dataSourceKey, dataBlockDataSource, fieldSchema } = options;
  const schemaField = fieldSchema?.['x-component-props']?.field;
  const { dataSourceName } = getFieldPathParts(field || schemaField, fieldSchema);
  const currentDataSource =
    dataSourceKey ||
    dataBlockDataSource ||
    collection?.dataSource ||
    field?.dataSourceKey ||
    field?.dataSource ||
    schemaField?.dataSourceKey ||
    schemaField?.dataSource ||
    fieldSchema?.['x-data-source'] ||
    fieldSchema?.['x-data-source-key'] ||
    fieldSchema?.['x-component-props']?.dataSource ||
    dataSourceName;
  const target = field?.target || ATTACHMENT_COLLECTION_NAME;
  return (
    target === ATTACHMENT_COLLECTION_NAME &&
    (currentDataSource === DATA_SOURCE_NAME || isFieldInDataSource(app, field || schemaField, fieldSchema))
  );
}

function useFiosAttachmentUrlFieldProps(props) {
  const app = useApp();
  const field = useCollectionField();
  const fieldSchema = useFieldSchema();
  const collection = useCollection_deprecated();
  const dataSourceKey = useDataSourceKey();
  const dataBlockProps = useDataBlockProps();
  const rules = useStorageRules(field?.storage);
  const headers = isFiosAttachmentField({
    app,
    field,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema,
  })
    ? {
        ...(props?.headers || {}),
        'x-data-source': DATA_SOURCE_NAME,
      }
    : props?.headers;

  return {
    ...props,
    headers,
    rules,
    action: `${field?.target || ATTACHMENT_COLLECTION_NAME}:create${
      field?.storage ? `?attachmentField=${field.collectionName}.${field.name}` : ''
    }`,
    toValueItem: defaultToValueItem,
    getThumbnailURL: (file) => {
      return file?.url;
    },
  };
}

const selectorSchema = {
  type: 'void',
  'x-component': 'AssociationField.Selector',
  title: '{{ t("Select record") }}',
  'x-component-props': {
    className: 'nb-record-picker-selector',
  },
  properties: {
    grid: {
      type: 'void',
      'x-component': 'Grid',
      'x-initializer': 'popup:tableSelector:addBlock',
      properties: {},
    },
    footer: {
      'x-component': 'Action.Container.Footer',
      'x-component-props': {},
      properties: {
        actions: {
          type: 'void',
          'x-component': 'ActionBar',
          'x-component-props': {},
          properties: {
            submit: {
              title: '{{ t("Submit") }}',
              'x-action': 'submit',
              'x-component': 'Action',
              'x-use-component-props': 'usePickActionProps',
              'x-toolbar': 'ActionSchemaToolbar',
              'x-settings': 'actionSettings:submit',
              'x-component-props': {
                type: 'primary',
                htmlType: 'submit',
              },
            },
          },
        },
      },
    },
  },
};

const useInsertSchema = (component) => {
  const fieldSchema = useFieldSchema();
  const { insertAfterBegin } = useDesignable();
  return useCallback(
    (schema) => {
      const exists = fieldSchema.reduceProperties((buf, s) => {
        if (s['x-component'] === `AssociationField.${component}`) {
          return s;
        }
        return buf;
      }, null);
      if (!exists) {
        insertAfterBegin(JSON.parse(JSON.stringify(schema)));
      }
    },
    [component, fieldSchema, insertAfterBegin],
  );
};

const InnerAttachmentUrl = (props) => {
  const { value, onChange, toValueItem = defaultToValueItem, disabled, underFilter, ...others } = props;
  const fieldSchema = useFieldSchema();
  const [visibleSelector, setVisibleSelector] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const fieldNames = useFieldNames(props);
  const field: any = useField();
  const [options, setOptions] = useState();
  const insertSelector = useInsertSchema('Selector');
  const collection = useCollection_deprecated();
  const { getField } = collection;
  const collectionField = getField(field.props.name);
  const app = useApp();
  const dataSourceKey = useDataSourceKey();
  const dataBlockProps = useDataBlockProps();
  const isFiosAttachment = isFiosAttachmentField({
    app,
    field: collectionField,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema,
  });
  const attachmentDataSource = isFiosAttachment ? DATA_SOURCE_NAME : 'main';
  const attachmentHeaders = isFiosAttachment
    ? {
        ...(others?.headers || {}),
        'x-data-source': DATA_SOURCE_NAME,
      }
    : others?.headers;
  const { modalProps } = useActionContext();

  const handleSelect = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    insertSelector(selectorSchema);
    setVisibleSelector(true);
    setSelectedRows([]);
  };

  useEffect(() => {
    if (value && Object.keys(value).length > 0) {
      setOptions(value);
    } else {
      setOptions(null);
    }
  }, [value, fieldNames?.label]);

  const pickerProps = {
    size: 'small',
    fieldNames,
    multiple: false,
    association: {
      target: collectionField?.target,
    },
    options,
    onChange: props?.onChange,
    selectedRows,
    setSelectedRows,
    collectionField,
  };

  const usePickActionProps = () => {
    const { setVisible } = useActionContext();
    const { selectedRows, onChange } = useContext(RecordPickerContext);
    return {
      onClick() {
        onChange(toValueItem(selectedRows?.[0]) || null);
        setVisible(false);
      },
    };
  };

  const useTableSelectorProps = () => {
    const {
      multiple,
      options,
      setSelectedRows,
      selectedRows: rcSelectRows = [],
      onChange,
    } = useContext(RecordPickerContext);
    const { onRowSelectionChange, rowKey = 'id', ...others } = useTsp();
    const { setVisible } = useActionContext();
    return {
      ...others,
      rowKey,
      rowSelection: {
        type: multiple ? 'checkbox' : 'radio',
        selectedRowKeys: rcSelectRows?.filter((item) => options?.[rowKey] !== item[rowKey]).map((item) => item[rowKey]),
      },
      onRowSelectionChange(selectedRowKeys, selectedRows) {
        setSelectedRows?.(selectedRows);
        onRowSelectionChange?.(selectedRowKeys, selectedRows);
        onChange(toValueItem(selectedRows?.[0]) || null);
        setVisible(false);
      },
    };
  };

  if (underFilter) {
    return <Input {...props} />;
  }

  return (
    <div style={{ width: '100%', overflow: 'auto' }}>
      <AssociationField.FileSelector
        toValueItem={toValueItem}
        value={options}
        quickUpload={fieldSchema['x-component-props']?.quickUpload !== false}
        selectFile={
          collectionField?.target && collectionField?.target !== ATTACHMENT_COLLECTION_NAME
            ? fieldSchema['x-component-props']?.selectFile !== false
            : false
        }
        action={others?.action || `${collectionField?.target || ATTACHMENT_COLLECTION_NAME}:create`}
        rules={others?.rules}
        getThumbnailURL={others?.getThumbnailURL}
        headers={attachmentHeaders}
        onSelect={handleSelect}
        onChange={onChange}
        disabled={disabled}
      />
      <ActionContextProvider
        value={{
          openMode: 'drawer',
          visible: visibleSelector,
          setVisible: setVisibleSelector,
          modalProps: {
            getContainer: others?.getContainer || modalProps?.getContainer,
          },
          formValueChanged: false,
        }}
      >
        {collectionField?.target && collectionField?.target !== ATTACHMENT_COLLECTION_NAME && (
          <RecordPickerProvider {...pickerProps}>
            <CollectionProvider_deprecated name={collectionField?.target} dataSource={attachmentDataSource}>
              <FormProvider>
                <TableSelectorParamsProvider params={{}}>
                  <SchemaComponentOptions scope={{ usePickActionProps, useTableSelectorProps }}>
                    <RecursionField
                      onlyRenderProperties
                      basePath={field.address}
                      schema={fieldSchema}
                      filterProperties={(s) => {
                        return s['x-component'] === 'AssociationField.Selector';
                      }}
                    />
                  </SchemaComponentOptions>
                </TableSelectorParamsProvider>
              </FormProvider>
            </CollectionProvider_deprecated>
          </RecordPickerProvider>
        )}
      </ActionContextProvider>
    </div>
  );
};

const FileManageReadPretty = connect((props) => {
  const { value } = props;
  const fieldSchema = useFieldSchema();
  const componentMode = fieldSchema?.['x-component-props']?.['componentMode'];
  const { getField } = useCollection_deprecated();
  const { getCollectionJoinField } = useCollectionManager_deprecated();
  const collectionField = getField(fieldSchema.name) || getCollectionJoinField(fieldSchema['x-collection-field']);
  if (componentMode === 'url') {
    return <EllipsisWithTooltip ellipsis>{value}</EllipsisWithTooltip>;
  }
  return (
    <EllipsisWithTooltip ellipsis>{collectionField ? <Upload.ReadPretty {...props} /> : null}</EllipsisWithTooltip>
  );
});

export const AttachmentUrl = connect(InnerAttachmentUrl, mapReadPretty(FileManageReadPretty));

export class PluginFiosAttachUrlClient extends Plugin {
  async load() {
    this.app.addScopes({ useAttachmentUrlFieldProps: useFiosAttachmentUrlFieldProps });
    this.app.addComponents({ AttachmentUrl });
  }
}

export default PluginFiosAttachUrlClient;
