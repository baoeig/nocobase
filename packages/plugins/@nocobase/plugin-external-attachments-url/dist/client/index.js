var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/plugins/@nocobase/plugin-external-attachments-url/src/client/index.tsx
var client_exports = {};
__export(client_exports, {
  AttachmentUrl: () => AttachmentUrl,
  PluginFiosAttachUrlClient: () => PluginFiosAttachUrlClient,
  default: () => client_default
});
module.exports = __toCommonJS(client_exports);
var import_react = require("@formily/react");
var import_client = require("@nocobase/client");
var import_react2 = __toESM(require("react"));
var DATA_SOURCE_NAME = "fios-test";
var ATTACHMENT_COLLECTION_NAME = "attachments";
var defaultToValueItem = (data) => {
  return data?.thumbnailRule ? `${data?.url}${data?.thumbnailRule}` : data?.url;
};
function useStorageRules(storage) {
  const name = storage ?? "";
  const { loading, data } = (0, import_client.useRequest)(
    {
      url: `storages:getBasicInfo/${name}`
    },
    {
      refreshDeps: [name]
    }
  );
  return !loading && data?.data || null;
}
function getFieldPathParts(field, fieldSchema) {
  const collectionField = fieldSchema?.["x-collection-field"];
  const parts = typeof collectionField === "string" ? collectionField.split(".").filter(Boolean) : [];
  const collectionName = field?.collectionName || (parts.length >= 2 ? parts[parts.length - 2] : void 0);
  const fieldName = field?.name || fieldSchema?.name || (parts.length >= 2 ? parts[parts.length - 1] : void 0);
  return {
    collectionName,
    fieldName,
    dataSourceName: parts.length >= 3 && parts[0] === DATA_SOURCE_NAME ? parts[0] : void 0
  };
}
function isFieldInDataSource(app, field, fieldSchema) {
  const { collectionName, fieldName } = getFieldPathParts(field, fieldSchema);
  if (!collectionName || !fieldName) {
    return false;
  }
  const dataSource = app?.dataSourceManager?.getDataSource?.(DATA_SOURCE_NAME);
  const collection = dataSource?.collectionManager?.getCollection?.(collectionName);
  const dataSourceField = collection?.getField?.(fieldName);
  return !!dataSourceField && (dataSourceField.target || ATTACHMENT_COLLECTION_NAME) === ATTACHMENT_COLLECTION_NAME;
}
function isFiosAttachmentField(options) {
  const { app, field, collection, dataSourceKey, dataBlockDataSource, fieldSchema } = options;
  const schemaField = fieldSchema?.["x-component-props"]?.field;
  const { dataSourceName } = getFieldPathParts(field || schemaField, fieldSchema);
  const currentDataSource = dataSourceKey || dataBlockDataSource || collection?.dataSource || field?.dataSourceKey || field?.dataSource || schemaField?.dataSourceKey || schemaField?.dataSource || fieldSchema?.["x-data-source"] || fieldSchema?.["x-data-source-key"] || fieldSchema?.["x-component-props"]?.dataSource || dataSourceName;
  const target = field?.target || ATTACHMENT_COLLECTION_NAME;
  return target === ATTACHMENT_COLLECTION_NAME && (currentDataSource === DATA_SOURCE_NAME || isFieldInDataSource(app, field || schemaField, fieldSchema));
}
function useFiosAttachmentUrlFieldProps(props) {
  const app = (0, import_client.useApp)();
  const field = (0, import_client.useCollectionField)();
  const fieldSchema = (0, import_react.useFieldSchema)();
  const collection = (0, import_client.useCollection_deprecated)();
  const dataSourceKey = (0, import_client.useDataSourceKey)();
  const dataBlockProps = (0, import_client.useDataBlockProps)();
  const rules = useStorageRules(field?.storage);
  const headers = isFiosAttachmentField({
    app,
    field,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema
  }) ? {
    ...props?.headers || {},
    "x-data-source": DATA_SOURCE_NAME
  } : props?.headers;
  return {
    ...props,
    headers,
    rules,
    action: `${field?.target || ATTACHMENT_COLLECTION_NAME}:create${field?.storage ? `?attachmentField=${field.collectionName}.${field.name}` : ""}`,
    toValueItem: defaultToValueItem,
    getThumbnailURL: (file) => {
      return file?.url;
    }
  };
}
var selectorSchema = {
  type: "void",
  "x-component": "AssociationField.Selector",
  title: '{{ t("Select record") }}',
  "x-component-props": {
    className: "nb-record-picker-selector"
  },
  properties: {
    grid: {
      type: "void",
      "x-component": "Grid",
      "x-initializer": "popup:tableSelector:addBlock",
      properties: {}
    },
    footer: {
      "x-component": "Action.Container.Footer",
      "x-component-props": {},
      properties: {
        actions: {
          type: "void",
          "x-component": "ActionBar",
          "x-component-props": {},
          properties: {
            submit: {
              title: '{{ t("Submit") }}',
              "x-action": "submit",
              "x-component": "Action",
              "x-use-component-props": "usePickActionProps",
              "x-toolbar": "ActionSchemaToolbar",
              "x-settings": "actionSettings:submit",
              "x-component-props": {
                type: "primary",
                htmlType: "submit"
              }
            }
          }
        }
      }
    }
  }
};
var useInsertSchema = (component) => {
  const fieldSchema = (0, import_react.useFieldSchema)();
  const { insertAfterBegin } = (0, import_client.useDesignable)();
  return (0, import_react2.useCallback)(
    (schema) => {
      const exists = fieldSchema.reduceProperties((buf, s) => {
        if (s["x-component"] === `AssociationField.${component}`) {
          return s;
        }
        return buf;
      }, null);
      if (!exists) {
        insertAfterBegin(JSON.parse(JSON.stringify(schema)));
      }
    },
    [component, fieldSchema, insertAfterBegin]
  );
};
var InnerAttachmentUrl = (props) => {
  const { value, onChange, toValueItem = defaultToValueItem, disabled, underFilter, ...others } = props;
  const fieldSchema = (0, import_react.useFieldSchema)();
  const [visibleSelector, setVisibleSelector] = (0, import_react2.useState)(false);
  const [selectedRows, setSelectedRows] = (0, import_react2.useState)([]);
  const fieldNames = (0, import_client.useFieldNames)(props);
  const field = (0, import_react.useField)();
  const [options, setOptions] = (0, import_react2.useState)();
  const insertSelector = useInsertSchema("Selector");
  const collection = (0, import_client.useCollection_deprecated)();
  const { getField } = collection;
  const collectionField = getField(field.props.name);
  const app = (0, import_client.useApp)();
  const dataSourceKey = (0, import_client.useDataSourceKey)();
  const dataBlockProps = (0, import_client.useDataBlockProps)();
  const isFiosAttachment = isFiosAttachmentField({
    app,
    field: collectionField,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema
  });
  const attachmentDataSource = isFiosAttachment ? DATA_SOURCE_NAME : "main";
  const attachmentHeaders = isFiosAttachment ? {
    ...others?.headers || {},
    "x-data-source": DATA_SOURCE_NAME
  } : others?.headers;
  const { modalProps } = (0, import_client.useActionContext)();
  const handleSelect = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    insertSelector(selectorSchema);
    setVisibleSelector(true);
    setSelectedRows([]);
  };
  (0, import_react2.useEffect)(() => {
    if (value && Object.keys(value).length > 0) {
      setOptions(value);
    } else {
      setOptions(null);
    }
  }, [value, fieldNames?.label]);
  const pickerProps = {
    size: "small",
    fieldNames,
    multiple: false,
    association: {
      target: collectionField?.target
    },
    options,
    onChange: props?.onChange,
    selectedRows,
    setSelectedRows,
    collectionField
  };
  const usePickActionProps = () => {
    const { setVisible } = (0, import_client.useActionContext)();
    const { selectedRows: selectedRows2, onChange: onChange2 } = (0, import_react2.useContext)(import_client.RecordPickerContext);
    return {
      onClick() {
        onChange2(toValueItem(selectedRows2?.[0]) || null);
        setVisible(false);
      }
    };
  };
  const useTableSelectorProps = () => {
    const {
      multiple,
      options: options2,
      setSelectedRows: setSelectedRows2,
      selectedRows: rcSelectRows = [],
      onChange: onChange2
    } = (0, import_react2.useContext)(import_client.RecordPickerContext);
    const { onRowSelectionChange, rowKey = "id", ...others2 } = (0, import_client.useTableSelectorProps)();
    const { setVisible } = (0, import_client.useActionContext)();
    return {
      ...others2,
      rowKey,
      rowSelection: {
        type: multiple ? "checkbox" : "radio",
        selectedRowKeys: rcSelectRows?.filter((item) => options2?.[rowKey] !== item[rowKey]).map((item) => item[rowKey])
      },
      onRowSelectionChange(selectedRowKeys, selectedRows2) {
        setSelectedRows2?.(selectedRows2);
        onRowSelectionChange?.(selectedRowKeys, selectedRows2);
        onChange2(toValueItem(selectedRows2?.[0]) || null);
        setVisible(false);
      }
    };
  };
  if (underFilter) {
    return /* @__PURE__ */ import_react2.default.createElement(import_client.Input, { ...props });
  }
  return /* @__PURE__ */ import_react2.default.createElement("div", { style: { width: "100%", overflow: "auto" } }, /* @__PURE__ */ import_react2.default.createElement(
    import_client.AssociationField.FileSelector,
    {
      toValueItem,
      value: options,
      quickUpload: fieldSchema["x-component-props"]?.quickUpload !== false,
      selectFile: collectionField?.target && collectionField?.target !== ATTACHMENT_COLLECTION_NAME ? fieldSchema["x-component-props"]?.selectFile !== false : false,
      action: others?.action || `${collectionField?.target || ATTACHMENT_COLLECTION_NAME}:create`,
      rules: others?.rules,
      getThumbnailURL: others?.getThumbnailURL,
      headers: attachmentHeaders,
      onSelect: handleSelect,
      onChange,
      disabled
    }
  ), /* @__PURE__ */ import_react2.default.createElement(
    import_client.ActionContextProvider,
    {
      value: {
        openMode: "drawer",
        visible: visibleSelector,
        setVisible: setVisibleSelector,
        modalProps: {
          getContainer: others?.getContainer || modalProps?.getContainer
        },
        formValueChanged: false
      }
    },
    collectionField?.target && collectionField?.target !== ATTACHMENT_COLLECTION_NAME && /* @__PURE__ */ import_react2.default.createElement(import_client.RecordPickerProvider, { ...pickerProps }, /* @__PURE__ */ import_react2.default.createElement(import_client.CollectionProvider_deprecated, { name: collectionField?.target, dataSource: attachmentDataSource }, /* @__PURE__ */ import_react2.default.createElement(import_client.FormProvider, null, /* @__PURE__ */ import_react2.default.createElement(import_client.TableSelectorParamsProvider, { params: {} }, /* @__PURE__ */ import_react2.default.createElement(import_client.SchemaComponentOptions, { scope: { usePickActionProps, useTableSelectorProps } }, /* @__PURE__ */ import_react2.default.createElement(
      import_react.RecursionField,
      {
        onlyRenderProperties: true,
        basePath: field.address,
        schema: fieldSchema,
        filterProperties: (s) => {
          return s["x-component"] === "AssociationField.Selector";
        }
      }
    ))))))
  ));
};
var FileManageReadPretty = (0, import_react.connect)((props) => {
  const { value } = props;
  const fieldSchema = (0, import_react.useFieldSchema)();
  const componentMode = fieldSchema?.["x-component-props"]?.["componentMode"];
  const { getField } = (0, import_client.useCollection_deprecated)();
  const { getCollectionJoinField } = (0, import_client.useCollectionManager_deprecated)();
  const collectionField = getField(fieldSchema.name) || getCollectionJoinField(fieldSchema["x-collection-field"]);
  if (componentMode === "url") {
    return /* @__PURE__ */ import_react2.default.createElement(import_client.EllipsisWithTooltip, { ellipsis: true }, value);
  }
  return /* @__PURE__ */ import_react2.default.createElement(import_client.EllipsisWithTooltip, { ellipsis: true }, collectionField ? /* @__PURE__ */ import_react2.default.createElement(import_client.Upload.ReadPretty, { ...props }) : null);
});
var AttachmentUrl = (0, import_react.connect)(InnerAttachmentUrl, (0, import_react.mapReadPretty)(FileManageReadPretty));
var PluginFiosAttachUrlClient = class extends import_client.Plugin {
  async load() {
    this.app.addScopes({ useAttachmentUrlFieldProps: useFiosAttachmentUrlFieldProps });
    this.app.addComponents({ AttachmentUrl });
  }
};
var client_default = PluginFiosAttachUrlClient;
