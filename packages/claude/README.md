# @browser-annotations/claude

A Claude Code plugin that listens for browser annotation webhook requests and injects them into the current Claude session.

## What it does

- Starts a local HTTP server when the plugin runs
- Accepts the same payloads as this repo's Chrome extension
- Saves base64 screenshots to temporary files
- Sends the normalized JSON payload into Claude through the plugin channel
- Adds a small root instruction through the MCP server configuration

## Development

### Run the local webhook server

```bash
pnpm --filter @browser-annotations/claude run dev
```

### Run Claude Code with the development plugin

```bash
pnpm --filter @browser-annotations/claude run dev:claude
```

## Default webhook URL

```text
http://127.0.0.1:8765/
```

That matches the default already used by the Chrome extension in this repo.

## Configuration

The plugin reads these optional environment variables:

- `BROWSER_ANNOTATIONS_HOST`
  - Default: `127.0.0.1`
- `BROWSER_ANNOTATIONS_PORT`
  - Default: `8765`

## Example request

```bash
curl -X POST http://127.0.0.1:8765/ \
  -H 'content-type: application/json' \
  -d '{"comment":"Button spacing feels off","page":{"href":"https://example.com"},"target":{"selector":"button.primary"}}'
```
