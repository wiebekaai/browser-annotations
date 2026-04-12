# @browser-annotations/chrome

Annotate elements and send them to your agents right from your Chrome DevTools.

## Install

```bash
pnpm install -g @browser-annotations/chrome
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select:

- `~/browser-annotations/chrome` — created automatically during install
- or the `dist` folder in your package manager's global directory, if you prefer no symlink

## Usage

1. Use the Chrome DevTools to select an element
2. Write your feedback in the `Feedback` tab
3. Use `Add` to batch annotations
4. Hit `Submit` to notify your agent or copy to clipboard

## Agent integration

For sending feedback straight to your agent, see the [pi](https://browser-annotations.dev/) and [Claude Code](https://browser-annotations.dev/) setup guides.

## Links

- [Documentation](https://browser-annotations.dev/)
- [GitHub](https://github.com/wiebekaai/browser-annotations)
