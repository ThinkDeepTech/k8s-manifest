import k8s from "@kubernetes/client-node";
import { capitalizeFirstLetter } from "./capitalize-first-letter.mjs";
import { k8sKind } from "./k8s-kind.mjs";
import yaml from "yaml";

/**
 * Create a kubernetes javascript client object.
 *
 * @param {String | object} configuration A string of valid YAML defining a kubernetes manifest. An yaml object is also acceptible.
 * @return {any} A kubernetes javascript client object with its fields filled as specified.
 */
const k8sManifest = (configuration) => {

    let yamlConfig = configuration;
    if ((typeof configuration === 'string')) {
        yamlConfig = yaml.parse(configuration);
    }

    if (!yamlConfig?.apiVersion) {
        yamlConfig.apiVersion = yamlConfig.groupVersion;
    }

    if (!yamlConfig.apiVersion) {
        throw new Error(`The api version needs to be set to be considered a valid k8s manifest.`);
    }

    if (!yamlConfig.kind) {
        throw new Error(`The kind needs to be set to be considered a valid k8s manifest.`);
    }

    const objectPrefix = objectVersion(yamlConfig.apiVersion);
    const objectKind = k8sKind(yamlConfig.kind);
    const target = k8sClientObject(`${objectPrefix}${objectKind}`, yamlConfig);

    return target;
};

/**
 * Convert a kubernetes javascript client object to a string.
 *
 * @param {any} manifest The kubernetes javascript client object.
 * @returns String representation of the kubernetes javascript client object.
 */
const stringify = (manifest) => {
    return k8s.dumpYaml(manifest);
}

const objectify = (manifest) => {

    const yamlString = stringify(manifest);

    return yaml.parse(yamlString);
}

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
}

const dateType = (typeName) => {
    return typeName.toLowerCase() === 'date';
}

const arrayType = (typeName) => {
    return typeName.includes('Array');
}

const mapType = (typeName) => {
    return typeName.includes('{');
}

const clientObjectType = (typeName) => {
    return typeName in k8s;
};

const attributeTypeMap = (typeName, attributeName) => {

    const attributeTypeMaps = k8s[typeName]['getAttributeTypeMap']();

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
}

const handleArrayType = (typeName, value) => {

    let subject = [];

    const elementType = typeName.match(/(?<=Array\<)(.*?)(?=\>)/)[0];

    if (!elementType) {
        throw new Error(`Could not match array element type for type ${typeName}`);
    }

    for (const entry of value) {
        subject.push(k8sClientObject(elementType, entry));
    }

    return subject;
}

const handleMap = (typeName, value) => {

    let subject = {};

    const propertyType = typeName.match(/(?<=\{ \[key: \w+\]: )(.*?)(?=; \})/)[0];

    for (const attribute in value) {
        subject[attribute] = k8sClientObject(propertyType, value[attribute]);
    }

    return subject;
}

const handleClientObjectType = (typeName, value) => {

    const subject = new k8s[typeName]();

    for (const attribute in value) {

        const targetTypeMap = attributeTypeMap(typeName, attribute);

        subject[attribute] = k8sClientObject(targetTypeMap.type, value[attribute]);

    }

    return subject;
}

const objectVersion = (apiVersion) => {
    if (!apiVersion.includes('/')) {
        return capitalizeFirstLetter(apiVersion);
    } else {

        const parts = apiVersion.split('/');
        const lastPart = parts[parts.length - 1];
        return capitalizeFirstLetter(lastPart);
    }
}


const emptyMap = (map) => {
    return Object.keys(map).length === 0;
}

export { k8sManifest, stringify, objectify, k8sClientObject };