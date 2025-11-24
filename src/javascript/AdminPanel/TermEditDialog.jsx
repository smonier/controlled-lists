import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import {Input, Button, Typography} from '@jahia/moonstone';
import styles from './AdminPanel.module.scss';
import {getFlagEmoji} from './flags';

export const TermEditDialog = ({isOpen, form, onChange, onClose, onSave, isSaving, t, languageCode, languageName}) => {
    if (!isOpen) {
        return null;
    }

    return ReactDOM.createPortal(
        <div className={styles.dialogOverlay}>
            <div className={styles.dialog}>
                <div className={styles.dialogHeader}>
                    <Typography variant="heading">{t('edit.title')}</Typography>
                    {languageCode && (
                        <Typography variant="body" className={styles.languageBadge}>
                            {getFlagEmoji(languageCode)} {languageName || languageCode.toUpperCase()}
                        </Typography>
                    )}
                </div>
                <div className={styles.dialogBody}>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.value')}</Typography>
                        <Input value={form.value} onChange={e => onChange('value', e.target.value)}/>
                    </div>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.label')}</Typography>
                        <Input value={form.label} onChange={e => onChange('label', e.target.value)}/>
                    </div>
                    <div className={styles.formGroup}>
                        <Typography variant="body" weight="bold">{t('terms.fields.description')}</Typography>
                        <textarea
                            className={styles.inlineTextarea}
                            value={form.description}
                            onChange={e => onChange('description', e.target.value)}
                        />
                    </div>
                </div>
                <div className={styles.dialogActions}>
                    <Button size="big" label={t('actions.cancel')} onClick={onClose}/>
                    <Button size="big" color="accent" isDisabled={isSaving} label={t('actions.save')} onClick={onSave}/>
                </div>
            </div>
        </div>,
        document.body
    );
};

TermEditDialog.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    form: PropTypes.shape({
        value: PropTypes.string,
        label: PropTypes.string,
        description: PropTypes.string
    }).isRequired,
    onChange: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    isSaving: PropTypes.bool,
    t: PropTypes.func.isRequired,
    languageCode: PropTypes.string,
    languageName: PropTypes.string
};
