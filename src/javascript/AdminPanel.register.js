import {registry} from '@jahia/ui-extender';
import {registerRoutes} from './AdminPanel/AdminPanel.routes';
import i18next from 'i18next';
import en from '../main/resources/javascript/locales/en.json';
import fr from '../main/resources/javascript/locales/fr.json';
import de from '../main/resources/javascript/locales/de.json';
import es from '../main/resources/javascript/locales/es.json';
import pt from '../main/resources/javascript/locales/pt.json';
import it from '../main/resources/javascript/locales/it.json';
import {ControlledListsSelector} from './ControlledListsSelector/ControlledListsSelector';

const registerResources = () => {
    const bundles = [
        ['en', en],
        ['fr', fr],
        ['de', de],
        ['es', es],
        ['pt', pt],
        ['it', it]
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

    registry.add('selectorType', 'controlledListsSelector', {
        cmp: ControlledListsSelector,
        supportMultiple: false
    });
    registerRoutes();
}
