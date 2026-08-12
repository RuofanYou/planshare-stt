#!/usr/bin/env python3
"""从 Wowhead 12.1 PTR 构建掉落页的显示物品数据。

输入行的名称、来源和旧属性权重只保存在审计报告中。公开 JSON 只发布
Wowhead PTR 可验证的实际物等、升级轨道、数值属性和本地图标。
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import html
import json
import re
import subprocess
import sys
import threading
import time
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET


EXPECTED_RECORDS = 577
SCHEMA_VERSION = 5
CACHE_SCHEMA_VERSION = 1
PARSER_VERSION = 2
BONUS_INDEX_SCHEMA_VERSION = 2
WOWHEAD_PAGE_URL = "https://www.wowhead.com/ptr/item={item_id}"
WOWHEAD_TOOLTIP_URL = "https://nether.wowhead.com/tooltip/item/{item_id}?{bonus_query}dataEnv=2&locale=0"
WOWHEAD_BONUS_INDEX_URL = "https://nether.wowhead.com/ptr/data/item-bonuses?dv=19&db=1785907058"
WOWHEAD_ICON_URL = "https://wow.zamimg.com/images/wow/icons/large/{icon}.jpg"
BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; ARM Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
TARGET_VARIANT = {"itemLevel": 259, "track": "Hero", "rank": 1, "maxRank": 6}
SOURCE_TYPE_ORDER = ("团本", "大秘境", "地下堡", "其它")
EXPECTED_SOURCE_COUNTS = {"团本": 218, "大秘境": 205, "地下堡": 95, "其它": 59}
CLASS_ORDER = ("战士", "圣骑士", "猎人", "潜行者", "牧师", "死亡骑士", "萨满祭司", "法师", "术士", "武僧", "德鲁伊", "恶魔猎手", "唤魔师")
OFFICIAL_WEAPON_CLASS_EXCLUSIONS = {"匕首": {"武僧"}}
SLOT_ORDER = ("头部", "颈部", "肩部", "背部", "胸部", "腕部", "手部", "腰部", "腿部", "脚部", "手指", "饰品", "单手", "主手", "副手", "双手", "远程", "盾牌")
TRACK_LABELS = {
    "Adventurer": "冒险者",
    "Champion": "勇士",
    "Explorer": "探索者",
    "Hero": "英雄",
    "Myth": "神话",
    "Veteran": "老兵",
}
STAT_LABELS = {
    "Agility": "敏捷",
    "Armor": "护甲",
    "Avoidance": "闪避",
    "Critical Strike": "暴击",
    "Haste": "急速",
    "Intellect": "智力",
    "Leech": "吸血",
    "Mastery": "精通",
    "Speed": "速度",
    "Stamina": "耐力",
    "Strength": "力量",
    "Versatility": "全能",
}
JSON_DECODER = json.JSONDecoder()
ICON_LOCK = threading.Lock()
LOG_LOCK = threading.Lock()
LOG_OUTPUT: Path | None = None
INPUT_HEADERS = ["名称", "部位", "分类", "掉落途径", "掉落来源", "属性组合", "主属性", "暴击", "精通", "急速", "全能"]
INPUT_DEFAULT = Path("/Users/rofan/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/impaker_2fdf/msg/file/2026-08/12.1 DropSheet(by Ango)(1)(1).xlsx")
XML_NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
WORKBOOK_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


class WowheadAccessBlockedError(RuntimeError):
    """Wowhead 明确拒绝访问时停止本轮，避免把全部待抓取记录写成失败。"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=INPUT_DEFAULT, help="只读 DropSheet XLSX，必须是 total!A1:K578")
    parser.add_argument("--base-data", type=Path, default=Path("src/data/loot-12-1.json"), help="首次迁移时的旧公开数据")
    parser.add_argument("--base-meta", type=Path, default=Path("src/data/loot-12-1.meta.json"), help="首次迁移时的旧元数据")
    parser.add_argument("--output", type=Path, default=Path("src/data/loot-12-1.json"))
    parser.add_argument("--meta-output", type=Path, default=Path("src/data/loot-12-1.meta.json"))
    parser.add_argument("--audit-output", type=Path, default=Path("reports/loot-12-1-input-audit.json"))
    parser.add_argument("--variant-report-output", type=Path, default=Path("reports/loot-12-1-variant-report.json"))
    parser.add_argument("--progress-output", type=Path, default=Path("reports/loot-12-1-build-progress.json"))
    parser.add_argument("--log-output", type=Path, default=Path("reports/loot-12-1-build.log"), help="追加写入可复核的构建日志")
    parser.add_argument("--unresolved-output", type=Path, default=Path("reports/loot-12-1-unresolved.json"))
    parser.add_argument("--trinket-effects-report", type=Path, default=Path("reports/loot-12-1-trinket-effects.json"), help="构建期生成的饰品官方中文效果报告")
    parser.add_argument("--cache-dir", type=Path, default=Path("reports/loot-12-1-wowhead-cache"))
    parser.add_argument("--icon-dir", type=Path, default=Path("public/loot-icons"))
    parser.add_argument("--access-date", default=datetime.now(UTC).date().isoformat())
    parser.add_argument("--workers", type=int, default=4, help="Wowhead PTR 抓取并发数，必须大于 0")
    parser.add_argument("--limit", type=int, default=0, help="本轮最多抓取多少条未缓存记录；0 表示全部")
    parser.add_argument("--sleep-seconds", type=float, default=0.08, help="每次远端请求后的最小等待秒数")
    parser.add_argument("--timeout-seconds", type=float, default=30.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--refresh", action="store_true", help="忽略已有 item 缓存并重新抓取")
    return parser.parse_args()


def log(message: str) -> None:
    line = f"[loot-data] {message}"
    print(line, flush=True)
    if LOG_OUTPUT is not None:
        with LOG_LOCK:
            LOG_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            with LOG_OUTPUT.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")


def canonical_json(value: object) -> bytes:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def write_bytes(path: Path, value: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    temporary.write_bytes(value)
    temporary.replace(path)


def fetch_bytes(url: str, *, timeout_seconds: float, retries: int, sleep_seconds: float) -> bytes:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        # Wowhead 的页面和 tooltip 使用常规浏览器请求头；403 由下方断路逻辑统一处理。
        request = Request(url, headers={
            "User-Agent": BROWSER_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
            "Referer": "https://www.wowhead.com/",
        })
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                payload = response.read()
            if not payload:
                raise ValueError("远端返回空响应")
            if sleep_seconds:
                time.sleep(sleep_seconds)
            return payload
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            last_error = error
            log(f"requestRetry attempt={attempt}/{retries} url={url} error={error}")
            if attempt < retries:
                # 403 期间不紧凑重试，保留日志和缓存后等待站点冷却。
                if isinstance(error, HTTPError) and error.code == 403:
                    retry_delay = max(5.0 * attempt, sleep_seconds)
                    log(f"requestCooldown status=403 seconds={retry_delay:.2f} url={url}")
                    time.sleep(retry_delay)
                else:
                    time.sleep(min(2.0, 0.35 * attempt))
    if isinstance(last_error, HTTPError) and last_error.code == 403:
        raise WowheadAccessBlockedError(f"Wowhead 访问被拒绝 retries={retries} url={url} error={last_error}")
    raise RuntimeError(f"请求失败 retries={retries} url={url} error={last_error}")


def fetch_page_bytes(url: str, *, timeout_seconds: float, retries: int, sleep_seconds: float) -> bytes:
    """以系统 curl 读取 Wowhead PTR HTML，保留 item=<id> 的 canonical 页面 URL。"""
    last_error = ""
    blocked = False
    for attempt in range(1, retries + 1):
        try:
            result = subprocess.run(
                [
                    "/usr/bin/curl",
                    "--fail",
                    "--location",
                    "--silent",
                    "--show-error",
                    "--user-agent",
                    BROWSER_USER_AGENT,
                    "--connect-timeout",
                    str(timeout_seconds),
                    "--max-time",
                    str(timeout_seconds),
                    url,
                ],
                capture_output=True,
                check=False,
                timeout=timeout_seconds + 5,
            )
            if result.returncode == 0 and result.stdout:
                if sleep_seconds:
                    time.sleep(sleep_seconds)
                return result.stdout
            last_error = result.stderr.decode("utf-8", errors="replace").strip() or f"curl exit={result.returncode}"
            # curl 在当前 CDN 返回路径上可能以 exit 22 或 exit 56 表示 HTTP 403；
            # 错误文本才是断路的权威信号。
            blocked = "403" in last_error
        except subprocess.TimeoutExpired as error:
            last_error = f"curl timeout={error}"
            blocked = False
        log(f"pageRetry attempt={attempt}/{retries} url={url} error={last_error}")
        if attempt < retries:
            if blocked:
                retry_delay = max(5.0 * attempt, sleep_seconds)
                log(f"pageCooldown status=403 seconds={retry_delay:.2f} url={url}")
                time.sleep(retry_delay)
            else:
                time.sleep(min(2.0, 0.35 * attempt))
    if blocked:
        raise WowheadAccessBlockedError(f"Wowhead 页面访问被拒绝 retries={retries} url={url} error={last_error}")
    raise RuntimeError(f"Wowhead 页面请求失败 retries={retries} url={url} error={last_error}")


def decode_json_after(text: str, marker: str) -> object:
    position = text.find(marker)
    if position < 0:
        raise ValueError(f"页面缺少 JSON 标记: {marker}")
    content = text[position + len(marker):].lstrip()
    value, _ = JSON_DECODER.raw_decode(content)
    return value


def col_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref)
    if not letters:
        raise ValueError(f"无效单元格引用: {cell_ref}")
    result = 0
    for char in letters.group(0):
        result = result * 26 + ord(char) - 64
    return result - 1


def read_input_rows(source: Path) -> list[dict[str, str]]:
    if not source.is_file():
        raise FileNotFoundError(f"只读 XLSX 不存在: {source}")
    with zipfile.ZipFile(source) as book:
        shared_root = ET.fromstring(book.read("xl/sharedStrings.xml"))
        shared = ["".join(node.itertext()) for node in shared_root.findall("x:si", XML_NS)]
        workbook_root = ET.fromstring(book.read("xl/workbook.xml"))
        total_sheets = [
            sheet
            for sheet in workbook_root.findall("x:sheets/x:sheet", XML_NS)
            if sheet.attrib.get("name") == "total"
        ]
        if len(total_sheets) != 1:
            raise ValueError(f"XLSX 必须恰有名为 total 的工作表，实际数量={len(total_sheets)}")
        relationship_id = total_sheets[0].attrib.get(f"{{{WORKBOOK_REL_NS}}}id")
        relationships_root = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        relationship = next(
            (
                node
                for node in relationships_root.findall(f"{{{PACKAGE_REL_NS}}}Relationship")
                if node.attrib.get("Id") == relationship_id
                and node.attrib.get("Type", "").endswith("/worksheet")
            ),
            None,
        )
        if relationship is None:
            raise ValueError("XLSX total 工作表关系缺失")
        target = relationship.attrib.get("Target", "")
        if not target.startswith("worksheets/"):
            raise ValueError(f"XLSX total 工作表路径异常: {target}")
        sheet_root = ET.fromstring(book.read(f"xl/{target}"))
        dimension = sheet_root.find("x:dimension", XML_NS)
        dimension_ref = dimension.attrib.get("ref") if dimension is not None else ""
        if dimension_ref not in {"A1:K578", "K578"}:
            raise ValueError(f"XLSX total 使用范围异常: {dimension_ref}")

    rows: list[tuple[int, list[str]]] = []
    for row_node in sheet_root.findall(".//x:sheetData/x:row", XML_NS):
        row_number = int(row_node.attrib["r"])
        cells = [""] * len(INPUT_HEADERS)
        for cell in row_node.findall("x:c", XML_NS):
            index = col_index(cell.attrib["r"])
            if index >= len(cells):
                raise ValueError(f"XLSX total 出现范围外单元格: {cell.attrib['r']}")
            value_node = cell.find("x:v", XML_NS)
            if value_node is None:
                continue
            value = value_node.text or ""
            cells[index] = shared[int(value)] if cell.attrib.get("t") == "s" else value
        rows.append((row_number, cells))
    if len(rows) != EXPECTED_RECORDS + 1 or not rows or rows[0] != (1, INPUT_HEADERS):
        raise ValueError(f"XLSX 必须精确为 total!A1:K578，实际行数={len(rows)} 表头={rows[0][1] if rows else '空'}")
    expected_rows = list(range(2, EXPECTED_RECORDS + 2))
    actual_rows = [row_number for row_number, _ in rows[1:]]
    if actual_rows != expected_rows:
        raise ValueError(f"XLSX 行号不连续: {actual_rows[:3]}...{actual_rows[-3:]}")
    return [dict(zip(INPUT_HEADERS, cells), sourceRow=row_number) for row_number, cells in rows[1:]]


def normalize_int(value: object, field: str) -> int:
    if isinstance(value, bool):
        raise ValueError(f"{field} 不能是布尔值")
    try:
        return int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} 不是整数: {value!r}") from error


def normalize_number(value: str) -> int | float:
    normalized = value.replace(",", "")
    number = float(normalized)
    return int(number) if number.is_integer() else number


def normalize_track(raw_track: str | None) -> str:
    return TRACK_LABELS.get(raw_track or "", "无升级轨道")


def plain_tooltip(tooltip: str) -> str:
    value = re.sub(r"<!--.*?-->", " ", tooltip, flags=re.DOTALL)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value).replace("\\/", "/")
    return "\n".join(" ".join(line.split()) for line in value.splitlines() if line.strip())


def parse_stats(tooltip: str) -> list[dict[str, object]]:
    # 不能先移除 HTML 再按换行匹配：例如 Back、Armor 与后续属性会粘成一行。
    # Wowhead tooltip 的注释锚点直接标识每个数值字段，按锚点提取才不会漏属性。
    raw = html.unescape(tooltip).replace("\\/", "/").replace("\xa0", " ")
    stats: list[dict[str, object]] = []
    seen: set[tuple[str, int | float]] = set()

    def add(label: str, value: int | float) -> None:
        key = (label, value)
        if key not in seen:
            seen.add(key)
            stats.append({"label": label, "value": value})

    numeric = r"([\d,]+(?:\.\d+)?)"
    for match in re.finditer(rf"<!--amr-->\s*\+?{numeric}\s+Armor\b", raw):
        add("护甲", normalize_number(match.group(1)))

    for match in re.finditer(rf"<!--stat\d+-->\s*\+?{numeric}\s+\[([A-Za-z ]+(?:\s+or\s+[A-Za-z ]+)*)\]", raw):
        labels = [STAT_LABELS.get(part.strip()) for part in match.group(2).split(" or ")]
        if all(labels):
            add("/".join(label for label in labels if label), normalize_number(match.group(1)))

    standard_names = "|".join(re.escape(name) for name in STAT_LABELS if name != "Armor")
    for match in re.finditer(rf"<!--(?:stat\d+|rtg\d+)-->\s*\+?{numeric}\s+({standard_names})\b", raw):
        add(STAT_LABELS[match.group(2)], normalize_number(match.group(1)))

    for match in re.finditer(rf"<!--dmgmin\d*-->\s*{numeric}", raw):
        add("伤害下限", normalize_number(match.group(1)))
    for match in re.finditer(rf"<!--dmgmax\d*-->\s*{numeric}", raw):
        add("伤害上限", normalize_number(match.group(1)))
    for match in re.finditer(rf"<!--dmg-->\s*{numeric}\s*-\s*{numeric}\s+Damage\b", raw):
        add("伤害下限", normalize_number(match.group(1)))
        add("伤害上限", normalize_number(match.group(2)))
    for match in re.finditer(rf"<!--dps-->\s*\(?{numeric}\s+damage per second\)?", raw, flags=re.IGNORECASE):
        add("每秒伤害", normalize_number(match.group(1)))

    return stats


def parse_tooltip(payload: bytes, item_id: int) -> tuple[dict[str, object], str, str]:
    data = json.loads(payload.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"tooltip 返回结构异常 itemId={item_id}")
    tooltip = data.get("tooltip")
    icon = data.get("icon")
    if not isinstance(tooltip, str) or not tooltip.strip():
        raise ValueError(f"tooltip 缺失 itemId={item_id}")
    if not isinstance(icon, str) or not re.fullmatch(r"[a-z0-9_]+", icon):
        raise ValueError(f"图标名异常 itemId={item_id} icon={icon!r}")
    plain = plain_tooltip(tooltip)
    level_match = re.search(r"Item Level\s+([\d,]+)", plain)
    if not level_match:
        raise ValueError(f"无法解析物等 itemId={item_id}")
    item_level = normalize_int(level_match.group(1).replace(",", ""), "itemLevel")
    upgrade_match = re.search(r"Upgrade Level:\s*([A-Za-z]+)\s+(\d+)/(\d+)", plain)
    raw_track = upgrade_match.group(1) if upgrade_match else None
    rank = normalize_int(upgrade_match.group(2), "rank") if upgrade_match else 0
    max_rank = normalize_int(upgrade_match.group(3), "maxRank") if upgrade_match else 0
    variant = {
        "itemLevel": item_level,
        "track": normalize_track(raw_track),
        "rank": rank,
        "maxRank": max_rank,
        "stats": parse_stats(tooltip),
        "icon": f"/loot-icons/{icon}.jpg",
        "verified": True,
    }
    internal = {"rawTrack": raw_track or "", "plainTooltip": plain}
    return variant, icon, json.dumps(internal, ensure_ascii=False)


def decode_ssr_script(text: str, script_id: str, item_id: int) -> object:
    marker = f'<script type="application/json" id="{script_id}">'
    start = text.find(marker)
    if start < 0:
        raise ValueError(f"页面缺少 SSR {script_id} itemId={item_id}")
    end = text.find("</script>", start)
    if end < 0:
        raise ValueError(f"页面 SSR {script_id} 未闭合 itemId={item_id}")
    return json.loads(text[start + len(marker):end])


def parse_ssr_bonus_token(value: object, item_id: int) -> tuple[str, list[int]]:
    if not isinstance(value, str):
        raise ValueError(f"页面 SSR tooltip.bonus 缺失 itemId={item_id}")
    if value == "":
        # SSR 明确声明默认 tooltip 没有 bonus：这是可验证的唯一无升级轨道变体。
        return "", []
    token = value.strip()
    if not re.fullmatch(r"\d+(?::\d+)*", token):
        raise ValueError(f"页面 SSR tooltip.bonus 无法解析 itemId={item_id} bonus={value!r}")
    bonus_ids = [normalize_int(part, "tooltip.bonus") for part in token.split(":")]
    if not bonus_ids or any(bonus_id <= 0 for bonus_id in bonus_ids):
        raise ValueError(f"页面 SSR tooltip.bonus 非正整数 itemId={item_id} bonus={value!r}")
    return token, bonus_ids


def parse_page(payload: bytes, item_id: int) -> dict[str, object]:
    text = payload.decode("utf-8")
    options = decode_ssr_script(text, "data.page.wow.item.bonusOptions", item_id)
    option_ids: set[int] = set()

    def collect_option_ids(value: object) -> None:
        if isinstance(value, dict):
            for child in value.values():
                collect_option_ids(child)
        elif isinstance(value, list):
            for child in value:
                collect_option_ids(child)
        elif isinstance(value, int) and not isinstance(value, bool):
            option_ids.add(value)

    collect_option_ids(options)
    if not option_ids:
        raise ValueError(f"页面 SSR bonusOptions 为空 itemId={item_id}")
    default_tooltip = decode_ssr_script(text, "data.page.wow.item.tooltip", item_id)
    if not isinstance(default_tooltip, dict) or normalize_int(default_tooltip.get("id"), "tooltip.id") != item_id:
        raise ValueError(f"页面 SSR tooltip 物品不一致 itemId={item_id}")
    page_icon = default_tooltip.get("iconName")
    if not isinstance(page_icon, str) or not re.fullmatch(r"[a-z0-9_]+", page_icon):
        raise ValueError(f"页面 SSR tooltip 图标异常 itemId={item_id} icon={page_icon!r}")

    # 旧版页面片段只作审计补充。变体与图标的唯一权威为 SSR 数据，部分 PTR 页面没有旧片段。
    try:
        detail = decode_json_after(text, f"$.extend(g_items[{item_id}], ")
    except ValueError:
        detail = {}
    raw_trees = detail.get("bonustrees", []) if isinstance(detail, dict) else []
    trees = sorted({normalize_int(value, "bonusTree") for value in raw_trees}) if isinstance(raw_trees, list) else []
    default_bonus_token, default_bonus_ids = parse_ssr_bonus_token(default_tooltip.get("bonus"), item_id)
    return {
        "icon": page_icon,
        "bonusTrees": trees,
        "bonusOptionIds": sorted(option_ids),
        "defaultBonusToken": default_bonus_token,
        "defaultBonusIds": default_bonus_ids,
    }


def build_upgrade_index(upgrades: object) -> dict[int, tuple[int, int, str]]:
    if not isinstance(upgrades, dict):
        raise ValueError("Wowhead upgrade 索引结构异常")
    upgrade_map: dict[int, tuple[int, int, str]] = {}
    for raw_bonus_id, metadata in upgrades.items():
        if not isinstance(metadata, list) or len(metadata) < 3 or not isinstance(metadata[2], str):
            continue
        rank = normalize_int(metadata[0], "upgrade.rank")
        max_rank = normalize_int(metadata[1], "upgrade.maxRank")
        upgrade_map[normalize_int(raw_bonus_id, "upgrade.bonusId")] = (rank, max_rank, metadata[2])
    return upgrade_map


def load_upgrade_index(args: argparse.Namespace) -> tuple[dict[int, tuple[int, int, str]], dict[str, object]]:
    cache_path = args.cache_dir / "_upgrade-index.json"
    if cache_path.exists() and not args.refresh:
        cached = read_json(cache_path)
        if isinstance(cached, dict) and cached.get("schemaVersion") == BONUS_INDEX_SCHEMA_VERSION:
            raw_upgrades = cached.get("upgrades")
            if isinstance(raw_upgrades, dict):
                upgrades = {
                    int(bonus): (int(value[0]), int(value[1]), str(value[2]))
                    for bonus, value in raw_upgrades.items()
                    if isinstance(value, list) and len(value) == 3
                }
                log(f"upgradeIndex cache=hit upgrades={len(upgrades)}")
                return upgrades, cached

    log(f"upgradeIndex cache=miss url={WOWHEAD_BONUS_INDEX_URL}")
    payload = fetch_bytes(WOWHEAD_BONUS_INDEX_URL, timeout_seconds=args.timeout_seconds, retries=args.retries, sleep_seconds=args.sleep_seconds)
    text = payload.decode("utf-8")
    upgrades = decode_json_after(text, "WH.setPageData('wow.item.bonuses.upgrades', ")
    upgrade_map = build_upgrade_index(upgrades)
    if not upgrade_map:
        raise ValueError("Wowhead upgrade 索引为空")
    cached = {
        "schemaVersion": BONUS_INDEX_SCHEMA_VERSION,
        "sourceUrl": WOWHEAD_BONUS_INDEX_URL,
        "fetchedAt": args.access_date,
        "sha256": sha256_bytes(payload),
        "upgrades": {str(bonus): list(value) for bonus, value in sorted(upgrade_map.items())},
    }
    write_json(cache_path, cached)
    log(f"upgradeIndex cache=stored upgrades={len(upgrade_map)} sha256={cached['sha256']}")
    return upgrade_map, cached


def assert_input_matches_audit(input_rows: list[dict[str, str]], audit_rows: object) -> None:
    if not isinstance(audit_rows, list) or len(input_rows) != EXPECTED_RECORDS or len(audit_rows) != EXPECTED_RECORDS:
        raise ValueError("XLSX 与审计报告记录数不一致")
    for input_row, audit_row in zip(input_rows, audit_rows):
        if not isinstance(audit_row, dict):
            raise ValueError("审计报告包含非对象行")
        trace = audit_row.get("record", {}).get("trace") if isinstance(audit_row.get("record"), dict) else None
        expected = {
            "sourceRow": input_row["sourceRow"],
            "rawName": input_row["名称"],
            "rawRoute": input_row["掉落途径"],
            "rawSource": input_row["掉落来源"],
        }
        actual = {
            "sourceRow": audit_row.get("sourceRow"),
            "rawName": audit_row.get("rawName"),
            "rawRoute": audit_row.get("rawRoute"),
            "rawSource": audit_row.get("rawSource"),
        }
        trace_values = {
            "sourceRow": trace.get("sourceRow") if isinstance(trace, dict) else None,
            "rawName": trace.get("rawName") if isinstance(trace, dict) else None,
            "rawRoute": trace.get("rawRoute") if isinstance(trace, dict) else None,
            "rawSource": trace.get("rawSource") if isinstance(trace, dict) else None,
        }
        if actual != expected or trace_values != expected or audit_row.get("inputFields") != input_row:
            raise ValueError(f"XLSX 审计不一致 sourceRow={input_row['sourceRow']} expected={expected} actual={actual} trace={trace_values}")


def load_or_create_audit(args: argparse.Namespace) -> dict[str, object]:
    input_rows = read_input_rows(args.input)
    input_sha256 = sha256_file(args.input)
    input_metadata = {
        "sourceFile": args.input.name,
        "sha256": input_sha256,
        "sheet": "total",
        "range": "A1:K578",
        "recordRows": len(input_rows),
    }
    if args.audit_output.exists():
        audit = read_json(args.audit_output)
        if isinstance(audit, dict) and audit.get("schemaVersion") == 1 and isinstance(audit.get("records"), list):
            if audit.get("input") != input_metadata:
                raise ValueError(f"XLSX 指纹或行数变化，拒绝混用旧审计: expected={audit.get('input')} actual={input_metadata}")
            assert_input_matches_audit(input_rows, audit["records"])
            log(f"audit cache=hit records={len(audit['records'])} inputSha256={input_sha256}")
            return audit

    legacy_records = read_json(args.base_data)
    if not isinstance(legacy_records, list) or len(legacy_records) != EXPECTED_RECORDS:
        raise ValueError(f"旧公开数据记录数错误: {len(legacy_records) if isinstance(legacy_records, list) else '非数组'}")
    legacy_by_row: dict[int, dict[str, object]] = {}
    for legacy in legacy_records:
        if not isinstance(legacy, dict) or not isinstance(legacy.get("trace"), dict):
            raise ValueError("旧公开数据包含缺少 trace 的记录")
        row_number = normalize_int(legacy["trace"].get("sourceRow"), "trace.sourceRow")
        if row_number in legacy_by_row:
            raise ValueError(f"旧公开数据 sourceRow 重复: {row_number}")
        legacy_by_row[row_number] = legacy
    legacy_meta = read_json(args.base_meta) if args.base_meta.exists() else {}
    audit_rows: list[dict[str, object]] = []
    for input_row in input_rows:
        source_row = normalize_int(input_row["sourceRow"], "input.sourceRow")
        legacy = legacy_by_row.get(source_row)
        if legacy is None:
            raise ValueError(f"XLSX 行未进入旧公开数据 sourceRow={source_row}")
        trace = legacy["trace"]
        attributes = legacy.get("attributes")
        if not isinstance(attributes, dict):
            raise ValueError(f"首次迁移需要旧 attributes sourceRow={source_row}")
        if trace.get("rawName") != input_row["名称"] or trace.get("rawRoute") != input_row["掉落途径"] or trace.get("rawSource") != input_row["掉落来源"]:
            raise ValueError(f"XLSX 与旧公开数据 trace 不一致 sourceRow={source_row}")
        record = copy.deepcopy(legacy)
        record.pop("attributes", None)
        audit_rows.append({
            "sourceRow": source_row,
            "rawName": input_row["名称"],
            "rawRoute": input_row["掉落途径"],
            "rawSource": input_row["掉落来源"],
            "inputFields": copy.deepcopy(input_row),
            "inputAttributes": copy.deepcopy(attributes),
            "record": record,
        })
    audit = {
        "schemaVersion": 1,
        "purpose": "保留原始 DropSheet 输入行与旧属性权重；公开 UI 不读取本文件。",
        "input": input_metadata,
        "upstreamSources": legacy_meta.get("sources", []) if isinstance(legacy_meta, dict) else [],
        "records": audit_rows,
    }
    assert_input_matches_audit(input_rows, audit_rows)
    write_json(args.audit_output, audit)
    log(f"audit cache=stored records={len(audit_rows)} inputSha256={input_sha256} output={args.audit_output}")
    return audit


def normalize_base_record(audit_row: object) -> dict[str, object]:
    if not isinstance(audit_row, dict) or not isinstance(audit_row.get("record"), dict):
        raise ValueError("审计行缺少 record")
    record = copy.deepcopy(audit_row["record"])
    record.pop("attributes", None)
    trace = record.get("trace")
    if not isinstance(trace, dict):
        raise ValueError("审计行缺少 trace")
    if trace.get("rawRoute") == "套装":
        record["sourceType"] = "团本"
        record["instance"] = "套装"
        record["boss"] = None
        record["journalOrder"] = None
    item_id = normalize_int(record.get("itemId"), "itemId")
    source_type = str(record.get("sourceType") or "")
    instance = str(record.get("instance") or "")
    boss = str(record.get("boss") or "")
    slot = str(record.get("slot") or "")
    equipment_type = str(record.get("equipmentType") or "")
    excluded_classes = OFFICIAL_WEAPON_CLASS_EXCLUSIONS.get(equipment_type, set())
    if excluded_classes:
        record["classes"] = [class_name for class_name in record.get("classes", []) if class_name not in excluded_classes]
    record["key"] = "|".join([str(item_id), source_type, instance, boss, slot])
    return record


def validate_audit(audit: dict[str, object]) -> list[dict[str, object]]:
    rows = audit.get("records")
    if not isinstance(rows, list) or len(rows) != EXPECTED_RECORDS:
        raise ValueError(f"审计记录数异常: {len(rows) if isinstance(rows, list) else '非数组'}")
    records = [normalize_base_record(row) for row in rows]
    source_rows = [record.get("trace", {}).get("sourceRow") for record in records]
    item_ids = [record.get("itemId") for record in records]
    keys = [record.get("key") for record in records]
    if len(set(source_rows)) != EXPECTED_RECORDS or len(set(item_ids)) != EXPECTED_RECORDS or len(set(keys)) != EXPECTED_RECORDS:
        raise ValueError("审计行的 sourceRow、itemId 或稳定键存在重复")
    for record in records:
        required = ("key", "itemId", "name", "slot", "equipmentType", "classes", "sourceType", "instance", "trace")
        missing = [field for field in required if not record.get(field)]
        if missing:
            raise ValueError(f"公开基础记录存在空字段 itemId={record.get('itemId')} fields={missing}")
        if record["sourceType"] not in SOURCE_TYPE_ORDER:
            raise ValueError(f"未知来源分类 itemId={record['itemId']} sourceType={record['sourceType']}")
        if "attributes" in record:
            raise ValueError(f"公开基础记录残留 attributes itemId={record['itemId']}")
    counts = Counter(str(record["sourceType"]) for record in records)
    if dict(counts) != EXPECTED_SOURCE_COUNTS:
        raise ValueError(f"套装归团本后的来源统计异常: {dict(counts)}")
    return records


def load_trinket_effects(path: Path, records: list[dict[str, object]]) -> dict[int, dict[str, object]]:
    """读取并校验饰品效果 SSOT，所有饰品必须有明确的验证状态。"""
    report = read_json(path)
    if not isinstance(report, dict) or report.get("schemaVersion") != 1:
        raise ValueError(f"饰品效果报告 schema 异常: {path}")
    if report.get("gameBuild") != "12.1.0.69111":
        raise ValueError(f"饰品效果报告构建号异常: {report.get('gameBuild')!r}")
    result = report.get("result")
    rows = report.get("records")
    if not isinstance(result, dict) or not isinstance(rows, list):
        raise ValueError(f"饰品效果报告结构异常: {path}")
    expected_ids = {int(record["itemId"]) for record in records if record.get("slot") == "饰品"}
    if len(expected_ids) != 44 or result.get("trinketRecords") != 44 or result.get("effectRecords") != 43 or result.get("staticOnlyRecords") != 1 or result.get("unresolved") != 0:
        raise ValueError(f"饰品效果报告统计异常: {result}")
    output: dict[int, dict[str, object]] = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("itemId"), int):
            raise ValueError(f"饰品效果报告记录异常: {row!r}")
        item_id = int(row["itemId"])
        if item_id in output or item_id not in expected_ids:
            raise ValueError(f"饰品效果报告 itemId 重复或越界: {item_id}")
        effects = row.get("effects")
        static_only = row.get("staticOnly")
        if not isinstance(effects, list) or not isinstance(static_only, bool):
            raise ValueError(f"饰品效果字段异常 itemId={item_id}")
        texts: list[str] = []
        for effect in effects:
            if not isinstance(effect, dict) or not isinstance(effect.get("text"), str) or not effect["text"].strip():
                raise ValueError(f"饰品效果文本为空 itemId={item_id}")
            text = str(effect["text"]).strip()
            if "$" in text or re.search(r"[A-Za-z]", text):
                raise ValueError(f"饰品效果仍含未本地化字符 itemId={item_id} text={text!r}")
            texts.append(text)
        if static_only != (not bool(effects)):
            raise ValueError(f"饰品 staticOnly 与效果数量不一致 itemId={item_id}")
        output[item_id] = {
            "text": "\n\n".join(texts),
            "verified": True,
            "staticOnly": static_only,
        }
    if set(output) != expected_ids:
        missing = sorted(expected_ids.difference(output))
        extra = sorted(set(output).difference(expected_ids))
        raise ValueError(f"饰品效果报告覆盖不完整 missing={missing} extra={extra}")
    return output


def icon_path(icon_dir: Path, icon: str) -> Path:
    return icon_dir / f"{icon}.jpg"


def ensure_icon(icon: str, args: argparse.Namespace) -> dict[str, object]:
    destination = icon_path(args.icon_dir, icon)
    with ICON_LOCK:
        if destination.exists() and destination.stat().st_size > 32:
            payload = destination.read_bytes()
            return {"path": f"/loot-icons/{icon}.jpg", "bytes": len(payload), "sha256": sha256_bytes(payload), "cache": "hit"}
        url = WOWHEAD_ICON_URL.format(icon=icon)
        payload = fetch_bytes(url, timeout_seconds=args.timeout_seconds, retries=args.retries, sleep_seconds=args.sleep_seconds)
        if not payload.startswith(b"\xff\xd8"):
            raise ValueError(f"图标不是 JPEG icon={icon} url={url}")
        write_bytes(destination, payload)
        return {"path": f"/loot-icons/{icon}.jpg", "bytes": len(payload), "sha256": sha256_bytes(payload), "cache": "stored"}


def cache_path(cache_dir: Path, item_id: int) -> Path:
    return cache_dir / f"{item_id}.json"


def valid_cached_variant(cached: object, item_id: int, args: argparse.Namespace) -> bool:
    if not isinstance(cached, dict) or cached.get("schemaVersion") != CACHE_SCHEMA_VERSION or cached.get("itemId") != item_id:
        return False
    variant = cached.get("displayVariant")
    icon = cached.get("icon")
    if not isinstance(variant, dict) or not isinstance(icon, dict):
        return False
    if variant.get("verified") is not True or not isinstance(variant.get("stats"), list):
        return False
    icon_name = cached.get("iconName")
    if not isinstance(icon_name, str) or not icon_path(args.icon_dir, icon_name).exists():
        return False
    try:
        cached_selected_bonus(cached, item_id)
    except ValueError:
        return False
    return True


def cached_selected_bonus(cached: dict[str, object], item_id: int) -> tuple[str, list[int]]:
    evidence = cached.get("evidence")
    if not isinstance(evidence, dict):
        raise ValueError(f"缓存缺少 SSR 证据 itemId={item_id}")
    raw_bonus_ids = evidence.get("selectedBonusIds")
    if not isinstance(raw_bonus_ids, list):
        raise ValueError(f"缓存缺少已选择 SSR bonus itemId={item_id}")
    if not raw_bonus_ids:
        if evidence.get("selectedDefaultNoBonus") is True and evidence.get("ssrDefaultBonus") == "" and evidence.get("selectedBonusToken", "") == "":
            return "", []
        raise ValueError(f"缓存缺少已选择 SSR bonus itemId={item_id}")
    bonus_ids = [normalize_int(value, "selectedBonusIds") for value in raw_bonus_ids]
    if any(bonus_id <= 0 for bonus_id in bonus_ids):
        raise ValueError(f"缓存已选择 SSR bonus 非正整数 itemId={item_id}")
    derived_token = ":".join(str(bonus_id) for bonus_id in bonus_ids)
    token = evidence.get("selectedBonusToken", derived_token)
    if not isinstance(token, str) or token != derived_token:
        raise ValueError(f"缓存已选择 SSR bonus token 不一致 itemId={item_id}")
    return token, bonus_ids


def candidate_target_bonuses(bonus_option_ids: list[int], upgrades: dict[int, tuple[int, int, str]]) -> list[int]:
    return sorted(
        bonus
        for bonus in bonus_option_ids
        if upgrades.get(bonus) == (TARGET_VARIANT["rank"], TARGET_VARIANT["maxRank"], TARGET_VARIANT["track"])
    )


def fallback_candidate_bonuses(bonus_option_ids: list[int], upgrades: dict[int, tuple[int, int, str]]) -> list[int]:
    by_track: dict[str, list[tuple[int, int]]] = defaultdict(list)
    for bonus_id in bonus_option_ids:
        upgrade = upgrades.get(bonus_id)
        if upgrade is None:
            continue
        rank, max_rank, track = upgrade
        if rank > 0 and max_rank > 0 and rank <= max_rank:
            by_track[track].append((rank, bonus_id))
    selected: set[int] = set()
    for candidates in by_track.values():
        highest_rank = max(rank for rank, _ in candidates)
        selected.update(bonus_id for rank, bonus_id in candidates if rank == highest_rank)
    return sorted(selected)


def fetch_tooltip_candidate(item_id: int, bonus_token: str, args: argparse.Namespace) -> tuple[dict[str, object], str, bytes, dict[str, object], str]:
    if bonus_token and not re.fullmatch(r"\d+(?::\d+)*", bonus_token):
        raise ValueError(f"tooltip bonus 参数异常 itemId={item_id} bonus={bonus_token!r}")
    bonus_query = f"bonus={quote(bonus_token, safe=':')}&" if bonus_token else ""
    tooltip_url = WOWHEAD_TOOLTIP_URL.format(item_id=item_id, bonus_query=bonus_query)
    payload = fetch_bytes(tooltip_url, timeout_seconds=args.timeout_seconds, retries=args.retries, sleep_seconds=args.sleep_seconds)
    variant, icon, internal_json = parse_tooltip(payload, item_id)
    return variant, icon, payload, json.loads(internal_json), tooltip_url


def fetch_item_variant(record: dict[str, object], args: argparse.Namespace, upgrades: dict[int, tuple[int, int, str]]) -> dict[str, object]:
    item_id = normalize_int(record["itemId"], "itemId")
    page_url = WOWHEAD_PAGE_URL.format(item_id=item_id)
    log(f"item state=fetch-page itemId={item_id} url={page_url}")
    page_payload = fetch_page_bytes(page_url, timeout_seconds=args.timeout_seconds, retries=args.retries, sleep_seconds=args.sleep_seconds)
    page = parse_page(page_payload, item_id)
    bonus_option_ids = page["bonusOptionIds"]
    target_bonuses = candidate_target_bonuses(bonus_option_ids, upgrades)
    fallback_bonuses = fallback_candidate_bonuses(bonus_option_ids, upgrades)
    selected_variant: dict[str, object] | None = None
    selected_icon: str | None = None
    selected_tooltip_payload: bytes | None = None
    selected_bonus_token = ""
    selected_bonus_ids: list[int] = []
    selected_default_no_bonus = False
    selection_reason = ""
    attempts: dict[str, tuple[dict[str, object], str, bytes, dict[str, object], str]] = {}
    attempt_bonus_ids: dict[str, list[int]] = {}

    def make_attempt(bonus_token: str, bonus_ids: list[int]) -> dict[str, object]:
        existing_bonus_ids = attempt_bonus_ids.setdefault(bonus_token, list(bonus_ids))
        if existing_bonus_ids != bonus_ids:
            raise ValueError(f"同一 tooltip bonus token 映射不一致 itemId={item_id} bonus={bonus_token}")
        if bonus_token not in attempts:
            attempts[bonus_token] = fetch_tooltip_candidate(item_id, bonus_token, args)
        variant, _, payload, internal, _ = attempts[bonus_token]
        return {
            "bonusToken": bonus_token,
            "bonusIds": bonus_ids,
            "itemLevel": variant["itemLevel"],
            "rawTrack": internal["rawTrack"],
            "rank": variant["rank"],
            "maxRank": variant["maxRank"],
            "tooltipSha256": sha256_bytes(payload),
        }

    for bonus_id in target_bonuses:
        bonus_token = str(bonus_id)
        attempt = make_attempt(bonus_token, [bonus_id])
        variant, icon, payload, internal, tooltip_url = attempts[bonus_token]
        if (
            variant["itemLevel"] == TARGET_VARIANT["itemLevel"]
            and internal["rawTrack"] == TARGET_VARIANT["track"]
            and variant["rank"] == TARGET_VARIANT["rank"]
            and variant["maxRank"] == TARGET_VARIANT["maxRank"]
        ):
            selected_variant, selected_icon, selected_tooltip_payload = variant, icon, payload
            selected_bonus_token = bonus_token
            selected_bonus_ids = [bonus_id]
            selection_reason = "匹配 Wowhead PTR 页面 SSR bonusOptions 中的 Hero 1/6 物品等级 259"
            break

    if selected_variant is None:
        verified_candidates: list[tuple[dict[str, object], str, bytes, dict[str, object], str, int]] = []
        for bonus_id in fallback_bonuses:
            bonus_token = str(bonus_id)
            make_attempt(bonus_token, [bonus_id])
            variant, icon, payload, internal, candidate_url = attempts[bonus_token]
            if variant["rank"] > 0 and variant["rank"] <= variant["maxRank"]:
                verified_candidates.append((variant, icon, payload, internal, candidate_url, bonus_id))
        if verified_candidates:
            selected_variant, selected_icon, selected_tooltip_payload, internal, tooltip_url, selected_bonus_id = max(
                verified_candidates,
                key=lambda candidate: (candidate[0]["itemLevel"], candidate[0]["rank"], candidate[5]),
            )
            selected_bonus_token = str(selected_bonus_id)
            selected_bonus_ids = [selected_bonus_id]
            selection_reason = "目标 Hero 1/6 259 未出现；从同页 SSR bonusOptions 的可验证最高变体中选择"
        else:
            selected_bonus_token = str(page["defaultBonusToken"])
            selected_bonus_ids = list(page["defaultBonusIds"])
            make_attempt(selected_bonus_token, selected_bonus_ids)
            selected_variant, selected_icon, selected_tooltip_payload, internal, tooltip_url = attempts[selected_bonus_token]
            selected_default_no_bonus = selected_bonus_token == ""
            selection_reason = (
                "页面 SSR tooltip 明确 default bonus 为空；采用 SSR 默认无 bonus 的实际唯一变体"
                if selected_default_no_bonus
                else "页面 SSR bonusOptions 未提供可解析升级候选；采用 SSR tooltip default bonus 的实际变体"
            )
    else:
        _, _, _, internal, tooltip_url = attempts[selected_bonus_token]

    if selected_icon != page["icon"]:
        raise ValueError(f"页面与 tooltip 图标不一致 itemId={item_id} page={page['icon']} tooltip={selected_icon}")
    icon = ensure_icon(selected_icon, args)
    if selected_variant["icon"] != icon["path"]:
        raise ValueError(f"本地图标路径不一致 itemId={item_id}")
    cache_entry = {
        "schemaVersion": CACHE_SCHEMA_VERSION,
        "parserVersion": PARSER_VERSION,
        "itemId": item_id,
        "fetchedAt": args.access_date,
        "ssrRecheckedAt": args.access_date,
        "displayVariant": selected_variant,
        "iconName": selected_icon,
        "icon": icon,
        "evidence": {
            "pageUrl": page_url,
            "pageSha256": sha256_bytes(page_payload),
            "bonusTrees": page["bonusTrees"],
            "ssrBonusOptionIds": bonus_option_ids,
            "ssrDefaultBonus": page["defaultBonusToken"],
            "ssrDefaultBonusIds": page["defaultBonusIds"],
            "targetCandidateBonusIds": target_bonuses,
            "fallbackCandidateBonusIds": fallback_bonuses,
            "attempts": [make_attempt(bonus_token, attempt_bonus_ids[bonus_token]) for bonus_token in sorted(attempts)],
            "selectedTooltipUrl": tooltip_url,
            "selectedBonusToken": selected_bonus_token,
            "selectedBonusIds": selected_bonus_ids,
            "selectedDefaultNoBonus": selected_default_no_bonus,
            "selectedTooltipSha256": sha256_bytes(selected_tooltip_payload),
            "selectionReason": selection_reason,
            "selectedTooltipExcerpt": internal["plainTooltip"][:500],
            "statsParserVersion": PARSER_VERSION,
        },
    }
    write_json(cache_path(args.cache_dir, item_id), cache_entry)
    log(
        "item state=stored "
        f"itemId={item_id} itemLevel={selected_variant['itemLevel']} track={selected_variant['track']} "
        f"rank={selected_variant['rank']}/{selected_variant['maxRank']} icon={selected_variant['icon']}"
    )
    return cache_entry


def build_progress(
    args: argparse.Namespace,
    *,
    total: int,
    cached: int,
    completed: int,
    failures: list[dict[str, object]],
    blocked: bool = False,
    stale_refreshed: int = 0,
    ssr_rechecked: int = 0,
) -> None:
    write_json(args.progress_output, {
        "schemaVersion": 1,
        "updatedAt": args.access_date,
        "totalRecords": total,
        "cachedRecords": cached,
        "completedThisRun": completed,
        "remainingRecords": max(0, total - cached),
        "blocked": blocked,
        "staleRefreshed": stale_refreshed,
        "ssrRechecked": ssr_rechecked,
        "failures": failures,
    })


def refresh_cached_stats(
    stale_entries: dict[int, dict[str, object]],
    cached: dict[int, dict[str, object]],
    args: argparse.Namespace,
) -> tuple[int, list[dict[str, object]], bool]:
    refreshed = 0
    failures: list[dict[str, object]] = []
    for item_id in sorted(stale_entries):
        entry = copy.deepcopy(stale_entries[item_id])
        try:
            bonus_token, bonus_ids = cached_selected_bonus(entry, item_id)
            log(f"cache state=refresh-stats itemId={item_id} parserVersion={PARSER_VERSION} bonus={bonus_token}")
            variant, icon_name, payload, internal, tooltip_url = fetch_tooltip_candidate(item_id, bonus_token, args)
            if icon_name != entry.get("iconName"):
                raise ValueError(f"缓存与 tooltip 图标不一致 itemId={item_id} cache={entry.get('iconName')} tooltip={icon_name}")
            icon = ensure_icon(icon_name, args)
            evidence = entry.get("evidence")
            if not isinstance(evidence, dict):
                raise ValueError(f"缓存缺少 evidence itemId={item_id}")
            attempts = evidence.get("attempts")
            if not isinstance(attempts, list):
                attempts = []
            updated_attempt = {
                "bonusToken": bonus_token,
                "bonusIds": bonus_ids,
                "itemLevel": variant["itemLevel"],
                "rawTrack": internal["rawTrack"],
                "rank": variant["rank"],
                "maxRank": variant["maxRank"],
                "tooltipSha256": sha256_bytes(payload),
            }
            retained_attempts = [
                attempt
                for attempt in attempts
                if not isinstance(attempt, dict)
                or str(attempt.get("bonusToken", attempt.get("bonusId", ""))) != bonus_token
            ]
            retained_attempts.append(updated_attempt)
            evidence["attempts"] = retained_attempts
            evidence["selectedTooltipUrl"] = tooltip_url
            evidence["selectedBonusToken"] = bonus_token
            evidence["selectedBonusIds"] = bonus_ids
            evidence["selectedTooltipSha256"] = sha256_bytes(payload)
            evidence["selectedTooltipExcerpt"] = internal["plainTooltip"][:500]
            evidence["statsParserVersion"] = PARSER_VERSION
            entry["displayVariant"] = variant
            entry["icon"] = icon
            entry["parserVersion"] = PARSER_VERSION
            entry["statsRefreshedAt"] = args.access_date
            write_json(cache_path(args.cache_dir, item_id), entry)
            cached[item_id] = entry
            refreshed += 1
            log(
                "cache state=stats-refreshed "
                f"itemId={item_id} fields={len(variant['stats'])} itemLevel={variant['itemLevel']} "
                f"track={variant['track']} rank={variant['rank']}/{variant['maxRank']}"
            )
        except WowheadAccessBlockedError as error:
            failures.append({"itemId": item_id, "error": str(error)})
            log(f"cache state=refresh-blocked itemId={item_id} error={error}")
            return refreshed, failures, True
        except Exception as error:
            failures.append({"itemId": item_id, "error": str(error)})
            log(f"cache state=refresh-failed itemId={item_id} error={error}")
    return refreshed, failures, False


def collect_cache(
    records: list[dict[str, object]],
    args: argparse.Namespace,
) -> tuple[dict[int, dict[str, object]], list[dict[str, object]], dict[int, dict[str, object]]]:
    cached: dict[int, dict[str, object]] = {}
    recheck_pending: list[dict[str, object]] = []
    new_pending: list[dict[str, object]] = []
    stale_entries: dict[int, dict[str, object]] = {}
    for record in records:
        item_id = normalize_int(record["itemId"], "itemId")
        path = cache_path(args.cache_dir, item_id)
        if path.exists() and not args.refresh:
            candidate = read_json(path)
            if valid_cached_variant(candidate, item_id, args):
                if candidate.get("parserVersion") == PARSER_VERSION:
                    cached[item_id] = candidate
                else:
                    stale_entries[item_id] = candidate
                continue
        (recheck_pending if path.exists() else new_pending).append(record)
    return cached, recheck_pending + new_pending, stale_entries


def validate_variant(variant: object, item_id: int) -> None:
    if not isinstance(variant, dict):
        raise ValueError(f"displayVariant 缺失 itemId={item_id}")
    if not isinstance(variant.get("itemLevel"), int) or variant["itemLevel"] <= 0:
        raise ValueError(f"itemLevel 异常 itemId={item_id}")
    if not isinstance(variant.get("track"), str) or not variant["track"].strip():
        raise ValueError(f"track 为空 itemId={item_id}")
    if not isinstance(variant.get("rank"), int) or not isinstance(variant.get("maxRank"), int):
        raise ValueError(f"rank 类型异常 itemId={item_id}")
    if variant["rank"] < 0 or variant["maxRank"] < 0 or variant["rank"] > variant["maxRank"]:
        raise ValueError(f"rank 范围异常 itemId={item_id}")
    if not isinstance(variant.get("stats"), list):
        raise ValueError(f"stats 类型异常 itemId={item_id}")
    for stat in variant["stats"]:
        if not isinstance(stat, dict) or not isinstance(stat.get("label"), str) or not stat["label"].strip() or not isinstance(stat.get("value"), (int, float)):
            raise ValueError(f"stats 字段异常 itemId={item_id} stat={stat!r}")
    if not isinstance(variant.get("icon"), str) or not variant["icon"].startswith("/loot-icons/"):
        raise ValueError(f"icon 路径异常 itemId={item_id}")
    if variant.get("verified") is not True:
        raise ValueError(f"variant 未验证 itemId={item_id}")


def main() -> int:
    global LOG_OUTPUT
    args = parse_args()
    if args.workers <= 0 or args.limit < 0 or args.retries <= 0:
        raise ValueError("workers、limit、retries 的参数范围错误")
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    args.icon_dir.mkdir(parents=True, exist_ok=True)
    LOG_OUTPUT = args.log_output
    log(f"run state=start input={args.input.name} workers={args.workers} sleepSeconds={args.sleep_seconds} refresh={args.refresh}")
    audit = load_or_create_audit(args)
    records = validate_audit(audit)
    trinket_effects = load_trinket_effects(args.trinket_effects_report, records)
    log(f"trinketEffects state=validated records={len(trinket_effects)} report={args.trinket_effects_report}")
    upgrades, bonus_index = load_upgrade_index(args)
    cached, pending, stale_entries = collect_cache(records, args)
    completed = 0
    failures: list[dict[str, object]] = []
    blocked = False
    stale_refreshed = 0
    ssr_rechecked = 0
    if stale_entries:
        refreshed, refresh_failures, blocked = refresh_cached_stats(stale_entries, cached, args)
        stale_refreshed = refreshed
        completed += refreshed
        failures.extend(refresh_failures)
    requested = [] if blocked else (pending if args.limit == 0 else pending[:args.limit])
    pending_ssr_rechecks = sum(cache_path(args.cache_dir, normalize_int(record["itemId"], "itemId")).exists() for record in pending)
    log(
        "progress state=start "
        f"total={len(records)} cacheHits={len(cached)} staleStats={len(stale_entries)} "
        f"staleRefreshed={stale_refreshed} pending={len(pending)} pendingSsrRechecks={pending_ssr_rechecks} "
        f"requested={len(requested)} workers={args.workers} blocked={blocked}"
    )
    if requested:
        with ThreadPoolExecutor(max_workers=args.workers, thread_name_prefix="wowhead-loot") as executor:
            requested_iter = iter(requested)
            futures: dict[object, int] = {}

            def submit_next() -> bool:
                try:
                    record = next(requested_iter)
                except StopIteration:
                    return False
                item_id = normalize_int(record["itemId"], "itemId")
                futures[executor.submit(fetch_item_variant, record, args, upgrades)] = item_id
                return True

            for _ in range(args.workers):
                if not submit_next():
                    break
            while futures:
                done, _ = wait(futures, return_when=FIRST_COMPLETED)
                for future in done:
                    item_id = futures.pop(future)
                    try:
                        entry = future.result()
                        cached[item_id] = entry
                        completed += 1
                        ssr_rechecked += 1
                    except WowheadAccessBlockedError as error:
                        failures.append({"itemId": item_id, "error": str(error)})
                        blocked = True
                        log(f"run state=blocked itemId={item_id} error={error}")
                    except Exception as error:  # 每条非访问拒绝失败都落进 progress/unresolved，保留其余缓存供续跑。
                        failures.append({"itemId": item_id, "error": str(error)})
                        log(f"item state=failed itemId={item_id} error={error}")
                    build_progress(
                        args,
                        total=len(records),
                        cached=len(cached),
                        completed=completed,
                        failures=failures,
                        blocked=blocked,
                        stale_refreshed=stale_refreshed,
                        ssr_rechecked=ssr_rechecked,
                    )
                    log(
                        "progress state=update "
                        f"completed={completed} cached={len(cached)} total={len(records)} failures={len(failures)} "
                        f"blocked={blocked} staleRefreshed={stale_refreshed} ssrRechecked={ssr_rechecked}"
                    )
                if blocked:
                    for pending_future in futures:
                        pending_future.cancel()
                    log(f"run state=stopped reason=wowhead-403 queuedCancelled={len(futures)}")
                    break
                for _ in done:
                    if not submit_next():
                        break

    # 并发中的在途成功项会自行原子写入缓存；访问拒绝后重新扫描，令进度准确反映已落盘事实。
    if blocked:
        cached, _, _ = collect_cache(records, args)
    missing_ids = [normalize_int(record["itemId"], "itemId") for record in records if normalize_int(record["itemId"], "itemId") not in cached]
    if failures or missing_ids:
        unresolved = failures + [{"itemId": item_id, "error": "未完成缓存；请使用相同命令继续运行"} for item_id in missing_ids if item_id not in {entry.get("itemId") for entry in failures}]
        write_json(args.unresolved_output, unresolved)
        build_progress(
            args,
            total=len(records),
            cached=len(cached),
            completed=completed,
            failures=failures,
            blocked=blocked,
            stale_refreshed=stale_refreshed,
            ssr_rechecked=ssr_rechecked,
        )
        log(f"progress state=incomplete cached={len(cached)} missing={len(missing_ids)} failures={len(failures)}")
        return 2

    published: list[dict[str, object]] = []
    report_rows: list[dict[str, object]] = []
    for record in records:
        item_id = normalize_int(record["itemId"], "itemId")
        entry = cached[item_id]
        if entry.get("parserVersion") != PARSER_VERSION:
            raise ValueError(f"缓存属性解析版本过旧 itemId={item_id}")
        variant = entry["displayVariant"]
        validate_variant(variant, item_id)
        output = copy.deepcopy(record)
        output["displayVariant"] = copy.deepcopy(variant)
        if output.get("slot") == "饰品":
            output["trinketEffect"] = copy.deepcopy(trinket_effects[item_id])
        if "attributes" in output:
            raise ValueError(f"公开输出残留 attributes itemId={item_id}")
        published.append(output)
        report_row = {
            "itemId": item_id,
            "key": output["key"],
            "displayVariant": variant,
            "evidence": entry["evidence"],
            "icon": entry["icon"],
        }
        if output.get("slot") == "饰品":
            report_row["trinketEffect"] = output["trinketEffect"]
        report_rows.append(report_row)

    if len(published) != EXPECTED_RECORDS or len({record["itemId"] for record in published}) != EXPECTED_RECORDS or len({record["key"] for record in published}) != EXPECTED_RECORDS:
        raise AssertionError("577 条发布记录的 itemId 或稳定键不完整/重复")
    if any(not record["name"] or not record["classes"] or not record["instance"] for record in published):
        raise AssertionError("发布记录存在空中文名、职业或来源")
    invalid_monk_daggers = [record for record in published if record["equipmentType"] == "匕首" and "武僧" in record["classes"]]
    if invalid_monk_daggers:
        raise AssertionError(f"武僧职业筛选仍包含匕首 itemIds={[record['itemId'] for record in invalid_monk_daggers]}")
    source_counts = {source_type: sum(record["sourceType"] == source_type for record in published) for source_type in SOURCE_TYPE_ORDER}
    if source_counts != EXPECTED_SOURCE_COUNTS:
        raise AssertionError(f"发布记录来源统计异常: {source_counts}")
    set_records = [record for record in published if record["trace"]["rawRoute"] == "套装"]
    priest_set_records = [record for record in set_records if "牧师" in record["classes"]]
    if len(set_records) != 117 or len(priest_set_records) != 9 or any(record["sourceType"] != "团本" or record["instance"] != "套装" or record["boss"] is not None for record in set_records):
        raise AssertionError("套装归团本的来源/牧师断言失败")
    icon_names = {entry["iconName"] for entry in cached.values()}
    if any(not icon_path(args.icon_dir, icon).exists() for icon in icon_names):
        raise AssertionError("存在未下载的本地图标")
    stale_refreshed_total = sum(isinstance(entry.get("statsRefreshedAt"), str) for entry in cached.values())
    ssr_rechecked_total = sum(isinstance(entry.get("ssrRecheckedAt"), str) for entry in cached.values())

    exact_target_records = [record for record in published if record["displayVariant"]["itemLevel"] == 259 and record["displayVariant"]["track"] == "英雄" and record["displayVariant"]["rank"] == 1 and record["displayVariant"]["maxRank"] == 6]
    present_classes = {class_name for record in published for class_name in record["classes"]}
    present_slots = {str(record["slot"]) for record in published}
    unknown_classes = present_classes.difference(CLASS_ORDER)
    unknown_slots = present_slots.difference(SLOT_ORDER)
    if unknown_classes or unknown_slots:
        raise AssertionError(f"元数据筛选枚举出现未知值 classes={sorted(unknown_classes)} slots={sorted(unknown_slots)}")
    metadata = {
        "schemaVersion": SCHEMA_VERSION,
        "gameVersion": "12.1",
        "dataUpdated": args.access_date,
        "attribution": "数据整理参考：12.1 DropSheet (by Ango)",
        "input": {**audit["input"], "auditReport": str(args.audit_output), "trinketEffectsReport": str(args.trinket_effects_report)},
        "sources": [
            *audit.get("upstreamSources", []),
            {"name": "Wowhead PTR item pages", "urlTemplate": WOWHEAD_PAGE_URL, "accessedAt": args.access_date, "purpose": "验证 item bonus tree"},
            {"name": "Wowhead PTR tooltip endpoint", "urlTemplate": WOWHEAD_TOOLTIP_URL, "accessedAt": args.access_date, "purpose": "实际物等、升级轨道、数值属性与图标名"},
            {"name": "Wowhead icon CDN", "urlTemplate": WOWHEAD_ICON_URL, "accessedAt": args.access_date, "purpose": "下载公开本地图标"},
            {"name": "Blizzard 武僧职业资料", "url": "https://worldofwarcraft.blizzard.com/zh-cn/game/classes/monk", "accessedAt": args.access_date, "purpose": "校验武僧可用武器"},
        ],
        "filters": {
            "sourceTypes": list(SOURCE_TYPE_ORDER),
            "classes": [class_name for class_name in CLASS_ORDER if class_name in present_classes],
            "slots": [slot for slot in SLOT_ORDER if slot in present_slots],
        },
        "displayVariant": {
            "target": {"itemLevel": 259, "track": "英雄", "rank": 1, "maxRank": 6},
            "contract": {"itemLevel": "number", "track": "string", "rank": "number", "maxRank": "number", "stats": "Array<{label:string,value:number}>", "icon": "string", "verified": "boolean"},
        },
        "quality": {
            "sourceCategoryCounts": source_counts,
            "setRecordsReclassifiedToRaid": len(set_records),
            "priestSetRecordsInRaid": len(priest_set_records),
            "verifiedRecords": len(published),
            "targetMatchedRecords": len(exact_target_records),
            "fallbackRecords": len(published) - len(exact_target_records),
            "iconAssets": len(icon_names),
            "upgradeIndexSha256": bonus_index["sha256"],
            "parserVersion": PARSER_VERSION,
            "staleRefreshed": stale_refreshed_total,
            "ssrRechecked": ssr_rechecked_total,
            "trinketEffectRecords": sum(bool(record.get("trinketEffect", {}).get("text")) for record in published),
            "trinketStaticOnlyRecords": sum(bool(record.get("trinketEffect", {}).get("staticOnly")) for record in published),
            "weaponClassCorrections": sum(record["equipmentType"] == "匕首" for record in published),
        },
        "result": {"resolvedRows": EXPECTED_RECORDS, "unresolvedRows": 0, "duplicateRows": 0, "publishedRecords": len(published)},
    }
    report = {
        "schemaVersion": 1,
        "target": metadata["displayVariant"]["target"],
        "result": {"records": len(report_rows), "verifiedRecords": len(report_rows), "targetMatchedRecords": len(exact_target_records)},
        "records": report_rows,
    }
    write_json(args.output, published)
    write_json(args.meta_output, metadata)
    write_json(args.variant_report_output, report)
    write_json(args.unresolved_output, [])
    build_progress(
        args,
        total=len(records),
        cached=len(cached),
        completed=completed,
        failures=[],
        stale_refreshed=stale_refreshed,
        ssr_rechecked=ssr_rechecked,
    )
    log(
        f"result state=published records={len(published)} unresolved=0 duplicates=0 "
        f"targetMatched={len(exact_target_records)} fallback={len(published) - len(exact_target_records)} icons={len(icon_names)} "
        f"staleRefreshed={stale_refreshed_total} ssrRechecked={ssr_rechecked_total}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
