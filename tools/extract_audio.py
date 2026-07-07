# -*- coding: utf-8 -*-
"""Extract voice/BGM/SE from CRI ACB/AWB via vgmstream, encode to m4a."""
import os, re, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)

_TOOLS = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(_TOOLS)
_BASE = os.path.dirname(SITE)          # folder holding site/ and plain/
_EXT = os.path.dirname(_BASE)          # folder holding vgmstream / ffmpeg
PLAIN = os.path.join(_BASE, "plain")
SCRATCH = os.path.join(_TOOLS, "audwork")
VGM = os.path.join(_EXT, "vgmstream-win64", "vgmstream-cli.exe")
FFMPEG = os.path.join(_EXT, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe")

def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a)

def ensure(d):
    os.makedirs(d, exist_ok=True)
    return d

def encode(wav, out, bitrate):
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", wav,
                        "-c:a", "aac", "-b:a", bitrate, out], capture_output=True)
    if r.returncode != 0:
        log("FFMPEG FAIL", wav, r.stderr.decode(errors="replace")[:200])
    return r.returncode == 0

def extract_acb_all(src, wavdir):
    """Extract all subsongs of an acb/awb to wavdir, named by stream name."""
    r = subprocess.run([VGM, "-S", "0", "-o", os.path.join(wavdir, "?n.wav"), src],
                       capture_output=True)
    return r.returncode == 0

# ---- 1) gacha SE + gacha bgm -------------------------------------------------
def do_se():
    outdir = ensure(os.path.join(SITE, "assets", "se"))
    wavdir = ensure(os.path.join(SCRATCH, "se_wav"))
    extract_acb_all(os.path.join(PLAIN, "gacha.acb"), wavdir)
    for b in ["bgm_gacha_home_0001", "bgm_gacha_start_0001", "bgm_gacha_result_0001"]:
        extract_acb_all(os.path.join(PLAIN, b + ".acb"), wavdir)
    for w in os.listdir(wavdir):
        name = os.path.splitext(w)[0]
        encode(os.path.join(wavdir, w), os.path.join(outdir, name + ".m4a"), "96k")
    log("SE/gacha-bgm done:", len(os.listdir(outdir)))
    shutil.rmtree(wavdir, ignore_errors=True)

# ---- 2) card voices ----------------------------------------------------------
def do_voices():
    outdir = ensure(os.path.join(SITE, "assets", "voice"))
    acbs = [f for f in os.listdir(PLAIN) if re.match(r"vo_card_\d+\.acb$", f)]
    log("voice acbs:", len(acbs))
    have = {os.path.splitext(f)[0] for f in os.listdir(outdir)}

    def work(acb):
        base = os.path.splitext(acb)[0]          # vo_card_1021301
        wavdir = os.path.join(SCRATCH, "vw_" + base)
        try:
            os.makedirs(wavdir, exist_ok=True)
            if not extract_acb_all(os.path.join(PLAIN, acb), wavdir):
                log("VGM FAIL", acb)
                return
            for w in os.listdir(wavdir):
                name = os.path.splitext(w)[0]            # vo_card_1021301_gacha_0001
                short = name.replace("vo_card_", "")     # 1021301_gacha_0001
                if short in have:
                    continue
                encode(os.path.join(wavdir, w), os.path.join(outdir, short + ".m4a"), "64k")
        finally:
            shutil.rmtree(wavdir, ignore_errors=True)

    with ThreadPoolExecutor(10) as ex:
        list(ex.map(work, acbs))
    log("voices done:", len(os.listdir(outdir)))

# ---- 3) bgm previews ---------------------------------------------------------
def do_previews():
    outdir = ensure(os.path.join(SITE, "assets", "bgm"))
    awbs = [f for f in os.listdir(PLAIN) if re.match(r"bgm_preview_\d+\.awb$", f)]
    log("preview awbs:", len(awbs))
    have = {os.path.splitext(f)[0] for f in os.listdir(outdir)}

    def work(awb):
        sid = re.match(r"bgm_preview_(\d+)\.awb", awb).group(1)
        if sid in have:
            return
        wav = os.path.join(SCRATCH, f"pv_{sid}.wav")
        r = subprocess.run([VGM, "-o", wav, os.path.join(PLAIN, awb)], capture_output=True)
        if r.returncode == 0:
            encode(wav, os.path.join(outdir, sid + ".m4a"), "128k")
        else:
            log("VGM FAIL", awb)
        if os.path.exists(wav):
            os.remove(wav)

    with ThreadPoolExecutor(10) as ex:
        list(ex.map(work, awbs))
    log("previews done:", len(os.listdir(outdir)))

if __name__ == "__main__":
    ensure(SCRATCH)
    do_se()
    do_voices()
    do_previews()
    log("ALL AUDIO COMPLETE")
