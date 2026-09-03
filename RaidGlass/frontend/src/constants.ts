

export const DEBUG = import.meta.env.VITE_DEBUG
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ""
export const APP_BASE_URL = "/log"
export const assetUrl = (path: string) => `${APP_BASE_URL}/${path.replace(/^\//, "")}`

export const LOGO_URL = assetUrl("logo.svg")
export const ASSETS = import.meta.env.VITE_ASSETS_URL || assetUrl("assets")


// Third Party
export const WCL_URL = "https://www.warcraftlogs.com"
export const DISCORD_LINK = ""
export const PATREON_LINK = ""
export const BUYMEACOFFEE_LINK = ""
export const DISCORD_CLIENT_ID = ""
export const DISCORD_LOGIN_URL = "https://discord.com/oauth2/authorize"



export const DIFFICULTIES = {
    HEROIC: "heroic",
    MYTHIC: "mythic",
}

export const DEFAULT_DIFFICULTY = DIFFICULTIES.MYTHIC
