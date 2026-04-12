import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEFAULT_HOST = process.env.BROWSER_ANNOTATIONS_HOST || "127.0.0.1";
const DEFAULT_PORT = Number.parseInt(process.env.BROWSER_ANNOTATIONS_PORT || "8765", 10);
const tmpDir = await mkdtemp(join(tmpdir(), "browser-annotations-"));

async function saveScreenshot(dataUrl: string, id: string = crypto.randomUUID()): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const ext = dataUrl.match(/^data:image\/(\w+)/)?.[1] ?? "png";
  const path = join(tmpDir, `${id}.${ext}`);
  await writeFile(path, Buffer.from(base64, "base64"));
  return path;
}

async function saveScreenshots(body: Record<string, unknown>) {
  const targets = [body, ...(Array.isArray(body.annotations) ? body.annotations : [])].filter(
    (target): target is { id?: unknown; screenshot: string } =>
      Boolean(target) &&
      typeof target === "object" &&
      typeof target.screenshot === "string" &&
      target.screenshot.startsWith("data:"),
  );

  await Promise.all(
    targets.map(async (target) => {
      target.screenshot =
        typeof target.id === "string"
          ? await saveScreenshot(target.screenshot, target.id)
          : await saveScreenshot(target.screenshot);
    }),
  );
}

const SCREENSHOT_DATA_URL_RE = /!\[([^\]]*)\]\((data:image\/\w+;base64,[A-Za-z0-9+/=]+)\)/g;

async function processMarkdownScreenshots(markdown: string): Promise<string> {
  const replacements: { match: string; replacement: string }[] = [];

  for (const m of markdown.matchAll(SCREENSHOT_DATA_URL_RE)) {
    const filePath = await saveScreenshot(m[2]!);
    replacements.push({ match: m[0], replacement: `![${m[1]}](${filePath})` });
  }

  let result = markdown;
  for (const { match, replacement } of replacements) {
    result = result.replace(match, replacement);
  }

  return result;
}

function setCorsHeaders(res: import("node:http").ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

const mcpServer = new Server(
  {
    name: "browser-annotations",
    version: "0.0.0",
  },
  {
    capabilities: { experimental: { "claude/channel": {} } },
    instructions: `You receive feedback from the Chrome DevTools extension.`,
  },
);

await mcpServer.connect(new StdioServerTransport());

const port = Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 8765;

const server = createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200).end("OK");
    return;
  }

  if (req.method === "POST") {
    const contentType = req.headers["content-type"] || "";
    const rawBody = await readBody(req);

    let content: string;

    if (contentType.includes("text/markdown")) {
      content = await processMarkdownScreenshots(rawBody);
    } else {
      const body = JSON.parse(rawBody);
      await saveScreenshots(body);
      content = JSON.stringify(body);
    }

    await mcpServer.notification({
      method: "notifications/claude/channel",
      params: { content, meta: {} },
    });
  }

  res.writeHead(200).end();
});

server.listen(port, DEFAULT_HOST, () => {
  console.log("Listening on http://%s:%d", DEFAULT_HOST, port);
});
