import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerResponse, IncomingMessage } from "node:http";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.BROWSER_ANNOTATIONS_PORT || "3330", 10) || 3330;
const tmpDir = await mkdtemp(join(tmpdir(), "browser-annotations-"));

async function saveScreenshot(dataUrl: string, id: string = crypto.randomUUID()): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const extension = dataUrl.match(/^data:image\/(\w+)/)?.[1] ?? "png";
  const path = join(tmpDir, `${id}.${extension}`);
  await writeFile(path, Buffer.from(base64, "base64"));
  return path;
}

async function saveJsonScreenshots(body: Record<string, unknown>) {
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

const SCREENSHOT_DATA_URL_REGEX = /!\[([^\]]*)\]\((data:image\/\w+;base64,[A-Za-z0-9+/=]+)\)/g;

async function saveMarkdownScreenshots(markdown: string): Promise<string> {
  const replacements: { match: string; replacement: string }[] = [];

  for (const match of markdown.matchAll(SCREENSHOT_DATA_URL_REGEX)) {
    const filePath = await saveScreenshot(match[2]!);
    replacements.push({ match: match[0], replacement: `![${match[1]}](${filePath})` });
  }

  let result = markdown;
  for (const { match, replacement } of replacements) {
    result = result.replace(match, replacement);
  }

  return result;
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

function listen(
  server: ReturnType<typeof createServer>,
  host: string,
  port: number,
  maxRetries = 10,
): Promise<{ address: string; port: number }> {
  return new Promise((resolve, reject) => {
    let currentPort = port;
    let attempts = 0;

    const onError = (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE" && ++attempts < maxRetries) {
        server.once("error", onError);
        server.listen(++currentPort, host);
      } else {
        reject(err);
      }
    };

    server.once("error", onError);
    server.once("listening", () => {
      resolve(server.address() as { address: string; port: number });
    });

    server.listen(currentPort, host);
  });
}

const mcpServer = new Server(
  {
    name: "browser-annotations",
    version: "0.0.0",
  },
  {
    capabilities: { experimental: { "claude/channel": {} } },
    instructions: `Process feedback from the Browser Annotations Chrome DevTools extension.`,
  },
);

mcpServer.oninitialized = async () => {
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

    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }

    try {
      const contentType = req.headers["content-type"] || "";
      const rawBody = await readBody(req);

      let content: string;

      if (contentType.includes("text/markdown")) {
        content = await saveMarkdownScreenshots(rawBody);
      } else {
        const body = JSON.parse(rawBody);
        await saveJsonScreenshots(body);
        content = JSON.stringify(body);
      }

      await mcpServer.notification({
        method: "notifications/claude/channel",
        params: { content, meta: {} },
      });

      res.writeHead(200).end();
    } catch (err) {
      await mcpServer.notification({
        method: "notifications/claude/channel",
        params: {
          content: `Request error: ${(err as Error).message}`,
          meta: {},
        },
      });

      res.writeHead(400).end();
    }
  });

  const shutdown = () => {
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("end", shutdown);

  try {
    const address = await listen(server, HOST, PORT);

    let content = "";
    if (address.port !== PORT) {
      content += `Address already in use ${address.address}:${PORT}\n\n`;
    }
    content += `Listening on http://${address.address}:${address.port}\n\n`;
    content += `\n\nMatch this port in the Chrome DevTools extension and start sending your feedback`;

    await mcpServer.notification({
      method: "notifications/claude/channel",
      params: { content, meta: {} },
    });
  } catch (err) {
    await mcpServer.notification({
      method: "notifications/claude/channel",
      params: {
        content: `Server error: ${(err as Error).message}`,
        meta: {},
      },
    });
  }
};

await mcpServer.connect(new StdioServerTransport());
