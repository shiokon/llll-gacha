# -*- coding: utf-8 -*-
"""Join master data into site/data/db.js"""
import json, os, re, sys
from collections import Counter, defaultdict

import yaml
try:
    Loader = yaml.CSafeLoader
except AttributeError:
    Loader = yaml.SafeLoader

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # folder holding site/ and masterdata/
MD = os.path.join(BASE, "masterdata")
SITE = os.path.join(BASE, "site")
ASSETS = os.path.join(SITE, "assets")

def yload(name):
    with open(os.path.join(MD, name), encoding="utf-8") as f:
        return yaml.load(f, Loader=Loader)

def jload(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)

def disk_ids(sub, ext=".webp"):
    d = os.path.join(ASSETS, sub)
    if not os.path.isdir(d):
        return set()
    return {os.path.splitext(f)[0] for f in os.listdir(d)
            if f.endswith(ext) and "@" not in f}

full_ids   = {int(x) for x in disk_ids("full")}
thumb_ids  = {int(x) for x in disk_ids("thumb")}
icon_ids   = {int(x) for x in disk_ids("icon")}
banner_ids = {int(x) for x in disk_ids("banner")}
pack_ids   = {int(x) for x in disk_ids("pack")}
chibi_ids  = {int(x) for x in disk_ids("chibi")}
jacket_ids = {int(x) for x in disk_ids("jacket")}
live_ids   = {int(x) for x in disk_ids("live", ".m4a")}
ost_files  = disk_ids("ost", ".m4a")
voice_files = sorted(disk_ids("voice", ".m4a"))
mvo_chars  = {int(m.group(1)) for v in voice_files
              if (m := re.match(r"m(\d+)_clear1_0001$", v))}

live_meta = {}
lm_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "live_meta.json")
if os.path.exists(lm_path):
    with open(lm_path, encoding="utf-8") as f:
        live_meta = json.load(f)

print("disk:", len(full_ids), "full,", len(thumb_ids), "thumb,", len(voice_files), "voice")

cards_raw = jload("CardDatas.json")
rarities = {r["Id"]: r["RarityName"] for r in jload("CardRarities.json")}
skills_raw = jload("CardSkills.json")
skillseries_raw = jload("CardSkillSeries.json")

card_series = {s["Id"]: s for s in yload("CardSeries.yaml")}
characters = yload("Characters.yaml")
units = yload("Units.yaml")
unit_chars = yload("UnitCharacters.yaml")
gacha_series = yload("GachaSeries.yaml")
musics = yload("Musics.yaml")
center_skills = yload("CenterSkills.yaml")
center_attrs = yload("CenterAttributes.yaml")

# ---- skills lookup -----------------------------------------------------------
ss_meta = {s["Id"]: s for s in skillseries_raw}          # series id -> name/icon
best_skill = {}                                          # series id -> max-level row
for s in skills_raw:
    k = s["CardSkillSeriesId"]
    if k not in best_skill or s["SkillLevel"] > best_skill[k]["SkillLevel"]:
        best_skill[k] = s

def skill_info(series_id):
    m = ss_meta.get(series_id)
    b = best_skill.get(series_id)
    if not m or not b:
        return None
    icon = m.get("SkillIcon", 0)
    return {
        "n": m["Name"],
        "d": b["Description"],
        "lv": b["SkillLevel"],
        "cost": b.get("SkillCost", 0),
        "i": icon if icon in icon_ids else 0,
    }

cs_best = {}
for s in center_skills:
    k = s["CenterSkillSeriesId"]
    if k not in cs_best or s["SkillLevel"] > cs_best[k]["SkillLevel"]:
        cs_best[k] = s

ca_first = {}
for a in center_attrs:
    k = a["CenterAttributeSeriesId"]
    if k not in ca_first:
        ca_first[k] = a

# ---- voice clips per series ----------------------------------------------------
voice_by_series = defaultdict(list)
for v in voice_files:
    m = re.match(r"(\d+)_([a-z]+)_(\d+)$", v)
    if m:
        voice_by_series[int(m.group(1))].append(v)

# ---- characters (needed first to resolve sticker member names) ------------------
unit_names = {u["Id"]: u["UnitName"] for u in units}
units_of_char = defaultdict(list)
for uc in unit_chars:
    if uc["UnitsId"] in (101, 102, 103, 105):
        units_of_char[uc["CharactersId"]].append(uc["UnitsId"])

chars_out = {}
for ch in characters:
    cid = ch["Id"]
    full = ch.get("DisplayFullName") or ""
    if ch.get("NameDisplayType") == 1 and full:
        nm, en = full, ch.get("LatinAlpabetFullName", "")
    else:
        nm = f'{ch.get("NameLast","")} {ch.get("NameFirst","")}'.strip()
        en = f'{ch.get("LatinAlphabetNameFirst","")} {ch.get("LatinAlphabetNameLast","")}'.strip()
    chars_out[cid] = {
        "n": nm, "en": en,
        "cv": ch.get("CharacterVoice", ""),
        "col": ch.get("ThemeColor", "#888888"),
        "gen": ch.get("DisplayGeneration", ""),
        "units": units_of_char.get(cid, []),
        "intro": (ch.get("Introduction") or "").strip(),
        "chibi": 0,
    }

# ---- cards ---------------------------------------------------------------------
# GROUND TRUTH: card unlock stickers. Sticker Id = trueSeriesId*10+variant,
# RequirementValue = trueSeriesId, Name = "[cardName]memberName".
# CardDatas.json's CardSeriesId column is a sliding catalog (each card's evo-0
# row is filed under the previous card's id), so identity CANNOT come from it.
# Gameplay rows are instead matched by (card name, character).
stickers = yload("Stickers.yaml")
spat = re.compile(r"^\[(.+)\]\s*(.+)$")
true_cards = {}                                   # trueSid -> (cardName, memberName)
for s in stickers:
    if s.get("RequirementType") == 5 and isinstance(s.get("RequirementValue"), int):
        m = spat.match(s.get("Name") or "")
        if m:
            true_cards.setdefault(s["RequirementValue"], (m.group(1).strip(), m.group(2).strip()))
print("sticker card identities:", len(true_cards))

norm = lambda t: re.sub(r"[\s　\xa0]+", "", t or "")
name2char = {norm(v["n"]): k for k, v in chars_out.items()}

rows_by_nc = defaultdict(list)                    # (normName, charId) -> rows
rows_by_n = defaultdict(list)                     # normName -> rows
for r in cards_raw:
    if r["Name"] and "？？？" not in r["Name"]:
        rows_by_nc[(norm(r["Name"]), r["CharactersId"])].append(r)
        rows_by_n[norm(r["Name"])].append(r)

def make_entry(sid, name, rows, cid):
    rows = sorted(rows, key=lambda r: r["EvolveTimes"])
    r0, rN = rows[0], rows[-1]
    rar = rN["Rarity"]
    if rar in (7, 8, 9):                          # LR/DR/BR have a single art
        arts = [a for a in (sid*10+1, sid*10, sid*10+2) if a in full_ids][:1]
    else:
        arts = [a for a in (sid*10, sid*10+1) if a in full_ids]
        if not arts and sid*10+2 in full_ids:
            arts = [sid*10+2]
    if not arts:
        return None
    thumbs = ([a for a in arts if a in thumb_ids]
              or [a for a in (sid*10, sid*10+1, sid*10+2) if a in thumb_ids])
    entry = {
        "s": sid, "n": name, "c": cid, "r": rar,
        "st": rN["Style"], "md": rN["Mood"],
        "arts": arts, "th": thumbs[0] if thumbs else arts[0],
        "stat": [r0["InitialSmile"], r0["InitialPure"], r0["InitialCool"], r0["InitialMental"],
                 rN["MaxSmile"], rN["MaxPure"], rN["MaxCool"], rN["MaxMental"]],
        "bp": rN["BeatPoint"],
        # CardSeries.Id IS the sticker/true id space — key by sid directly.
        # (Its EvolutionXId columns are formulaic Id*10+stage and the CardDatas
        # rows AT those ids belong to the catalog-next card, so never join
        # through them for identity.) LimitedType: 1-4 = spring/summer/autumn/
        # winter 期間限定, 5 = graduation, 9 = birthday, 11 = PARTY!,
        # 101 = non-gacha reward, 201-204 = collabs — labels live in util.js.
        "lt": card_series.get(sid, {}).get("LimitedType", 0),
        "o": min(r["OrderId"] for r in rows),
        "evo": len(rows) - 1,
    }
    ap = skill_info(rN["SpecialAppealSeriesId"]) or skill_info(r0["SpecialAppealSeriesId"])
    sk = skill_info(rN["SkillSeriesId"]) or skill_info(r0["SkillSeriesId"])
    if ap: entry["ap"] = ap
    if sk: entry["sk"] = sk
    csid = rN.get("CenterSkillSeriesId", 0)
    if csid and csid in cs_best:
        b = cs_best[csid]
        entry["cs"] = {"n": b["CenterSkillName"], "d": b["Description"], "lv": b["SkillLevel"]}
    caid = rN.get("CenterAttributeSeriesId", 0)
    if caid and caid in ca_first:
        a = ca_first[caid]
        entry["ca"] = {"n": a["CenterAttributeName"], "d": a["Description"]}
    if sid in voice_by_series:
        entry["vo"] = voice_by_series[sid]
    elif cid in mvo_chars:
        entry["mvo"] = cid          # m-rarity cards use per-character line banks
    if sid in chibi_ids:
        entry["chibi"] = 1
    return entry

cards_out = []
used_bases = set()
unmatched_rows = sticker_no_art = 0
for sid, (nm, member) in sorted(true_cards.items()):
    cid = name2char.get(norm(member), 0)
    rows = rows_by_nc.get((norm(nm), cid)) if cid else None
    if not rows:
        rows = rows_by_n.get(norm(nm))
        if rows:
            cnt = Counter(r["CharactersId"] for r in rows)
            cid = cnt.most_common(1)[0][0]
            rows = [r for r in rows if r["CharactersId"] == cid]
    if not rows:
        unmatched_rows += 1
        continue
    e = make_entry(sid, nm, rows, cid)
    if e is None:
        sticker_no_art += 1
        continue
    cards_out.append(e)
    used_bases.add(sid)

# art bases on disk that no sticker names yet: best-effort via CardDatas grouping
leftover = 0
disk_bases = {a // 10 for a in full_ids}
for base in sorted(disk_bases - used_bases):
    rows = [r for r in cards_raw
            if r["CardSeriesId"] == base and r["Name"] and "？？？" not in r["Name"]]
    if not rows:
        continue
    rows.sort(key=lambda r: r["EvolveTimes"])
    ident = rows[-1]
    own = [r for r in rows if r["Name"] == ident["Name"]]
    e = make_entry(base, ident["Name"], own, ident["CharactersId"])
    if e:
        cards_out.append(e)
        leftover += 1

cards_out.sort(key=lambda e: (e["o"], e["s"]))
print(f"cards: {len(cards_out)} (sticker-keyed {len(used_bases)}, leftover {leftover}, "
      f"name-unmatched {unmatched_rows}, sticker-without-art {sticker_no_art})")

# sanity assertions from user-reported examples
def _check(sid, want_name):
    e = next((e for e in cards_out if e["s"] == sid), None)
    got = e["n"] if e else "(missing)"
    flag = "OK " if got == want_name else "FAIL"
    print(f"  {flag} {sid} -> {got} (want {want_name})")
print("verify:")
_check(1042524, "アイシイ")
_check(1021515, "蓮ノ空歌留多")
_check(1011501, "蓮ノ空女学院スクールアイドルクラブ101期生")
_check(1021802, "Ether Aria")
_check(1021901, "18th Birthday")

series_in_db = {e["s"] for e in cards_out}

# ---- chibi assignment ------------------------------------------------------------
chibi_of_char = {}
for e in cards_out:
    if e.get("chibi") and e["c"] not in chibi_of_char:
        chibi_of_char[e["c"]] = e["s"]
for cid, ch in chars_out.items():
    ch["chibi"] = chibi_of_char.get(cid, 0)

# synthesize characters referenced by cards but missing from Characters.yaml
for cid in sorted({e["c"] for e in cards_out}):
    if cid in chars_out:
        continue
    name = next((r["Description"] for r in cards_raw
                 if r["CharactersId"] == cid and r["Description"] and "？？？" not in r["Description"]),
                f"キャラクター{cid}")
    chars_out[cid] = {"n": name.replace("\xa0", " "), "en": "", "cv": "",
                      "col": "#b5a8c9", "gen": "", "units": [], "intro": "",
                      "chibi": chibi_of_char.get(cid, 0)}
    print("synthesized character:", cid, name)

# ---- banners ----------------------------------------------------------------------
# birthday banners land here a day behind what's actually shown in-game, so bump
# just those forward by 1 (other banner types are correct as sourced)
def plus_one_day(raw):
    s = str(raw)[:10]
    if not s:
        return s
    from datetime import date, timedelta
    y, m, d = map(int, s.split("-"))
    return (date(y, m, d) + timedelta(days=1)).isoformat()

banners_out = []
for g in gacha_series:
    gid = g["Id"]
    if gid not in banner_ids:
        continue
    picks = []
    for i in range(1, 7):
        p = g.get(f"PickUpCardSeriesId_{i}", 0)
        if p and p in series_in_db:
            picks.append(p)
    name = g.get("GachaSeriesName", "")
    is_birthday = "BIRTHDAY" in name.upper()
    date_fn = plus_one_day if is_birthday else (lambda raw: str(raw)[:10])
    banners_out.append({
        "id": gid,
        "n": name,
        "type": g.get("GachaType", 0),
        "start": date_fn(g.get("StartTime", "")),
        "end": date_fn(g.get("EndTime", "")),
        "picks": picks,
        "pack": 1 if gid in pack_ids else 0,
        "bgm": g.get("GachaStartBgm", 0),
    })
# reruns keep the banner name but re-declare GachaStartBgm as 0
# (e.g. 2025 PARTY! 1050307 vs 1050418) — share the theme across same-name banners
bgm_by_name = {b["n"]: b["bgm"] for b in banners_out if b["bgm"]}
for b in banners_out:
    if not b["bgm"] and b["n"] in bgm_by_name:
        b["bgm"] = bgm_by_name[b["n"]]
banners_out.sort(key=lambda b: b["start"], reverse=True)
print("banners:", len(banners_out), "| with picks:", sum(1 for b in banners_out if b["picks"]))

# ---- musics ------------------------------------------------------------------------
# full-length audio only (no previews are shipped); songs without a rhythm-game
# chart are dropped after the chart pass below
musics_out = []
for m in musics:
    jid, sndid = m.get("JacketId", 0), m.get("SoundId", 0)
    if sndid not in live_ids:
        continue
    musics_out.append({
        "id": m["Id"],
        "t": m.get("Title", ""),
        "fu": m.get("TitleFurigana", ""),
        "j": jid if jid in jacket_ids else 0,
        "snd": sndid,
        "u": m.get("UnitId", 0),
        "gen": m.get("GenerationsId", 0),
        "ctr": m.get("CenterCharacterId", 0),
        "sing": [int(x) for x in str(m.get("SingerCharacterId", "")).split(",") if x.strip().isdigit()],
        "desc": m.get("Description", ""),
        "o": m.get("OrderId", 0),
        "full": 1,
    })
    bpm = live_meta.get(str(sndid), {}).get("bpm", 0)
    if bpm:
        musics_out[-1]["bpm"] = bpm
# dedupe by sound id (multiple music entries can share audio)
seen = set()
musics_dedup = []
for m in sorted(musics_out, key=lambda x: x["o"]):
    if m["snd"] in seen:
        continue
    seen.add(m["snd"])
    musics_dedup.append(m)
print("musics:", len(musics_dedup))

# ---- rhythm game charts (rhythmgame_chart_{musicId}_{01..04}.bytes) ----------------
# Each file is raw-deflate (zlib wbits=-15) JSON: {Notes, Bpms, Offset, Beats}.
# Note.Flags = left<<16 | right<<4 | type on a 0..59 bar (4 keys x 15).
# type: 0=tap 2/3=flick 1=hold. Hold L/R are scaled x65.
#
# A type-1 row's `holds` list = waypoint TIMES; the LAST one is that row's
# release. Slides are emitted as ~49-98ms sample rows that tile: one row's
# release == the next row's just — but the source has ~µs formatting jitter
# (e.g. 3.552632 vs 3.552634), so links need a tolerance, never exact
# equality. TWO rules decide where one hold NOTE ends and the next begins
# (consecutive separate holds tile in time exactly like slide samples do):
#   1. a multi-element row is a static ticked tail (score ticks + release)
#      and TERMINATES its note — never chain out of it;
#   2. slide samples move <= ~6 lanes per step, while back-to-back separate
#      notes jump sides (e.g. 38 lanes) — reject candidates >12 lanes away.
# Same-time candidates (side-by-side double slides) pick the nearest left
# edge. Finally, the source sometimes layers 2-3 duplicate copies of a note
# ~1ms apart — superposed copies get deduped (kept, they demand impossible
# re-presses on keys).
import bisect
import zlib
DIFF_NAMES = {1: "NORMAL", 2: "HARD", 3: "EXPERT", 4: "MASTER"}
LINK_TOL = 5e-4

def _span_at(pts, t):
    if t <= pts[0][0]: return pts[0][1], pts[0][2]
    for a, b in zip(pts, pts[1:]):
        if a[0] <= t <= b[0]:
            f = 0 if b[0] == a[0] else (t - a[0]) / (b[0] - a[0])
            return a[1] + (b[1]-a[1])*f, a[2] + (b[2]-a[2])*f
    return pts[-1][1], pts[-1][2]

def _dedupe_holds(holds):
    """drop the shorter of any pair tracing the same lanes (<=1.5 on both
       edges) over >=60% of the shorter one's life; true doubles/gathers
       differ by >=3 lanes and survive"""
    drop = set()
    for i in range(len(holds)):
        if i in drop: continue
        for j in range(i+1, len(holds)):
            if j in drop: continue
            a, b = holds[i], holds[j]
            t0 = max(a[0][0], b[0][0]); t1 = min(a[-1][0], b[-1][0])
            short = min(a[-1][0]-a[0][0], b[-1][0]-b[0][0])
            if short <= 0 or (t1 - t0) < 0.6 * short: continue
            if all(abs(x-y) <= 1.5
                   for k in range(7)
                   for (x, y) in zip(*(_span_at(p, t0 + (t1-t0)*k/6) for p in (a, b)))):
                drop.add(j if (b[-1][0]-b[0][0]) <= (a[-1][0]-a[0][0]) else i)
                if i in drop: break
    return [h for k, h in enumerate(holds) if k not in drop]

def _build_holds(notes):
    segs = sorted((n for n in notes if n["Flags"] & 15 == 1), key=lambda n: float(n["just"]))
    starts = [float(n["just"]) for n in segs]
    consumed, out = set(), []
    for head in segs:
        if id(head) in consumed:
            continue
        pts, cur = [], head
        consumed.add(id(cur))
        while True:
            fl = cur["Flags"]
            curL = fl >> 16
            pts.append([round(float(cur["just"]), 3),
                        round(curL / 65, 2),
                        round(((fl & 0xFFFF) >> 4) / 65, 2)])
            rel = float(cur["holds"][-1]) if cur["holds"] else float(cur["just"])
            if len(cur["holds"] or []) != 1:   # ticked tail = note end
                if rel > pts[-1][0]:
                    pts.append([round(rel, 3), pts[-1][1], pts[-1][2]])
                break
            lo = bisect.bisect_left(starts, rel - LINK_TOL)
            cands = []
            for k in range(lo, len(starts)):
                if starts[k] > rel + LINK_TOL:
                    break
                c = segs[k]
                if id(c) not in consumed and abs((c["Flags"] >> 16) - curL) / 65 <= 12:
                    cands.append(c)
            if not cands:
                if rel > pts[-1][0]:
                    pts.append([round(rel, 3), pts[-1][1], pts[-1][2]])
                break
            nxt = min(cands, key=lambda c: abs((c["Flags"] >> 16) - curL))
            consumed.add(id(nxt)); cur = nxt
        # collapse knots <12ms apart (1-2ms duplicate-row hops leave
        # near-vertical micro-kinks in the ribbon); the head keeps its
        # press timing, the tail keeps the release
        clean = [pts[0]]
        for p in pts[1:]:
            if p[0] - clean[-1][0] >= 0.012:
                clean.append(p)
            elif len(clean) > 1:
                clean[-1] = p
        out.append(clean if len(clean) >= 2 else pts)
    out.sort(key=lambda p: p[0][0])
    return _dedupe_holds(out)
charts_dir = os.path.join(SITE, "data", "charts")
os.makedirs(charts_dir, exist_ok=True)
plain_dir = os.path.join(BASE, "plain")
chart_files = defaultdict(dict)
for f in os.listdir(plain_dir):
    m = re.match(r"rhythmgame_chart_(\d+)_(\d+)\.bytes$", f)
    if m and int(m.group(2)) in DIFF_NAMES:
        chart_files[int(m.group(1))][int(m.group(2))] = f

music_by_id = {m["id"]: m for m in musics_dedup}
n_chart_songs = tap_dupes = 0
for mid, dmap in sorted(chart_files.items()):
    mu = music_by_id.get(mid)
    if not mu or not mu.get("full"):
        continue
    song, counts = {}, {}
    for dnum, fn in sorted(dmap.items()):
        cj = json.loads(zlib.decompress(open(os.path.join(plain_dir, fn), "rb").read(), -15))
        taps = []
        for n in cj["Notes"]:
            fl = n["Flags"]; typ = fl & 15
            if typ != 1:
                taps.append([round(float(n["just"]), 3), fl >> 16, (fl & 0xFFFF) >> 4, typ])
        taps.sort(key=lambda x: x[0])
        # layered-duplicate artifact affects taps too: same lanes a few ms apart
        dd = []
        for tp in taps:
            if any(abs(q[0]-tp[0]) <= 0.005 and q[1] == tp[1] and q[2] == tp[2] for q in dd[-8:]):
                tap_dupes += 1; continue
            dd.append(tp)
        taps = dd
        holds = _build_holds(cj["Notes"])
        song[DIFF_NAMES[dnum]] = {"taps": taps, "holds": holds}
        counts[DIFF_NAMES[dnum]] = len(taps) + len(holds)
    with open(os.path.join(charts_dir, f"{mid}.js"), "w", encoding="utf-8") as f:
        f.write(f"window.CHARTS=window.CHARTS||{{}};window.CHARTS[{mid}]=")
        json.dump(song, f, separators=(",", ":"))
        f.write(";")
    mu["chart"] = counts
    n_chart_songs += 1
print("charts:", n_chart_songs, "songs | duplicate taps removed:", tap_dupes)
# jukebox == live catalog: ship only songs that ended up with a chart
musics_dedup = [m for m in musics_dedup if m.get("chart")]
print("musics kept (full + chart):", len(musics_dedup))

# ---- OST sound test (plain/offlinebgms.tsv — binary columnar master table) ---------
# layout: da 00 00 | varint header_len | varint rows | varint cols |
#         cols x (u32 name-hash, u32 type: 0x20=varint, 0x10=cstring) | column data
def decode_bin_tsv(path):
    b = open(path, "rb").read()
    assert b[:3] == b"\xda\x00\x00"
    o = 3
    def vint(o):
        v = sh = 0
        while True:
            x = b[o]; o += 1
            v |= (x & 0x7F) << sh
            if not x & 0x80: return v, o
            sh += 7
    _, o = vint(o); rows, o = vint(o); cols, o = vint(o)
    types = []
    for _ in range(cols):
        types.append(int.from_bytes(b[o+4:o+8], "big")); o += 8
    data = []
    for t in types:
        col = []
        for _ in range(rows):
            if t == 0x20:
                v, o = vint(o)
            else:
                e = b.index(0, o); v = b[o:e].decode("utf-8"); o = e + 1
            col.append(v)
        data.append(col)
    return list(zip(*data))

ost_out = []
obgm = os.path.join(BASE, "plain", "offlinebgms.tsv")
if os.path.exists(obgm):
    for oid, lon, loff, title, cat in decode_bin_tsv(obgm):
        if loff in ost_files:
            ost_out.append({"id": oid, "f": loff, "t": title, "cat": cat.strip("　 ")})
print("ost tracks:", len(ost_out))

db = {
    "cards": cards_out,
    "chars": chars_out,
    "units": unit_names,
    "rarities": rarities,
    "banners": banners_out,
    "musics": musics_dedup,
    "ost": ost_out,
}

os.makedirs(os.path.join(SITE, "data"), exist_ok=True)
out = os.path.join(SITE, "data", "db.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("window.DB=")
    json.dump(db, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")
print("wrote", out, f"{os.path.getsize(out)/1024:.0f} KB")

# quick sanity dump
for e in cards_out[:2]:
    print(json.dumps(e, ensure_ascii=False)[:300])
rc = defaultdict(int)
for e in cards_out:
    rc[rarities[e['r']]] += 1
print("by rarity:", dict(rc))
