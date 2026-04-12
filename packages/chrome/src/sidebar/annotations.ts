import type { Selection } from "~/sidebar/selection";
import type { BoundingBox, PageContext, SelectionContext } from "~/sidebar/selection-context";
import type { SourceContext } from "~/sidebar/sources";

export type Annotation = {
  id: string;
  createdAt: string;
  comment?: string;
  screenshot?: string;
  target: Selection;
  page: PageContext;
  boundingBox: BoundingBox;
  source?: SourceContext;
};

export const createAnnotation = ({
  comment,
  screenshot,
  selection,
  context,
}: {
  comment?: string;
  screenshot?: string;
  selection: Selection;
  context: SelectionContext;
}): Annotation => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  comment,
  ...(screenshot ? { screenshot } : {}),
  target: selection,
  ...context,
});

export function isValidAnnotation(v: unknown): v is Annotation {
  return (
    !!v &&
    typeof (v as Annotation).id === "string" &&
    typeof (v as Annotation).target?.selector === "string" &&
    typeof (v as Annotation).page?.href === "string"
  );
}
