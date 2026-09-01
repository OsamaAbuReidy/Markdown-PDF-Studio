# Markdown PDF Studio

Markdown PDF Studio is a local Markdown-to-PDF converter with both a command-line interface and a visual editor. It renders through Chrome or Microsoft Edge for selectable text, print-quality CSS, syntax-highlighted code, and predictable page layout.

## Features

- A4, A3, Letter, and Legal pages in portrait or landscape
- Live margin, paragraph-spacing, and heading-spacing controls
- Separate body, heading, and code fonts
- Windows font discovery and embedded `.otf`, `.ttf`, `.woff`, and `.woff2` imports
- Custom colours, syntax highlighting, line numbers, and code wrapping
- Headers, footers, page numbers, page breaks, and custom CSS
- GitHub-flavoured Markdown, tables, task lists, images, and raw HTML
- Local CLI and browser-based workflows

## Requirements

- Node.js 18 or newer
- pnpm 11
- Google Chrome or Microsoft Edge

## Quick start

```powershell
pnpm install
pnpm start
```

Then open `http://127.0.0.1:4173`.

On Windows, double-click `Start Markdown PDF Studio.bat` for first-time setup, server startup, and browser launch.

## Command-line usage

```powershell
node src/cli.mjs notes.md
node src/cli.mjs notes.md -o report.pdf -c examples/config.json
node src/cli.mjs notes.md -o report.pdf -c examples/config.json --css examples/custom.css
```

Install the local `mdpdf` command with:

```powershell
pnpm link --global
mdpdf notes.md -o report.pdf
```

Run `node src/cli.mjs --help` for all CLI options.

## Configuration

Copy `examples/config.json` and override only what you need:

| Section | Controls |
|---|---|
| `page` | size, orientation, and four margins |
| `fonts` | body, heading, and code families; size and line height |
| `spacing` | paragraph gap and heading space before/after |
| `colors` | text, headings, links, accent, borders, quotes, and code |
| `code` | theme, size, line numbers, and wrapping |
| `markdown` | GitHub-flavoured Markdown and hard line breaks |
| `document` | title, header/footer HTML, and background printing |
| `customCss` | final CSS overrides |

Chrome provides `pageNumber`, `totalPages`, `date`, `title`, and `url` classes inside header and footer templates.

Useful print helpers:

```html
<div class="page-break"></div>
<div class="avoid-break">Keep this block on one page.</div>
```

## Custom fonts

The visual editor can embed font files directly. The CLI can load a local font through custom CSS:

```css
@font-face {
  font-family: "My Font";
  src: url("file:///C:/Fonts/MyFont-Regular.woff2") format("woff2");
}

body { font-family: "My Font", sans-serif; }
```

## Windows launchers

- `Start Markdown PDF Studio.bat` starts the server and opens the editor.
- `Install Browser Shortcut.bat` registers the optional `mdpdfstudio://start` user protocol.
- `Uninstall Browser Shortcut.bat` removes that protocol registration.
- `Browser Bookmark Setup.html` explains the Firefox bookmark workflow.

The protocol handler accepts no URL arguments and only launches Markdown PDF Studio.

## Project structure

```text
src/       Converter and local HTTP server
ui/        Zero-build browser interface
examples/  Example Markdown, configuration, and CSS
```

## Development

```powershell
pnpm check
pnpm demo
```

This project is intended for trusted local documents and exposes the styling flexibility of Markdown, HTML, and CSS by design.

## License

MIT
