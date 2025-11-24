import React, {useEffect, useMemo, useState} from 'react';
import PropTypes from 'prop-types';
import {Typography, Dropdown, CheckboxItem, Chip, Button, Loader, Paper} from '@jahia/moonstone';
import axios from 'axios';
import styles from '../AdminPanel/AdminPanel.module.scss';
import {getFlagEmoji} from '../AdminPanel/flags';
import {CONTROLLED_LISTS_SELECTOR_QUERY} from '../graphql/controlledLists.queries';

const parseValue = value => {
    if (!value) {
        return {listId: null, terms: []};
    }

    try {
        const parsed = JSON.parse(value);
        return {
            listId: parsed.listId || null,
            terms: Array.isArray(parsed.terms) ? parsed.terms : []
        };
    } catch (_) {
        return {listId: null, terms: []};
    }
};

export const ControlledListsSelector = ({value, onChange, language}) => {
    const context = window.contextJsParameters || {};
    const siteKey = context.siteKey || context.site?.key || '';
    const editorLanguage = language || context.lang || context.language || context.uilang || 'en';
    const [rootPath] = useState(siteKey ? `/sites/${siteKey}/contents/controlled-lists` : null);
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const state = useMemo(() => parseValue(value), [value]);
    const selectedList = lists.find(list => list.uuid === state.listId) || null;
    const selectedTermIds = useMemo(() => new Set(state.terms.map(term => term.uuid)), [state.terms]);

    useEffect(() => {
        if (!rootPath) {
            return;
        }

        const fetchLists = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await axios.post(
                    `${context.contextPath || ''}/modules/graphql`,
                    {query: CONTROLLED_LISTS_SELECTOR_QUERY, variables: {rootPath, language: editorLanguage}},
                    {headers: {'Content-Type': 'application/json'}, withCredentials: true}
                );

                if (response.data?.errors?.length) {
                    throw new Error(response.data.errors.map(err => err.message).join('\n'));
                }

                const nodes = response.data?.data?.jcr?.nodeByPath?.children?.nodes || [];
                const mapped = nodes.map(node => ({
                    uuid: node.uuid,
                    name: node.name,
                    label: node.title?.value || node.name,
                    terms: (node.children?.nodes || []).map(term => ({
                        uuid: term.uuid,
                        value: term.termValue?.value || '',
                        label: term.termLabel?.value || term.termValue?.value || ''
                    }))
                }));
                mapped.sort((a, b) => a.label.localeCompare(b.label));
                setLists(mapped);
            } catch (err) {
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLists();
    }, [context.contextPath, editorLanguage, rootPath, siteKey]);

    const handleListChange = (e, item) => {
        const nextListId = item.value;
        if (!nextListId) {
            onChange('');
            return;
        }

        onChange(JSON.stringify({listId: nextListId, terms: []}));
    };

    const handleTermToggle = term => {
        const exists = selectedTermIds.has(term.uuid);
        let nextTerms;
        if (exists) {
            nextTerms = state.terms.filter(t => t.uuid !== term.uuid);
        } else {
            nextTerms = [...state.terms, term];
        }

        onChange(JSON.stringify({listId: selectedList?.uuid || null, terms: nextTerms}));
    };

    if (!rootPath) {
        return (
            <Typography variant="body">
                {context.siteKey ? 'Missing lists root.' : 'Please select a site.'}
            </Typography>
        );
    }

    if (loading) {
        return (
            <div className={styles.selectorLoading}>
                <Loader size="big"/>
                <Typography variant="body">Loading controlled lists...</Typography>
            </div>
        );
    }

    if (error) {
        return (
            <Typography variant="body" color="danger">
                {error.message}
            </Typography>
        );
    }

    const listOptions = lists.map(list => ({
        label: list.label,
        value: list.uuid
    }));

    return (
        <Paper className={styles.selectorCard}>
            <div className={styles.selectorContainer}>
                <div className={styles.formGroup}>
                    <Typography variant="body" weight="bold">Controlled list</Typography>
                    <Dropdown
                        data={listOptions}
                        value={selectedList?.uuid || null}
                        placeholder="Select a controlled list"
                        onChange={handleListChange}
                    />
                </div>

                {selectedList && (
                    <div className={styles.selectorTerms}>
                        <Typography variant="body" weight="bold">
                            Terms {editorLanguage && `(${getFlagEmoji(editorLanguage)} ${editorLanguage.toUpperCase()})`}
                        </Typography>
                        <div className={styles.selectorTermsList}>
                            {selectedList.terms.map(term => (
                                <CheckboxItem
                                    key={term.uuid}
                                    label={term.label}
                                    description={term.value}
                                    checked={selectedTermIds.has(term.uuid)}
                                    onChange={() => handleTermToggle(term)}
                                />
                            ))}
                        </div>
                        {state.terms.length > 0 && (
                            <div className={styles.selectorSelection}>
                                <Typography variant="body" weight="bold">Selected</Typography>
                                <div className={styles.selectorChips}>
                                    {state.terms.map(term => (
                                        <Chip key={term.uuid} label={term.label}/>
                                    ))}
                                </div>
                                <Button
                                    size="small"
                                    label="Clear selection"
                                    onClick={() => onChange(JSON.stringify({listId: selectedList.uuid, terms: []}))}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Paper>
    );
};

ControlledListsSelector.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    language: PropTypes.string
};

ControlledListsSelector.defaultProps = {
    value: '',
    language: null
};
