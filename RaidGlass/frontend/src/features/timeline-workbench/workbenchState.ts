import type { FightsRequestError, FightsState } from "../../store/fights";

export type WorkbenchContentState =
    | "initial-loading"
    | "cross-target-loading"
    | "ready"
    | "same-target-refreshing"
    | "same-target-error"
    | "target-error"
    | "target-empty"
    | "filter-empty";

export interface WorkbenchPresentation {
    contentState: WorkbenchContentState;
    displayTargetKey: string | null;
    showAcceptedTimeline: boolean;
    copyAllowed: boolean;
    copyBlockReason: "target-mismatch" | "target-empty" | "filters-hidden" | null;
}

export interface WorkbenchStateInput {
    selectedTargetKey: string;
    requestTarget: string | null;
    acceptedTarget: string | null;
    status: FightsState["status"];
    error: FightsRequestError | null;
    acceptedFightCount: number;
    visibleFightCount: number;
}

export function deriveWorkbenchPresentation(input: WorkbenchStateInput): WorkbenchPresentation {
    const hasAcceptedTarget = input.acceptedTarget !== null;
    const targetMatches = input.selectedTargetKey === input.acceptedTarget;
    const selectedTargetFailed = input.status === "error"
        && input.error?.targetKey === input.selectedTargetKey;

    let contentState: WorkbenchContentState;
    if (!hasAcceptedTarget) {
        contentState = selectedTargetFailed ? "target-error" : "initial-loading";
    } else if (!targetMatches) {
        contentState = selectedTargetFailed ? "target-error" : "cross-target-loading";
    } else if (
        input.status === "updating"
        && input.requestTarget === input.selectedTargetKey
    ) {
        contentState = "same-target-refreshing";
    } else if (selectedTargetFailed) {
        contentState = "same-target-error";
    } else if (input.acceptedFightCount === 0) {
        contentState = "target-empty";
    } else if (input.visibleFightCount === 0) {
        contentState = "filter-empty";
    } else {
        contentState = "ready";
    }

    const copyAllowed = targetMatches
        && input.acceptedFightCount > 0
        && input.visibleFightCount > 0;
    const copyBlockReason = !targetMatches
        ? "target-mismatch"
        : input.acceptedFightCount === 0
            ? "target-empty"
            : input.visibleFightCount === 0
                ? "filters-hidden"
                : null;

    return {
        contentState,
        displayTargetKey: input.acceptedTarget,
        showAcceptedTimeline: hasAcceptedTarget
            && input.acceptedFightCount > 0
            && input.visibleFightCount > 0,
        copyAllowed,
        copyBlockReason,
    };
}
