import type { JSX, ParentComponent } from "solid-js";
import { Show } from "solid-js";
import { cn } from "~/sidebar/utils";
import { truncateSelector } from "~/sidebar/utils";
import { CrosshairSimpleIcon, MinusIcon, PlusIcon, XIcon } from "~/sidebar/icons";
import type { Annotation as AnnotationType } from "~/sidebar/annotations";

const ActionButton: ParentComponent<JSX.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => (
  <button
    type="button"
    {...props}
    class={cn(
      "pointer-events-none absolute top-2 right-2 ml-auto text-2xs text-foreground/80 opacity-0 group-hover/annotation:pointer-events-auto group-hover/annotation:opacity-100 hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100",
      props.class,
    )}
  />
);

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
        "group/annotation relative w-full bg-foreground/2 p-2 pl-3",
        "before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-[background-color] before:duration-150 before:content-['']",
        props.isInBatch ? "before:bg-accent" : "before:bg-foreground/20",
      )}
    >
      <p class="pr-5 whitespace-pre-wrap">{props.annotation.comment}</p>
      <div class="mt-2 flex h-fit items-center gap-1">
        <Show
          when={props.isBatching}
          fallback={
            <ActionButton aria-label="Discard annotation" onClick={props.onRemove}>
              <XIcon class="size-3" />
            </ActionButton>
          }
        >
          <Show when={props.isInBatch}>
            <ActionButton aria-label="Exclude annotation" onClick={props.onExclude}>
              <MinusIcon class="size-3" />
            </ActionButton>
          </Show>
          <Show when={!props.isInBatch}>
            <ActionButton aria-label="Include annotation" onClick={props.onInclude}>
              <PlusIcon class="size-3" />
            </ActionButton>
          </Show>
        </Show>
        <span class="flex cursor-default items-center gap-1 text-2xs text-foreground/80">
          <CrosshairSimpleIcon class="size-3 shrink-0" />
          {truncateSelector(props.annotation.target.selector)}
        </span>
      </div>
    </article>
  </li>
);
