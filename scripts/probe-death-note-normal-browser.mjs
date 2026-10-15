// scripts/probe-death-note-normal-browser.mjs
import { chromium } from "playwright-core";
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

// scripts/probe-death-note-cloud.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

// shared/death-note.mjs
var finite = Number.isFinite;

// shared/death-note-web.mjs
var fail = (message) => {
  throw new Error(message);
};
var integer = Number.isSafeInteger;
var classes = /* @__PURE__ */ new Set(["DeathKnight", "DemonHunter", "Druid", "Evoker", "Hunter", "Mage", "Monk", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"]);
function normalizeWebReport(metadata, { code: code2, title, startTime }) {
  if (!/^[A-Za-z0-9]{16}$/.test(code2) || typeof title !== "string" || !title.trim() || !integer(startTime) || startTime <= 0) fail("\u7F51\u9875\u62A5\u544A\u8EAB\u4EFD\u4E0D\u5B8C\u6574");
  if (!Array.isArray(metadata?.fights) || !Array.isArray(metadata.friendlies) || !Array.isArray(metadata.enemies) || !Array.isArray(metadata.phases)) fail("\u7F51\u9875\u62A5\u544A\u7F3A\u5C11\u6218\u6597\u3001\u89D2\u8272\u6216\u9636\u6BB5\u8D44\u6599");
  const actors = [metadata.friendlies, metadata.enemies, metadata.friendlyPets ?? [], metadata.enemyPets ?? []].flat().map((a) => {
    if (!integer(a.id) || a.id <= 0 || typeof a.name !== "string") fail("\u7F51\u9875\u89D2\u8272\u8D44\u6599\u65E0\u6548");
    return {
      id: a.id,
      name: a.name,
      gameID: a.guid,
      type: classes.has(a.type) ? "Player" : a.type === "Pet" ? "Pet" : "NPC",
      subType: a.type,
      ...a.petOwner != null ? { petOwner: a.petOwner } : {},
      ...a.server ? { server: a.server } : {}
    };
  }).sort((a, b) => a.id - b.id);
  if (new Set(actors.map((a) => a.id)).size !== actors.length) fail("\u7F51\u9875\u89D2\u8272\u7F16\u53F7\u91CD\u590D");
  const fights = metadata.fights.filter((f) => f.boss === 3429 && f.difficulty === 5 && !f.inProgress).map((f) => {
    if (!integer(f.id) || !integer(f.start_time) || !integer(f.end_time) || f.end_time <= f.start_time || f.start_time < 0) fail("\u7F51\u9875\u6218\u6597\u8FB9\u754C\u65E0\u6548");
    return {
      id: f.id,
      name: f.name,
      encounterID: f.boss,
      difficulty: f.difficulty,
      startTime: f.start_time,
      endTime: f.end_time,
      kill: !!f.kill,
      friendlyPlayers: metadata.friendlies.filter((a) => classes.has(a.type) && String(a.fights).split(".").includes(String(f.id))).map((a) => a.id),
      phaseTransitions: f.phases ?? [],
      maps: (f.maps ?? []).map((id) => ({ id })),
      bossPercentage: f.bossPercentage / 100,
      fightPercentage: f.fightPercentage / 100
    };
  }).sort((a, b) => a.startTime - b.startTime);
  if (!fights.length || fights.length > 1e3 || new Set(fights.map((f) => f.id)).size !== fights.length) fail("\u7F51\u9875\u62A5\u544A\u6CA1\u6709\u5B8C\u6574\u7684\u53F2\u8BD7M7\u6218\u6597\uFF0C\u6216\u6218\u6597\u7F16\u53F7\u65E0\u6548");
  const phases = metadata.phases.filter((p) => p.boss === 3429).map((p) => ({
    encounterID: p.boss,
    phases: p.phases.map((name, index) => ({ id: index + 1, name, isIntermission: (p.intermissions ?? []).includes(index + 1) }))
  }));
  if (!phases.length) fail("\u7F51\u9875\u62A5\u544A\u7F3A\u5C11M7\u9636\u6BB5\u5B9A\u4E49");
  return { code: code2, title: title.trim(), startTime, fights, phases, masterData: { actors, abilities: [], logVersion: metadata.logVersion, gameVersion: metadata.gameVersion, lang: metadata.lang } };
}
function validateWebPage(page, segment) {
  if (!Array.isArray(page?.events) || page.events.length > 1e6) fail("\u7F51\u9875\u56DE\u653E\u5206\u6BB5\u65E0\u6548\u6216\u8FC7\u5927");
  for (const e of page.events) if (!e || !integer(e.timestamp) || e.timestamp < segment.start || e.timestamp > segment.end || typeof e.type !== "string" || e.fight != null && e.fight !== segment.fightID) fail("\u7F51\u9875\u56DE\u653E\u4E8B\u4EF6\u8D85\u51FA\u6218\u6597\u6216\u5206\u6BB5\u8FB9\u754C");
  return page;
}

// server/death-note-wcl.mjs
var QUOTA = "rateLimitData { limitPerHour pointsSpentThisHour pointsResetIn }";
var REPORT_QUERY = `query DeathNoteReport($code: String!) {
  ${QUOTA}
  reportData { report(code: $code) {
    code title startTime endTime visibility
    fights { id name encounterID difficulty startTime endTime kill friendlyPlayers
      bossPercentage fightPercentage wipeCalledTime
      phaseTransitions { id startTime }
      maps { id } boundingBox { minX maxX minY maxY }
      enemyNPCs { id gameID instanceCount groupCount }
    }
    masterData { logVersion gameVersion lang
      actors { id gameID name type subType petOwner server }
      abilities { gameID name icon type }
    }
    phases { encounterID phases { id name isIntermission } }
  } }
}`;
var EVENTS_QUERY = `query DeathNoteEvents($code: String!, $fight: Int!, $start: Float, $end: Float!) {
  ${QUOTA}
  reportData { report(code: $code) {
    events(fightIDs: [$fight], startTime: $start, endTime: $end, dataType: All,
      includeResources: true, limit: 10000) { data nextPageTimestamp }
  } }
}`;
var fail2 = (message, statusCode, code2, retryAfter) => Object.assign(new Error(message), { statusCode, code: code2, retryAfter });
function validateDeathNoteInput(kind, params) {
  const { code: code2 } = params;
  if (typeof code2 !== "string" || !/^[A-Za-z0-9]{16}$/.test(code2)) throw fail2("WCL \u62A5\u544A\u7F16\u53F7\u65E0\u6548", 400, "invalid_report");
  if (params.refresh != null && (kind !== "report" || params.refresh !== "1" && params.refresh !== true)) {
    throw fail2("WCL \u5237\u65B0\u53C2\u6570\u65E0\u6548", 400, "invalid_refresh");
  }
  if (kind === "report") return params.refresh == null ? { code: code2 } : { code: code2, refresh: true };
  const fight = Number(params.fight);
  const start = params.start == null ? null : Number(params.start);
  if (!Number.isSafeInteger(fight) || fight <= 0) throw fail2("WCL \u6218\u6597\u7F16\u53F7\u65E0\u6548", 400, "invalid_fight");
  if (params.start === "" || start != null && (!Number.isFinite(start) || start < 0)) throw fail2("WCL \u5206\u9875\u8D77\u70B9\u65E0\u6548", 400, "invalid_cursor");
  return { code: code2, fight, start };
}

// scripts/probe-death-note-cloud.mjs
function cloudProbeCode(code2) {
  validateDeathNoteInput("report", { code: code2 });
  return `const evidence = await (async () => {
    const { gzipSync } = await import('node:zlib');
    const { createHash } = await import('node:crypto');
    const code = ${JSON.stringify(code2)};
    let officialApiAttempts = 0;
    const api = /^https:\\/\\/(?:cn|www)\\.warcraftlogs\\.com\\/(?:api\\/v2\\/(?:client|user)|oauth\\/token)(?:[/?]|$)/;
    await page.route(api, async route => { officialApiAttempts++; await route.abort(); });
    await page.goto('https://cn.warcraftlogs.com/reports/' + code, {waitUntil:'domcontentloaded',timeout:30000});
    if (/just a moment|\u8BF7\u7A0D\u5019/i.test(await page.title())) await page.waitForSelector('#report-title-link',{timeout:15000}).catch(()=>{});
    const title = await page.title(), url = page.url();
    if (!await page.locator('#report-title-link').count()) return {code,title,url,blocked:true,officialApiAttempts};
    const identity = await page.evaluate(() => {
      const link = document.querySelector('#report-title-link').cloneNode(true);
      link.querySelectorAll('script').forEach(e => e.remove());
      const title = link.textContent.split('\\n').map(s=>s.trim()).find(Boolean);
      const scripts = Array.from(document.scripts).filter(s=>!s.src).map(s=>s.textContent).join('\\n');
      return {title,startTime:Number(scripts.match(/const\\s+reportStartDate\\s*=\\s*new Date\\((\\d+)\\)/)?.[1])};
    });
    async function read(path) {
      const reply = await page.evaluate(async path => {
        const response = await fetch(path,{signal:AbortSignal.timeout(30000)});
        return {status:response.status,url:response.url,contentType:response.headers.get('content-type'),text:await response.text()};
      }, path);
      let parsed; try { parsed = JSON.parse(reply.text); } catch {}
      if (reply.status !== 200 || !parsed) return {status:reply.status,url:reply.url,contentType:reply.contentType,validJSON:false};
      const bytes = Buffer.from(reply.text);
      return {status:reply.status,url:reply.url,contentType:reply.contentType,validJSON:true,bytes:bytes.length,
        sha256:createHash('sha256').update(bytes).digest('hex'),gzipBase64:gzipSync(bytes).toString('base64')};
    }
    const metadata = await read('/reports/fights-and-participants/'+code+'/0?lang=en');
    if (!metadata.validJSON) return {code,title,url,identity,metadata,blocked:true,officialApiAttempts};
    const {gunzipSync} = await import('node:zlib');
    const data = JSON.parse(gunzipSync(Buffer.from(metadata.gzipBase64,'base64')));
    const fight = data.fights?.find(f=>f.boss===3429 && f.difficulty===5 && !f.inProgress);
    if (!fight) return {code,title,url,identity,metadata,blocked:false,missingM7:true,officialApiAttempts};
    const start = fight.start_time, end = Math.min(start+999,fight.end_time);
    const replay = await read('/reports/replaysegment/'+code+'/3429/'+start+'/'+end+'/?lang=en');
    return {code,title,url,identity,metadata,replay,segment:{fightID:fight.id,start,end},blocked:!replay.validJSON,officialApiAttempts};
  })(); JSON.stringify(evidence);`;
}
function decodeCloudResponse(record) {
  if (record?.validJSON !== true || record.status !== 200 || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || record.bytes > 8 * 1024 * 1024 || typeof record.gzipBase64 !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error("\u4E91\u91C7\u96C6\u6CA1\u6709\u8FD4\u56DE\u5B8C\u6574\u539F\u59CBJSON");
  const bytes = gunzipSync(Buffer.from(record.gzipBase64, "base64"), { maxOutputLength: 8 * 1024 * 1024 });
  if (bytes.length !== record.bytes || createHash("sha256").update(bytes).digest("hex") !== record.sha256) throw new Error("\u4E91\u91C7\u96C6\u8F93\u51FA\u622A\u65AD\u6216\u6821\u9A8C\u5931\u8D25");
  return JSON.parse(bytes);
}
async function probeFirecrawl({ apiKey, code: code2, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("\u7F3A\u5C11FIRECRAWL_API_KEY\uFF0C\u5C1A\u4E0D\u80FD\u8C03\u7528Firecrawl");
  const program = cloudProbeCode(code2);
  async function call(path2, method, body) {
    const response = await fetchImpl(`https://api.firecrawl.dev/v2/interact${path2}`, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      ...body ? { body: JSON.stringify(body) } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(9e4)
    });
    if (!response.ok) throw new Error(`Firecrawl\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${response.status}`);
    const value = await response.json();
    if (value.success === false) throw new Error("Firecrawl\u672A\u5B8C\u6210\u8BF7\u6C42");
    return value;
  }
  const session = await call("", "POST", { ttl: 120, activityTtl: 60 });
  if (typeof session.id !== "string" || !session.id || session.id.length > 200) throw new Error("Firecrawl\u4F1A\u8BDD\u8D44\u6599\u4E0D\u5B8C\u6574");
  const path = `/${encodeURIComponent(session.id)}`;
  try {
    const execution = await call(`${path}/execute`, "POST", { language: "node", code: program, timeout: 60 });
    const evidence2 = typeof execution.result === "string" ? JSON.parse(execution.result) : execution.result;
    if (!evidence2 || evidence2.code !== code2 || evidence2.officialApiAttempts !== 0) throw new Error("\u4E91\u91C7\u96C6\u7ED3\u679C\u4E0E\u62A5\u544A\u6216\u975EAPI\u901A\u9053\u8981\u6C42\u4E0D\u7B26");
    if (!evidence2.blocked) {
      const report = normalizeWebReport(decodeCloudResponse(evidence2.metadata), { code: code2, ...evidence2.identity });
      const page = validateWebPage(decodeCloudResponse(evidence2.replay), evidence2.segment);
      evidence2.verified = { fights: report.fights.length, players: report.fights[0].friendlyPlayers.length, sampleEvents: page.events.length };
    }
    return evidence2;
  } finally {
    await call(path, "DELETE");
  }
}
if (process.argv[1]?.endsWith("/probe-death-note-cloud.mjs") && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code2 = process.argv[2] || "F9WjkYzBDyrHaT7X";
  const result = await probeFirecrawl({ apiKey: process.env.FIRECRAWL_API_KEY, code: code2 });
  await mkdir(".workflow/cloud-fetch-probe", { recursive: true });
  await writeFile(`.workflow/cloud-fetch-probe/firecrawl-${code2}.json`, JSON.stringify(result), { mode: 384 });
  console.log({ code: code2, blocked: result.blocked, url: result.url, verified: result.verified, officialApiAttempts: result.officialApiAttempts });
}

// scripts/probe-death-note-normal-browser.mjs
var code = process.argv[2] || process.env.REPORT_CODE;
assert.match(code || "", /^[A-Za-z0-9]{16}$/, "\u62A5\u544A\u7F16\u53F7\u5FC5\u987B\u662F16\u4F4D\u5B57\u6BCD\u6216\u6570\u5B57");
var folder = resolve(process.env.PROBE_OUTPUT || ".workflow/normal-browser-probe", code);
await mkdir2(folder, { recursive: true, mode: 448 });
var began = performance.now();
var browser = await chromium.launch({
  headless: true,
  ...process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : { channel: "chrome" }
});
var evidence;
try {
  const page = await browser.newPage();
  const execute = new (Object.getPrototypeOf(async function() {
  })).constructor("page", `${cloudProbeCode(code)}
return evidence;`);
  evidence = await execute(page);
  assert.equal(evidence.code, code);
  assert.equal(evidence.officialApiAttempts, 0, "\u63A2\u9488\u53D1\u73B0\u5B98\u65B9API\u8BF7\u6C42\uFF0C\u4E0D\u80FD\u89C6\u4E3A\u514DAPI\u901A\u8FC7");
  if (!evidence.blocked && !evidence.missingM7) {
    const report = normalizeWebReport(decodeCloudResponse(evidence.metadata), { code, ...evidence.identity });
    const pageData = validateWebPage(decodeCloudResponse(evidence.replay), evidence.segment);
    evidence.verified = { metadataFights: report.fights.length, sampleEvents: pageData.events.length };
  }
  await page.screenshot({ path: join(folder, "page.png") });
} catch (error) {
  evidence = { ...evidence, code, error: { type: error.name, message: String(error.message).replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 300) } };
} finally {
  await browser.close();
}
evidence = {
  ...evidence,
  elapsedMs: Math.round(performance.now() - began),
  source: "ordinary-chrome-new-session",
  fullReportCollected: false
};
await writeFile2(join(folder, "evidence.json"), JSON.stringify(evidence, null, 2), { mode: 384 });
console.info({
  code,
  blocked: evidence.blocked,
  title: evidence.title,
  verified: evidence.verified,
  officialApiAttempts: evidence.officialApiAttempts,
  elapsedMs: evidence.elapsedMs,
  error: evidence.error,
  fullReportCollected: false
});
if (!evidence.verified || evidence.error) process.exitCode = 2;
