import type { Annotation } from "~/sidebar/annotations";

const toAnnotationMd = (
  annotation: Annotation,
  index: number,
  { includeScreenshot = true }: { includeScreenshot?: boolean } = {},
) => {
  const { comment, screenshot, target, page, boundingBox, source } = annotation;
  const lines: string[] = [];

  lines.push(`## ${index}. \`${target.selector}\``);
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

export const toMd = (annotation: Annotation, options: { includeScreenshot?: boolean } = {}) =>
  toBatchMd([annotation], options);

export const toBatchMd = (
  annotations: Annotation[],
  {
    comment,
    includeScreenshot = true,
  }: { comment?: string | null; includeScreenshot?: boolean } = {},
) => {
  const parts: string[] = ["# Feedback", ""];

  if (comment) {
    parts.push(comment);
    parts.push("");
  }

  for (const [i, annotation] of annotations.entries()) {
    parts.push(toAnnotationMd(annotation, i + 1, { includeScreenshot }));
    parts.push("");
  }

  return parts.join("\n").trimEnd();
};
