import { createServer, type IncomingMessage, type Server as HttpServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const CUSTOM_TYPE = "browser-annotation";
const STATUS_KEY = "browser-annotations";
const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.BROWSER_ANNOTATIONS_PORT || "3330", 10) || 3330;
const BROWSER_PROMPT = "Process feedback from the Browser Annotations Chrome DevTools extension.";
const COMMAND_NAME = "browser-annotations";

type RuntimeState = {
  server?: HttpServer;
  tmpDir?: string;
  hasInjectedPrompt: boolean;
  host: string;
  port: number;
};

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString();
}

async function saveScreenshot(
  dataUrl: string,
  tmpDir: string,
  id: string = crypto.randomUUID(),
): Promise<string> {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const extension = dataUrl.match(/^data:image\/(\w+)/)?.[1] ?? "png";
  const path = join(tmpDir, `${id}.${extension}`);
  await writeFile(path, Buffer.from(base64, "base64"));
  return path;
}

async function saveJsonScreenshots(body: Record<string, unknown>, tmpDir: string) {
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
          ? await saveScreenshot(target.screenshot, tmpDir, target.id)
          : await saveScreenshot(target.screenshot, tmpDir);
    }),
  );
}

const SCREENSHOT_DATA_URL_REGEX = /!\[([^\]]*)\]\((data:image\/\w+;base64,[A-Za-z0-9+/=]+)\)/g;

async function saveMarkdownScreenshots(markdown: string, tmpDir: string): Promise<string> {
  const replacements: { match: string; replacement: string }[] = [];

  for (const match of markdown.matchAll(SCREENSHOT_DATA_URL_REGEX)) {
    const filePath = await saveScreenshot(match[2]!, tmpDir);
    replacements.push({ match: match[0], replacement: `![${match[1]}](${filePath})` });
  }

  let result = markdown;
  for (const { match, replacement } of replacements) {
    result = result.replace(match, replacement);
  }

  return result;
}

function getServerUrl(host: string, port: number): string {
  return `http://${host}:${port}/`;
}

function closeServer(server: HttpServer | undefined) {
  if (!server) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function listen(
  server: HttpServer,
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

async function ensureTmpDir(state: RuntimeState) {
  if (!state.tmpDir) {
    state.tmpDir = await mkdtemp(join(tmpdir(), "browser-annotations-"));
  }

  return state.tmpDir;
}

async function cleanupTmpDir(state: RuntimeState) {
  if (!state.tmpDir) return;

  await rm(state.tmpDir, { recursive: true, force: true });
  state.tmpDir = undefined;
}

function updateStatus(
  ctx: { hasUI: boolean; ui: { setStatus(key: string, value?: string): void } },
  state: RuntimeState,
) {
  if (!ctx.hasUI) return;

  const value = state.server ? `→ Listening on ${getServerUrl(state.host, state.port)}` : undefined;
  ctx.ui.setStatus(STATUS_KEY, value);
}

function parsePort(value: string) {
  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }

  return port;
}

export default function browserAnnotationsExtension(pi: ExtensionAPI) {
  const state: RuntimeState = {
    hasInjectedPrompt: false,
    host: HOST,
    port: PORT,
  };

  pi.on("before_agent_start", async (event) => {
    if (state.hasInjectedPrompt || !state.server) {
      return;
    }

    state.hasInjectedPrompt = true;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${BROWSER_PROMPT}`,
    };
  });

  async function stopServer() {
    await closeServer(state.server);
    state.server = undefined;
    await cleanupTmpDir(state);
  }

  function createAnnotationServer() {
    return createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

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
        const tmpDir = await ensureTmpDir(state);

        let content: string;
        let details: unknown;

        if (contentType.includes("text/markdown")) {
          content = await saveMarkdownScreenshots(rawBody, tmpDir);
          details = { markdown: content };
        } else {
          const body = JSON.parse(rawBody) as Record<string, unknown>;
          await saveJsonScreenshots(body, tmpDir);
          content = JSON.stringify(body);
          details = body;
        }

        pi.sendMessage(
          {
            customType: CUSTOM_TYPE,
            content,
            display: true,
            details,
          },
          { triggerTurn: true },
        );

        res.writeHead(200).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  }

  async function startServer(
    ctx: {
      hasUI: boolean;
      ui: {
        notify(message: string, level?: "info" | "warning" | "error"): void;
        setStatus(key: string, value?: string): void;
      };
    },
    nextPort: number,
  ) {
    if (state.server && state.port === nextPort) {
      updateStatus(ctx, state);

      if (ctx.hasUI) {
        ctx.ui.notify(
          `Browser annotations already listening on ${getServerUrl(state.host, state.port)}`,
          "info",
        );
      }

      return;
    }

    await stopServer();
    state.port = nextPort;
    state.hasInjectedPrompt = false;
    await ensureTmpDir(state);

    const server = createAnnotationServer();

    try {
      const address = await listen(server, state.host, state.port);
      state.port = address.port;
      state.server = server;
      updateStatus(ctx, state);

      if (ctx.hasUI) {
        const portChanged = address.port !== nextPort;
        const prefix = portChanged ? `Port ${nextPort} in use. ` : "";
        ctx.ui.notify(
          `${prefix}Browser annotations listening on ${getServerUrl(state.host, state.port)}`,
          "info",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await closeServer(server);
      state.server = undefined;
      await cleanupTmpDir(state);
      updateStatus(ctx, state);

      if (ctx.hasUI) {
        ctx.ui.notify(`Could not start browser annotations server: ${message}`, "error");
      }
    }
  }

  pi.registerCommand(COMMAND_NAME, {
    description: "Start, stop, or inspect the browser annotations webhook server",
    handler: async (args, ctx) => {
      const input = args.trim();

      if (!input) {
        if (state.server) {
          ctx.ui.notify(
            `Browser annotations listening on ${getServerUrl(state.host, state.port)}`,
            "info",
          );
          return;
        }

        await startServer(ctx, state.port);
        return;
      }

      if (input === "status") {
        const message = state.server
          ? `Browser annotations listening on ${getServerUrl(state.host, state.port)}`
          : "Browser annotations server is stopped";
        ctx.ui.notify(message, "info");
        return;
      }

      if (input === "stop") {
        if (!state.server) {
          ctx.ui.notify("Browser annotations server is already stopped", "info");
          return;
        }

        await stopServer();
        updateStatus(ctx, state);
        ctx.ui.notify("Browser annotations server stopped", "info");
        return;
      }

      try {
        await startServer(ctx, parsePort(input));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui.notify(`${message}. Usage: /${COMMAND_NAME} [port|status|stop]`, "error");
      }
    },
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await stopServer();
    updateStatus(ctx, state);
  });
}
