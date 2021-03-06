import k8s from '@kubernetes/client-node';
import {capitalizeFirstLetter} from './capitalize-first-letter.js';
import {k8sKind} from './k8s-kind.js';
import yaml from 'yaml';

/**
 * Create a kubernetes javascript client object.
 *
 * @param {String | object} configuration A string of valid YAML defining a kubernetes manifest. An yaml object is also acceptible.
 * @return {any} A kubernetes javascript client object with its fields filled as specified.
 */
const k8sManifest = (configuration) => {
  if (!configuration) {
    throw new Error(`The configuration must be defined.`);
  }

  if (clientObjectType(configuration.constructor.name)) {
    return configuration;
  }

  let yamlConfig = configuration;
  if (typeof configuration === 'string') {
    yamlConfig = yaml.parse(configuration);
  }

  if (!yamlConfig.apiVersion) {
    throw new Error(
      `The api version needs to be set to be considered a valid k8s manifest.`
    );
  }

  if (!yamlConfig.kind) {
    throw new Error(
      `The kind needs to be set to be considered a valid k8s manifest.`
    );
  }

  const version = objectVersion(yamlConfig.apiVersion);
  const kind = k8sKind(yamlConfig.kind);

  let objectType = `${version}${kind}`;
  if (clientObjectType(objectType)) {
    /** Do nothing */
  } else if (
    clientObjectType(`${objectPrefix(yamlConfig.apiVersion)}${objectType}`)
  ) {
    objectType = `${objectPrefix(yamlConfig.apiVersion)}${objectType}`;
  } else if (clientObjectType(`Core${objectType}`)) {
    objectType = `Core${objectType}`;
  } else {
    throw new Error(
      `The kind ${yamlConfig.kind} mapped to ${objectType} and couldn't be mapped to a corresponding client object type.`
    );
  }

  return k8sClientObject(objectType, yamlConfig);
};

/**
 * Convert a kubernetes javascript client object to a string.
 *
 * @param {any} manifest The kubernetes javascript client object.
 * @return {String} String representation of the kubernetes javascript client object.
 */
const stringify = (manifest) => {
  return k8s.dumpYaml(manifest);
};

/**
 * Convert a kubernetes javascript client object to a regular javascript object.
 *
 * @param {any} manifest The kubernetes javascript client object.
 * @return {Object} Standard javascript object representation of the kubernetes javascript client object.
 */
const objectify = (manifest) => {
  const yamlString = stringify(manifest);

  return yaml.parse(yamlString);
};

const k8sClientObject = (typeName, value) => {
  if (clientObjectType(typeName)) {
    return handleClientObjectType(typeName, value);
  } else if (arrayType(typeName)) {
    return handleArrayType(typeName, value);
  } else if (mapType(typeName)) {
    return handleMap(typeName, value);
  } else {
    if (dateType(typeName) && !!value) {
      return new Date(value);
    }

    return value;
  }
};

const dateType = (typeName) => {
  return typeName.toLowerCase() === 'date';
};

const arrayType = (typeName) => {
  return typeName.includes('Array');
};

const mapType = (typeName) => {
  return typeName.includes('{');
};

const clientObjectType = (typeName) => {
  return typeName in k8s;
};

const attributeTypeMap = (typeName, attributeName) => {
  const attributeTypeMaps = k8s[typeName].getAttributeTypeMap();

  let targetTypeMap = {};
  for (const prospectiveTypeMap of attributeTypeMaps) {
    if (prospectiveTypeMap.name === attributeName) {
      targetTypeMap = prospectiveTypeMap;
    }
  }

  if (emptyMap(targetTypeMap)) {
    throw new Error(`
            The attribute with name ${attributeName} and type ${typeName} wasn't found in the type map. Are you sure it's acceptible in kubernetes yaml configurations?
        `);
  }

  return targetTypeMap;
};

const handleArrayType = (typeName, value) => {
  const subject = [];

  const elementType = typeName.match(/(?<=Array<)(.*?)(?=>)/)[0];

  if (!elementType) {
    throw new Error(`Could not match array element type for type ${typeName}`);
  }

  for (const entry of value) {
    subject.push(k8sClientObject(elementType, entry));
  }

  return subject;
};

const handleMap = (typeName, value) => {
  const subject = {};

  const propertyType = typeName.match(/(?<=\{ \[key: \w+\]: )(.*?)(?=; \})/)[0];

  for (const attribute in value) {
    if (Object.prototype.hasOwnProperty.call(value, attribute)) {
      subject[attribute] = k8sClientObject(propertyType, value[attribute]);
    }
  }

  return subject;
};

const handleClientObjectType = (typeName, value) => {
  const subject = new k8s[typeName]();

  for (const attribute in value) {
    if (Object.prototype.hasOwnProperty.call(value, attribute)) {
      const targetTypeMap = attributeTypeMap(typeName, attribute);

      subject[attribute] = k8sClientObject(
        targetTypeMap.type,
        value[attribute]
      );
    }
  }

  return subject;
};

const objectPrefix = (apiVersion) => {
  const apiPart = apiVersion.split('/')[0];
  const apiComponents = apiPart.split('.');

  /**
   * The convention seems to include ending with .k8s.io which is why we subtract 2.
   */
  let prefix = capitalizeFirstLetter(apiComponents[0]);
  for (let i = 1; i < apiComponents.length - 2; i++) {
    prefix = prefix.concat(capitalizeFirstLetter(apiComponents[i]));
  }

  return prefix;
};

const objectVersion = (apiVersion) => {
  if (!apiVersion.includes('/')) {
    return capitalizeFirstLetter(apiVersion);
  } else {
    const parts = apiVersion.split('/');
    const lastPart = parts[parts.length - 1];
    return capitalizeFirstLetter(lastPart);
  }
};

const emptyMap = (map) => {
  return Object.keys(map).length === 0;
};

export {
  k8sManifest,
  stringify,
  objectify,
  k8sClientObject,
  objectPrefix,
  clientObjectType,
};
