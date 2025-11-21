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
    UPDATE_TERM_MUTATION
} from '../graphql/controlledLists.queries';
import styles from './AdminPanel.module.scss';

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

const mapListNode = node => ({
    uuid: node.uuid,
    path: node.path,
    name: node.name,
    systemName: node.systemName?.value || '',
    title: node.title?.value || node.name,
    description: node.description?.value || '',
    terms: (node.children?.nodes || []).map(term => ({
        uuid: term.uuid,
        path: term.path,
        name: term.name,
        value: term.termValue?.value || '',
        label: term.termLabel?.value || '',
        description: term.termDescription?.value || ''
    }))
});

export const AdminPanel = () => {
    const {t} = useTranslation('controlled-lists');

    const context = window.contextJsParameters || {};
    const siteKey = context.siteKey || context.site?.key || '';
    const language = context.uilang || context.lang || context.language || 'en';
    const graphqlEndpoint = `${context.contextPath || ''}/modules/graphql`;

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
    }, [selectedList, showCreateList]);

    const handleListChange = (field, value) => {
        setListForm(prev => ({...prev, [field]: value}));
    };

    const handleTermChange = (field, value) => {
        setTermForm(prev => ({...prev, [field]: value}));
    };

    const notify = (type, key) => {
        setFeedback({type, message: t(key)});
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
            {name: 'cl:systemName', value: systemName},
            {name: 'cl:title', value: title, language},
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
    };

    const handleEditTerm = term => {
        setTermForm({
            uuid: term.uuid,
            path: term.path,
            value: term.value,
            label: term.label,
            description: term.description
        });
    };

    const handleSaveTerm = async event => {
        event.preventDefault();
        if (!selectedList) {
            return;
        }

        const value = termForm.value.trim();
        const label = termForm.label.trim();
        const description = termForm.description.trim();

        if (!value || !label) {
            setFeedback({type: 'error', message: t('errors.requiredFields')});
            return;
        }

        const duplicate = selectedList.terms.some(
            term => term.uuid !== termForm.uuid && term.value.toLowerCase() === value.toLowerCase()
        );
        if (duplicate) {
            setFeedback({type: 'error', message: t('errors.duplicateTermValue', {value})});
            return;
        }

        const properties = [
            {name: 'cl:value', value},
            {name: 'cl:label', value: label, language},
            {name: 'cl:description', value: description || '', language}
        ];

        setSavingTerm(true);
        try {
            if (termForm.uuid) {
                await executeQuery(UPDATE_TERM_MUTATION, {path: termForm.path, properties});
                notify('success', 'feedback.termUpdated');
            } else {
                const existingNames = selectedList.terms.map(term => term.name);
                const termName = ensureUniqueName(value, existingNames, 'controlled-term');
                await executeQuery(CREATE_TERM_MUTATION, {
                    parentPath: selectedList.path,
                    name: termName,
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

    const handleDeleteTerm = async term => {
        if (!selectedList || !term) {
            return;
        }

        if (!askConfirmation(t('terms.deleteConfirm', {label: term.label || term.value}))) {
            return;
        }

        try {
            await executeQuery(DELETE_NODE_MUTATION, {path: term.path});
            notify('success', 'feedback.termDeleted');
            await refreshLists(rootPath, selectedList.uuid);
        } catch (err) {
            setFeedback({type: 'error', message: err.message});
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

        return selectedList.terms.map(term => (
            <TableRow key={term.uuid}>
                <TableBodyCell>{term.value}</TableBodyCell>
                <TableBodyCell>{term.label}</TableBodyCell>
                <TableBodyCell>{term.description}</TableBodyCell>
                <TableBodyCell>
                    <div style={{display: 'flex', gap: '8px'}}>
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
        ));
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
                <Typography variant="heading">{t('terms.title')}</Typography>
                <div style={{overflowX: 'auto', marginTop: '12px'}}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableHeadCell>{t('terms.fields.value')}</TableHeadCell>
                                <TableHeadCell>{t('terms.fields.label')}</TableHeadCell>
                                <TableHeadCell>{t('terms.fields.description')}</TableHeadCell>
                                <TableHeadCell>{t('actions.actionsColumn')}</TableHeadCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
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

    return (
        <LayoutContent
            header={(
                <Header
                    title={t('pageTitle')}
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
    );
};
