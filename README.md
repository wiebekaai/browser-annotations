# Browser Annotations

A Chrome extension for developers to annotate elements and send feedback to agents.

## Usage

1. Use the Chrome DevTools to select an element (<kbd>CMD OPT C</kbd>)
2. Write your feedback in the `Feedback` tab
3. Use `Add` to batch annotations
4. Hit `Submit` to notify your agent or copy to clipboard

## Features

- Captures element context, page context, and an element screenshot
- Maps elements to source code in React and Svelte (for example `pages/index.tsx:30`)
- Supports webhook and clipboard output modes
- Claude Code plugin and Pi package to send feedback straight to your agent
- Send feedback directly or batch annotations
- Keyboard shortcuts for every action
- Persists annotations per site, allowing feedback across multiple pages

## Installation

> Currently figuring out how I can best distribute the packages :)

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
