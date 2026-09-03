import {
    useLayoutEffect,
    useRef,
    type KeyboardEvent as ReactKeyboardEvent,
    type RefObject,
} from "react";

const FOCUSABLE_SELECTOR = "a[href], button, input, select, textarea, [tabindex]";

export interface ModalDialogLifecycleOptions {
    open: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
    returnFocusRef?: RefObject<HTMLElement | null>;
}

function isFocusable(element: HTMLElement): boolean {
    const elementStyle = getComputedStyle(element);
    if (elementStyle.visibility === "hidden" || elementStyle.visibility === "collapse") {
        return false;
    }

    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const style = current === element ? elementStyle : getComputedStyle(current);
        if (style.display === "none" || style.contentVisibility === "hidden") return false;
    }

    return element.tabIndex >= 0
        && !element.matches(":disabled")
        && !(element instanceof HTMLInputElement && element.type === "hidden")
        && element.closest("[hidden], [inert]") === null;
}

function focusableElements(dialog: HTMLDialogElement): HTMLElement[] {
    return Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter(isFocusable);
}

export function trapDialogTab(event: ReactKeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== "Tab") return;

    const elements = focusableElements(event.currentTarget);
    const first = elements[0];
    const last = elements.at(-1);
    if (!first || !last) return;

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
    }

    if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

/**
 * 管理单个受控原生模态对话框。消费层须保证同一时刻只打开一个使用此生命周期的 dialog。
 */
export function useModalDialogLifecycle({
    open,
    initialFocusRef,
    returnFocusRef,
}: ModalDialogLifecycleOptions): RefObject<HTMLDialogElement | null> {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const lifecycleGenerationRef = useRef(0);
    const returnTargetRef = useRef<HTMLElement | null>(null);
    const hasReturnTargetRef = useRef(false);

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        if (!open || !dialog) return;
        const lifecycleGeneration = ++lifecycleGenerationRef.current;

        if (!hasReturnTargetRef.current) {
            returnTargetRef.current = returnFocusRef?.current
                ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
            hasReturnTargetRef.current = true;
        }
        const htmlOverflow = document.documentElement.style.overflow;
        const bodyOverflow = document.body.style.overflow;

        if (!dialog.open) dialog.showModal();
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";

        const requestedInitialTarget = initialFocusRef?.current;
        const initialTarget = requestedInitialTarget?.isConnected
            && dialog.contains(requestedInitialTarget)
            && isFocusable(requestedInitialTarget)
            ? requestedInitialTarget
            : focusableElements(dialog)[0];
        initialTarget?.focus();

        return () => {
            if (dialog.open) dialog.close();
            document.documentElement.style.overflow = htmlOverflow;
            document.body.style.overflow = bodyOverflow;
            queueMicrotask(() => {
                if (
                    lifecycleGenerationRef.current === lifecycleGeneration
                ) {
                    const returnTarget = returnTargetRef.current;
                    returnTargetRef.current = null;
                    hasReturnTargetRef.current = false;
                    if (returnTarget?.isConnected) returnTarget.focus();
                }
            });
        };
    }, [initialFocusRef, open, returnFocusRef]);

    return dialogRef;
}
