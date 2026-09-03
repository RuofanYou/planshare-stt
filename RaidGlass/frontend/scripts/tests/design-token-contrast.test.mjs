import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsPath = new URL("../../scss/_settings.scss", import.meta.url);
const generalPath = new URL("../../scss/_general.scss", import.meta.url);
const layoutPath = new URL("../../scss/_layout.scss", import.meta.url);
const shellPath = new URL("../../src/components/ProductShell/ProductShell.module.scss", import.meta.url);
const buttonGroupPath = new URL("../../src/components/SettingsBar/shared/ButtonGroup.module.scss", import.meta.url);
const displaySettingsPath = new URL("../../src/components/SettingsBar/DisplaySettings.module.scss", import.meta.url);
const regionFilterPath = new URL("../../src/components/SettingsBar/FilterSettings/RegionFilter.module.scss", import.meta.url);
const filterDateRangePath = new URL("../../src/components/SettingsBar/FilterSettings/FilterDateRange.module.scss", import.meta.url);
const filterKilltimePath = new URL("../../src/components/SettingsBar/FilterSettings/FilterKilltime.module.scss", import.meta.url);
const durationInputPath = new URL("../../src/components/shared/DurationInput.module.scss", import.meta.url);
const spellPresetPath = new URL("../../src/components/SettingsBar/SpellPresets/SpellPresetSettings.module.scss", import.meta.url);
const spellButtonPath = new URL("../../src/components/SettingsBar/SpellSettings/SpellButton.module.scss", import.meta.url);
const collapsableSpellGroupStylePath = new URL("../../src/components/SettingsBar/SpellSettings/CollapsableSpellGroup.module.scss", import.meta.url);
const collapsableSpellGroupComponentPath = new URL("../../src/components/SettingsBar/SpellSettings/CollapsableSpellGroup.tsx", import.meta.url);
const playerNamePath = new URL("../../src/components/PlayerNames/PlayerName.module.scss", import.meta.url);
const workbenchPath = new URL("../../src/features/timeline-workbench/TimelineWorkbench.module.scss", import.meta.url);
const targetPickerPath = new URL("../../src/features/timeline-workbench/TargetPicker.module.scss", import.meta.url);
const footerPath = new URL("../../src/components/Footer/Footer.module.scss", import.meta.url);

function tokenValue(source, name) {
    const match = source.match(new RegExp(`\\-\\-${name}\\s*:\\s*(#[a-fA-F0-9]{6}|[0-9]+px)\\s*;`));
    assert.ok(match, `missing design token --${name}`);
    return match[1];
}

function luminance(hex) {
    const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = channels.map((channel) => (
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left, right) {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

function selectorBody(source, selector) {
    const selectorStart = source.indexOf(selector);
    assert.notEqual(selectorStart, -1, `missing selector ${selector}`);
    const bodyStart = source.indexOf("{", selectorStart);
    assert.notEqual(bodyStart, -1, `missing body for selector ${selector}`);

    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        if (source[index] === "{") depth += 1;
        if (source[index] === "}") depth -= 1;
        if (depth === 0) return source.slice(bodyStart + 1, index);
    }
    assert.fail(`unclosed selector ${selector}`);
}

function assertTouchSize(source, selector, properties) {
    const body = selectorBody(source, selector);
    for (const property of properties) {
        assert.match(
            body,
            new RegExp(`${property}:\\s*var\\(--rg-control-min-touch\\)`),
            `${selector} must consume the touch target token for ${property}`,
        );
    }
}

function tokenDeclarations(source, token) {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return source.match(new RegExp(`${escapedToken}\\s*:\\s*[^;]+;`, "g")) ?? [];
}

test("关键 M32 文本状态达到 WCAG AA 对比度", async () => {
    const source = await readFile(settingsPath, "utf8");
    const parchment = tokenValue(source, "rg-parchment-soft");
    const canvas = tokenValue(source, "rg-canvas");
    const warningText = tokenValue(source, "rg-warning-text");
    const footerText = tokenValue(source, "rg-footer-text");
    const actionText = tokenValue(source, "rg-action-text");

    assert.ok(contrast(warningText, parchment) >= 4.5, "delayed status contrast must be >= 4.5");
    assert.ok(contrast(footerText, canvas) >= 4.5, "footer contrast must be >= 4.5");
    for (const stop of ["rg-action-start", "rg-action-mid", "rg-action-end"]) {
        assert.ok(contrast(actionText, tokenValue(source, stop)) >= 4.5, `${stop} contrast must be >= 4.5`);
    }
});

test("设计间距由统一 4px 尺度提供", async () => {
    const source = await readFile(settingsPath, "utf8");
    const expected = new Map([
        ["rg-space-1", "4px"],
        ["rg-space-2", "8px"],
        ["rg-space-3", "12px"],
        ["rg-space-4", "16px"],
        ["rg-space-6", "24px"],
        ["rg-space-8", "32px"],
    ]);
    for (const [name, value] of expected) {
        assert.equal(tokenValue(source, name), value);
    }
});

test("根布局允许长内容增高并将页脚排在主外框之后", async () => {
    const layout = await readFile(layoutPath, "utf8");
    const appRoot = selectorBody(layout, "#app_root");

    assert.match(appRoot, /min-height:\s*100%/);
    assert.doesNotMatch(appRoot, /display:\s*flex/);
    assert.doesNotMatch(appRoot, /height:\s*100%\s*!important/);
});

test("关键组件消费统一可访问颜色令牌", async () => {
    const [general, workbench, footer] = await Promise.all([
        readFile(generalPath, "utf8"),
        readFile(workbenchPath, "utf8"),
        readFile(footerPath, "utf8"),
    ]);

    assert.match(general, /color:\s*var\(--rg-action-text\)/);
    for (const stop of ["rg-action-start", "rg-action-mid", "rg-action-end"]) {
        assert.match(general, new RegExp(`var\\(--${stop}\\)`));
    }
    assert.match(workbench, /background:\s*var\(--success\)/);
    assert.match(workbench, /color:\s*var\(--danger\)/);
    assert.match(footer, /color:\s*var\(--rg-footer-text\)/);
    assert.doesNotMatch(footer, /opacity:\s*0\.2/);
});

test("pressed focus 与控件尺寸令牌拥有精确单一值", async () => {
    const settings = await readFile(settingsPath, "utf8");
    const expected = [
        ["--rg-control-min-desktop", "40px"],
        ["--rg-control-min-touch", "44px"],
        ["--rg-press-scale", "0.965"],
        ["--rg-press-release", "180ms cubic-bezier(0.2, 0.84, 0.32, 1)"],
        ["--rg-surface-transition", "320ms cubic-bezier(0.2, 0.84, 0.32, 1)"],
        ["--rg-spring-fast", "240ms cubic-bezier(0.2, 0.9, 0.28, 1)"],
        ["--rg-spring-surface", "380ms cubic-bezier(0.18, 0.92, 0.26, 1)"],
        ["--rg-focus-ring-width", "2px"],
        ["--rg-focus-ring-offset", "2px"],
        ["--rg-focus-ring-color", "#5b330c"],
    ];

    for (const [token, value] of expected) {
        assert.deepEqual(
            tokenDeclarations(settings, token),
            [`${token}: ${value};`],
            `${token} must have one exact declaration`,
        );
    }
});

test("general 是 pressed focus 与通用按钮尺寸的唯一权威", async () => {
    const general = await readFile(generalPath, "utf8");
    const enabledSelector = ':where(button, a[href], [role="button"]):not(:disabled, [aria-disabled="true"])';
    const disabledSelector = ':where(button, a[href], [role="button"]):is(:disabled, [aria-disabled="true"]):active';
    const enabledBody = selectorBody(general, enabledSelector);
    const activeBody = selectorBody(general, `${enabledSelector}:active`);
    const focusBody = selectorBody(
        general,
        ':where(a, button, select, input, textarea, [tabindex]:not([tabindex="-1"])):focus-visible',
    );
    const rgButtonBody = selectorBody(general, ".rg-button");

    assert.match(enabledBody, /transition:\s*transform var\(--rg-press-release\)/);
    assert.match(activeBody, /transform:\s*scale\(var\(--rg-press-scale\)\)/);
    assert.match(activeBody, /transition-duration:\s*0ms/);
    assert.equal(general.includes(disabledSelector), false, "disabled active must preserve its existing transform");
    assert.match(focusBody, /outline:\s*var\(--rg-focus-ring-width\) solid var\(--rg-focus-ring-color\)/);
    assert.match(focusBody, /outline-offset:\s*var\(--rg-focus-ring-offset\)/);
    assert.match(rgButtonBody, /min-height:\s*var\(--rg-control-min-desktop\)/);
    assert.doesNotMatch(general, /\.rg-button:active\s*\{/);
});

test("核心表面没有私有位移或悬停放大", async () => {
    const [shell, buttonGroup, collapsableStyle, collapsableComponent] = await Promise.all([
        readFile(shellPath, "utf8"),
        readFile(buttonGroupPath, "utf8"),
        readFile(collapsableSpellGroupStylePath, "utf8"),
        readFile(collapsableSpellGroupComponentPath, "utf8"),
    ]);
    const navLinkBody = selectorBody(shell, ".navLink");

    assert.doesNotMatch(navLinkBody, /transition:[^;]*transform/);
    assert.doesNotMatch(navLinkBody, /&:active\s*\{/);
    assert.doesNotMatch(buttonGroup, /transform:\s*(?:scale|translate)/);
    assert.doesNotMatch(buttonGroup, /text-decoration:\s*underline/);
    assert.doesNotMatch(collapsableStyle, /--hover-scale/);
    assert.doesNotMatch(collapsableComponent, /grow-when-touched/);
});

test("真实可达控件共享 focus 和命中区域令牌", async () => {
    const [
        buttonGroup,
        displaySettings,
        regionFilter,
        filterDateRange,
        filterKilltime,
        durationInput,
        spellPreset,
        spellButton,
        collapsableStyle,
        playerName,
        workbench,
        targetPicker,
        shell,
        layout,
    ] = await Promise.all([
        readFile(buttonGroupPath, "utf8"),
        readFile(displaySettingsPath, "utf8"),
        readFile(regionFilterPath, "utf8"),
        readFile(filterDateRangePath, "utf8"),
        readFile(filterKilltimePath, "utf8"),
        readFile(durationInputPath, "utf8"),
        readFile(spellPresetPath, "utf8"),
        readFile(spellButtonPath, "utf8"),
        readFile(collapsableSpellGroupStylePath, "utf8"),
        readFile(playerNamePath, "utf8"),
        readFile(workbenchPath, "utf8"),
        readFile(targetPickerPath, "utf8"),
        readFile(shellPath, "utf8"),
        readFile(layoutPath, "utf8"),
    ]);

    for (const source of [
        buttonGroup,
        displaySettings,
        regionFilter,
        spellPreset,
        spellButton,
        collapsableStyle,
        playerName,
    ]) {
        assert.doesNotMatch(source, /outline:\s*3px\s+solid/, "reachable control retains a private 3px focus ring");
    }

    assertTouchSize(buttonGroup, ".header", ["min-width", "min-height"]);
    assertTouchSize(displaySettings, ".button", ["width", "min-width", "height"]);
    assertTouchSize(regionFilter, ".button", ["width", "min-width", "height"]);
    assertTouchSize(filterDateRange, ".date_input", ["min-height"]);
    assertTouchSize(filterKilltime, ".killtime_group", ["min-height"]);
    assertTouchSize(durationInput, ".duration_input", ["min-height"]);
    assertTouchSize(spellPreset, ".button", ["width", "min-width", "height"]);
    assertTouchSize(spellButton, ".toggle", ["width", "height"]);
    assertTouchSize(collapsableStyle, ".toggle", ["width", "height"]);
    assertTouchSize(playerName, ".copyButton", ["width", "height"]);
    assertTouchSize(shell, ".navLink", ["height"]);

    const clippedFocusBody = selectorBody(playerName, ".playerLink:focus-visible,");
    assert.match(
        clippedFocusBody,
        /outline-offset:\s*calc\(0px - var\(--rg-focus-ring-width\) - 1px\)/,
    );
    assert.doesNotMatch(clippedFocusBody, /outline\s*:/, "clipped controls must not redeclare focus width or color");
    assert.match(playerName, /\.boss_name:focus-visible/);

    const mobileBreakpoint = shell.indexOf("@media (max-width: 959px)");
    assert.notEqual(mobileBreakpoint, -1, "missing shared mobile shell breakpoint");
    const mobileShell = shell.slice(mobileBreakpoint);
    const mobileNavBody = selectorBody(mobileShell, ".nav");
    const mobileNavLinkBody = selectorBody(mobileShell, ".navLink");
    const mobileContentBody = selectorBody(mobileShell, ".content");
    assert.match(mobileNavBody, /position:\s*fixed/);
    assert.match(mobileNavBody, /bottom:\s*max\(10px, env\(safe-area-inset-bottom, 0px\)\)/);
    assert.match(mobileNavBody, /overflow:\s*visible/);
    assert.match(mobileNavBody, /padding:\s*var\(--rg-space-1\)/);
    assert.match(mobileNavLinkBody, /min-width:\s*var\(--rg-control-min-touch\)/);
    assert.match(mobileNavLinkBody, /height:\s*var\(--rg-control-min-touch\)/);
    assert.match(
        mobileContentBody,
        /padding-bottom:[^;]*var\(--rg-control-min-touch\)[^;]*env\(safe-area-inset-bottom, 0px\)/,
    );

    const formControlStart = layout.lastIndexOf("\n.form-control {");
    assert.notEqual(formControlStart, -1, "missing top-level .form-control selector");
    const formControlFocusBody = selectorBody(layout.slice(formControlStart), "&:focus");
    assert.doesNotMatch(formControlFocusBody, /outline:\s*0/);
    assert.doesNotMatch(formControlFocusBody, /(?:-webkit-)?box-shadow\s*:/);

    assertTouchSize(selectorBody(workbench, ".selector"), "select", ["min-height"]);
    assertTouchSize(selectorBody(workbench, ".specChoices"), "button", ["min-height"]);
    assertTouchSize(selectorBody(targetPicker, ".difficulty"), "\n    button {", ["min-height"]);
    assertTouchSize(selectorBody(workbench, ".summaryAction"), "button", ["min-height"]);
    assert.match(
        selectorBody(workbench, ".settingsToggle"),
        /min-height:\s*calc\(var\(--rg-control-min-touch\) \+ var\(--rg-space-1\)\)/,
    );
    assertTouchSize(selectorBody(workbench, ".timelineTools"), "button", ["width", "height"]);

    const stateButton = selectorBody(selectorBody(workbench, ".stateMessage,"), "button");
    const errorButton = selectorBody(selectorBody(workbench, ".stateError"), "button");
    assert.match(stateButton, /min-height:\s*var\(--rg-control-min-desktop\)/);
    assert.match(errorButton, /min-height:\s*var\(--rg-control-min-desktop\)/);
});
