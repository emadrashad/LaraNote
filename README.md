# LaraNote — Highlights & Notes

LaraNote is a browser extension that allows you to highlight text and take notes on any webpage. Your highlights and notes are saved locally and are specific to the URL you are on.

<a href="https://emadrashad.github.io/LaraNote/" target="_blank"><strong>Features Demo</strong></a>

![LaraNote screenshot](icons/Laranote-main.png)

## Features

* **Highlighting:** Select any text on a webpage to bring up a small toolbar. Click the highlight button to highlight the selected text.
* **Notes:** Add notes to your highlights.
* **Copying:** Easily copy the selected text to your clipboard.
* **Removing Highlights:** Remove highlights with a single click.
* **Per-URL Savings:** All your highlights and notes are saved against the URL of the page you are on.
* **Export/Import:** Export your notes as a JSON file or import them.

## How to Use

1. **Select Text:** Simply select any text on a webpage.
2. **Use the Toolbar:** A small toolbar will appear. You can:
   * Highlight the text.
   * Add a note to the highlighted text.
   * Copy the text.
   * Remove a highlight.
3. **View Notes:** Click on the extension icon in your browser's toolbar to view all the notes for the current page.
4. **Manage Notes:** From the popup, you can view, edit, or delete your notes. You can also export all your notes for the current page.
5. **Options:** Go to the options page to export or import all your notes from all pages.

## Installation

### From the Chrome Web Store

LaraNote is available on the Chrome Web Store. You can install it by visiting the [extension&#39;s page](https://chrome.google.com/webstore/detail/your-extension-id-here).

### For Developers (Manual Installation)

If you want to install the extension manually or contribute to the project:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/emadrashad/LaraNote.git
   ```
2. **Navigate to the directory:**
   ```bash
   cd LaraNote
   ```
3. **Open Chrome and navigate to `chrome://extensions`.**
4. **Enable "Developer mode"** by toggling the switch in the top-right corner.
5. **Click "Load unpacked"** and select the `LaraNote` directory.

## Permissions

* **storage:** To save your highlights and notes.
* **activeTab:** To interact with the currently active tab.
* **scripting:** To inject the highlighting and note-taking functionality into webpages.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License.
