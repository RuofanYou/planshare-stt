import {
    estimateVelocity,
    rubberband,
} from "../../motion/physicalMotion";

export interface SheetSample {
    y: number;
    at: number;
}

export interface SheetRelease {
    offsetY: number;
    velocityY: number;
    height: number;
}

export const SHEET_DISMISS_DISTANCE_RATIO = 0.33;
export const SHEET_DISMISS_VELOCITY_PX_PER_SECOND = 900;

export function rubberbandSheetOffset(offsetY: number, height: number): number {
    if (!Number.isFinite(offsetY) || !Number.isFinite(height) || height <= 0) return 0;
    if (offsetY >= 0) return Math.min(offsetY, height);
    return rubberband(offsetY, 0, height, height, 0.2);
}

export function sheetReleaseVelocity(samples: readonly SheetSample[]): number {
    return estimateVelocity(samples.map((sample) => ({
        value: sample.y,
        at: sample.at,
    })));
}

export function shouldDismissSheet({ offsetY, velocityY, height }: SheetRelease): boolean {
    if (!Number.isFinite(height) || height <= 0) return false;
    return offsetY >= height * SHEET_DISMISS_DISTANCE_RATIO
        || velocityY >= SHEET_DISMISS_VELOCITY_PX_PER_SECOND;
}
