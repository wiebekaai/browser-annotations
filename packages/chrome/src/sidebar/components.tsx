import type { ClassValue } from "clsx";
import type { JSX, ParentComponent } from "solid-js";
import { splitProps } from "solid-js";
import { cn } from "~/sidebar/utils";

const tooltipPositions = {
  "top-left": "[position-area:top_span-right] [justify-self:start] mb-1",
  top: "[position-area:top] [justify-self:anchor-center] mb-1",
  "top-right": "[position-area:top_span-left] [justify-self:end] mb-1",
  "bottom-left": "[position-area:bottom_span-right] [justify-self:start] mt-1",
  bottom: "[position-area:bottom] [justify-self:anchor-center] mt-1",
  "bottom-right": "[position-area:bottom_span-left] [justify-self:end] mt-1",
  left: "[position-area:left] [align-self:anchor-center] mr-1",
  right: "[position-area:right] [align-self:anchor-center] ml-1",
} as const;

export const Tooltip: ParentComponent<{
  anchor: string;
  position?: keyof typeof tooltipPositions;
  class?: ClassValue;
}> = (props) => {
  return (
    <div
      role="tooltip"
      style={{ "--anchor": props.anchor }}
      class={cn(
        "pointer-events-none fixed inset-auto z-20 w-max max-w-[calc(100vw-1rem)] overflow-hidden rounded border border-foreground/10 bg-panel px-1.5 py-0.75 text-2xs text-foreground opacity-0 [position-anchor:var(--anchor)] [position-try-fallbacks:flip-block,flip-inline] peer-hover:opacity-100 peer-focus-visible:opacity-100 peer-has-focus-visible:opacity-100",
        tooltipPositions[props.position ?? "bottom"],
        props.class,
      )}
    >
      {props.children}
    </div>
  );
};

export const Kbd: ParentComponent<JSX.HTMLAttributes<HTMLElement> & { class?: ClassValue }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ["children", "class"]);
  return (
    <kbd
      {...rest}
      class={cn("font-inherit inline-flex items-center gap-0.5 text-foreground/50", local.class)}
    >
      {local.children}
    </kbd>
  );
};

export const SubmitButton: ParentComponent<
  JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    submitted?: boolean;
    variant?: "blue" | "white";
  }
> = (props) => {
  const [local, buttonProps] = splitProps(props, [
    "loading",
    "submitted",
    "variant",
    "children",
    "class",
  ]);

  return (
    <button
      {...buttonProps}
      data-loading={local.loading ? "" : undefined}
      data-submitted={local.submitted ? "" : undefined}
      class={cn(
        // Layout
        "group relative flex size-8 items-center justify-center overflow-clip rounded-sm",
        // Button scale transition + press effect
        "[transition:scale_160ms_var(--ease-out-quint)]",
        "active:scale-[0.935] data-loading:active:scale-100",

        // Ring layer (::before) — oversized conic gradient, rotates during loading
        "before:absolute before:-inset-1/2 before:content-['']",
        "before:bg-[conic-gradient(transparent_0%_85%,var(--color-foreground)_95%_100%)]",
        "before:opacity-0 before:[transition:opacity_0ms]",
        "data-loading:before:opacity-100",
        "data-loading:before:[transition:opacity_150ms_ease-out]",
        "data-loading:before:animate-[rotate_2s_linear_infinite]",

        // Fill layer (::after) — solid bg, scales down during loading to reveal ring
        "after:absolute after:inset-0 after:content-['']",
        "after:rounded-[inherit]",
        "after:[transition:scale_300ms_var(--ease-out-quint),background-color_300ms_var(--ease-out-quint)]",
        "data-loading:after:scale-[0.935]",

        // Variant colors
        local.variant === "blue"
          ? [
              "text-foreground",
              "after:bg-accent",
              "hover:after:bg-[color-mix(in_srgb,var(--color-accent)_90%,var(--color-panel))]",
              "data-loading:after:bg-[color-mix(in_srgb,var(--color-accent)_90%,var(--color-panel))]",
            ]
          : [
              "text-panel",
              "after:bg-foreground",
              "hover:after:bg-[color-mix(in_srgb,var(--color-foreground)_90%,var(--color-panel))]",
              "data-loading:after:bg-[color-mix(in_srgb,var(--color-foreground)_90%,var(--color-panel))]",
            ],
        local.class,
      )}
    >
      {local.children}
    </button>
  );
};
