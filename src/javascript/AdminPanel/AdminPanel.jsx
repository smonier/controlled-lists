import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    LayoutContent,
    Header,
    Paper,
    Button,
    Input,
    Typography,
    Table,
    TableHead,
    TableHeadCell,
    TableRow,
    TableBody,
    TableBodyCell
} from '@jahia/moonstone';
import axios from 'axios';
import {useTranslation} from 'react-i18next';
import {
    CONTROLLED_LISTS_QUERY,
    CREATE_LIST_MUTATION,
    CREATE_ROOT_MUTATION,
    CREATE_TERM_MUTATION,
    DELETE_NODE_MUTATION,
    FIND_NODE_QUERY,
    UPDATE_LIST_MUTATION,
    UPDATE_TERM_MUTATION,
    SITE_LANGUAGES_QUERY,
    RENAME_NODE_MUTATION,
    REORDER_TERMS_MUTATION
} from '../graphql/controlledLists.queries';
import styles from './AdminPanel.module.scss';
import {TermImportDialog} from './TermImportDialog';
import {TermEditDialog} from './TermEditDialog';
import {getFlagEmoji} from './flags';

const defaultListForm = {
    uuid: null,
    path: '',
    systemName: '',
    title: '',
    description: ''
};

const defaultTermForm = {
    uuid: null,
    path: '',
    value: '',
    label: '',
    description: ''
};

const slugify = value => value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const ensureUniqueName = (value, existingNames, fallbackPrefix) => {
    const base = slugify(value) || fallbackPrefix;
    if (!existingNames.includes(base)) {
        return base;
    }

    let suffix = 1;
    while (existingNames.includes(`${base}-${suffix}`)) {
        suffix += 1;
    }

    return `${base}-${suffix}`;
};

const askConfirmation = message => {
    // eslint-disable-next-line no-alert
    return window.confirm(message);
};

const reorderTermCollection = (terms, sourceIndex, targetIndex) => {
    if (!Array.isArray(terms) || terms.length < 2) {
        return null;
    }

    if ((sourceIndex === null || sourceIndex === undefined) || (targetIndex === null || targetIndex === undefined) ||
        sourceIndex < 0 || sourceIndex >= terms.length) {
        return null;
    }

    const clampedTarget = Math.max(0, Math.min(targetIndex, terms.length));
    const nextOrder = [...terms];
    const [moved] = nextOrder.splice(sourceIndex, 1);

    if (!moved) {
        return null;
    }

    const insertIndex = sourceIndex < clampedTarget ? clampedTarget - 1 : clampedTarget;
    nextOrder.splice(insertIndex, 0, moved);

    const unchanged = nextOrder.length === terms.length && nextOrder.every((term, idx) => term.uuid === terms[idx].uuid);
    return unchanged ? null : nextOrder;
};

const mapListNode = node => ({
    uuid: node.uuid,
    path: node.path,
    name: node.name,
    systemName: node.name,
    title: node.title?.value || node.name,
    description: node.description?.value || '',
    terms: (node.children?.nodes || []).map(term => ({
        uuid: term.uuid,
        path: term.path,
        name: term.name,
        value: term.name,
        label: term.termLabel?.value || term.name,
        description: term.termDescription?.value || ''
    }))
});

const normalizeLanguages = langs => {
    if (!Array.isArray(langs)) {
        return [];
    }

    const seen = new Set();
    const normalized = [];
    langs.forEach(lang => {
        if (!lang) {
            return;
        }

        const code = lang.code;
        if (!code || seen.has(code)) {
            return;
        }

        normalized.push({
            code,
            displayName: lang.displayName || code
        });
        seen.add(code);
    });

    return normalized;
};

export const AdminPanel = () => {
    const {
        t,
        i18n: {language: uiLanguage}
    } = useTranslation('controlled-lists');

    const context = window.contextJsParameters || {};
    const siteKey = context.siteKey || context.site?.key || '';
    const siteName = context.site?.displayName || context.site?.name || siteKey || '';
    const [language, setLanguage] = useState(uiLanguage || 'en');
    const graphqlEndpoint = `${context.contextPath || ''}/modules/graphql`;
    const initialSiteLanguages = normalizeLanguages((context.siteLanguages || []).map(lang => (typeof lang === 'string' ? {code: lang, displayName: lang} : {
        code: lang.language || lang.code,
        displayName: lang.displayName || lang.language || lang.code
    })).filter(lang => lang.code));
    const [siteLanguages, setSiteLanguages] = useState(initialSiteLanguages);

    const [rootPath, setRootPath] = useState('');
    const [lists, setLists] = useState([]);
    const [selectedListId, setSelectedListId] = useState(null);
    const [showCreateList, setShowCreateList] = useState(false);
    const [listForm, setListForm] = useState(defaultListForm);
    const [termForm, setTermForm] = useState(defaultTermForm);
    const [loading, setLoading] = useState(false);
    const [savingList, setSavingList] = useState(false);
    const [savingTerm, setSavingTerm] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [error, setError] = useState(null);
    const [isImportDialogOpen, setImportDialogOpen] = useState(false);
    const [importingTerms, setImportingTerms] = useState(false);
    const [isEditDialogOpen, setEditDialogOpen] = useState(false);
    const [editTermForm, setEditTermForm] = useState(defaultTermForm);
    const [reorderingTerms, setReorderingTerms] = useState(false);
    const [dragState, setDragState] = useState({sourceIndex: null, targetIndex: null});

    useEffect(() => {
        setLanguage(uiLanguage || 'en');
    }, [uiLanguage]);

    const executeQuery = useCallback(async (query, variables) => {
        const response = await axios.post(graphqlEndpoint, {query, variables}, {
            headers: {'Content-Type': 'application/json'},
            withCredentials: true
        });

        if (response.data?.errors?.length) {
            const message = response.data.errors.map(err => err.message).join('\n');
            throw new Error(message);
        }

        return response.data.data;
    }, [graphqlEndpoint]);

    const selectedList = useMemo(
        () => lists.find(list => list.uuid === selectedListId) || null,
        [lists, selectedListId]
    );

    const resetDragState = useCallback(() => {
        setDragState({sourceIndex: null, targetIndex: null});
    }, []);

    useEffect(() => {
        resetDragState();
        setReorderingTerms(false);
    }, [resetDragState, selectedListId, showCreateList]);

    useEffect(() => {
        if (rootPath) {
            refreshLists(rootPath);
        }
    }, [language, refreshLists, rootPath]);

    useEffect(() => {
        if (feedback) {
            const timer = setTimeout(() => setFeedback(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [feedback]);

    const ensureRoot = useCallback(async () => {
        if (!siteKey) {
            throw new Error(t('errors.missingSite'));
        }

        const baseContentPath = `/sites/${siteKey}/contents`;
        const targetPath = `${baseContentPath}/controlled-lists`;
        const data = await executeQuery(FIND_NODE_QUERY, {path: targetPath});

        if (!data?.jcr?.nodeByPath) {
            await executeQuery(CREATE_ROOT_MUTATION, {parentPath: baseContentPath});
        }

        return targetPath;
    }, [executeQuery, siteKey, t]);

    const refreshLists = useCallback(async (path, nextSelection) => {
        if (!path) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await executeQuery(CONTROLLED_LISTS_QUERY, {rootPath: path, language});
            const mapped = (data?.jcr?.nodeByPath?.children?.nodes || []).map(mapListNode);
            mapped.sort((a, b) => a.title.localeCompare(b.title, language, {sensitivity: 'base'}));
            setLists(mapped);

            if (nextSelection) {
                setSelectedListId(nextSelection);
                setShowCreateList(false);
            } else if (!showCreateList) {
                const stillExists = mapped.some(list => list.uuid === selectedListId);
                if (!stillExists) {
                    setSelectedListId(mapped[0]?.uuid || null);
                }
            }
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    }, [executeQuery, language, selectedListId, showCreateList]);

    useEffect(() => {
        let active = true;

        const bootstrap = async () => {
            if (!siteKey) {
                setError(new Error(t('errors.missingSite')));
                return;
            }

            try {
                const path = await ensureRoot();
                if (!active) {
                    return;
                }

                setRootPath(path);
                await refreshLists(path);
            } catch (err) {
                if (active) {
                    setError(err);
                }
            }
        };

        bootstrap();

        return () => {
            active = false;
        };
    }, [ensureRoot, refreshLists, siteKey, t]);

    useEffect(() => {
        if (!siteKey) {
            setSiteLanguages([]);
            return;
        }

        let mounted = true;
        const fetchLanguages = async () => {
            try {
                const data = await executeQuery(SITE_LANGUAGES_QUERY, {sitePath: `/sites/${siteKey}`});
                const langs = data?.jcr?.nodeByPath?.site?.languages?.filter(lang => lang.activeInEdit) ?? [];
                if (mounted && langs.length) {
                    const normalized = normalizeLanguages(langs.map(lang => ({
                        code: lang.language,
                        displayName: lang.displayName || lang.language
                    })));
                    setSiteLanguages(normalized);

                    if (!normalized.find(lang => lang.code === language) && normalized[0]) {
                        setLanguage(normalized[0].code);
                    }
                }
            } catch (err) {
                console.warn('Failed to load site languages', err);
            }
        };

        fetchLanguages();
        return () => {
            mounted = false;
        };
    }, [executeQuery, language, siteKey]);

    useEffect(() => {
        if (showCreateList) {
            setListForm({...defaultListForm});
        } else if (selectedList) {
            setListForm({
                uuid: selectedList.uuid,
                path: selectedList.path,
                systemName: selectedList.systemName,
                title: selectedList.title,
                description: selectedList.description
            });
        } else {
            setListForm({...defaultListForm});
        }

        setTermForm({...defaultTermForm});
        setEditDialogOpen(false);
    }, [selectedList, showCreateList, language]);

    const handleListChange = (field, value) => {
        setListForm(prev => ({...prev, [field]: value}));
    };

    const handleTermChange = (field, value) => {
        setTermForm(prev => ({...prev, [field]: value}));
    };

    const notify = (type, key, params) => {
        setFeedback({type, message: t(key, params)});
    };

    const handleSaveList = async event => {
        event.preventDefault();
        if (!rootPath) {
            return;
        }

        const systemName = listForm.systemName.trim();
        const title = listForm.title.trim();
        const description = listForm.description.trim();

        if (!systemName || !title) {
            setFeedback({type: 'error', message: t('errors.requiredFields')});
            return;
        }

        const duplicate = lists.some(
            list => list.uuid !== listForm.uuid && list.systemName.toLowerCase() === systemName.toLowerCase()
        );
        if (duplicate) {
            setFeedback({type: 'error', message: t('errors.duplicateSystemName', {name: systemName})});
            return;
        }

        const properties = [
            {name: 'jcr:title', value: title, language},
            {name: 'cl:description', value: description || '', language}
        ];

        setSavingList(true);
        try {
            if (showCreateList) {
                const existingNames = lists.map(list => list.name);
                const name = ensureUniqueName(systemName, existingNames, 'controlled-list');
                const data = await executeQuery(CREATE_LIST_MUTATION, {parentPath: rootPath, name, properties});
                const newUuid = data?.jcr?.addNode?.uuid || null;
                notify('success', 'feedback.listCreated');
                setShowCreateList(false);
                await refreshLists(rootPath, newUuid);
            } else if (selectedList) {
                await executeQuery(UPDATE_LIST_MUTATION, {path: selectedList.path, properties});

                if (selectedList.systemName !== systemName) {
                    await executeQuery(RENAME_NODE_MUTATION, {path: selectedList.path, name: systemName});
                }

                notify('success', 'feedback.listUpdated');
                await refreshLists(rootPath, selectedList.uuid);
            }
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        } finally {
            setSavingList(false);
        }
    };

    const handleDeleteList = async list => {
        if (!rootPath || !list) {
            return;
        }

        if (!askConfirmation(t('lists.deleteConfirm', {title: list.title}))) {
            return;
        }

        try {
            await executeQuery(DELETE_NODE_MUTATION, {path: list.path});
            notify('success', 'feedback.listDeleted');
            await refreshLists(rootPath);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        }
    };

    const beginCreateList = () => {
        setShowCreateList(true);
        setSelectedListId(null);
        setListForm({...defaultListForm});
        setTermForm({...defaultTermForm});
        resetDragState();
    };

    const handleLanguageChange = code => {
        if (!code || code === language) {
            return;
        }

        setLanguage(code);
    };

    const handleEditTerm = term => {
        setEditDialogOpen(true);
        setEditTermForm({
            uuid: term.uuid,
            path: term.path,
            value: term.value,
            label: term.label,
            description: term.description || ''
        });
    };

    const handleSaveTerm = async event => {
        event.preventDefault();
        if (!selectedList) {
            return;
        }

        const rawSystemName = termForm.value.trim();
        const label = termForm.label.trim();
        const description = termForm.description.trim();

        if (!rawSystemName || !label) {
            setFeedback({type: 'error', message: t('errors.requiredFields')});
            return;
        }

        const systemName = slugify(rawSystemName);
        if (!systemName) {
            setFeedback({type: 'error', message: t('errors.invalidSystemName')});
            return;
        }

        const duplicate = selectedList.terms.some(
            term => term.uuid !== termForm.uuid && term.name.toLowerCase() === systemName.toLowerCase()
        );
        if (duplicate) {
            setFeedback({type: 'error', message: t('errors.duplicateTermValue', {value: systemName})});
            return;
        }

        const properties = [
            {name: 'jcr:title', value: label, language},
            {name: 'cl:description', value: description || '', language}
        ];

        setSavingTerm(true);

        try {
            if (termForm.uuid) {
                await executeQuery(UPDATE_TERM_MUTATION, {path: termForm.path, properties});
                if (termForm.value !== systemName) {
                    await executeQuery(RENAME_NODE_MUTATION, {path: termForm.path, name: systemName});
                }

                notify('success', 'feedback.termUpdated');
            } else {
                await executeQuery(CREATE_TERM_MUTATION, {
                    parentPath: selectedList.path,
                    name: systemName,
                    properties
                });

                notify('success', 'feedback.termCreated');
            }

            setTermForm({...defaultTermForm});
            await refreshLists(rootPath, selectedList.uuid);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        } finally {
            setSavingTerm(false);
        }
    };

    const handleEditFieldChange = (field, value) => {
        setEditTermForm(prev => ({...prev, [field]: value}));
    };

    const handleEditDialogSave = async () => {
        if (!selectedList) {
            return;
        }

        const rawSystemName = editTermForm.value.trim();
        const label = editTermForm.label.trim();
        const description = editTermForm.description.trim();

        if (!rawSystemName || !label) {
            setFeedback({type: 'error', message: t('errors.requiredFields')});
            return;
        }

        const systemName = slugify(rawSystemName);
        if (!systemName) {
            setFeedback({type: 'error', message: t('errors.invalidSystemName')});
            return;
        }

        const duplicate = selectedList.terms.some(
            term => term.uuid !== editTermForm.uuid && term.name.toLowerCase() === systemName.toLowerCase()
        );
        if (duplicate) {
            setFeedback({type: 'error', message: t('errors.duplicateTermValue', {value: systemName})});
            return;
        }

        const properties = [
            {name: 'jcr:title', value: label, language},
            {name: 'cl:description', value: description || '', language}
        ];

        setSavingTerm(true);

        try {
            await executeQuery(UPDATE_TERM_MUTATION, {path: editTermForm.path, properties});
            if (editTermForm.value !== systemName) {
                await executeQuery(RENAME_NODE_MUTATION, {path: editTermForm.path, name: systemName});
            }

            notify('success', 'feedback.termUpdated');
            setEditDialogOpen(false);
            await refreshLists(rootPath, selectedList.uuid);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        } finally {
            setSavingTerm(false);
        }
    };

    const handleDeleteTerm = async term => {
        if (!selectedList || !term) {
            return;
        }

        if (!askConfirmation(t('terms.deleteConfirm', {label: term.label || term.value}))) {
            return;
        }

        try {
            if (isEditDialogOpen && editTermForm.uuid === term.uuid) {
                setEditDialogOpen(false);
            }

            await executeQuery(DELETE_NODE_MUTATION, {path: term.path});
            notify('success', 'feedback.termDeleted');
            await refreshLists(rootPath, selectedList.uuid);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        }
    };

    const handleImportEntries = async (importedEntries, options = {}) => {
        if (!selectedList) {
            setFeedback({type: 'error', message: t('import.errors.noList')});
            return;
        }

        setEditDialogOpen(false);
        setImportingTerms(true);
        try {
            const usedNames = new Set(selectedList.terms.map(term => term.name));
            const existingByName = new Map(selectedList.terms.map(term => [term.name.toLowerCase(), term]));
            const createPayloads = [];
            const updatePayloads = [];
            const importLanguage = options.language || language;
            const overrideExisting = Boolean(options.overrideExisting);

            importedEntries.forEach(entry => {
                const value = entry.value?.trim();
                const label = entry.label?.trim();
                if (!label) {
                    return;
                }

                const normalizedSystemName = slugify(value || '');
                if (!normalizedSystemName) {
                    return;
                }

                const valueKey = normalizedSystemName.toLowerCase();
                const description = entry.description?.trim() || '';
                const properties = [
                    {name: 'jcr:title', value: label, language: importLanguage},
                    {name: 'cl:description', value: description, language: importLanguage}
                ];
                const existingTerm = existingByName.get(valueKey);

                if (existingTerm) {
                    if (overrideExisting) {
                        updatePayloads.push({path: existingTerm.path, properties});
                    }

                    return;
                }

                if (usedNames.has(normalizedSystemName)) {
                    return;
                }

                const uniqueName = normalizedSystemName;
                usedNames.add(uniqueName);
                existingByName.set(valueKey, {path: null});
                createPayloads.push({name: uniqueName, properties});
            });

            if (!createPayloads.length && !updatePayloads.length) {
                setFeedback({type: 'error', message: t('import.errors.noValidRows')});
                return;
            }

            const createResults = await Promise.allSettled(createPayloads.map(payload => executeQuery(CREATE_TERM_MUTATION, {
                parentPath: selectedList.path,
                name: payload.name,
                properties: payload.properties
            })));

            const updateResults = await Promise.allSettled(updatePayloads.map(payload => executeQuery(UPDATE_TERM_MUTATION, {
                path: payload.path,
                properties: payload.properties
            })));

            const created = createResults.filter(result => result.status === 'fulfilled').length;
            const updated = updateResults.filter(result => result.status === 'fulfilled').length;
            const rejected = [...createResults, ...updateResults].find(result => result.status === 'rejected');

            if (created + updated > 0) {
                setImportDialogOpen(false);
                notify('success', 'feedback.termImported', {count: created + updated});
                await refreshLists(rootPath, selectedList.uuid);
            }

            if (rejected) {
                throw rejected.reason;
            }
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        } finally {
            setImportingTerms(false);
        }
    };

    const updateTargetIndex = useCallback(index => {
        setDragState(prev => {
            if (prev.sourceIndex === null) {
                return prev;
            }

            const limit = selectedList?.terms.length || 0;
            const clamped = Math.max(0, Math.min(index, limit));
            if (clamped === prev.targetIndex) {
                return prev;
            }

            return {...prev, targetIndex: clamped};
        });
    }, [selectedList]);

    const handleTermDragStart = (event, index) => {
        if (!selectedList || selectedList.terms.length < 2 || reorderingTerms) {
            return;
        }

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', selectedList.terms[index].uuid);
        }

        setDragState({sourceIndex: index, targetIndex: index});
    };

    const handleTermDragOver = (event, index) => {
        if (dragState.sourceIndex === null) {
            return;
        }

        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const shouldPlaceAfter = event.clientY - rect.top > rect.height / 2;
        const nextIndex = shouldPlaceAfter ? index + 1 : index;
        updateTargetIndex(nextIndex);
    };

    const handleTermDrop = async event => {
        if (dragState.sourceIndex === null || dragState.targetIndex === null || !selectedList) {
            resetDragState();
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const {sourceIndex, targetIndex} = dragState;
        const nextOrder = reorderTermCollection(selectedList.terms, sourceIndex, targetIndex);
        resetDragState();

        if (!nextOrder) {
            return;
        }

        setReorderingTerms(true);
        try {
            await executeQuery(REORDER_TERMS_MUTATION, {
                path: selectedList.path,
                names: nextOrder.map(term => term.name)
            });
            notify('success', 'feedback.termReordered');
            await refreshLists(rootPath, selectedList.uuid);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
        } finally {
            setReorderingTerms(false);
        }
    };

    const handleTermDragEnd = () => {
        if (!reorderingTerms) {
            resetDragState();
        }
    };

    const renderTermRows = () => {
        if (!selectedList || selectedList.terms.length === 0) {
            return (
                <TableRow>
                    <TableBodyCell colSpan={4}>{t('terms.empty')}</TableBodyCell>
                </TableRow>
            );
        }

        const allowDrag = selectedList.terms.length > 1 && !reorderingTerms;
        const isSelfTarget = dragState.sourceIndex !== null &&
            dragState.targetIndex !== null &&
            (dragState.targetIndex === dragState.sourceIndex ||
            (dragState.targetIndex === dragState.sourceIndex + 1 && dragState.targetIndex > dragState.sourceIndex));
        const shouldShowPlaceholder = dragState.sourceIndex !== null &&
            dragState.targetIndex !== null &&
            !isSelfTarget;
        const placeholderIndex = shouldShowPlaceholder ? dragState.targetIndex : null;

        const renderPlaceholder = key => (
            <TableRow key={`placeholder-${key}`} className={styles.placeholderRow}>
                <TableBodyCell colSpan={4}>
                    <div className={styles.placeholderBar}/>
                </TableBodyCell>
            </TableRow>
        );

        const rows = [];
        selectedList.terms.forEach((term, index) => {
            if (placeholderIndex === index) {
                rows.push(renderPlaceholder(`before-${term.uuid}`));
            }

            const rowClasses = [styles.termRow];
            if (dragState.sourceIndex === index) {
                rowClasses.push(styles.draggingRow);
            }

            if (!allowDrag) {
                rowClasses.push(styles.termRowDragDisabled);
            }

            rows.push(
                <TableRow
                    key={term.uuid}
                    className={rowClasses.join(' ')}
                    draggable={allowDrag}
                    onDragStart={event => handleTermDragStart(event, index)}
                    onDragOver={event => handleTermDragOver(event, index)}
                    onDragEnd={handleTermDragEnd}
                >
                    <TableBodyCell>{term.value}</TableBodyCell>
                    <TableBodyCell>{term.label}</TableBodyCell>
                    <TableBodyCell className={styles.descriptionCell}>
                        <div className={styles.descriptionContent}>{term.description}</div>
                    </TableBodyCell>
                    <TableBodyCell>
                        <div className={styles.termActions}>
                            <Button
                                size="small"
                                label={t('actions.edit')}
                                onClick={() => handleEditTerm(term)}
                            />
                            <Button
                                size="small"
                                color="danger"
                                label={t('actions.delete')}
                                onClick={() => handleDeleteTerm(term)}
                            />
                        </div>
                    </TableBodyCell>
                </TableRow>
            );
        });

        if (placeholderIndex !== null && placeholderIndex === selectedList.terms.length) {
            rows.push(renderPlaceholder('after-last'));
        }

        if (allowDrag) {
            rows.push(
                <TableRow
                    key="drop-zone"
                    className={styles.dropZoneRow}
                    onDragOver={event => {
                        if (dragState.sourceIndex === null) {
                            return;
                        }

                        event.preventDefault();
                        updateTargetIndex(selectedList.terms.length);
                    }}
                >
                    <TableBodyCell colSpan={4}/>
                </TableRow>
            );
        }

        return rows;
    };

    const renderLanguageTabs = () => {
        if (!siteLanguages.length) {
            return null;
        }

        return (
            <div className={styles.languageTabs}>
                {siteLanguages.map(lang => (
                    <button
                        key={lang.code}
                        type="button"
                        className={`${styles.languageTab} ${lang.code === language ? styles.languageTabActive : ''}`}
                        onClick={() => handleLanguageChange(lang.code)}
                    >
                        <span className={styles.languageFlag}>{getFlagEmoji(lang.code)}</span>
                        <span>{lang.displayName || lang.code}</span>
                    </button>
                ))}
            </div>
        );
    };

    const renderListForm = () => (
        <Paper className={styles.card}>
            <Typography variant="heading">
                {showCreateList ? t('lists.createTitle') : t('lists.editTitle')}
            </Typography>
            <form onSubmit={handleSaveList}>
                <div className={styles.formGroup}>
                    <Typography variant="body" weight="bold">{t('lists.fields.systemName')}</Typography>
                    <Input value={listForm.systemName} onChange={e => handleListChange('systemName', e.target.value)}/>
                    <Typography variant="caption">{t('lists.help.systemName')}</Typography>
                </div>
                <div className={styles.formGroup}>
                    <Typography variant="body" weight="bold">{t('lists.fields.title')}</Typography>
                    <Input value={listForm.title} onChange={e => handleListChange('title', e.target.value)}/>
                </div>
                <div className={styles.formGroup}>
                    <Typography variant="body" weight="bold">{t('lists.fields.description')}</Typography>
                    <textarea
                        className={styles.textarea}
                        value={listForm.description}
                        onChange={e => handleListChange('description', e.target.value)}
                    />
                </div>
                <div style={{display: 'flex', gap: '12px'}}>
                    <Button type="submit" size="big" disabled={savingList} label={t('actions.save')}/>
                    {!showCreateList && (
                        <Button
                            type="button"
                            size="big"
                            color="danger"
                            label={t('actions.delete')}
                            onClick={() => handleDeleteList(selectedList)}
                        />
                    )}
                </div>
            </form>
        </Paper>
    );

    const renderTermsSection = () => {
        if (!selectedList || showCreateList) {
            return null;
        }

        return (
            <Paper className={styles.card}>
                <div className={styles.cardHeader}>
                    <Typography variant="heading">{t('terms.title')}</Typography>
                    <Button
                        size="big"
                        color="accent"
                        isDisabled={importingTerms}
                        label={t('actions.importTerms')}
                        onClick={() => setImportDialogOpen(true)}
                    />
                </div>
                <div style={{overflowX: 'auto', marginTop: '12px'}}>
                    <Table className={styles.termsTable}>
                        <TableHead>
                            <TableRow>
                                <TableHeadCell>{t('terms.fields.value')}</TableHeadCell>
                                <TableHeadCell>{t('terms.fields.label')}</TableHeadCell>
                                <TableHeadCell>{t('terms.fields.description')}</TableHeadCell>
                                <TableHeadCell>{t('actions.actionsColumn')}</TableHeadCell>
                            </TableRow>
                        </TableHead>
                        <TableBody onDrop={handleTermDrop}>
                            {renderTermRows()}
                        </TableBody>
                    </Table>
                </div>
                <form style={{marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px'}} onSubmit={handleSaveTerm}>
                    <Typography variant="subheading">{termForm.uuid ? t('terms.editTitle') : t('terms.addTitle')}</Typography>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.value')}</Typography>
                        <Input value={termForm.value} onChange={e => handleTermChange('value', e.target.value)}/>
                    </div>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.label')}</Typography>
                        <Input value={termForm.label} onChange={e => handleTermChange('label', e.target.value)}/>
                    </div>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.description')}</Typography>
                        <textarea
                            className={styles.textarea}
                            value={termForm.description}
                            onChange={e => handleTermChange('description', e.target.value)}
                        />
                    </div>
                    <div style={{display: 'flex', gap: '12px'}}>
                        <Button type="submit" size="big" disabled={savingTerm} label={t('actions.save')}/>
                        <Button
                            type="button"
                            size="big"
                            label={t('actions.cancel')}
                            onClick={() => setTermForm({...defaultTermForm})}
                        />
                    </div>
                </form>
            </Paper>
        );
    };

    const renderSidebar = () => (
        <div className={styles.listPanel}>
            <Typography variant="heading">{t('lists.title')}</Typography>
            <div className={styles.listsContainer}>
                {lists.length === 0 && !loading && (
                    <Typography variant="body">{t('lists.empty')}</Typography>
                )}
                {lists.map(list => (
                    <button
                        key={list.uuid}
                        type="button"
                        className={`${styles.listButton} ${list.uuid === selectedListId && !showCreateList ? styles.listButtonActive : ''}`}
                        onClick={() => {
                            setSelectedListId(list.uuid);
                            setShowCreateList(false);
                        }}
                    >
                        <span>{list.title}</span>
                    </button>
                ))}
            </div>
            <Button size="big" label={t('actions.reload')} onClick={() => refreshLists(rootPath)}/>
        </div>
    );

    const activeLanguage = siteLanguages.find(lang => lang.code === language);

    return (
        <>
            <LayoutContent
                header={(
                    <Header
                        title={`${t('pageTitle')}${siteName ? ` - ${siteName}` : ''}`}
                        subtitle={t('pageSubtitle')}
                        mainActions={[
                            <Button
                                key="create-list"
                                color="accent"
                                size="big"
                                label={t('actions.createList')}
                                onClick={beginCreateList}
                            />
                        ]}
                    />
                )}
                content={(
                    <div className={styles.layout}>
                        {feedback && (
                            <div className={`${styles.feedback} ${feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess}`}>
                                {feedback.message}
                            </div>
                        )}
                        {error && (
                            <div className={`${styles.feedback} ${styles.feedbackError}`}>
                                {error.message}
                            </div>
                        )}
                        <div className={styles.container}>
                            {renderSidebar()}
                            <div className={styles.contentPanel}>
                                {loading && (
                                    <Typography variant="body">{t('states.loading')}</Typography>
                                )}
                                {!loading && (lists.length > 0 || showCreateList) && (
                                    <>
                                        {renderLanguageTabs()}
                                        {renderListForm()}
                                        {renderTermsSection()}
                                    </>
                                )}
                                {!loading && lists.length === 0 && !showCreateList && (
                                    <Paper className={styles.card}>
                                        <Typography variant="body">{t('lists.empty')}</Typography>
                                    </Paper>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            />
            <TermImportDialog
                isOpen={isImportDialogOpen}
                t={t}
                siteLanguages={siteLanguages}
                initialLanguage={language}
                onClose={() => setImportDialogOpen(false)}
                onImport={handleImportEntries}
            />
            <TermEditDialog
                isOpen={isEditDialogOpen}
                form={editTermForm}
                isSaving={savingTerm}
                t={t}
                languageCode={language}
                languageName={activeLanguage?.displayName}
                onChange={handleEditFieldChange}
                onClose={() => setEditDialogOpen(false)}
                onSave={handleEditDialogSave}
            />
        </>
    );
};
