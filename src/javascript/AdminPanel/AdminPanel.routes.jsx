import {registry} from '@jahia/ui-extender';
import constants from './AdminPanel.constants';
import {AdminPanel} from './AdminPanel';
import React, {Suspense} from 'react';
const ListIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="5" width="16" height="2" rx="1"/>
        <rect x="4" y="11" width="16" height="2" rx="1"/>
        <rect x="4" y="17" width="16" height="2" rx="1"/>
    </svg>
);

export const registerRoutes = () => {
    registry.add('adminRoute', 'controlled-lists', {
        targets: ['administration-sites:10'],
        icon: <ListIcon/>,
        label: 'controlled-lists:controlled-lists.label',
        path: `${constants.DEFAULT_ROUTE}*`, // Catch everything and let the app handle routing logic
        defaultPath: constants.DEFAULT_ROUTE,
        isSelectable: true,
        render: v => <Suspense fallback="loading ..."><AdminPanel match={v.match}/></Suspense>
    });

    console.debug('%c controlled-lists is activated', 'color: #3c8cba');
};
