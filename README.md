# Browser Annotations

Annotate elements and send them to your agents right from your Chrome DevTools.

A Chrome extension for developers to annotate elements and send feedback to agents.

## Installation

> Currently figuring out how I can best distribute the packages :)

### Claude Code

```bash
# 1. Start Claude Code
claude

# 2. Add marketplace and install extension
/plugin marketplace add wiebekaai/browser-annotations
/plugin install browser-annotations@browser-annotations

# 3. Restart Claude Code with the plugin
claude --dangerously-load-development-channels plugin:browser-annotations@browser-annotations

# ?. If the server keeps running after closing Claude Code, run this. I'll try to find a better solution.
bunx kill-port 8765
```

> This plugin uses [channels](https://code.claude.com/docs/en/channels-reference) that are currently in [research preview](https://code.claude.com/docs/en/channels#research-preview). That's why you need to pass `--dangerously-load-development-channels`.

## Usage

1. Use the Chrome DevTools to select an element
2. Write your feedback in the `Feedback` tab
3. Use `Add` to batch annotations
4. Hit `Submit` to notify your agent or copy to clipboard

![Screenshot](docs/screenshot.png)

## Features

- Captures element context, page context, and an element screenshot
- Maps elements to source code in React and Svelte (for example `pages/index.tsx:30`)
- Supports webhook and clipboard output modes
- Claude Code plugin and Pi package to send feedback straight to your agent
- Send feedback directly or batch annotations
- Keyboard shortcuts for every action
- Persists annotations per site, allowing feedback across multiple pages

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
