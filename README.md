# Controlled Lists module for Jahia

This module delivers two complementary capabilities that bring centrally-managed vocabularies to your Jahia environment:

1. **Controlled Lists Admin App** – a React-based administration UI that lets delegated editors create and curate controlled lists and their terms for each site.
2. **Controlled Lists Selector Type** – a re-usable selector for the Jahia Content Editor so definitions (via JSON fieldset overrides) can expose those centrally-managed lists to regular editors without hardcoding values.

---

## 1. Controlled Lists Admin App

### Features
- Creates the `/sites/<site>/contents/controlled-lists` tree automatically.
- Lets privileged users create, edit, import (CSV/JSON), reorder, translate and delete controlled lists and their terms.
- Includes language tabs, drag & drop term reordering, bulk import dialog (with override & language options), and fine-grained buttons (reload, save, edit, delete) aligned with Moonstone design.
- Ensures the folder is centrally managed with permissions so only authorized groups can adjust vocabularies.

### Installation & access
1. **Build/install** the module (`mvn clean install` then deploy the bundle on your Jahia DX/Cloud stack).
2. Open **jContent → Taxonomy tools → Controlled Lists** (a dedicated accordion entry under Models/Taxonomy tools gets registered automatically).
3. Select your site and manage lists/terms via the React app.

### Key operations in the UI
- **Create list**: Provide a technical system name, localized title, and optional description.
- **Add terms**: Each term stores a technical `value`, a localized `label`, and a localized rich-text `description`.
- **Inline actions**: Edit/Delete per term; reorder via drag handle; languages toggled with the flag tabs.
- **Bulk import**: Upload CSV/JSON files matching `value,label,description`; choose language & overwrite behavior.
- **Refresh**: Reload button retrieves latest data from JCR; Save/Cancel buttons persist or revert edits.

---

## 2. Controlled Lists Selector Type

This module also registers a new selector type `controlledListsSelector` that can be used in content definitions (CND + JSON form overrides) to let editors pick controlled terms rather than free text.

### How it works
1. **Field definition**: In your CND type, declare a property that references the selector (e.g. via mixin `mix:title` plus a `string` property that will store the serialized selection).
2. **Form override**: In `META-INF/jahia-content-editor-forms/fieldsets/*.json`, assign `"selectorType": "controlledListsSelector"` to that field.
3. **Editor experience**: The selector displays a dropdown of available controlled lists and checkboxes for the terms (with localized labels/descriptions). Selected items are stored as JSON `{"listId": "...", "terms": [{...}]}`.
4. **Language-aware**: The selector automatically loads terms using the Content Editor’s current locale so editors always see the translated labels/descriptions.

### Example override
```json
{
  "name": "cl:test",
  "fields": [
    {
      "name": "cl:list",
      "selectorType": "controlledListsSelector"
    }
  ]
}
```

### Consuming the data
Downstream renderers or GraphQL queries can parse the stored JSON to:
- Know which controlled list was referenced (`listId`).
- Retrieve the chosen terms (`uuid`, `value`, `label`, `description`).
- Enforce business logic (e.g., closed vocabularies, automation, API integrations).

---

## Getting started for developers

1. **Clone & install**
   ```bash
   git clone <repo-url> controlled-lists
   cd controlled-lists
   yarn install
   mvn clean install
   ```
2. **Deploy** the built bundle to your Jahia server (`digital-factory-data/modules/`).
3. **Enable** the module on the target site(s) and assign proper permissions to the editors who should manage controlled lists.
4. **Optional**: configure Content Editor fieldsets to use `controlledListsSelector`.

---

## Contributions & License

- Source code is intended as a Jahia SE reference implementation; feel free to adapt it for your own projects.
- See `pom.xml` headers for MIT-based licensing; respect Jahia’s guidelines for module distribution.

For issues or enhancements, open a ticket / PR in your internal Git repository. Happy taxonomy building!
