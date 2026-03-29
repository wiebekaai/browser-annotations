import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const CUSTOM_TYPE = "browser-annotation";
const STATUS_KEY = "browser-annotations";
const DEFAULT_HOST = process.env.BROWSER_ANNOTATIONS_HOST || "127.0.0.1";
const DEFAULT_PORT = Number.parseInt(process.env.BROWSER_ANNOTATIONS_PORT || "8765", 10);
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const BROWSER_PROMPT = "You receive feedback from the Chrome DevTools extension.";

type JsonRecord = Record<string, unknown>;

type RuntimeState = {
  server?: HttpServer;
  tempDir?: string;
  hasInjectedPrompt: boolean;
  host: string;
  port: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeFileNamePart(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "-");
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function saveScreenshot(dataUrl: string, tempDir: string, id: string = crypto.randomUUID()) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const ext = dataUrl.match(/^data:image\/(\w+)/)?.[1] ?? "png";
  const path = join(tempDir, `${sanitizeFileNamePart(id)}.${ext}`);
  await writeFile(path, Buffer.from(base64, "base64"));
  return path;
}

async function normalizePayload(payload: unknown, tempDir: string): Promise<JsonRecord> {
  if (!isRecord(payload)) {
    throw new Error("Expected a JSON object payload");
  }

  const normalized = structuredClone(payload) as JsonRecord;
  const annotations = Array.isArray(normalized.annotations)
    ? normalized.annotations.filter(isRecord)
    : [];
  const screenshotTargets = [normalized, ...annotations].filter(
    (value): value is JsonRecord =>
      typeof value.screenshot === "string" && value.screenshot.startsWith("data:"),
  );

  await Promise.all(
    screenshotTargets.map(async (target) => {
      const screenshot = target.screenshot;
      if (typeof screenshot !== "string") return;

      target.screenshot = await saveScreenshot(
        screenshot,
        tempDir,
        getString(target.id) || crypto.randomUUID(),
      );
    }),
  );

  return normalized;
}

const SCREENSHOT_DATA_URL_RE = /!\[([^\]]*)\]\((data:image\/\w+;base64,[A-Za-z0-9+/=]+)\)/g;

async function processMarkdownScreenshots(markdown: string, tempDir: string): Promise<string> {
  const replacements: { match: string; replacement: string }[] = [];

  for (const m of markdown.matchAll(SCREENSHOT_DATA_URL_RE)) {
    const filePath = await saveScreenshot(m[2]!, tempDir);
    replacements.push({ match: m[0], replacement: `![${m[1]}](${filePath})` });
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

function writeJson(response: ServerResponse, statusCode: number, body: JsonRecord) {
  response.writeHead(statusCode, {
    ...CORS_HEADERS,
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, statusCode: number, body: string) {
  response.writeHead(statusCode, {
    ...CORS_HEADERS,
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function writeEmpty(response: ServerResponse, statusCode: number) {
  response.writeHead(statusCode, CORS_HEADERS);
  response.end();
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

function listen(server: HttpServer, port: number, host: string) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

export default function browserAnnotationsExtension(pi: ExtensionAPI) {
  const state: RuntimeState = {
    hasInjectedPrompt: false,
    host: DEFAULT_HOST,
    port: Number.isFinite(DEFAULT_PORT) ? DEFAULT_PORT : 8765,
  };

  pi.on("before_agent_start", async (event) => {
    if (state.hasInjectedPrompt) {
      return;
    }

    state.hasInjectedPrompt = true;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${BROWSER_PROMPT}`,
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    state.hasInjectedPrompt = false;
    state.tempDir = await mkdtemp(join(tmpdir(), "browser-annotations-"));

    const server = createServer(async (request, response) => {
      if (request.method === "OPTIONS") {
        response.writeHead(204, CORS_HEADERS);
        response.end();
        return;
      }

      if (request.method === "GET") {
        writeText(response, 200, "OK");
        return;
      }

      if (request.method !== "POST") {
        writeJson(response, 405, { ok: false, error: "Method not allowed" });
        return;
      }

      try {
        const rawBody = await readRequestBody(request);
        const contentType = request.headers["content-type"] || "";

        let content: string;
        let details: unknown;

        if (contentType.includes("text/markdown")) {
          content = await processMarkdownScreenshots(rawBody, state.tempDir!);
          details = { markdown: content };
        } else {
          const parsedBody = JSON.parse(rawBody) as unknown;
          const payload = await normalizePayload(parsedBody, state.tempDir!);
          content = JSON.stringify(payload);
          details = payload;
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

        writeEmpty(response, 200);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (ctx.hasUI) {
          ctx.ui.notify(`Browser annotation failed: ${message}`, "error");
        }

        writeJson(response, 400, { ok: false, error: message });
      }
    });

    try {
      await listen(server, state.port, state.host);
      state.server = server;

      if (ctx.hasUI) {
        ctx.ui.notify("Browser annotations plugin loaded", "info");
        ctx.ui.setStatus(STATUS_KEY, `→ Listening on ${getServerUrl(state.host, state.port)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await closeServer(server);

      if (ctx.hasUI) {
        ctx.ui.setStatus(STATUS_KEY, `browser annotations unavailable (${message})`);
        ctx.ui.notify(`Could not start browser annotations server: ${message}`, "error");
      }
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await closeServer(state.server);
    state.server = undefined;

    if (state.tempDir) {
      await rm(state.tempDir, { recursive: true, force: true });
      state.tempDir = undefined;
    }

    if (ctx.hasUI) {
      ctx.ui.setStatus(STATUS_KEY, undefined);
    }
  });
}
