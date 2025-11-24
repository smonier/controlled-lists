export const FIND_NODE_QUERY = `
    query ControlledListsRoot($path: String!) {
        jcr {
            nodeByPath(path: $path) {
                uuid
                path
            }
        }
    }
`;

export const CONTROLLED_LISTS_QUERY = `
    query ControlledLists($rootPath: String!, $language: String!) {
        jcr {
            nodeByPath(path: $rootPath) {
                uuid
                path
                children(typesFilter: {types: ["cl:controlledList"]}) {
                    nodes {
                        uuid
                        path
                        name
                        title: property(name: "jcr:title", language: $language) {
                            value
                        }
                        description: property(name: "cl:description", language: $language) {
                            value
                        }
                        children(typesFilter: {types: ["cl:controlledTerm"]}) {
                            nodes {
                                uuid
                                path
                                name
                                termValue: property(name: "cl:value") {
                                    value
                                }
                                termLabel: property(name: "cl:label", language: $language) {
                                    value
                                }
                                termDescription: property(name: "cl:description", language: $language) {
                                    value
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;

export const CREATE_ROOT_MUTATION = `
    mutation CreateControlledListsRoot($parentPath: String!) {
        jcr(workspace: EDIT) {
            addNode(
                parentPathOrId: $parentPath
                name: "controlled-lists"
                primaryNodeType: "cl:listsFolder"
            ) {
                uuid
            }
        }
    }
`;

export const CREATE_LIST_MUTATION = `
    mutation CreateControlledList($parentPath: String!, $name: String!, $properties: [InputJCRProperty]!) {
        jcr(workspace: EDIT) {
            addNode(
                parentPathOrId: $parentPath
                name: $name
                primaryNodeType: "cl:controlledList"
                properties: $properties
            ) {
                uuid
            }
        }
    }
`;

export const UPDATE_LIST_MUTATION = `
    mutation UpdateControlledList($path: String!, $properties: [InputJCRProperty]!) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $path) {
                setPropertiesBatch(properties: $properties) {
                    property {
                        name
                    }
                }
                uuid
            }
        }
    }
`;

export const DELETE_NODE_MUTATION = `
    mutation DeleteControlledListNode($path: String!) {
        jcr(workspace: EDIT) {
            deleteNode(pathOrId: $path)
        }
    }
`;

export const CREATE_TERM_MUTATION = `
    mutation CreateControlledTerm($parentPath: String!, $name: String!, $properties: [InputJCRProperty]!) {
        jcr(workspace: EDIT) {
            addNode(
                parentPathOrId: $parentPath
                name: $name
                primaryNodeType: "cl:controlledTerm"
                properties: $properties
            ) {
                uuid
            }
        }
    }
`;

export const UPDATE_TERM_MUTATION = `
    mutation UpdateControlledTerm($path: String!, $properties: [InputJCRProperty]!) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $path) {
                setPropertiesBatch(properties: $properties) {
                    property {
                        name
                    }
                }
                uuid
            }
        }
    }
`;

export const SITE_LANGUAGES_QUERY = `
    query ControlledListLanguages($sitePath: String!) {
        jcr {
            nodeByPath(path: $sitePath) {
                site {
                    languages {
                        displayName
                        language
                        activeInEdit
                    }
                }
            }
        }
    }
`;

export const RENAME_NODE_MUTATION = `
    mutation RenameControlledList($path: String!, $name: String!) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $path) {
                rename(name: $name)
            }
        }
    }
`;

export const REORDER_TERMS_MUTATION = `
    mutation ReorderControlledTerms($path: String!, $names: [String]!) {
        jcr(workspace: EDIT) {
            mutateNode(pathOrId: $path) {
                reorderChildren(names: $names)
            }
        }
    }
`;

export const CONTROLLED_LISTS_SELECTOR_QUERY = `
    query SelectorControlledLists($rootPath: String!, $language: String!) {
        jcr {
            nodeByPath(path: $rootPath) {
                children(typesFilter: {types: ["cl:controlledList"]}) {
                    nodes {
                        uuid
                        name
                        title: property(name: "jcr:title", language: $language) {
                            value
                        }
                        children(typesFilter: {types: ["cl:controlledTerm"]}) {
                            nodes {
                                uuid
                                termValue: property(name: "cl:value") {
                                    value
                                }
                                termLabel: property(name: "cl:label", language: $language) {
                                    value
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`;
