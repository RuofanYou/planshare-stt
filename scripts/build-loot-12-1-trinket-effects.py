#!/usr/bin/env python3
"""构建 12.1 饰品效果：官方简中法术模板 + 已选物品档位数值。"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import io
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BUILD = "12.1.0.69111"
WAGO_URL = "https://wago.tools/db2/{table}/csv?build={build}&locale={locale}&filter%5BID%5D={row_id}"
WAGO_ITEM_EFFECT_URL = "https://wago.tools/db2/ItemXItemEffect/csv?build={build}&filter%5BItemID%5D={item_id}"
WAGO_ITEM_EFFECT_ROW_URL = "https://wago.tools/db2/ItemEffect/csv?build={build}&filter%5BID%5D={effect_id}"
DEFAULT_DATA = Path("src/data/loot-12-1.json")
DEFAULT_CACHE = Path("reports/loot-12-1-wowhead-cache")
DEFAULT_REPORT = Path("reports/loot-12-1-trinket-effects.json")
DEFAULT_UNRESOLVED = Path("reports/loot-12-1-trinket-effects-unresolved.json")
USER_AGENT = "Mozilla/5.0 (Macintosh; ARM Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"
REQUEST_LOCK = None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    parser.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--unresolved-output", type=Path, default=DEFAULT_UNRESOLVED)
    parser.add_argument("--access-date", default=datetime.now(UTC).date().isoformat())
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--refresh", action="store_true")
    return parser.parse_args()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fetch(url: str, retries: int = 3) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            request = Request(url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            })
            with urlopen(request, timeout=30) as response:
                payload = response.read()
            if not payload:
                raise ValueError("远端返回空响应")
            time.sleep(0.06)
            return payload
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            last_error = error
            print(f"[loot-effects] requestRetry attempt={attempt}/{retries} url={url} error={error}", flush=True)
            if attempt < retries:
                time.sleep(0.4 * attempt)
    raise RuntimeError(f"请求失败 url={url} error={last_error}")


def fetch_csv(url: str, *, allow_empty: bool = False) -> tuple[list[dict[str, str]], str]:
    try:
        payload = fetch(url)
    except RuntimeError as error:
        if allow_empty and "空响应" in str(error):
            return [], sha256(b"")
        raise
    return list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig")))), sha256(payload)


def strip_tags(value: str) -> str:
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", "", value)
    return html.unescape(value).replace("\x08", "")


def plain_tooltip_effects(payload: dict[str, object]) -> list[dict[str, object]]:
    tooltip = str(payload.get("tooltip") or "")
    spans = re.findall(r'<span id="useText\d+"[^>]*>(.*?)</span>', tooltip, flags=re.IGNORECASE | re.DOTALL)
    effects: list[dict[str, object]] = []
    for span in spans:
        cursor = 0
        while True:
            opening = re.search(r'<a href="/ptr/spell=(\d+)[^\"]*"[^>]*>', span[cursor:], flags=re.IGNORECASE)
            if opening is None:
                break
            spell_id = int(opening.group(1))
            start = cursor + opening.start()
            content_start = cursor + opening.end()
            position = content_start
            depth = 1
            while depth:
                next_open = re.search(r"<a\b", span[position:], flags=re.IGNORECASE)
                next_close = span.lower().find("</a>", position)
                if next_close < 0:
                    raise ValueError(f"tooltip anchor 未闭合 spellId={spell_id}")
                if next_open is not None and position + next_open.start() < next_close:
                    depth += 1
                    position += next_open.end()
                else:
                    depth -= 1
                    position = next_close + 4
            raw_text = span[content_start:position - 4]
            effects.append({
                "spellId": spell_id,
                "englishText": " ".join(strip_tags(raw_text).split()),
            })
            cursor = position
    return effects


def balanced(text: str, start: int, opening: str, closing: str) -> tuple[str, int]:
    if start >= len(text) or text[start] != opening:
        raise ValueError(f"缺少平衡符号 {opening} at={start}")
    depth = 1
    position = start + 1
    while position < len(text) and depth:
        depth += int(text[position] == opening) - int(text[position] == closing)
        position += 1
    if depth:
        raise ValueError(f"未闭合模板 {opening} at={start}")
    return text[start + 1:position - 1], position


def parse_template(text: str) -> list[dict[str, object]]:
    nodes: list[dict[str, object]] = []
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            nodes.append({"kind": "text", "value": "".join(buffer)})
            buffer.clear()

    position = 0
    while position < len(text):
        if text[position] != "$":
            buffer.append(text[position])
            position += 1
            continue
        flush()
        if text.startswith("${", position):
            expression, position = balanced(text, position + 1, "{", "}")
            nodes.append({"kind": "expression", "value": "${" + expression + "}"})
            continue
        if text.startswith("$?", position):
            position += 2
            options: list[dict[str, object]] = []
            while True:
                condition, position = balanced(text, position, "(", ")")
                branch, position = balanced(text, position, "[", "]")
                options.append({"condition": condition, "branch": branch})
                if position < len(text) and text[position] == "?":
                    position += 1
                    continue
                fallback, position = balanced(text, position, "[", "]")
                nodes.append({"kind": "conditional", "options": options, "fallback": fallback})
                break
            continue
        reference = re.match(r"\$@spelldesc(\d+)", text[position:], flags=re.IGNORECASE)
        if reference:
            token = reference.group(0)
            position += len(token)
            nodes.append({"kind": "reference", "token": token, "spellId": int(reference.group(1))})
            continue
        macro = re.match(r"\$(?:(?:\d+)?[A-Za-z]+\d*)", text[position:])
        if macro:
            token = macro.group(0)
            position += len(token)
            nodes.append({"kind": "value", "token": token})
            continue
        raise ValueError(f"无法识别模板占位符: {text[position:position + 40]!r}")
    flush()
    return nodes


def normalized(text: str) -> str:
    return " ".join(html.unescape(text).replace("\x08", "").split())


def static_pattern(text: str) -> str:
    parts = re.split(r"(\s+)", html.unescape(text).replace("\x08", ""))
    return "".join(r"\s+" if part.isspace() else re.escape(part) for part in parts if part)


def without_cooldown(text: str) -> str:
    return re.sub(
        r"\s*\((?:\d+(?:\.\d+)?\s*(?:ms|sec|s|min|hour|hr|day)|\d+\s*[A-Za-z]+)\s+cooldown\)\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    )


def matcher(nodes: list[dict[str, object]]) -> tuple[re.Pattern[str], int]:
    parts: list[str] = []
    captures = 0
    for node in nodes:
        if node["kind"] == "text":
            parts.append(static_pattern(str(node["value"])))
        else:
            captures += 1
            parts.append(f"(?P<v{captures}>.+?)")
    return re.compile("^" + "".join(parts) + "$", flags=re.DOTALL), captures


def localize_value(value: str) -> str:
    value = value.strip()
    value = re.sub(r"(?<=\d)\s*sec(?:onds?)?\b", "秒", value, flags=re.IGNORECASE)
    value = re.sub(r"(?<=\d)\s*min(?:utes?)?\b", "分钟", value, flags=re.IGNORECASE)
    value = re.sub(r"(?<=\d)\s*hr(?:s|ours?)?\b", "小时", value, flags=re.IGNORECASE)
    value = re.sub(r"(?<=\d)\s*day(?:s)?\b", "天", value, flags=re.IGNORECASE)
    value = value.replace("*", "×")
    value = value.replace("[", "（").replace("]", "）")
    for english, chinese in (
        ("Strength or Agility", "力量或敏捷"),
        ("Agility or Strength or Intellect", "敏捷或力量或智力"),
        ("Versatility", "全能"),
        ("Strength", "力量"),
        ("Agility", "敏捷"),
        ("Intellect", "智力"),
    ):
        value = value.replace(english, chinese)
    return value


def node_key(node: dict[str, object]) -> str:
    kind = str(node["kind"])
    if kind == "value":
        return "value:" + str(node["token"]).lower()
    if kind == "reference":
        return "reference:" + str(node["spellId"])
    if kind == "expression":
        expression = str(node["value"])
        tokens = re.findall(r"\$@spelldesc\d+|\$<[^>]+>|\$(?:(?:\d+)?[A-Za-z]+\d*)", expression, flags=re.IGNORECASE)
        return "expression:" + "|".join(token.lower() for token in tokens)
    if kind == "conditional":
        options = node["options"]
        parts: list[str] = []
        if isinstance(options, list):
            parts.extend(str(option["condition"]) for option in options)
        return "conditional:" + "|".join(parts) + "|fallback"
    raise ValueError(f"文本节点不应提取 key kind={kind}")


class TemplateResolver:
    def __init__(self, templates: dict[tuple[int, str], dict[str, str]]) -> None:
        self.templates = templates
        self.stack: list[int] = []

    def resolve(self, spell_id: int, rendered_english: str) -> str:
        if spell_id in self.stack:
            raise ValueError(f"法术描述循环引用 spellId={spell_id}")
        for field in ("Description_lang", "AuraDescription_lang"):
            english_row = self.templates.get((spell_id, "enUS"), {})
            chinese_row = self.templates.get((spell_id, "zhCN"), {})
            english = english_row.get(field, "")
            chinese = chinese_row.get(field, "")
            if not english or not chinese:
                continue
            try:
                self.stack.append(spell_id)
                result = self.resolve_pair(english, chinese, rendered_english)
                self.stack.pop()
                return result.strip()
            except ValueError:
                self.stack.pop()
        raise ValueError(f"没有匹配的官方模板 spellId={spell_id} rendered={rendered_english[:160]!r}")

    def resolve_pair(self, english: str, chinese: str, rendered_english: str) -> str:
        # Wago 的文本字段常带 CRLF/尾部空白，客户端渲染文本不会保留这些空白。
        # 仅裁剪首尾，保留模板内部段落和分隔符语义。
        english = english.strip()
        chinese = chinese.strip()
        english_nodes = parse_template(english)
        chinese_nodes = parse_template(chinese)
        pattern, capture_count = matcher(english_nodes)
        rendered = normalized(without_cooldown(rendered_english))
        match = pattern.match(rendered)
        if not match or capture_count != sum(node["kind"] != "text" for node in english_nodes):
            raise ValueError(f"英文模板无法匹配 rendered={rendered_english[:160]!r} template={english[:160]!r}")
        captures: dict[str, list[str]] = {}
        english_nodes_by_key: dict[str, list[dict[str, object]]] = {}
        cursor = 0
        for node in english_nodes:
            if node["kind"] == "text":
                continue
            key = node_key(node)
            captures.setdefault(key, []).append(match.group(f"v{cursor + 1}"))
            english_nodes_by_key.setdefault(key, []).append(node)
            cursor += 1
        output: list[str] = []
        for node in chinese_nodes:
            kind = str(node["kind"])
            if kind == "text":
                output.append(str(node["value"]))
                continue
            key = node_key(node)
            values = captures.get(key)
            if not values:
                raise ValueError(f"中英文模板占位符无法对应 key={key}")
            value = values.pop(0)
            if kind == "value" or kind == "expression":
                output.append(localize_value(value))
                continue
            if kind == "reference":
                output.append(self.resolve(int(node["spellId"]), value))
                continue
            if kind == "conditional":
                english_node = english_nodes_by_key[key].pop(0)
                output.append(self.resolve_conditional(english_node, node, value))
                continue
            raise ValueError(f"未知模板节点 kind={kind}")
        result = "".join(output)
        if "$" in result or re.search(r"\b(?:sec|min|Strength|Agility|Intellect|Nature|Shadow|Physical|Holy)\b", result):
            raise ValueError(f"效果仍含未翻译内容: {result[:200]!r}")
        return result

    def resolve_conditional(self, english_node: dict[str, object], chinese_node: dict[str, object], rendered_value: str) -> str:
        english_options = english_node["options"]
        chinese_options = chinese_node["options"]
        if not isinstance(english_options, list) or not isinstance(chinese_options, list):
            raise ValueError("条件模板 options 类型错误")
        # 条件本身依赖角色，已渲染英文文本决定实际分支；中文使用同序分支。
        for index, option in enumerate(english_options):
            if normalized(str(option["branch"])) == normalized(rendered_value):
                return str(chinese_options[index]["branch"])
        if normalized(str(english_node["fallback"])) == normalized(rendered_value):
            return str(chinese_node["fallback"])
        raise ValueError(f"条件分支未匹配 rendered={rendered_value!r}")


def read_cached_tooltip(cache_dir: Path, item_id: int) -> tuple[dict[str, object], str]:
    cache = json.loads((cache_dir / f"{item_id}.json").read_text(encoding="utf-8"))
    url = str(cache["evidence"]["selectedTooltipUrl"])
    payload = json.loads(fetch(url).decode("utf-8"))
    return payload, url


def item_spell_ids(item_id: int) -> tuple[list[int], list[str]]:
    rows, _ = fetch_csv(WAGO_ITEM_EFFECT_URL.format(build=BUILD, item_id=item_id), allow_empty=True)
    effect_ids = [int(row["ItemEffectID"]) for row in rows if row.get("ItemEffectID", "").isdigit()]
    spells: list[int] = []
    hashes: list[str] = []
    for effect_id in effect_ids:
        effect_rows, payload_hash = fetch_csv(WAGO_ITEM_EFFECT_ROW_URL.format(build=BUILD, effect_id=effect_id))
        hashes.append(payload_hash)
        for row in effect_rows:
            if row.get("SpellID", "").isdigit() and int(row["SpellID"]) > 0:
                spells.append(int(row["SpellID"]))
    return sorted(set(spells)), hashes


def load_spell_templates(spell_ids: set[int], workers: int) -> tuple[dict[tuple[int, str], dict[str, str]], dict[str, str]]:
    fields = ("Description_lang", "AuraDescription_lang")
    templates: dict[tuple[int, str], dict[str, str]] = {}
    hashes: dict[str, str] = {}

    def load(task: tuple[int, str]) -> tuple[tuple[int, str], dict[str, str], str]:
        spell_id, locale = task
        url = WAGO_URL.format(table="Spell", build=BUILD, locale=locale, row_id=spell_id)
        rows, payload_hash = fetch_csv(url)
        rows = [row for row in rows if row.get("ID") == str(spell_id)]
        if not rows:
            raise ValueError(f"Wago Spell 缺少记录 spellId={spell_id} locale={locale}")
        return (spell_id, locale), {field: rows[0].get(field, "") for field in fields}, payload_hash

    pending = set(spell_ids)
    while pending:
        tasks = [(spell_id, locale) for spell_id in sorted(pending) for locale in ("enUS", "zhCN")]
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = [executor.submit(load, task) for task in tasks]
            for future in as_completed(futures):
                key, values, payload_hash = future.result()
                templates[key] = values
                hashes[f"{key[0]}:{key[1]}"] = payload_hash
        references = {
            int(reference.group(1))
            for values in templates.values()
            for field in fields
            for reference in re.finditer(r"\$@spelldesc(\d+)", values.get(field, ""), flags=re.IGNORECASE)
        }
        pending = references.difference({spell_id for spell_id, _ in templates})
    return templates, hashes


def build(args: argparse.Namespace) -> int:
    if args.workers <= 0:
        raise ValueError("workers 必须大于 0")
    if args.output.exists() and not args.refresh:
        report = json.loads(args.output.read_text(encoding="utf-8"))
        result = report.get("result", {}) if isinstance(report, dict) else {}
        print(f"[loot-effects] report cache=hit trinkets={result.get('trinketRecords')} effects={result.get('effectRecords')} unresolved={result.get('unresolved')}")
        return 0
    records = json.loads(args.data.read_text(encoding="utf-8"))
    trinkets = [record for record in records if record.get("slot") == "饰品"]
    if len(trinkets) != 44:
        raise ValueError(f"饰品记录数异常: {len(trinkets)}")

    print(f"[loot-effects] run state=start build={BUILD} trinkets={len(trinkets)} workers={args.workers}", flush=True)
    item_mappings: dict[int, list[int]] = {}
    mapping_hashes: dict[int, list[str]] = {}
    mapping_failures: list[dict[str, object]] = []

    def load_mapping(record: dict[str, object]) -> tuple[int, list[int], list[str]]:
        item_id = int(record["itemId"])
        spells, hashes = item_spell_ids(item_id)
        return item_id, spells, hashes

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(load_mapping, record) for record in trinkets]
        for future in as_completed(futures):
            try:
                item_id, spells, hashes = future.result()
                item_mappings[item_id] = spells
                mapping_hashes[item_id] = hashes
            except Exception as error:
                mapping_failures.append({"error": str(error)})
    if mapping_failures:
        write_json(args.unresolved_output, mapping_failures)
        return 2

    tooltip_payloads: dict[int, dict[str, object]] = {}
    tooltip_urls: dict[int, str] = {}
    tooltip_failures: list[dict[str, object]] = []

    def load_tooltip(record: dict[str, object]) -> tuple[int, dict[str, object], str]:
        item_id = int(record["itemId"])
        payload, url = read_cached_tooltip(args.cache_dir, item_id)
        return item_id, payload, url

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(load_tooltip, record) for record in trinkets]
        for future in as_completed(futures):
            try:
                item_id, payload, url = future.result()
                tooltip_payloads[item_id] = payload
                tooltip_urls[item_id] = url
            except Exception as error:
                tooltip_failures.append({"error": str(error)})
    if tooltip_failures:
        write_json(args.unresolved_output, tooltip_failures)
        return 2

    linked_effects = {
        int(effect["spellId"])
        for payload in tooltip_payloads.values()
        for effect in plain_tooltip_effects(payload)
    }
    templates, template_hashes = load_spell_templates(linked_effects | {spell_id for values in item_mappings.values() for spell_id in values}, args.workers)
    resolver = TemplateResolver(templates)
    output_records: list[dict[str, object]] = []
    unresolved: list[dict[str, object]] = []
    for record in sorted(trinkets, key=lambda value: int(value["itemId"])):
        item_id = int(record["itemId"])
        effects = plain_tooltip_effects(tooltip_payloads[item_id])
        mapped_spells = set(item_mappings[item_id])
        rendered_effects: list[dict[str, object]] = []
        try:
            if effects and any(int(effect["spellId"]) not in mapped_spells for effect in effects):
                raise ValueError(f"物品效果关联校验失败 linked={effects} mapped={sorted(mapped_spells)}")
            for effect in effects:
                spell_id = int(effect["spellId"])
                text = resolver.resolve(spell_id, str(effect["englishText"]))
                if not text or "$" in text or re.search(r"[A-Za-z]", text):
                    raise ValueError(f"效果文本未完成本地化 spellId={spell_id} text={text!r}")
                rendered_effects.append({"spellId": spell_id, "text": text})
            output_records.append({
                "itemId": item_id,
                "name": record["name"],
                "staticOnly": not bool(effects),
                "effects": rendered_effects,
                "tooltip": {"url": tooltip_urls[item_id], "sha256": sha256(json.dumps(tooltip_payloads[item_id], ensure_ascii=False, sort_keys=True).encode("utf-8"))},
                "wago": {"itemEffectSpellIds": sorted(mapped_spells), "mappingPayloadSha256": mapping_hashes[item_id], "templatePayloadSha256": {str(spell_id): template_hashes.get(f"{spell_id}:zhCN", "") for spell_id in sorted(mapped_spells)}},
            })
        except Exception as error:
            unresolved.append({"itemId": item_id, "name": record["name"], "reason": str(error), "englishEffects": effects})

    report = {
        "schemaVersion": 1,
        "gameBuild": BUILD,
        "accessedAt": args.access_date,
        "purpose": "只为网页生成饰品效果；中文来自 Wago Spell zhCN，数值来自已选物品档位 tooltip。",
        "sources": [
            {"name": "Wago DB2 ItemXItemEffect", "urlTemplate": "https://wago.tools/db2/ItemXItemEffect/csv?build=12.1.0.69111&filter%5BItemID%5D={itemId}"},
            {"name": "Wago DB2 ItemEffect", "urlTemplate": "https://wago.tools/db2/ItemEffect/csv?build=12.1.0.69111&filter%5BID%5D={itemEffectId}"},
            {"name": "Wago DB2 Spell zhCN", "urlTemplate": "https://wago.tools/db2/Spell/csv?build=12.1.0.69111&locale=zhCN&filter%5BID%5D={spellId}"},
            {"name": "Wowhead PTR tooltip", "purpose": "只定位已选 item bonus 的实际数值与效果结构"},
        ],
        "result": {"trinketRecords": len(trinkets), "effectRecords": sum(bool(row["effects"]) for row in output_records), "staticOnlyRecords": sum(bool(row["staticOnly"]) for row in output_records), "unresolved": len(unresolved)},
        "records": output_records,
    }
    write_json(args.output, report)
    write_json(args.unresolved_output, unresolved)
    print(f"[loot-effects] run state=complete trinkets={len(trinkets)} effects={report['result']['effectRecords']} staticOnly={report['result']['staticOnlyRecords']} unresolved={len(unresolved)}", flush=True)
    return 0 if not unresolved else 2


if __name__ == "__main__":
    raise SystemExit(build(parse_args()))
