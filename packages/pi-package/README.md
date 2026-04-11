# @browser-annotations/pi-package

A pi extension that listens for browser annotation webhook requests and injects them into the current pi session.

## What it does

- Starts a local HTTP server when you run `/browser-annotations`
- Accepts the same payloads as this repo's Chrome extension
- Saves base64 screenshots to temporary files
- Sends a compact browser-annotation message into pi
- Adds a tiny prompt so pi treats these messages as page feedback

## Install

### Local project install

```bash
pi install -l ./packages/pi-package
```

### One-off test

```bash
pi -e ./packages/pi-package/src/index.ts
```

## Run

Start pi, then run:

```text
/browser-annotations
```

Optional commands:

```text
/browser-annotations 9001
/browser-annotations status
/browser-annotations stop
```

## Default webhook URL

```text
http://127.0.0.1:8765/
```

That matches the default already used by the Chrome extension in this repo.

## Configuration

The extension reads these optional environment variables:

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

## Distribution

This package is set up as a pi package.

- `keywords` includes `pi-package`
- `package.json#pi.extensions` points at `./src/index.ts`
- pi can install it from a local path, git URL, or npm package once published
