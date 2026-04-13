# Browser Annotations

[Browser Annotations](https://browser-annotations.dev/) is a Chrome DevTools extension to send feedback to your agent.

Select an element, add feedback, and send it to your pi or Claude Code session.

![Sending feedback from the Chrome DevTools to pi.](docs/screenshot.png)

## Install

Install the Chrome extension

```bash
npx browser-annotations@latest
```

Install the pi extension

```bash
pi install npm:@browser-annotations/pi
```

Install the Claude Code plugin

```bash
/plugin marketplace add wiebekaai/browser-annotations
/plugin install claude@browser-annotations
```

## Usage

1. _(Optional)_ Set up your agent to work on your feedback
   - pi — `/browser-annotations`
   - Claude Code — `claude --dangerously-load-development-channels plugin:claude@browser-annotations`
2. Select an element in the Chrome DevTools
3. Add your feedback in the Feedback tab (drag this tab to the left so it's easily accessible)
4. Use <img src="docs/icon-add.svg" alt="Add" /> to batch annotations. Annotations persist per website, so your feedback can span multiple pages
5. Hit <img src="docs/icon-send.svg" alt="Send" /> to send to your agent, or <img src="docs/icon-copy.svg" alt="Copy" /> to copy as markdown

> [!TIP]
> <kbd><kbd>⌘</kbd> <kbd>X</kbd></kbd> / <kbd><kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>X</kbd></kbd> copies your feedback to clipboard. Handy for quick sharing.

## Features

- **Annotate any website** – Select an element with <kbd><kbd>⌘</kbd> <kbd>⌥</kbd> <kbd>C</kbd></kbd> and write your feedback in the DevTools sidebar
- **Live agent collaboration** – Send feedback directly to your pi or Claude Code session via a webhook
- **Complete context** – Includes an element's selector, position, size, viewport, device info, and a screenshot
- **Source mapping** – Links elements to React and Svelte source code during development
- **Batch annotations** – Annotate elements across multiple pages and send them as one prompt
- **Clipboard support** – Copy feedback and its context as markdown for quick sharing

## Keyboard shortcuts

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

## Example output

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
