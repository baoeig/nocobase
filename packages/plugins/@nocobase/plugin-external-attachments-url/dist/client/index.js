define('@nocobase/plugin-fios-attach-url', ['@formily/react', '@nocobase/client', 'react'], function(__formilyReact, __nocobaseClient, __react) {
  var module = { exports: {} };
  var exports = module.exports;
  function require(id) {
    if (id === '@formily/react') return __formilyReact;
    if (id === '@nocobase/client') return __nocobaseClient;
    if (id === 'react') return __react;
    throw new Error('[fios-attach-url] Cannot resolve dependency: ' + id);
  }
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
var DEBUG_PREFIX = "[fios-attach-url]";
var INTERCEPTOR_FLAG = "__fiosAttachmentUrlInterceptor";
console.warn(DEBUG_PREFIX, "client module evaluated", {
  dataSource: DATA_SOURCE_NAME,
  attachmentCollection: ATTACHMENT_COLLECTION_NAME
});
var defaultToValueItem = (data) => {
  return data?.thumbnailRule ? `${data?.url}${data?.thumbnailRule}` : data?.url;
};
function useOptionalDataBlockProps() {
  const context = (0, import_react2.useContext)(import_client.DataBlockContext);
  return context?.props || {};
}
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
function summarizeField(field) {
  if (!field) {
    return null;
  }
  return {
    name: field.name,
    collectionName: field.collectionName,
    target: field.target,
    targetKey: field.targetKey,
    interface: field.interface,
    storage: field.storage,
    dataSource: field.dataSource,
    dataSourceKey: field.dataSourceKey
  };
}
function getFieldInDataSourceInfo(app, field, fieldSchema) {
  const { collectionName, fieldName } = getFieldPathParts(field, fieldSchema);
  if (!collectionName || !fieldName) {
    return {
      collectionName,
      fieldName,
      dataSourceExists: false,
      collectionExists: false,
      fieldExists: false,
      matchesAttachmentTarget: false
    };
  }
  const dataSource = app?.dataSourceManager?.getDataSource?.(DATA_SOURCE_NAME);
  const collection = dataSource?.collectionManager?.getCollection?.(collectionName);
  const dataSourceField = collection?.getField?.(fieldName);
  const matchesAttachmentTarget = !!dataSourceField && (dataSourceField.target || ATTACHMENT_COLLECTION_NAME) === ATTACHMENT_COLLECTION_NAME;
  return {
    collectionName,
    fieldName,
    dataSourceExists: !!dataSource,
    collectionExists: !!collection,
    fieldExists: !!dataSourceField,
    fieldTarget: dataSourceField?.target,
    field: summarizeField(dataSourceField),
    matchesAttachmentTarget
  };
}
function getFiosAttachmentDecision(options) {
  const { app, field, collection, dataSourceKey, dataBlockDataSource, fieldSchema } = options;
  const schemaField = fieldSchema?.["x-component-props"]?.field;
  const fieldPathParts = getFieldPathParts(field || schemaField, fieldSchema);
  const currentDataSource = dataSourceKey || dataBlockDataSource || collection?.dataSource || field?.dataSourceKey || field?.dataSource || schemaField?.dataSourceKey || schemaField?.dataSource || fieldSchema?.["x-data-source"] || fieldSchema?.["x-data-source-key"] || fieldSchema?.["x-component-props"]?.dataSource || fieldPathParts.dataSourceName;
  const target = field?.target || ATTACHMENT_COLLECTION_NAME;
  const dataSourceLookup = getFieldInDataSourceInfo(app, field || schemaField, fieldSchema);
  const isFiosAttachment = target === ATTACHMENT_COLLECTION_NAME && (currentDataSource === DATA_SOURCE_NAME || dataSourceLookup.matchesAttachmentTarget);
  return {
    isFiosAttachment,
    currentDataSource,
    target,
    expectedDataSource: DATA_SOURCE_NAME,
    fieldPathParts,
    dataSourceLookup,
    context: {
      dataSourceKey,
      dataBlockDataSource,
      collectionName: collection?.name,
      collectionDataSource: collection?.dataSource
    },
    field: summarizeField(field),
    schemaField: summarizeField(schemaField),
    fieldSchema: {
      name: fieldSchema?.name,
      xCollectionField: fieldSchema?.["x-collection-field"],
      xDataSource: fieldSchema?.["x-data-source"],
      xDataSourceKey: fieldSchema?.["x-data-source-key"],
      componentDataSource: fieldSchema?.["x-component-props"]?.dataSource
    }
  };
}
function getUrlInfo(url) {
  if (!url || typeof url !== "string") {
    return {};
  }
  const [action = "", query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  return {
    action,
    attachmentField: params.get("attachmentField") || void 0
  };
}
function getFieldInDataSourceByPath(app, fieldPath) {
  if (!fieldPath) {
    return null;
  }
  const parts = fieldPath.split(".").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const fieldName = parts.pop();
  const collectionName = parts.pop();
  const dataSource = app?.dataSourceManager?.getDataSource?.(DATA_SOURCE_NAME);
  const collection = dataSource?.collectionManager?.getCollection?.(collectionName);
  const field = collection?.getField?.(fieldName);
  if (!field || (field.target || ATTACHMENT_COLLECTION_NAME) !== ATTACHMENT_COLLECTION_NAME) {
    return null;
  }
  return {
    collectionName,
    fieldName,
    field
  };
}
function registerUploadRequestInterceptor(app) {
  const apiClient = app?.apiClient;
  if (!apiClient?.axios || apiClient[INTERCEPTOR_FLAG]) {
    return;
  }
  apiClient[INTERCEPTOR_FLAG] = true;
  apiClient.axios.interceptors.request.use((config) => {
    const { action, attachmentField } = getUrlInfo(config?.url);
    const fieldInfo = getFieldInDataSourceByPath(app, attachmentField);
    if (action === `${ATTACHMENT_COLLECTION_NAME}:create` && fieldInfo) {
      config.headers = config.headers || {};
      config.headers["x-data-source"] = config.headers["x-data-source"] || DATA_SOURCE_NAME;
      console.warn(DEBUG_PREFIX, "request interceptor added x-data-source", {
        url: config.url,
        action,
        attachmentField,
        dataSource: DATA_SOURCE_NAME,
        field: summarizeField(fieldInfo.field),
        headers: config.headers
      });
    }
    return config;
  });
  console.warn(DEBUG_PREFIX, "request interceptor registered", {
    dataSource: DATA_SOURCE_NAME,
    attachmentCollection: ATTACHMENT_COLLECTION_NAME
  });
}
function useFiosAttachmentUrlFieldProps(props) {
  const app = (0, import_client.useApp)();
  const field = (0, import_client.useCollectionField)();
  const fieldSchema = (0, import_react.useFieldSchema)();
  const collection = (0, import_client.useCollection_deprecated)();
  const dataSourceKey = (0, import_client.useDataSourceKey)();
  const dataBlockProps = useOptionalDataBlockProps();
  const rules = useStorageRules(field?.storage);
  const decision = getFiosAttachmentDecision({
    app,
    field,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema
  });
  const headers = decision.isFiosAttachment ? {
    ...props?.headers || {},
    "x-data-source": DATA_SOURCE_NAME
  } : props?.headers;
  const action = `${field?.target || ATTACHMENT_COLLECTION_NAME}:create${field?.storage ? `?attachmentField=${field.collectionName}.${field.name}` : ""}`;
  (0, import_react2.useEffect)(() => {
    console.warn(DEBUG_PREFIX, "useAttachmentUrlFieldProps decision", {
      decision,
      action,
      headers,
      originalHeaders: props?.headers,
      rules
    });
  }, [
    action,
    collection?.dataSource,
    collection?.name,
    dataBlockProps?.dataSource,
    dataSourceKey,
    decision.isFiosAttachment,
    field?.collectionName,
    field?.name,
    field?.target,
    fieldSchema?.["x-collection-field"],
    headers?.["x-data-source"],
    props?.headers,
    rules
  ]);
  return {
    ...props,
    headers,
    rules,
    action,
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
  const dataBlockProps = useOptionalDataBlockProps();
  const decision = getFiosAttachmentDecision({
    app,
    field: collectionField,
    collection,
    dataSourceKey,
    dataBlockDataSource: dataBlockProps?.dataSource,
    fieldSchema
  });
  const attachmentDataSource = decision.isFiosAttachment ? DATA_SOURCE_NAME : "main";
  const attachmentHeaders = decision.isFiosAttachment ? {
    ...others?.headers || {},
    "x-data-source": DATA_SOURCE_NAME
  } : others?.headers;
  const { modalProps } = (0, import_client.useActionContext)();
  (0, import_react2.useEffect)(() => {
    console.warn(DEBUG_PREFIX, "AttachmentUrl component decision", {
      decision,
      attachmentDataSource,
      attachmentHeaders,
      action: others?.action || `${collectionField?.target || ATTACHMENT_COLLECTION_NAME}:create`,
      fieldName: field.props.name,
      originalHeaders: others?.headers
    });
  }, [
    attachmentDataSource,
    attachmentHeaders?.["x-data-source"],
    collection?.dataSource,
    collection?.name,
    collectionField?.collectionName,
    collectionField?.name,
    collectionField?.target,
    dataBlockProps?.dataSource,
    dataSourceKey,
    decision.isFiosAttachment,
    field.props.name,
    fieldSchema?.["x-collection-field"],
    others?.action,
    others?.headers
  ]);
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
    console.warn(DEBUG_PREFIX, "client plugin loaded", {
      dataSource: DATA_SOURCE_NAME,
      attachmentCollection: ATTACHMENT_COLLECTION_NAME
    });
    registerUploadRequestInterceptor(this.app);
    this.app.addScopes({ useAttachmentUrlFieldProps: useFiosAttachmentUrlFieldProps });
    this.app.addComponents({ AttachmentUrl });
  }
};
var client_default = PluginFiosAttachUrlClient;

  return module.exports;
});
