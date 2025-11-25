import {registry} from '@jahia/ui-extender';
import constants from './AdminPanel.constants';
import {AdminPanel} from './AdminPanel';
import React, {Suspense} from 'react';
import PropTypes from 'prop-types';

const ListIcon = ({width = 12, height = 12}) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M4.5 6.5l1.8 1.8 3.2-3.3 1.1 1.1-4.3 4.4-2.9-2.9 1.1-1.1z"/>
        <rect x="12" y="6" width="8" height="2" rx="1"/>

        <path d="M4.5 12.5l1.8 1.8 3.2-3.3 1.1 1.1-4.3 4.4-2.9-2.9 1.1-1.1z"/>
        <rect x="12" y="12" width="8" height="2" rx="1"/>

        <path d="M4.5 18.5l1.8 1.8 3.2-3.3 1.1 1.1-4.3 4.4-2.9-2.9 1.1-1.1z"/>
        <rect x="12" y="18" width="8" height="2" rx="1"/>
    </svg>
);

const TaxoIcon = ({width = 12, height = 12}) => (
    <svg
        width={width}
        height={height}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M10 3h4v4h-4V3zM4 13h4v4H4v-4zm12 0h4v4h-4v-4zM12 7v3h-6v3m6-6v3h6v3"/>
    </svg>
);

export const registerRoutes = () => {
    window.jahia.i18n.loadNamespaces('controlled-lists');

    registry.add('accordionItem', 'taxonomyAccordion', registry.get('accordionItem', 'renderDefaultApps'), {
        targets: ['jcontent:75'],
        icon: <TaxoIcon width={24} height={24}/>,
        label: 'controlled-lists:accordionTitle',
        appsTarget: 'taxonomyAccordionApps'
    });

    registry.add('adminRoute', 'controlled-lists', {
        targets: ['taxonomyAccordionApps'],
        icon: <ListIcon/>,
        label: 'controlled-lists:label',
        path: `${constants.DEFAULT_ROUTE}*`,
        defaultPath: constants.DEFAULT_ROUTE,
        isSelectable: true,
        requireModuleInstalledOnSite: 'controlled-lists',
        render: v => <Suspense fallback="loading ..."><AdminPanel match={v.match}/></Suspense>
    });
};

ListIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number
};

TaxoIcon.propTypes = {
    width: PropTypes.number,
    height: PropTypes.number
};
