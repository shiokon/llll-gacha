# -*- coding: utf-8 -*-
"""Extract card art + UI textures from assetbundles and convert to webp."""
import os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

_TOOLS = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(_TOOLS)
_BASE = os.path.dirname(SITE)          # folder holding site/ and plain/
_EXT = os.path.dirname(_BASE)          # folder holding AssetStudio / ffmpeg
PLAIN = os.path.join(_BASE, "plain")
SCRATCH = os.path.join(_TOOLS, "imgwork")
CLI = os.path.join(_EXT, "AssetStudio", "AssetStudio.CLI.exe")
FFMPEG = os.path.join(_EXT, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe")

# group -> (filename prefix, out subdir, webp quality, parallel CLI chunks)
GROUPS = [
    ("image_card_full_",            "full",   82, 6),
    ("image_card_middle_vertical_", "thumb",  80, 6),
    ("icon_skill_",                 "icon",   90, 4),
    ("image_gacha_banner_",         "banner", 85, 2),
    ("image_gacha_pack_full_",      "pack",   85, 2),
    ("image_deck_frame_chara_",     "chibi",  90, 2),
    ("image_music_thumbnail_",      "jacket", 85, 2),
]

def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a)

def run_group(prefix, sub, quality, chunks):
    t0 = time.time()
    files = [f for f in os.listdir(PLAIN)
             if f.startswith(prefix) and f.endswith(".assetbundle")]
    log(f"{sub}: {len(files)} bundles")
    outdir = os.path.join(SITE, "assets", sub)
    os.makedirs(outdir, exist_ok=True)

    # skip whole group if done already
    have = {os.path.splitext(f)[0] for f in os.listdir(outdir)}
    todo = [f for f in files if f[len(prefix):].split(".")[0] not in have]
    if not todo:
        log(f"{sub}: already complete, skipping")
        return
    files = todo

    # stage into N chunk dirs
    stage_dirs, png_dirs = [], []
    for i in range(chunks):
        sd = os.path.join(SCRATCH, f"{sub}_st{i}")
        pd = os.path.join(SCRATCH, f"{sub}_png{i}")
        shutil.rmtree(sd, ignore_errors=True)
        shutil.rmtree(pd, ignore_errors=True)
        os.makedirs(sd); os.makedirs(pd)
        stage_dirs.append(sd); png_dirs.append(pd)
    for n, f in enumerate(files):
        shutil.copy2(os.path.join(PLAIN, f), stage_dirs[n % chunks])
    log(f"{sub}: staged into {chunks} chunks")

    def cli(i):
        subprocess.run(
            [CLI, stage_dirs[i], png_dirs[i], "--game", "Normal",
             "--types", "Texture2D", "--group_assets", "None", "--silent"],
            capture_output=True)
    with ThreadPoolExecutor(chunks) as ex:
        list(ex.map(cli, range(chunks)))
    pngs = []
    for pd in png_dirs:
        pngs += [os.path.join(pd, f) for f in os.listdir(pd) if f.endswith(".png")]
    log(f"{sub}: {len(pngs)} png exported in {time.time()-t0:.0f}s, converting to webp q{quality}")

    def conv(p):
        name = os.path.splitext(os.path.basename(p))[0]
        m = re.match(re.escape(prefix) + r"(.+)$", name)
        ident = m.group(1) if m else name
        out = os.path.join(outdir, ident + ".webp")
        r = subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-i", p,
             "-c:v", "libwebp", "-quality", str(quality),
             "-compression_level", "4", out],
            capture_output=True)
        if r.returncode != 0:
            log("FFMPEG FAIL", p, r.stderr.decode(errors="replace")[:200])
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(conv, pngs))
    n_out = len(os.listdir(outdir))
    log(f"{sub}: DONE -> {n_out} webp in {time.time()-t0:.0f}s total")

    for d in stage_dirs + png_dirs:
        shutil.rmtree(d, ignore_errors=True)

if __name__ == "__main__":
    os.makedirs(SCRATCH, exist_ok=True)
    for g in GROUPS:
        run_group(*g)
    log("ALL IMAGE GROUPS COMPLETE")
