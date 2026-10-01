import { RefreshCoordinator } from "./src/coordinator.js";

export { RefreshCoordinator };

export default {
    async fetch(request, env) {
        const { action, args } = await request.json();
        const coordinator = env.REFRESH_COORDINATOR.getByName("raidglass-refresh-global-v2");
        if (typeof coordinator[action] !== "function") {
            return Response.json({ error: "unknown_action" }, { status: 400 });
        }
        return Response.json((await coordinator[action](...args)) ?? null);
    },
};
