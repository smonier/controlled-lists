import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import Papa from 'papaparse';
import {Button, Typography, Dropdown, Checkbox} from '@jahia/moonstone';
import styles from './AdminPanel.module.scss';

const normalizeEntries = data => {
    return (data || []).map(item => ({
        value: (item.value || '').trim(),
        label: (item.label || item.value || '').trim(),
        description: (item.description || '').trim()
    })).filter(entry => entry.value && entry.label);
};

const pickDefaultLanguage = (languages, preferred) => {
    if (preferred && languages.some(lang => lang.code === preferred)) {
        return preferred;
    }

    return languages[0]?.code || '';
};

export const TermImportDialog = ({isOpen, siteLanguages, initialLanguage, onClose, onImport, t}) => {
    const [entries, setEntries] = useState([]);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState(null);
    const [parsing, setParsing] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState(() => pickDefaultLanguage(siteLanguages, initialLanguage));
    const [overrideExisting, setOverrideExisting] = useState(false);
    const fileInputRef = useRef(null);
    const languageOptions = useMemo(
        () => (siteLanguages || []).map(lang => ({
            label: lang.displayName || lang.code,
            value: lang.code
        })),
        [siteLanguages]
    );

    const resetState = useCallback(() => {
        setEntries([]);
        setFileName('');
        setError(null);
        setParsing(false);
        setSelectedLanguage(pickDefaultLanguage(siteLanguages, initialLanguage));
        setOverrideExisting(false);
    }, [initialLanguage, siteLanguages]);

    const handleClose = () => {
        onClose();
    };

    const handleFileChange = event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        setParsing(true);
        setError(null);
        setFileName(file.name);

        const extension = file.name.toLowerCase().split('.').pop();
        if (extension === 'json') {
            const reader = new FileReader();
            reader.onload = loadEvent => {
                try {
                    const jsonData = JSON.parse(loadEvent.target.result || '[]');
                    const normalized = normalizeEntries(Array.isArray(jsonData) ? jsonData : []);
                    if (!normalized.length) {
                        throw new Error(t('import.errors.invalidFormat'));
                    }

                    setEntries(normalized);
                } catch (err) {
                    setEntries([]);
                    setError(err.message || t('import.errors.invalidFormat'));
                } finally {
                    setParsing(false);
                }
            };

            reader.onerror = () => {
                setParsing(false);
                setError(t('import.errors.readFailed'));
            };

            reader.readAsText(file);
        } else {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: result => {
                    if (result?.errors?.length) {
                        setError(result.errors[0].message || t('import.errors.invalidFormat'));
                        setEntries([]);
                    } else {
                        const normalized = normalizeEntries(result.data);
                        if (normalized.length === 0) {
                            setError(t('import.errors.invalidFormat'));
                        } else {
                            setEntries(normalized);
                        }
                    }

                    setParsing(false);
                },
                error: err => {
                    setEntries([]);
                    setParsing(false);
                    setError(err.message || t('import.errors.invalidFormat'));
                }
            });
        }
    };

    const handleImport = () => {
        if (!selectedLanguage) {
            setError(t('import.errors.noLanguage'));
            return;
        }

        onImport(entries, {language: selectedLanguage, overrideExisting});
    };

    useEffect(() => {
        if (!isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);

    useEffect(() => {
        setSelectedLanguage(prev => {
            if (prev && siteLanguages.some(lang => lang.code === prev)) {
                return prev;
            }

            return pickDefaultLanguage(siteLanguages, initialLanguage);
        });
    }, [initialLanguage, siteLanguages]);

    if (!isOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <div className={styles.dialogOverlay}>
            <div className={styles.dialog}>
                <div className={styles.dialogHeader}>
                    <Typography variant="heading">{t('import.title')}</Typography>
                    <Typography variant="body">{t('import.instructions')}</Typography>
                </div>
                <div className={styles.dialogBody}>
                    <div className={styles.formGroup}>
                        <Button
                            size="big"
                            label={fileName || t('import.selectFile')}
                            onClick={() => fileInputRef.current?.click()}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.json"
                            className={styles.hiddenInput}
                            onChange={handleFileChange}
                        />
                        <Typography variant="caption">
                            {t('import.supportedFormats')}
                        </Typography>
                    </div>
                    {parsing && (
                        <Typography variant="body">{t('import.parsing')}</Typography>
                    )}
                    {error && (
                        <div className={`${styles.feedback} ${styles.feedbackError}`}>
                            {error}
                        </div>
                    )}
                    {Boolean(entries.length) && (
                        <div className={styles.previewBlock}>
                            <Typography variant="subheading">
                                {t('import.preview', {count: entries.length})}
                            </Typography>
                            <div className={styles.previewList}>
                                {entries.slice(0, 5).map(entry => {
                                    const key = `${entry.value}-${entry.label}-${entry.description}`;
                                    return (
                                        <div key={key} className={styles.previewItem}>
                                            <strong>{entry.value}</strong>
                                            <span>{entry.label}</span>
                                            {entry.description && (
                                                <em>{entry.description}</em>
                                            )}
                                        </div>
                                    );
                                })}
                                {entries.length > 5 && (
                                <Typography variant="caption">
                                    {t('import.moreRows', {count: entries.length - 5})}
                                </Typography>
                                )}
                            </div>
                        </div>
                    )}
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('import.language')}</Typography>
                        <Dropdown
                            data={languageOptions}
                            value={selectedLanguage}
                            placeholder={t('import.language')}
                            onChange={(e, item) => setSelectedLanguage(item.value)}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.checkboxRow}>
                            <Checkbox
                                checked={overrideExisting}
                                onChange={(event, value, checked) => setOverrideExisting(checked)}
                            />
                            <Typography variant="body">{t('import.override')}</Typography>
                        </label>
                    </div>
                </div>
                <div className={styles.dialogActions}>
                    <Button size="big" label={t('actions.cancel')} onClick={handleClose}/>
                    <Button
                        size="big"
                        color="accent"
                        isDisabled={!entries.length || parsing}
                        label={t('import.importButton')}
                        onClick={handleImport}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

TermImportDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    siteLanguages: PropTypes.arrayOf(PropTypes.shape({
        code: PropTypes.string.isRequired,
        displayName: PropTypes.string
    })),
    initialLanguage: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    onImport: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired
};

TermImportDialog.defaultProps = {
    siteLanguages: [],
    initialLanguage: ''
};
