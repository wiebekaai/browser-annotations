# Browser Annotations

Select elements in the Chrome DevTools, write feedback, and send it to your coding agent.

Install the [Chrome extension](#chrome-extension) and use it with [pi](#pi) or [Claude Code](#claude-code).

![Sending feedback from the Chrome DevTools to pi.](docs/screenshot.png)

## Features

- **Annotate elements** – Select any element and write your feedback
- **Live agent collaboration** – Send feedback directly to your [pi](#pi) or [Claude Code](#claude-code) session
- **Complete context** – Includes an element's selector, position, size, viewport, device info, and a screenshot
- **Source mapping** – Links elements to React and Svelte source code during development
- **Batch annotations** – Combine feedback across multiple elements and pages
- **Works everywhere** – Lives in your DevTools, works on any website
- **Clipboard mode** – Copy feedback as markdown for any workflow

## Installation

### Chrome extension

1. Install with `pnpm install -g browser-annotations`
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select `~/browser-annotations/chrome-extension`

**Updates:** Run `pnpm update -g browser-annotations` and reload the extension in `chrome://extensions`

### pi

1. Install with `pi install git:github.com/wiebekaai/browser-annotations`
2. Start pi with `pi`
3. Run `/browser-annotations`

**Updates:** Run `pi update` in pi

### Claude Code

1. Start Claude Code with `claude`
2. Add the marketplace with `/plugin marketplace add wiebekaai/browser-annotations`
3. Install the plugin with `/plugin install claude@browser-annotations`
4. Restart with `claude --dangerously-load-development-channels plugin:claude@browser-annotations`

**Updates:** Run `/plugin update claude@browser-annotations` in Claude Code

## Usage

1. Choose your mode
   - **Webhook on** — Send feedback directly to your agent (see [pi](#pi) or [Claude Code](#claude-code) setup)
   - **Webhook off** — Copy feedback as markdown to your clipboard
2. Select an element in the Chrome DevTools
3. Write your feedback in the <img src="docs/feedback-tab.png" alt="Feedback tab" height="20" /> tab (drag this tab to the left so it's easily accessible)
4. Use <img src="docs/icon-add.svg" alt="Add" /> to batch annotations. Annotations persist per website, so your feedback can span multiple pages
5. Hit <img src="docs/icon-send.svg" alt="Send" /> to send to your agent, or <img src="docs/icon-copy.svg" alt="Copy" /> to copy as markdown

> [!TIP]
> Even when using a webhook, <kbd><kbd>⌘</kbd> <kbd>X</kbd></kbd> / <kbd><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>X</kbd></kbd> copies to clipboard. Handy for quick sharing.

### Keyboard shortcuts

| Action          | Shortcut                                              |
| --------------- | ----------------------------------------------------- |
| Inspect element | <kbd><kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>C</kbd></kbd>     |
| Add             | <kbd><kbd>⌘</kbd> <kbd>Enter</kbd></kbd>              |
| Submit          | <kbd><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>Enter</kbd></kbd> |
| Copy current    | <kbd><kbd>⌘</kbd> <kbd>X</kbd></kbd>                  |
| Copy all        | <kbd><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>X</kbd></kbd>     |
| Clear current   | <kbd><kbd>⌘</kbd> <kbd>K</kbd></kbd>                  |
| Clear all       | <kbd><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>K</kbd></kbd>     |
| Cancel / Reset  | <kbd>Esc</kbd>                                        |

### Example output

```md
# Feedback

Please refine the homepage

## 1. `div:nth-of-type(4) > h2.section-title`

Title should be 24px

![Screenshot](/tmp/browser-annotations/screenshot-1.png)

- **Page:** [http://localhost:5173/](http://localhost:5173/)
- **Device:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36`
- **Viewport:** 1497×879
- **Device pixel ratio:** 2
- **Position:** X 407, Y 206
- **Size:** 684×36
- **Source:** [`pages/index.tsx:42`](pages/index.tsx)

## 2. `p.docs-button > a[href="/packages"]`

This should open the sidepanel with packages

![Screenshot](/tmp/browser-annotations/screenshot-2.png)

- **Page:** [http://localhost:5173/](http://localhost:5173/)
- **Device:** `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36`
- **Viewport:** 1497×879
- **Device pixel ratio:** 2
- **Position:** X 407, Y 616
- **Size:** 159×48
- **Source:** [`components/DocsButton.tsx:8`](components/DocsButton.tsx)
```
