import { Show } from "solid-js";
import { cn } from "~/sidebar/utils";
import { truncateSelector } from "~/sidebar/utils";
import { CrosshairSimpleIcon, MinusIcon, PlusIcon, XIcon } from "~/sidebar/icons";
import type { Annotation as AnnotationType } from "~/sidebar/annotations";

export const Annotation = (props: {
  annotation: AnnotationType;
  isBatching: boolean;
  isInBatch: boolean;
  onRemove: () => void;
  onExclude: () => void;
  onInclude: () => void;
}) => (
  <li>
    <article
      class={cn(
        "group/annotation relative w-full bg-white/2 p-2 pl-3",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-[background-color] before:duration-150 before:content-['']",
        props.isInBatch ? "before:bg-blue" : "before:bg-white/20",
      )}
    >
      <p class="pr-5 whitespace-pre-wrap">{props.annotation.comment}</p>
      <div class="mt-2 flex h-fit items-center gap-1">
        <Show
          when={props.isBatching}
          fallback={
            <button
              type="button"
              aria-label="Discard annotation"
              class={
                "pointer-events-none absolute top-2 right-2 ml-auto text-2xs text-white/80 opacity-0 group-hover/annotation:pointer-events-auto group-hover/annotation:opacity-100 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100"
              }
              onClick={props.onRemove}
            >
              <XIcon class="size-3" />
            </button>
          }
        >
          <Show when={props.isInBatch}>
            <button
              type="button"
              aria-label="Exclude annotation"
              class={
                "pointer-events-none absolute top-2 right-2 ml-auto text-2xs text-white/80 opacity-0 group-hover/annotation:pointer-events-auto group-hover/annotation:opacity-100 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100"
              }
              onClick={props.onExclude}
            >
              <MinusIcon class="size-3" />
            </button>
          </Show>
          <Show when={!props.isInBatch}>
            <button
              type="button"
              aria-label="Include annotation"
              class={
                "pointer-events-none absolute top-2 right-2 ml-auto text-2xs text-white/80 opacity-0 group-hover/annotation:pointer-events-auto group-hover/annotation:opacity-100 hover:text-white focus-visible:pointer-events-auto focus-visible:opacity-100"
              }
              onClick={props.onInclude}
            >
              <PlusIcon class="size-3" />
            </button>
          </Show>
        </Show>
        <span class="flex cursor-default items-center gap-1 text-2xs text-white/80">
          <CrosshairSimpleIcon class="size-3 shrink-0" />
          {truncateSelector(props.annotation.target.selector)}
        </span>
      </div>
    </article>
  </li>
);
