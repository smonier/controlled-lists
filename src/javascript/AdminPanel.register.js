import {registerRoutes} from './AdminPanel/AdminPanel.routes';
import i18next from 'i18next';
import en from '../main/resources/javascript/locales/en.json';
import fr from '../main/resources/javascript/locales/fr.json';

const registerResources = () => {
    const bundles = [
        ['en', en],
        ['fr', fr]
    ];

    bundles.forEach(([lang, resource]) => {
        const namespaceData = resource['controlled-lists'];
        if (namespaceData && !i18next.hasResourceBundle(lang, 'controlled-lists')) {
            i18next.addResourceBundle(lang, 'controlled-lists', namespaceData, true, true);
        }
    });
};

export default async function () {
    registerResources();
    await i18next.loadNamespaces('controlled-lists');

    registerRoutes();
}
