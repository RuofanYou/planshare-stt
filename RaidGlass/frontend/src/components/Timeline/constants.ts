/* Constants used only inside the Timeline Module */


export const LINE_HEIGHT = 52

export const DEFAULT_ZOOM = 4

export const TIMELINE_POINTER_INTENT_THRESHOLD = 8
export const TIMELINE_ZOOM_STEP = 1.1
export const TIMELINE_ZOOM_MIN = 0.5
export const TIMELINE_ZOOM_MAX = 16
export const TIMELINE_WHEEL_PAN_RATE = 0.5
export const TIMELINE_WHEEL_ZOOM_SENSITIVITY = 0.0015
export const TIMELINE_KEYBOARD_PAN_STEP = 140
export const TIMELINE_MAX_RELEASE_VELOCITY = 2400
export const TIMELINE_ZOOM_IDLE_MS = 120

// Events
export const EVENT_ZOOM_CHANGE = "zoom_change"
export const EVENT_SPELL_DISPLAY = "spell_display"
export const EVENT_DISPLAY_SETTINGS = "display_settings"

export const EVENT_CHECK_IMAGES_LOADED = "check_images_loaded"
export const EVENT_IMAGES_LOADED = "images_loaded"

// This event is also used inside the spells-reducer and must therefore match the name there!
export const EVENT_SPELL_SELECTED = "spells/spell_selected"

// event to show/hide the tooltip.
// WARNING: must match the name of the stores ui/set_tooltip action
// payload should include
// - content (string)
// - position (vector)
export const EVENT_SHOW_TOOLTIP = "ui/set_tooltip"

// Event when hovering over a phase marker
export const EVENT_PHASE_HOVER = "phase/hover"

export const EVENT_ANCHOR_CHANGED = "stage/anchor_changed"
