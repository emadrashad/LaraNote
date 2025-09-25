<p align="center"><a href="https://laravel.com" target="_blank"><img src="./icons/Laranote-main.png" width="400"></a></p>

# Laranote — Lightweight Highlights & Notes Browser Extension

Laranote is a small browser extension that lets you highlight text on any webpage, attach short notes to highlights, copy highlighted text, and restore highlights across page loads. It aims to be fast, privacy-friendly (stores data locally), and supports basic localization (Arabic & English).

## Key features

- Highlight selected text on any webpage and save it locally.
- Attach short notes to any highlight (a pin appears on highlighted text).
- Copy highlighted text to clipboard with one click.
- Remove highlights you don't want anymore.
- Deep-link to a saved highlight using `#laranote=<id>` in the URL (when available).
- Best-effort re-anchoring using text quotes (prefix/exact/suffix) so highlights can be reapplied after small page changes.
- Per-page storage: highlights are stored per origin + path so they remain scoped to the page where they were created.
- Small popup UI (extension popup) listing recent highlights across pages with pagination and export (JSON) support.
- Basic localization: English (`en`) and Arabic (`ar`) supported; toolbar and popup labels follow your selected language.

## Installation (Developer / Unpacked)

1. Open your browser's extensions page (e.g. `chrome://extensions` for Chrome/Edge).
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `laranote` folder.
4. The extension should appear in the toolbar.

## How to use

1. Navigate to any webpage.
2. Select some text with the mouse.
3. A small toolbar will appear near the selection with buttons:
   - Highlight — saves the selection as a highlight for the current page.
   - Note — saves the selection and opens a popup to type a short note.
   - Copy — copies the selected text to your clipboard.
   - Remove — removes the highlight covering the selection.
4. If you attach a note, a small pin (📌) will be added to the highlight. Clicking the pin opens the note(s) attached to that highlight.
5. Use the extension popup (click the extension icon) to view recent highlights across pages, jump to the saved page, export your highlights to JSON, or change pagination.

## Localization / Language

- Language setting is stored in `chrome.storage.sync` under the key `laranote_lang` (default is `ar`).
- The popup uses an internal I18N object to provide text for supported languages.
- The content script (`content.js`) picks up the language and applies translations to toolbar buttons and popups using `data-act` attributes.
- If you change language in the extension options, the toolbar and popups will update automatically.

## Data storage

- Highlights and notes are saved in `chrome.storage.local` under keys prefixed with `yh_notes_v1::` followed by the page origin + pathname.
- Each saved record contains fields such as:
  - id — a unique short id for the highlight
  - text — the selected text
  - note — optional note text
  - createdAt — timestamp
  - quote — optional prefix/exact/suffix used for re-anchoring
- Export: use the popup export button to save all highlights as a JSON file.

## Technical details

- `content.js`:
  - Creates the in-page toolbar and note popups.
  - Wraps selections in `<span class="yh-highlight" data-yh-id="...">` and stores records.
  - Implements best-effort re-anchoring using stored quote (prefix/exact/suffix) and normalized text matching.
  - Listens to `mouseup`, `mousedown`, and `keydown` to show/hide toolbars and popups.
  - Uses `MutationObserver` and `chrome.storage.onChanged` to apply toolbar/popup localization dynamically.

- `popup.js`:
  - Provides a small UI listing saved highlights across pages.
  - Supports pagination, export, and opening the saved page (deep link with `#laranote=<id>`).
  - Reads `laranote_lang` and renders UI text from an I18N object.

## Developer notes & tips

- To change or add languages:
  - Update the `I18N` object in `popup.js` and the `MAP` in `content.js` (or refactor to a shared source so both scripts use the same translations).
  - Keys used: `refresh`, `export`, `empty`, `highlight`, `note`, `prev`, `next`, `page`, `of`, `made`, `remove`, `copy`, `addNotePlaceholder`, `cancel`, `save`, `notes`.

- Re-anchoring robustness:
  - The extension stores a small quote (prefix/exact/suffix) when creating a highlight. On page load the script attempts to re-find the quote and reapply the highlight.
  - This works well for small edits, but very large changes to page content may prevent re-anchoring. For stronger anchoring consider Web Annotation integrations or more advanced selectors.

- Styling:
  - The toolbar and popups are styled with `styles.css` / inline styles inside `content.js`. Adjust those to match themes or accessibility needs.

## Testing checklist

- Load unpacked extension and test on various pages (static pages, dynamic sites, long-form articles).
- Test highlight → note → pin flow.
- Test copy and remove actions.
- Test deep-linking with `#laranote=<id>` and re-anchoring behavior.
- Change language in storage and confirm toolbar/popups update.
- Export JSON and ensure exported objects contain the expected fields.

## Contributing

- Open an issue or submit a pull request to improve language handling, persistence, or anchoring.
- For larger refactors (shared i18n, storage migration), add tests and document API changes.

## License

This project is provided as-is. Include your preferred license file if you plan to publish.
