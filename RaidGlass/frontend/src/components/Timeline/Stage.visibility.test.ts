import { describe, expect, it, vi } from "vitest";

import type { TimelineVisibility } from "../../filter_logic";
import { MODES } from "../../store/ui";
import type Actor from "../../types/actor";
import type Fight from "../../types/fight";
import { LINE_HEIGHT } from "./constants";

vi.mock("konva", () => {
    class KonvaNode {
        attrs: Record<string, unknown>;
        children: KonvaNode[] = [];
        parent?: KonvaNode;

        constructor(config: Record<string, unknown> = {}) {
            this.attrs = { visible: true, x: 0, y: 0, ...config };
        }

        private attr(name: string, value?: unknown) {
            if (value === undefined) return this.attrs[name];
            this.attrs[name] = value;
            return this;
        }

        add(child: KonvaNode) {
            child.parent = this;
            this.children.push(child);
            return this;
        }

        remove() {
            if (!this.parent) return this;
            this.parent.children = this.parent.children.filter((child) => child !== this);
            this.parent = undefined;
            return this;
        }

        destroy() {
            this.destroyChildren();
            return this.remove();
        }

        destroyChildren() {
            this.children.forEach((child) => { child.parent = undefined; });
            this.children = [];
            return this;
        }

        getParent() { return this.parent; }
        getStage(): KonvaStage | undefined {
            let node: KonvaNode | undefined = this;
            while (node && !(node instanceof KonvaStage)) node = node.parent;
            return node as KonvaStage | undefined;
        }
        getLayer(): KonvaLayer | undefined {
            let node: KonvaNode | undefined = this;
            while (node && !(node instanceof KonvaLayer)) node = node.parent;
            return node as KonvaLayer | undefined;
        }
        moveToTop() { return this; }
        hasChildren() { return this.children.length > 0; }
        find(selector: string): KonvaNode[] {
            const name = selector.replace(/^\./, "");
            return this.children.flatMap((child) => [
                ...(child.attrs.name === name ? [child] : []),
                ...child.find(selector),
            ]);
        }

        setAttr(name: string, value: unknown) { return this.attr(name, value); }
        getAttr(name: string) { return this.attr(name); }
        name(value?: string) { return this.attr("name", value); }
        x(value?: number) { return this.attr("x", value) as number | this; }
        y(value?: number) { return this.attr("y", value) as number | this; }
        width(value?: number) {
            if (value !== undefined) return this.attr("width", value);
            const configured = this.attr("width");
            if (typeof configured === "number") return configured;
            return String(this.attr("text") ?? "").length * 7;
        }
        height(value?: number) { return this.attr("height", value) as number | this; }
        visible(value?: boolean) { return this.attr("visible", value) as boolean | this; }
        isVisible(): boolean {
            return this.visible() !== false && (!this.parent || this.parent.isVisible());
        }
        scaleX(value?: number) { return this.attr("scaleX", value) as number | this; }
        opacity(value?: number) { return this.attr("opacity", value) as number | this; }
        strokeWidth(value?: number) { return this.attr("strokeWidth", value) as number | this; }
        text(value?: string) { return this.attr("text", value) as string | this; }
        fill(value?: string) { return this.attr("fill", value) as string | this; }
        fontStyle(value?: string) { return this.attr("fontStyle", value) as string | this; }
        points(value?: number[]) { return this.attr("points", value) as number[] | this; }
        image(value?: HTMLImageElement) { return this.attr("image", value); }
        clip(value?: unknown) { return this.attr("clip", value); }
        clipWidth(value?: number) { return this.attr("clipWidth", value); }
        listening(value?: boolean) { return this.attr("listening", value); }
        draggable(value?: boolean) { return this.attr("draggable", value); }
        transformsEnabled(value?: string) { return this.attr("transformsEnabled", value); }
        cache() { return this; }
        clearCache() { return this; }
        batchDraw() { return this; }
        on() { return this; }
        absolutePosition() { return { x: Number(this.x()), y: Number(this.y()) }; }
    }

    class KonvaStage extends KonvaNode {
        container() { return this.attrs.container as HTMLDivElement; }
        getPointerPosition() { return null; }
    }
    class KonvaLayer extends KonvaNode {}

    return {
        default: {
            autoDrawEnabled: true,
            Stage: KonvaStage,
            Group: KonvaNode,
            Layer: KonvaLayer,
            Line: KonvaNode,
            Rect: KonvaNode,
            Text: KonvaNode,
            Image: KonvaNode,
        },
    };
});

import Stage from "./Stage";

function actor(name: string): Actor {
    return {
        name,
        spec_slug: "mage-fire",
        class_slug: "mage",
        total: 100,
        casts: [],
        deaths: [],
        resurrects: [],
    };
}

function fightFixture(
    fightId: number,
    boss: Actor,
    players: Actor[],
): Fight {
    return {
        fight_id: fightId,
        report_id: `REPORT-${fightId}`,
        report_url: `https://example.test/REPORT-${fightId}`,
        duration: 90_000,
        difficulty: 0,
        phases: [],
        boss,
        players,
    };
}

function stageHarness(fights: readonly Fight[]) {
    const container = document.createElement("div");
    Object.defineProperty(container, "offsetWidth", {
        configurable: true,
        value: 800,
    });
    const stage = new Stage({ container });
    stage.MODE = MODES.SPEC_RANKING;
    stage.set_fights(fights);
    return { stage, container };
}

describe("Stage visibility", () => {
    it("真实 set_fights 按 boss→players 与多场顺序布局 visibility", () => {
        const firstBoss = actor("首场首领");
        firstBoss.boss_slug = "vorasius";
        firstBoss.class_slug = "boss";
        const firstVisible = actor("首场可见玩家");
        const firstHidden = actor("首场隐藏玩家");
        const secondBoss = actor("次场首领");
        secondBoss.boss_slug = "vorasius";
        secondBoss.class_slug = "boss";
        const secondVisible = actor("次场可见玩家");
        const firstFight = fightFixture(1, firstBoss, [firstVisible, firstHidden]);
        const secondFight = fightFixture(2, secondBoss, [secondVisible]);
        const visibility: TimelineVisibility = {
            fights: [{
                fight: firstFight,
                actors: [
                    { actor: firstBoss, kind: "boss" },
                    { actor: firstVisible, kind: "player" },
                ],
            }, {
                fight: secondFight,
                actors: [{ actor: secondVisible, kind: "player" }],
            }],
            hiddenPlayerCount: 2,
        };
        const { stage, container } = stageHarness([firstFight, secondFight]);

        const visibleActors = stage.apply_visibility(visibility);
        const rows = (stage as unknown as {
            rows: Array<{
                _fight_data: Fight;
                foreground: { y(): number };
                rows: Array<{
                    foreground: { player_data: Actor; y(): number };
                    height(): number;
                }>;
            }>;
        }).rows;

        expect(visibleActors).toEqual([firstBoss, firstVisible, secondVisible]);
        expect(rows.map(({ _fight_data }) => _fight_data)).toEqual([firstFight, secondFight]);
        expect(rows[0].rows.map(({ foreground }) => foreground.player_data)).toEqual([
            firstBoss,
            firstVisible,
            firstHidden,
        ]);
        expect(rows[1].rows.map(({ foreground }) => foreground.player_data)).toEqual([
            secondBoss,
            secondVisible,
        ]);
        expect(rows[0].rows.map((row) => row.height())).toEqual([LINE_HEIGHT, LINE_HEIGHT, 0]);
        expect(rows[1].rows.map((row) => row.height())).toEqual([0, LINE_HEIGHT]);
        expect(rows[0].rows.map(({ foreground }) => foreground.y())).toEqual([
            0,
            LINE_HEIGHT,
            LINE_HEIGHT * 2,
        ]);
        expect(rows[1].rows.map(({ foreground }) => foreground.y())).toEqual([0, 0]);
        expect(rows.map(({ foreground }) => foreground.y())).toEqual([
            LINE_HEIGHT,
            LINE_HEIGHT * 3,
        ]);
        expect(stage.height()).toBe(LINE_HEIGHT * 4 + 1);
        expect(container.dataset).toMatchObject({
            timelineVisibleFightRows: "2",
            timelineVisibleActorRows: "3",
            timelineHiddenPlayerRows: "2",
        });
    });
});
