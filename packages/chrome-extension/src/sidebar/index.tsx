import { For, Show, batch, createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import "~/styles.css";
import {
  CopyIcon,
  PlusIcon,
  PaperPlaneTiltIcon,
  CheckIcon,
  TrashIcon,
  CommandIcon,
  ArrowFatUpIcon,
  CrosshairSimpleIcon,
  WarningCircleIcon,
} from "~/sidebar/icons";
import { cn, copyToClipboard } from "~/sidebar/utils";
import { captureCroppedScreenshot } from "~/sidebar/screenshot";
import { createSelectionContext } from "~/sidebar/selection-context";
import { Kbd, SubmitButton, Tooltip } from "~/sidebar/components";
import { createSelection } from "~/sidebar/selection";
import { formatHref, truncateSelector } from "~/sidebar/utils";
import { createAnnotation } from "~/sidebar/annotations";
import type { Annotation as AnnotationType } from "~/sidebar/annotations";
import { loadState, onStorageChange, saveState } from "~/sidebar/storage";
import { toBatchMd, toMd } from "~/sidebar/output";
import { Annotation } from "~/sidebar/annotation";

const Sidebar = () => {
  const refs = {
    webhookUrlInput: undefined as unknown as HTMLInputElement,
    annotationList: undefined as unknown as HTMLOListElement,
    form: undefined as unknown as HTMLFormElement,
    commentInput: undefined as unknown as HTMLTextAreaElement,
    addButton: undefined as unknown as HTMLButtonElement,
    submitButton: undefined as unknown as HTMLButtonElement,
  };

  const [webhookEnabled, setWebhookEnabled] = createSignal(false);
  const [isEditingWebhook, setIsEditingWebhook] = createSignal(false);
  const [webhookUrl, setWebhookUrl] = createSignal("");

  const [annotations, setAnnotations] = createSignal<AnnotationType[]>([]);

  // Auto-persist when storable state changes
  createEffect(
    on(
      () => [webhookEnabled(), webhookUrl(), annotations()] as const,
      async ([webhookEnabled, webhookUrl, annotations]) => {
        const currentOrigin = origin();
        if (!currentOrigin) return;
        isPersisting = true;
        await saveState(currentOrigin, {
          webhookEnabled,
          webhookUrl,
          annotations,
        });
        isPersisting = false;
      },
      { defer: true },
    ),
  );

  const [batchedAnnotationIds, setBatchedAnnotationIds] = createSignal<string[] | null>(null);
  const isBatching = () => batchedAnnotationIds() !== null;
  const batchAnnotationIds = () => batchedAnnotationIds() ?? [];
  const batchAnnotations = () => {
    const annotationIds = new Set(batchAnnotationIds());
    return annotations().filter(({ id }) => annotationIds.has(id));
  };
  const startBatching = (annotationIds: string[]) => setBatchedAnnotationIds(annotationIds);
  const stopBatching = () => {
    clearErrors();
    setBatchedAnnotationIds(null);
  };

  let hasCopiedAllTimeout: ReturnType<typeof setTimeout> | undefined;
  const [hasCopiedAll, setHasCopiedAll] = createSignal(false);

  let hasSubmittedTimeout: ReturnType<typeof setTimeout> | undefined;
  const [hasSubmitted, setHasSubmitted] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const loading = () => isSubmitting() || hasSubmitted();

  const [formError, setFormError] = createSignal<string | null>(null);
  const [webhookError, setWebhookError] = createSignal<string | null>(null);
  const [webhookFailed, setWebhookFailed] = createSignal(false);
  createEffect(on(webhookUrl, () => setWebhookFailed(false), { defer: true }));

  const clearErrors = () => {
    setFormError(null);
    setWebhookError(null);
  };

  const flashFormError = (message: string) => {
    setFormError(message);
  };

  const flashWebhookError = (message: string) => {
    setWebhookError(message);
    setWebhookFailed(true);
  };

  const comment = () => refs.commentInput.value.trim() || undefined;

  const { selection, origin } = createSelection();
  createEffect(on(selection, clearErrors, { defer: true }));

  // Load persisted state whenever the origin changes.
  createEffect(
    on(origin, async (origin) => {
      if (!origin) return;
      const state = await loadState(origin);
      batch(() => {
        setWebhookEnabled(state.webhookEnabled);
        setWebhookUrl(state.webhookUrl);
        setAnnotations(state.annotations);
      });
    }),
  );
  const {
    selectionContext,
    isLoading: isLoadingSelectionContext,
    load: loadSelectionContext,
  } = createSelectionContext();

  const handleClearAll = () => {
    setAnnotations([]);
    stopBatching();
  };

  const requireSelectionAndContext = async () => {
    const currentSelection = selection();
    if (!currentSelection) {
      flashFormError("Select an element");
      return null;
    }
    const context = await loadSelectionContext();
    if (!context) return null;
    return { selection: currentSelection, context };
  };

  const sendToWebhook = async (body: string): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(webhookUrl(), {
          method: "POST",
          headers: { "Content-Type": "text/markdown" },
          body,
          signal: controller.signal,
        });
        if (!response.ok) {
          flashWebhookError("Could not reach webhook");
          return false;
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      flashWebhookError("Could not reach webhook");
      return false;
    } finally {
      setIsSubmitting(false);
      refs.commentInput.focus();
    }
    setWebhookError(null);
    setWebhookFailed(false);
    return true;
  };

  const flashSubmittedAndCleanBatch = (annotationIds: string[]) => {
    clearTimeout(hasSubmittedTimeout);
    setHasSubmitted(true);
    hasSubmittedTimeout = setTimeout(() => {
      batch(() => {
        setHasSubmitted(false);
        setAnnotations((annotations) => {
          const ids = new Set(annotationIds);
          return annotations.filter(({ id }) => !ids.has(id));
        });
        stopBatching();
      });
      refs.form.reset();
    }, 2000);
  };

  const handleCopy = async () => {
    const required = await requireSelectionAndContext();
    if (!required) return;

    const success = await copyToClipboard(
      toMd(
        createAnnotation({
          comment: comment() || undefined,
          selection: required.selection,
          context: required.context,
        }),
        { includeScreenshot: false },
      ),
    );

    clearTimeout(hasCopiedAllTimeout);
    setHasCopiedAll(success);

    if (success) {
      hasCopiedAllTimeout = setTimeout(() => setHasCopiedAll(false), 2000);
    }
  };

  const handleCopyAll = async () => {
    const success = await copyToClipboard(
      toBatchMd(annotations(), { comment: comment(), includeScreenshot: false }),
    );

    clearTimeout(hasCopiedAllTimeout);
    setHasCopiedAll(success);

    if (success) {
      hasCopiedAllTimeout = setTimeout(() => setHasCopiedAll(false), 2000);
    }
  };

  const submitLabel = () => (webhookEnabled() ? "Send" : "Copy");

  const submitIntent = () =>
    webhookEnabled() ? (isBatching() ? "sendBatch" : "send") : isBatching() ? "copyBatch" : "copy";

  const handleSubmit = async (e: SubmitEvent & { currentTarget: HTMLFormElement }) => {
    e.preventDefault();

    if (isSubmitting()) {
      return;
    }

    clearTimeout(hasSubmittedTimeout);
    setHasSubmitted(false);

    const currentComment = comment();
    const intent = ((e.submitter as HTMLButtonElement | null)?.value ?? "add") as
      | "add"
      | "copy"
      | "copyBatch"
      | "send"
      | "sendBatch";

    switch (intent) {
      case "send": {
        if (annotations().length) {
          startBatching(annotations().map(({ id }) => id));
          return;
        }

        const required = await requireSelectionAndContext();
        if (!required) return;

        const sendScreenshot = await captureCroppedScreenshot(
          required.context.boundingBox,
          required.context.page.devicePixelRatio,
        );

        const sendBody = toMd(
          createAnnotation({
            comment: currentComment,
            screenshot: sendScreenshot || undefined,
            selection: required.selection,
            context: required.context,
          }),
        );

        if (!(await sendToWebhook(sendBody))) return;

        setHasSubmitted(true);
        hasSubmittedTimeout = setTimeout(() => setHasSubmitted(false), 2000);
        refs.form.reset();
        break;
      }
      case "copy": {
        if (annotations().length) {
          startBatching(annotations().map(({ id }) => id));
          return;
        }

        const required = await requireSelectionAndContext();
        if (!required) return;

        await copyToClipboard(
          toMd(
            createAnnotation({
              comment: currentComment,
              selection: required.selection,
              context: required.context,
            }),
            { includeScreenshot: false },
          ),
        );

        setHasSubmitted(true);
        hasSubmittedTimeout = setTimeout(() => setHasSubmitted(false), 2000);
        refs.form.reset();
        break;
      }
      case "sendBatch": {
        const annotationIds = [...batchAnnotationIds()];
        if (!annotationIds.length) return;

        const sendBatchBody = toBatchMd(batchAnnotations(), {
          comment: currentComment,
        });

        if (!(await sendToWebhook(sendBatchBody))) return;

        flashSubmittedAndCleanBatch(annotationIds);
        break;
      }
      case "copyBatch": {
        const annotationIds = [...batchAnnotationIds()];
        if (!annotationIds.length) return;

        await copyToClipboard(
          toBatchMd(batchAnnotations(), {
            comment: currentComment,
            includeScreenshot: false,
          }),
        );

        flashSubmittedAndCleanBatch(annotationIds);
        break;
      }
      case "add":
      default: {
        const required = await requireSelectionAndContext();
        if (!required) return;

        const annotation = createAnnotation({
          comment: currentComment,
          selection: required.selection,
          context: required.context,
        });

        setAnnotations((v) => [...v, annotation]);

        if (webhookEnabled()) {
          captureCroppedScreenshot(
            required.context.boundingBox,
            required.context.page.devicePixelRatio,
          ).then((screenshot) => {
            if (!screenshot) return;
            setAnnotations((v) =>
              v.some(({ id }) => id === annotation.id)
                ? v.map((a) => (a.id === annotation.id ? { ...a, screenshot } : a))
                : v,
            );
          });
        }

        refs.form.reset();
        refs.annotationList.scrollTo({
          behavior: "smooth",
          top: refs.annotationList.scrollHeight,
        });
        break;
      }
    }
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (loading()) return;

    const modifier = e.metaKey || e.ctrlKey;

    if (e.key === "Escape") {
      if (isBatching()) {
        e.preventDefault();
        stopBatching();
        return;
      }

      refs.form.reset();
      return;
    }

    if (modifier && e.shiftKey && e.key === "Enter") {
      refs.form.requestSubmit(refs.submitButton);
      return;
    }

    if (modifier && e.key === "Enter") {
      refs.form.requestSubmit(refs.addButton);
      return;
    }

    if (modifier && e.shiftKey && e.key === "x") {
      handleCopyAll();
      return;
    }

    if (modifier && e.key === "x") {
      e.preventDefault();
      handleCopy();
      return;
    }

    if (modifier && e.shiftKey && e.key === "k") {
      e.preventDefault();
      handleClearAll();
      return;
    }

    if (modifier && e.key === "k" && comment()) {
      e.preventDefault();
      refs.form.reset();
    }
  };

  let isDisposed = false;
  let isPersisting = false;
  let removeStorageListener = () => {};

  onMount(() => {
    window.addEventListener("keydown", handleKeydown);

    // Sync state written by OTHER DevTools panels on the same origin.
    // The createEffect above handles writes from THIS panel; this listener
    // catches writes from any other tab/window sharing the same storage key.
    // Guarded by isPersisting to avoid reacting to our own writes.
    removeStorageListener = onStorageChange(origin, (state) => {
      if (isDisposed || isPersisting) {
        return;
      }

      batch(() => {
        setWebhookEnabled(state.webhookEnabled);
        setWebhookUrl(state.webhookUrl);
        setAnnotations(state.annotations);
      });
    });
  });

  onCleanup(() => {
    isDisposed = true;
    removeStorageListener();
    window.removeEventListener("keydown", handleKeydown);
    clearTimeout(hasSubmittedTimeout);
    clearTimeout(hasCopiedAllTimeout);
  });

  return (
    <main
      onPointerDown={clearErrors}
      onKeyDown={clearErrors}
      class={cn(
        "absolute inset-0 flex flex-col overflow-auto bg-white font-mono text-zinc-950 antialiased dark:bg-panel dark:text-foreground",
        loading() && "cursor-wait",
      )}
    >
      {/* Toolbar */}
      <div
        inert={loading() || undefined}
        class="flex h-8 border-b border-b-foreground/7 pl-1 text-2xs"
      >
        <div class="flex items-center gap-1">
          <div class="relative flex h-8 items-center justify-center">
            <button
              class="toggle peer group flex size-4 items-center justify-center p-1"
              aria-label="Toggle webhook"
              type="button"
              onClick={() => {
                setWebhookFailed(false);
                setIsEditingWebhook(false);
                setWebhookEnabled((v) => !v);
              }}
            >
              <span
                class={cn(
                  "block size-1.5 rounded-full transition-[background-color] duration-150",
                  webhookFailed()
                    ? "bg-danger group-hover:bg-danger/80"
                    : webhookEnabled()
                      ? "bg-success group-hover:bg-success/80"
                      : "bg-foreground/50 group-hover:bg-foreground/80",
                )}
              ></span>
            </button>
            <div
              aria-hidden="true"
              class="pointer-events-none absolute top-0 left-0 h-8 w-8 [anchor-name:--webhook-toggle]"
            ></div>
            <Tooltip anchor="--webhook-toggle" position="bottom-left">
              Toggle webhook
            </Tooltip>
          </div>
          <Show when={webhookEnabled()}>
            <Show
              when={isEditingWebhook()}
              fallback={
                <div>
                  <button
                    type="button"
                    aria-label="Change Webhook URL"
                    class="peer flex max-w-48 items-center truncate text-foreground/80 [anchor-name:--webhook-url] hover:text-foreground"
                    onClick={() => {
                      setIsEditingWebhook(true);
                      // SolidJS batches DOM updates — the input isn't mounted yet
                      // when setIsEditingWebhook(true) runs. Microtask defers
                      // until after SolidJS flushes its render queue.
                      queueMicrotask(() => refs.webhookUrlInput.select());
                    }}
                  >
                    {webhookUrl()}
                  </button>
                  <Tooltip class="ml-1.5" anchor="--webhook-url" position="right">
                    Change URL
                  </Tooltip>
                </div>
              }
            >
              <form
                class="flex items-center gap-1.5 pl-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  setWebhookUrl(refs.webhookUrlInput.value);
                  setIsEditingWebhook(false);
                }}
                // Close when focus leaves the form, but not when moving between form elements (e.g. tabbing to submit)
                onFocusOut={(e) => {
                  if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))
                    return;
                  e.currentTarget.reset();
                  setIsEditingWebhook(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setIsEditingWebhook(false);
                  }
                }}
              >
                <input
                  ref={(r) => (refs.webhookUrlInput = r)}
                  class="field-sizing-content"
                  value={webhookUrl()}
                  type="url"
                  name="url"
                />
                <button
                  type="submit"
                  class="text-foreground/80 hover:text-foreground"
                  aria-label="Save"
                >
                  <CheckIcon class="size-3.25" />
                </button>
              </form>
            </Show>
          </Show>
        </div>
        <div class="ml-auto flex">
          <Show when={webhookEnabled()}>
            <div class="h-8 [anchor-name:--toolbar-copy-button]">
              <button
                type="button"
                aria-label="Copy annotations"
                onClick={() => handleCopyAll()}
                data-copied={hasCopiedAll() ? "" : undefined}
                class="group peer flex size-8 items-center justify-center text-foreground/80 transition-[scale] duration-150 hover:text-foreground active:scale-[0.95]"
              >
                <CopyIcon
                  class={cn(
                    "size-3.25 transition-[opacity,blur] duration-100",
                    "group-data-copied:scale-80 group-data-copied:opacity-0 group-data-copied:blur-[0.25px]",
                    "not-group-data-copied:opacity-100 not-group-data-copied:blur-none",
                  )}
                />
                <CheckIcon
                  class={cn(
                    "absolute size-3.25 transition-[opacity,blur] duration-100",
                    "group-data-copied:opacity-100 group-data-copied:blur-none",
                    "not-group-data-copied:scale-80 not-group-data-copied:opacity-0 not-group-data-copied:blur-[0.25px]",
                  )}
                />
              </button>
              <Tooltip anchor="--toolbar-copy-button" position="bottom">
                <div class="flex flex-col gap-0.5">
                  <span class="inline-flex items-center gap-1">
                    Copy all
                    <Kbd aria-label="Command Shift X">
                      <CommandIcon class="size-2.5" /> <ArrowFatUpIcon class="size-2.5" />
                      <span aria-hidden="true">X</span>
                    </Kbd>
                  </span>
                  <span class="inline-flex items-center gap-1 text-foreground/50">
                    Or current
                    <Kbd aria-label="Command X">
                      <CommandIcon class="size-2.5" />
                      <span aria-hidden="true">X</span>
                    </Kbd>
                  </span>
                </div>
              </Tooltip>
            </div>
          </Show>
          <div class="h-8 [anchor-name:--toolbar-clear-button]">
            <button
              type="button"
              aria-label="Clear annotations"
              onClick={handleClearAll}
              class="group peer flex size-8 items-center justify-center text-foreground/80 transition-[scale] duration-150 hover:text-foreground active:scale-[0.95]"
            >
              <TrashIcon class={cn("size-3.25")} />
            </button>
            <Tooltip anchor="--toolbar-clear-button" position="bottom-right" class="mr-1">
              <div class="flex flex-col gap-0.5">
                <span class="inline-flex items-center gap-1">
                  Clear all
                  <Kbd aria-label="Command Shift K">
                    <CommandIcon class="size-2.5" /> <ArrowFatUpIcon class="size-2.5" />
                    <span aria-hidden="true">K</span>
                  </Kbd>
                </span>
                <span class="inline-flex items-center gap-1 text-foreground/50">
                  Or current
                  <Kbd aria-label="Command K">
                    <CommandIcon class="size-2.5" />
                    <span aria-hidden="true">K</span>
                  </Kbd>
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Annotation list */}
      <div inert={loading() || undefined} class="relative flex min-h-36 grow flex-col">
        <Show when={annotations().length}>
          <ol
            ref={(e) => (refs.annotationList = e)}
            class="flex min-h-0 grow flex-col gap-2 overflow-y-auto scroll-fade p-2"
          >
            <For each={annotations()}>
              {(annotation) => (
                <Annotation
                  annotation={annotation}
                  isBatching={isBatching()}
                  isInBatch={isBatching() && batchAnnotationIds().includes(annotation.id)}
                  onRemove={() => setAnnotations((a) => a.filter(({ id }) => id !== annotation.id))}
                  onExclude={() =>
                    setBatchedAnnotationIds((a) => a && a.filter((id) => id !== annotation.id))
                  }
                  onInclude={() =>
                    setBatchedAnnotationIds((a) =>
                      a && !a.includes(annotation.id) ? [...a, annotation.id] : a,
                    )
                  }
                />
              )}
            </For>
          </ol>
        </Show>
      </div>

      {/* Form */}
      <div class="border-t border-t-foreground/7">
        <form class="p-2" onSubmit={handleSubmit} ref={(e) => (refs.form = e)}>
          <div class="relative">
            <textarea
              ref={(e) => (refs.commentInput = e)}
              name="comment"
              required={!isBatching()}
              readonly={loading() || undefined}
              class="flex field-sizing-content max-h-[4rlh] min-h-[2.5rlh] w-full resize-none rounded-sm border border-foreground/5 bg-foreground/2.5 p-2 text-xs hover:bg-foreground/4"
              placeholder={isBatching() ? "Care to elaborate? (optional)" : "What would you like?"}
            ></textarea>
          </div>
          <div class="mt-2 flex items-start gap-2">
            <div class="flex min-w-0 flex-col gap-1">
              <Show when={isBatching() && !hasSubmitted()}>
                <span class="block text-2xs text-foreground/80">
                  {batchAnnotationIds().length
                    ? `${webhookEnabled() ? "Sending" : "Copying"} ${batchAnnotationIds().length} annotation${batchAnnotationIds().length > 1 ? "s" : ""}`
                    : "No annotations selected"}
                </span>
              </Show>
              <Show when={!isBatching() && !hasSubmitted()}>
                <Show
                  when={selection()}
                  fallback={
                    <span class="block text-2xs text-foreground/80">{"Select an element"}</span>
                  }
                >
                  {(selection) => (
                    <div class="flex h-fit items-center gap-1">
                      <span
                        tabindex="0"
                        class="peer flex cursor-default items-center gap-1 text-2xs text-foreground/80 select-none [anchor-name:--selector]"
                        onMouseEnter={loadSelectionContext}
                        onFocus={loadSelectionContext}
                      >
                        <CrosshairSimpleIcon class="size-3 shrink-0" />
                        <span>{truncateSelector(selection().selector)}</span>
                      </span>
                      <Tooltip
                        class="hidden max-w-[min(24rem,calc(100vw-1rem))] whitespace-normal"
                        anchor="--selector"
                        position="bottom-left"
                      >
                        <Show when={!isLoadingSelectionContext() && selectionContext()}>
                          {(context) => (
                            <>
                              {formatHref(context().page.href)} ({context().page.viewport.width}
                              &times;
                              {context().page.viewport.height})
                            </>
                          )}
                        </Show>
                      </Tooltip>
                    </div>
                  )}
                </Show>
              </Show>
            </div>
            <div
              inert={loading() || undefined}
              class="ml-auto flex h-8 w-fit shrink-0 items-center gap-1 [anchor-name:--form-actions]"
            >
              <Show
                when={isBatching()}
                fallback={
                  <div>
                    <div class="peer size-8 [anchor-name:--add-button]">
                      <button
                        ref={(e) => (refs.addButton = e)}
                        type="submit"
                        name="intent"
                        value="add"
                        aria-label="Add"
                        class="flex size-8 items-center justify-center rounded-sm bg-foreground/5 text-foreground transition-[scale] duration-150 active:scale-[0.935]"
                      >
                        <PlusIcon class="size-3.5" />
                      </button>
                    </div>
                    <Tooltip anchor="--add-button" position="top">
                      <span class="inline-flex items-center gap-1">
                        Add
                        <Kbd aria-label="Command Enter">
                          <CommandIcon class="size-2.5" /> <span aria-hidden="true">Enter</span>
                        </Kbd>
                      </span>
                    </Tooltip>
                  </div>
                }
              >
                <div>
                  <div class="peer h-8 [anchor-name:--cancel-submit-button]">
                    <button
                      type="button"
                      onClick={stopBatching}
                      class="flex h-8 items-center justify-center rounded-sm px-2 text-2xs text-foreground/80 transition-[scale,color] duration-150 hover:text-foreground active:scale-[0.9625]"
                    >
                      Cancel
                    </button>
                  </div>
                  <Tooltip anchor="--cancel-submit-button" position="top">
                    <span class="inline-flex items-center gap-1">
                      Cancel
                      <Kbd aria-label="Escape">
                        <span aria-hidden="true">Esc</span>
                      </Kbd>
                    </span>
                  </Tooltip>
                </div>
              </Show>
              <div>
                <div class="peer size-8 [anchor-name:--submit-button]">
                  <SubmitButton
                    ref={(e) => (refs.submitButton = e)}
                    type="submit"
                    name="intent"
                    value={submitIntent()}
                    formNoValidate={isBatching() || !!annotations().length}
                    aria-label={submitLabel()}
                    aria-busy={isSubmitting() || undefined}
                    loading={isSubmitting()}
                    submitted={hasSubmitted()}
                    variant={isBatching() ? "blue" : "white"}
                  >
                    {webhookEnabled() ? (
                      <PaperPlaneTiltIcon
                        class={cn(
                          "z-10 size-3.5 transition-[opacity,blur,scale] duration-150",
                          "group-data-submitted:scale-80 group-data-submitted:opacity-0 group-data-submitted:blur-[0.25px]",
                          "not-group-data-submitted:opacity-100 not-group-data-submitted:blur-none",
                        )}
                      />
                    ) : (
                      <CopyIcon
                        class={cn(
                          "z-10 size-3.5 transition-[opacity,blur,scale] duration-150",
                          "group-data-submitted:scale-80 group-data-submitted:opacity-0 group-data-submitted:blur-[0.25px]",
                          "not-group-data-submitted:opacity-100 not-group-data-submitted:blur-none",
                        )}
                      />
                    )}
                    <CheckIcon
                      class={cn(
                        "absolute z-10 size-3.5 transition-[opacity,blur,scale] duration-150",
                        "group-data-submitted:opacity-100 group-data-submitted:blur-none",
                        "not-group-data-submitted:scale-80 not-group-data-submitted:opacity-0 not-group-data-submitted:blur-[0.25px]",
                      )}
                    />
                  </SubmitButton>
                </div>
                <Tooltip anchor="--submit-button" position="top" class="mr-1">
                  <span class="inline-flex items-center gap-1">
                    {submitLabel()}
                    <Kbd aria-label="Command Shift Enter">
                      <CommandIcon class="size-2.5" /> <ArrowFatUpIcon class="size-2.5" />
                      <span aria-hidden="true">Enter</span>
                    </Kbd>
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>
          <Show when={webhookError() || formError()}>
            <div class="mt-2 ml-auto flex w-fit items-center gap-1 text-2xs text-foreground">
              <WarningCircleIcon class="size-3 shrink-0 text-danger" />
              {webhookError() || formError()}
            </div>
          </Show>
        </form>
      </div>
    </main>
  );
};

render(() => <Sidebar />, document.getElementById("root")!);
