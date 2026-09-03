export interface MotionSample {
    value: number;
    at: number;
}

export interface DampedSpringState {
    value: number;
    velocity: number;
}

export interface DampedSpringConfig {
    stiffness: number;
    damping: number;
    mass: number;
}

export const DEFAULT_DAMPED_SPRING: Readonly<DampedSpringConfig> = {
    stiffness: 1024,
    damping: 64,
    mass: 1,
};

const SPRING_MAX_STEP_SECONDS = 1 / 120;
const SPRING_REST_DISTANCE = 0.001;
const SPRING_REST_VELOCITY = 0.001;
const SPRING_VISUAL_REST_DISTANCE = 0.01;
const SPRING_VISUAL_REST_VELOCITY = 0.3;
const DEFAULT_RUBBERBAND_CONSTANT = 0.55;
const DEFAULT_VELOCITY_WINDOW_MS = 80;
const DEFAULT_PROJECTION_DECELERATION_RATE = 0.998;
const DEFAULT_WHEEL_LINE_SIZE_PX = 16;

export function advanceDampedSpring(
    state: DampedSpringState,
    target: number,
    elapsedMs: number,
    config: Readonly<DampedSpringConfig> = DEFAULT_DAMPED_SPRING,
): DampedSpringState {
    if (elapsedMs <= 0 || !Number.isFinite(elapsedMs)) return { ...state };

    let value = state.value;
    let velocity = state.velocity;
    let remaining = elapsedMs / 1000;
    while (remaining > 0) {
        const step = Math.min(remaining, SPRING_MAX_STEP_SECONDS);
        const acceleration = (
            -config.stiffness * (value - target) - config.damping * velocity
        ) / config.mass;
        velocity += acceleration * step;
        value += velocity * step;
        remaining -= step;
    }
    return { value, velocity };
}

export function isDampedSpringSettled(state: DampedSpringState, target: number): boolean {
    return Math.abs(state.value - target) <= SPRING_REST_DISTANCE
        && Math.abs(state.velocity) <= SPRING_REST_VELOCITY;
}

export function isDampedSpringVisuallySettled(
    state: DampedSpringState,
    target: number,
): boolean {
    return Math.abs(state.value - target) <= SPRING_VISUAL_REST_DISTANCE
        && Math.abs(state.velocity) <= SPRING_VISUAL_REST_VELOCITY;
}

export function rubberband(
    value: number,
    minimum: number,
    maximum: number,
    dimension: number,
    constant = DEFAULT_RUBBERBAND_CONSTANT,
): number {
    if (value < minimum) {
        const overshoot = minimum - value;
        return minimum - rubberbandDistance(overshoot, dimension, constant);
    }
    if (value > maximum) {
        const overshoot = value - maximum;
        return maximum + rubberbandDistance(overshoot, dimension, constant);
    }
    return value;
}

export function estimateVelocity(
    samples: readonly MotionSample[],
    windowMs = DEFAULT_VELOCITY_WINDOW_MS,
): number {
    const validSamples = samples.filter((sample) => (
        Number.isFinite(sample.value) && Number.isFinite(sample.at)
    ));
    const last = validSamples.at(-1);
    if (!last) return 0;

    const cutoff = last.at - windowMs;
    const first = validSamples.find((sample) => (
        sample.at >= cutoff && sample.at < last.at
    ));
    if (!first) return 0;

    const elapsed = last.at - first.at;
    if (elapsed <= 0) return 0;
    return ((last.value - first.value) / elapsed) * 1000;
}

export function projectClampedTarget(
    position: number,
    velocity: number,
    minimum: number,
    maximum: number,
    decelerationRate = DEFAULT_PROJECTION_DECELERATION_RATE,
): number {
    const projectedDistance = (velocity / 1000)
        * decelerationRate
        / (1 - decelerationRate);
    return Math.min(Math.max(position + projectedDistance, minimum), maximum);
}

export function normalizeWheelDelta(
    delta: number,
    deltaMode: number,
    pageSize: number,
    lineSize = DEFAULT_WHEEL_LINE_SIZE_PX,
): number {
    if (deltaMode === 1) return delta * lineSize;
    if (deltaMode === 2) return delta * pageSize;
    return delta;
}

function rubberbandDistance(overshoot: number, dimension: number, constant: number): number {
    return (overshoot * dimension * constant)
        / (dimension + constant * overshoot);
}
