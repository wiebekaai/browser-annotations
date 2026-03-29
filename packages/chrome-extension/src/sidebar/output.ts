import type { Annotation } from "~/sidebar/annotations";

export const toJson = (
  annotation: Annotation,
  { includeScreenshot = true }: { includeScreenshot?: boolean } = {},
) => {
  const { id: _id, createdAt: _createdAt, screenshot, page, source, ...rest } = annotation;

  return {
    ...rest,
    ...(includeScreenshot && screenshot ? { screenshot } : {}),
    page: {
      href: page.href,
      userAgent: page.userAgent,
      devicePixelRatio: page.devicePixelRatio,
      viewport: page.viewport,
    },
    ...(source?.location ? { source: `${source.location.file}:${source.location.line}` } : {}),
  };
};

export const toMd = (
  annotation: Annotation,
  { includeScreenshot = true }: { includeScreenshot?: boolean } = {},
) => {
  const { comment, screenshot, target, page, boundingBox, source } = annotation;
  const lines: string[] = [];

  lines.push(`## \`${target.selector}\``);
  lines.push("");

  if (comment) {
    lines.push(comment);
    lines.push("");
  }

  if (includeScreenshot && screenshot) {
    lines.push(`![Screenshot](${screenshot})`);
    lines.push("");
  }

  lines.push(`- **Page:** [${page.href}](${page.href})`);
  lines.push(`- **Device:** \`${page.userAgent}\``);
  lines.push(`- **Viewport:** ${page.viewport.width}\u00d7${page.viewport.height}`);
  lines.push(`- **Device pixel ratio:** ${page.devicePixelRatio}`);
  lines.push(`- **Position:** X ${Math.round(boundingBox.x)}, Y ${Math.round(boundingBox.y)}`);
  lines.push(`- **Size:** ${Math.round(boundingBox.width)}\u00d7${Math.round(boundingBox.height)}`);

  if (target.frame?.length) {
    lines.push(`- **Frame:** \`${target.frame.join(" > ")}\``);
  }

  if (target.nodeType && target.content) {
    lines.push(`- **Content:** \`${target.content}\``);
  }

  if (source?.location) {
    const loc = `${source.location.file}:${source.location.line}`;
    lines.push(`- **Source:** [\`${loc}\`](${source.location.file})`);
  }

  return lines.join("\n");
};

export const toBatchMd = (
  annotations: Annotation[],
  {
    comment,
    includeScreenshot = true,
  }: { comment?: string | null; includeScreenshot?: boolean } = {},
) => {
  const parts: string[] = [];

  if (comment) {
    parts.push("# Feedback");
    parts.push("");
    parts.push(comment);
    parts.push("");
  }

  for (const [i, annotation] of annotations.entries()) {
    const md = toMd(annotation, { includeScreenshot });
    parts.push(md.replace(/^## /, `## ${i + 1}. `));
    parts.push("");
  }

  return parts.join("\n").trimEnd();
};
