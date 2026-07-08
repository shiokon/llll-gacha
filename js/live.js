/* ═══ live.js — スクールアイドルショウ (rhythm game) ═══
   Real game charts from rhythmgame_chart_{musicId}_{01..04}.bytes
   (raw-deflate JSON, converted to data/charts/{musicId}.js by build_data.py).
   Notes live on a continuous 0..59 bar split into 4 key zones (D/F/J/K):
   pink taps, green flicks (a tap counts), blue holds incl. sliding polylines.
   Full songs from bgm_live_*.acb, judgement SEs from rhythm.acb. */
"use strict";

const LiveStage = {
  diff:"NORMAL",
  DIFFS:{
    NORMAL: {label:"NORMAL",  col:"#7fd4f0"},
    HARD:   {label:"HARD",    col:"#ffd066"},
    EXPERT: {label:"EXPERT",  col:"#ff8fa3"},
    MASTER: {label:"MASTER",  col:"#b48cff"},
  },
  menuAudio:null,

  speed(){ return State.lgSpeed || 2; },
  approach(){ return 2.8 / this.speed(); },

  appealOf(c){ return c.stat[4] + c.stat[5] + c.stat[6] + Math.round(c.stat[7]/2); },

  UNIT_SIZE:6,
  SUPPORT_PCT:.06,          /* each owned card outside the main 6 lends this slice of its appeal */

  /* resolve the current unit → 6 card objects (guests fill empty slots) */
  unitCards(){
    const owned = DB.cards.filter(c => State.owned[c.s]);
    let unit = (State.liveUnit || []).map(s => CARD_BY_S[s]).filter(c => c && State.owned[c.s]);
    if(unit.length < this.UNIT_SIZE){
      const rest = owned.filter(c => !unit.includes(c))
        .sort((a,b) => this.appealOf(b) - this.appealOf(a));
      unit = unit.concat(rest.slice(0, this.UNIT_SIZE - unit.length));
    }
    if(unit.length < this.UNIT_SIZE){
      const guests = DB.cards.filter(c => c.r === 3 && !unit.includes(c)).slice(0, this.UNIT_SIZE - unit.length);
      guests.forEach(g => g._guest = true);
      unit = unit.concat(guests);
    }
    return unit.slice(0, this.UNIT_SIZE);
  },
  /* main 6 count in full; every other owned card kicks in a small % of its
     appeal too, so growing the whole collection keeps paying off */
  supportAppeal(unit){
    const inUnit = new Set(unit.map(c => c.s));
    return DB.cards.filter(c => State.owned[c.s] && !inUnit.has(c.s))
      .reduce((s,c) => s + this.appealOf(c) * this.SUPPORT_PCT, 0);
  },
  unitAppeal(unit){
    const main = unit.reduce((s,c) => s + Math.round(this.appealOf(c) * (c._guest ? .5 : 1)), 0);
    return Math.round(main + this.supportAppeal(unit));
  },

  render(root){
    const songs = DB.musics.filter(m => m.full && m.chart);
    this.playMenuBgm();

    const unitRow = h("div",{class:"ls-unit"});
    const drawUnit = () => {
      const u = this.unitCards();
      const support = Math.round(this.supportAppeal(u));
      unitRow.replaceChildren(
        h("div",{class:"ls-unit-cards"},
          u.map(c => h("div",{class:"ls-ucard", title:c.n, onclick:() => this.unitPicker(drawUnit)},
            h("img",{src:IMG.thumb(c.th)}),
            c._guest ? h("span",{class:"ls-guest"},"GUEST") : null,
          ))),
        h("div",{class:"ls-unit-meta"},
          h("div",{class:"ls-appeal"},t("live.appeal"), h("b", this.unitAppeal(u).toLocaleString())),
          support ? h("small",{class:"ls-support"},t("live.support", support.toLocaleString())) : null,
          h("button",{class:"chip", onclick:() => this.unitPicker(drawUnit)},t("live.edit")),
        ),
      );
    };
    drawUnit();

    /* note scroll speed control */
    const spdVal = h("b", this.speed().toFixed(1));
    const setSpeed = d => {
      State.lgSpeed = Math.min(8, Math.max(1, this.speed() + d));
      State.save();
      spdVal.textContent = this.speed().toFixed(1);
    };
    const speedCtl = h("div",{class:"ls-speed"},
      h("span",t("live.speed")),
      h("button",{class:"chip", onclick:() => setSpeed(-.5)},"−"),
      spdVal,
      h("button",{class:"chip", onclick:() => setSpeed(+.5)},"＋"),
    );

    const diffRow = h("div",{class:"ls-diffs"});
    const grid = h("div",{class:"ls-grid"});
    const drawDiffs = () => {
      diffRow.replaceChildren(...Object.entries(this.DIFFS).map(([k,d]) =>
        h("button",{class:"ls-diff" + (this.diff === k ? " on" : ""), style:`--dc:${d.col}`,
          onclick:() => { this.diff = k; drawDiffs(); drawGrid(); }}, d.label)));
    };
    const drawGrid = () => {
      grid.replaceChildren(...songs.map(m => {
        const notes = m.chart[this.diff];
        const best = State.live[m.snd + "_" + this.diff];
        const uc = UNIT_C[m.u] || "#9aa3c7";
        return h("div",{class:"ls-song" + (notes ? "" : " off"), style:`--uc:${uc}`,
          onclick:() => {
            if(!notes) return;
            this.stopMenuBgm();
            LiveGame.start(m, this.unitCards(), this.diff);
          }},
          m.j ? h("img",{src:IMG.jacket(m.j), loading:"lazy"})
              : h("div",{class:"ls-nojacket"},"♪"),
          best ? h("div",{class:"ls-rank r" + best.rank}, best.rank) : null,
          best && best.fc ? h("div",{class:"ls-fc"},"FC") : null,
          h("div",{class:"ls-song-meta"},
            h("div",{class:"ls-song-t"}, m.t),
            h("div",{class:"ls-song-s"},
              (DB.units[m.u] || "") + "　♩=" + m.bpm + (notes ? "　♪" + notes : "")),
          ),
        );
      }));
    };
    drawDiffs(); drawGrid();

    /* lifetime stats: every best score across all songs and difficulties */
    const played = Object.entries(State.live).map(([k, v]) => {
      const us = k.lastIndexOf("_");
      const m = DB.musics.find(x => x.snd === +k.slice(0, us));
      return m ? {m, df: k.slice(us + 1), ...v} : null;
    }).filter(Boolean);
    let statsEl = null;
    if(played.length){
      const total = played.reduce((s, p) => s + p.sc, 0);
      const top = [...played].sort((a, b) => b.sc - a.sc).slice(0, 3);
      statsEl = h("div",{class:"ls-stats"},
        h("div",{class:"ls-stat-total"},
          h("span",t("live.totalScore")),
          h("b", total.toLocaleString()),
          h("small",t("live.cleared", played.length))),
        h("div",{class:"ls-stat-top"},
          top.map((p, i) => h("div",{class:"ls-top-row"},
            h("span",{class:"ls-top-no"}, ["1st","2nd","3rd"][i]),
            h("span",{class:"ls-top-t"}, p.m.t),
            h("span",{class:"ls-top-d", style:`color:${(this.DIFFS[p.df]||{}).col||"#9aa3c7"}`}, p.df),
            h("span",{class:"ls-top-s"}, p.sc.toLocaleString()),
          ))),
      );
    }

    root.append(...[
      h("div",{class:"section-title"},t("live.title"),
        h("small",t("live.small", songs.length))),
      statsEl,
      h("div",{class:"ls-head"},
        unitRow,
        h("div",{class:"ls-side"},
          speedCtl,
          h("div",{class:"ls-help"}, h("div",t("live.help")), h("div",t("live.helpSp"))),
        ),
      ),
      diffRow, grid,
    ].filter(Boolean));
  },

  unitPicker(onDone){
    const owned = DB.cards.filter(c => State.owned[c.s])
      .sort((a,b) => this.appealOf(b) - this.appealOf(a));
    if(!owned.length){ toast(t("live.needCards")); return; }
    let sel = this.unitCards().filter(c => !c._guest).map(c => c.s);
    const ov = h("div",{class:"ls-picker-ov", onclick:e => { if(e.target === ov) close(); }});
    const gridEl = h("div",{class:"ls-picker-grid"});
    const cnt = h("b", String(sel.length));
    const draw = () => {
      cnt.textContent = sel.length;
      gridEl.replaceChildren(...owned.map(c =>
        h("div",{class:"ls-pick" + (sel.includes(c.s) ? " on" : ""), onclick:() => {
            if(sel.includes(c.s)) sel = sel.filter(s => s !== c.s);
            else { if(sel.length >= this.UNIT_SIZE) sel.shift(); sel.push(c.s); }
            draw();
          }},
          h("img",{src:IMG.thumb(c.th), loading:"lazy"}),
          h("span",{class:"ls-pick-ap"}, this.appealOf(c).toLocaleString()),
        )));
    };
    const close = () => {
      if(sel.length){ State.liveUnit = sel; State.save(); }
      ov.remove(); onDone && onDone();
    };
    draw();
    ov.append(h("div",{class:"ls-picker"},
      h("div",{class:"ls-picker-head"},t("live.pickerPre"), cnt, t("live.pickerPost"),
        h("button",{class:"chip", style:"margin-left:auto", onclick:close},t("live.done"))),
      gridEl,
    ));
    document.body.append(ov);
  },

  playMenuBgm(){
    if(this.menuAudio && !this.menuAudio.paused) return;
    if(!State.bgmOn) return;
    Audio_.stopBgm(true);
    const a = new Audio(AUD.se("bgm_soundtest_rhythm_menu_0001_loopoff"));
    a.loop = true; a.volume = .3;
    a.play().catch(()=>{});
    this.menuAudio = a;
  },
  stopMenuBgm(){
    if(this.menuAudio){ this.menuAudio.pause(); this.menuAudio = null; }
  },
  leave(){ this.stopMenuBgm(); },
};

/* ───────── the game engine ───────── */
const LiveGame = {
  active:false,

  loadChart(mid){
    if(window.CHARTS && window.CHARTS[mid]) return Promise.resolve(window.CHARTS[mid]);
    return new Promise(res => {
      const s = document.createElement("script");
      s.src = `data/charts/${mid}.js`;
      s.onload = s.onerror = () => { s.remove(); res(window.CHARTS && window.CHARTS[mid]); };
      document.head.append(s);
    });
  },

  async start(m, unit, diffKey){
    if(this.active) return;
    this.active = true;
    const D = LiveStage.DIFFS[diffKey];
    const appeal = LiveStage.unitAppeal(unit);
    Audio_.stopBgm(true);

    const chartData = await this.loadChart(m.id);
    const ch = chartData && chartData[diffKey];
    if(!ch){
      toast(t("live.noChart"));
      this.active = false;
      return;
    }

    /* overlay */
    const jacketUrl = m.j ? IMG.jacket(m.j) : "";
    const ov = h("div",{class:"lg-ov"},
      jacketUrl ? h("div",{class:"lg-bg", style:`background-image:url(${jacketUrl})`}) : null,
      h("div",{class:"lg-veil"}),
    );
    const scoreEl = h("div",{class:"lg-score"},"0");
    const progEl = h("i");
    ov.append(
      h("div",{class:"lg-top"},
        h("div",{class:"lg-songtitle"},
          jacketUrl ? h("img",{src:jacketUrl}) : null,
          h("span", m.t), h("small"," " + D.label)),
        h("div",{class:"lg-prog"}, progEl),
        scoreEl,
      ),
    );
    const cv = h("canvas",{class:"lg-cv"});
    ov.append(cv);
    const LANES = 6, ZW = 60 / LANES;          /* 6 key zones of 10 bar-units */
    const zones = h("div",{class:"lg-zones"},
      Array.from({length:LANES}, () => h("div",{class:"lg-zone"})));
    ov.append(zones);
    const spFill = h("i");
    const spBtn = h("button",{class:"lg-sp"}, h("div",{class:"lg-sp-bar"}, spFill), h("span","SPECIAL"));
    ov.append(
      h("div",{class:"lg-bottom"},
        h("div",{class:"lg-unit"},
          unit.map(c => h("img",{src:IMG.thumb(c.th), title:c.n}))),
        spBtn,
        h("button",{class:"lg-quit", title:t("live.quit")},"✕"),
      ),
    );
    document.body.append(ov);

    /* audio */
    const song = new Audio(AUD.live(m.snd));
    song.volume = .8;
    await new Promise(res => {
      song.addEventListener("canplaythrough", res, {once:true});
      song.addEventListener("error", res, {once:true});
      setTimeout(res, 5000);
      song.load();
    });
    if(!this.active || !document.body.contains(ov)) return;
    const dur = song.duration && isFinite(song.duration) ? song.duration : 150;

    /* build notes from the real chart.
       taps: [t, l, r, type(0 tap / 2|3 flick)]
       holds: [[t,l,r],...,[endT,l,r]] waypoint polylines */
    const taps = ch.taps.map(a => ({t:a[0], l:a[1], r:a[2], k:a[3], hit:0}));
    const holds = ch.holds.map(p => ({
      pts:p, t:p[0][0], l:p[0][1], r:p[0][2],
      end:p[p.length-1][0], el:p[p.length-1][1], er:p[p.length-1][2],
      k:1, hit:0, tailHit:0,
    }));
    const notes = [...taps, ...holds].sort((a,b) => a.t - b.t);
    const chartEnd = Math.max(...notes.map(n => n.end || n.t), 0);

    /* game state */
    const G = {
      notes, holds, idx:0, combo:0, maxCombo:0, judged:0,
      counts:{PERFECT:0, GREAT:0, GOOD:0, MISS:0},
      weight:0, totalWeight:taps.length + holds.length * 1.5,
      base:0, score:0, sp:0, feverUntil:0, pulses:[], texts:[],
      held:new Array(LANES).fill(false), done:false,
    };
    /* scoring: an all-PERFECT run earns exactly 1,000,000 base points,
       then multipliers — chart difficulty (note density; the data ships no
       level values) and unit appeal (main 6 + a slice of the rest of the
       collection, see LiveStage.unitAppeal) — scale it. Combo never affects
       score. Misses are penalized by RATE, not raw count: a flat per-miss
       penalty would let dense MASTER charts (hundreds of notes) shrug off
       far more misses than a sparse NORMAL chart before it shows up as a
       percentage of the score, letting sloppy hard-chart runs out-score
       clean easy-chart ones purely from note-count dilution. */
    const chartSpan = Math.max(1, chartEnd - (notes.length ? notes[0].t : 0));
    const diffMul = 1 + notes.length / chartSpan * .18;   /* NORMAL ≈×1.2 … MASTER ≈×2.3 */
    const appealMul = 1 + appeal / 250000;                /* stacked collection ≈×3-4 */
    const missMul = () => Math.exp(-3 * G.counts.MISS / notes.length);
    /* SPECIAL gauge fills a fixed amount per note hit (not per % of the
       chart), so it's charged by real elapsed time at the chart's note
       rate — denser charts (HARD/EXPERT/MASTER) genuinely fill it faster
       and earn more ×1.5 fever windows per song than sparse ones. */
    const SP_HITS_NEEDED = 60;
    const OFFSET = .045;
    const APPR = LiveStage.approach();
    let clockBase = 0, useAudioClock = true;
    const now = () => useAudioClock && !song.paused && song.currentTime > 0
      ? song.currentTime - OFFSET
      : (performance.now() - clockBase) / 1000;

    const NCOL = {tap:"#ff9ec6", hold:"#7fd4f0", flick:"#8ee5c0", trace:"#ffd066"};
    const JUDGE = [
      {n:"PERFECT", w:1,   win:.055, col:"#ffd97a", se:"se_rhythm_tap_perfect_0001"},
      {n:"GREAT",   w:.97, win:.105, col:"#8fd8ff", se:"se_rhythm_tap_great_0001"},
      {n:"GOOD",    w:.90, win:.155, col:"#b9c2d8", se:"se_rhythm_tap_good_0001"},
    ];
    const overlaps = (n, z0, z1) => n.r >= z0 - .5 && n.l <= z1 + .5;

    const updateScore = () => {
      G.score = G.base * missMul() * diffMul * appealMul;
      scoreEl.textContent = Math.round(G.score).toLocaleString();
    };
    const addScore = w => {
      const fever = now() < G.feverUntil ? 1.5 : 1;
      G.base += 1000000 * (w / G.totalWeight) * fever;
      updateScore();
    };
    const judgeText = j => G.texts.push({t:performance.now(), n:j.n, col:j.col});

    const registerHit = (n, j, lane) => {
      n.hit = j.n;
      G.counts[j.n]++; G.judged++;
      G.combo++; G.maxCombo = Math.max(G.maxCombo, G.combo);
      G.weight += j.w;
      G.sp = Math.min(1, G.sp + 1 / SP_HITS_NEEDED);
      spFill.style.width = G.sp * 100 + "%";
      spBtn.classList.toggle("ready", G.sp >= 1);
      addScore(j.w);
      judgeText(j);
      G.pulses.push({t:performance.now(), lane});
    };

    /* sustained hold SE: starts on head hit, follows the key, stops on release */
    const holdSnd = hd => {
      if(!State.seOn || hd.au) return;
      const a = new Audio(AUD.se("se_rhythm_hold_0001"));
      a.loop = true; a.volume = .4;
      a.play().catch(()=>{});
      hd.au = a;
    };
    const stopHoldSnd = hd => {
      if(hd.au){ hd.au.pause(); hd.au = null; }
    };

    const judge = (lane, tNow) => {
      const z0 = lane * ZW, z1 = z0 + ZW;
      let best = null, bestDt = 9;
      for(let i = G.idx; i < G.notes.length; i++){
        const n = G.notes[i];
        if(n.t - tNow > .16) break;
        if(n.hit || n.k === 3 || !overlaps(n, z0, z1)) continue;
        const dt = Math.abs(n.t - tNow);
        if(dt < bestDt){ best = n; bestDt = dt; }
      }
      if(!best || bestDt > JUDGE[2].win){
        Audio_.se("se_rhythm_touch_0001", .18);
        return;
      }
      const j = JUDGE.find(j => bestDt <= j.win);
      registerHit(best, j, lane);
      Audio_.se(best.k === 2 ? "se_rhythm_flick_0001" : j.se, .85);
      if(best.k === 1) holdSnd(best);
    };

    const heldSpanOverlap = (lo, hi) => {
      for(let l = 0; l < LANES; l++)
        if(G.held[l] && hi >= l * ZW - .5 && lo <= l * ZW + ZW + .5) return true;
      return false;
    };
    const laneOfSpan = (lo, hi) =>
      Math.max(0, Math.min(LANES - 1, Math.round((lo + hi) / 2 / ZW - .5)));

    const missSweep = tNow => {
      for(let i = G.idx; i < G.notes.length; i++){
        const n = G.notes[i];
        if(n.t - tNow > .04) break;
        if(n.hit) continue;
        if(n.k === 3){
          /* trace note: no tap needed — hits while a key over it is held */
          if(tNow >= n.t - .033 && heldSpanOverlap(n.l, n.r)){
            registerHit(n, JUDGE[0], laneOfSpan(n.l, n.r));
            Audio_.se("se_rhythm_trace_0001", .6);
          } else if(tNow - n.t > .12){
            n.hit = "MISS";
            G.counts.MISS++; G.judged++; G.combo = 0;
            updateScore();
            judgeText({n:"MISS", col:"#ff7d95"});
          }
        } else if(tNow - n.t > .16){
          n.hit = "MISS";
          G.counts.MISS++; G.judged++; G.combo = 0;
          updateScore();
          judgeText({n:"MISS", col:"#ff7d95"});
          if(n.k === 1) stopHoldSnd(n);
        }
      }
      while(G.idx < G.notes.length){
        const n = G.notes[G.idx];
        if((n.end || n.t) - tNow > -.2) break;
        G.idx++;
      }
      /* holds: sustain SE follows the key; tails resolve at release time */
      for(const hd of G.holds){
        if(!hd.hit || hd.hit === "MISS") continue;
        if(hd.tailHit){ stopHoldSnd(hd); continue; }
        if(tNow < hd.end){
          if(hd.au){
            const [cl, cr] = holdAt(hd.pts, tNow);
            const on = heldSpanOverlap(cl, cr);
            if(on && hd.au.paused) hd.au.play().catch(()=>{});
            else if(!on && !hd.au.paused) hd.au.pause();
          }
          continue;
        }
        stopHoldSnd(hd);
        if(heldSpanOverlap(hd.el, hd.er)){
          hd.tailHit = 1; G.weight += .5; addScore(.5);
        } else {
          hd.tailHit = -1; G.combo = 0;
        }
      }
    };

    /* special appeal (fever) */
    const fireSp = () => {
      if(G.sp < 1) return;
      G.sp = 0; spFill.style.width = "0%"; spBtn.classList.remove("ready");
      G.feverUntil = now() + 8;
      ov.classList.add("fever");
      setTimeout(() => ov.classList.remove("fever"), 8000);
      Audio_.se("se_rhythm_slide_0001", .5);
      const c = unit[Math.random() * unit.length | 0];
      const cut = h("div",{class:"lg-cutin"},
        h("img",{src:IMG.full(c.arts[c.arts.length - 1])}),
        h("span","SPECIAL APPEAL!"));
      ov.append(cut);
      setTimeout(() => cut.remove(), 2200);
    };
    spBtn.onclick = fireSp;

    /* input */
    const KEYMAP = {s:0, d:1, f:2, j:3, k:4, l:5, S:0, D:1, F:2, J:3, K:4, L:5};
    const onKey = e => {
      if(e.key === "Escape"){ quit(); return; }
      if(e.repeat) return;
      if(e.key === " "){ e.preventDefault(); fireSp(); return; }
      const l = KEYMAP[e.key];
      if(l === undefined) return;
      G.held[l] = true;
      zones.children[l].classList.add("on");
      judge(l, now());
    };
    const onKeyUp = e => {
      const l = KEYMAP[e.key];
      if(l === undefined) return;
      G.held[l] = false;
      zones.children[l].classList.remove("on");
    };
    addEventListener("keydown", onKey);
    addEventListener("keyup", onKeyUp);
    [...zones.children].forEach((z, l) => {
      z.addEventListener("pointerdown", e => {
        e.preventDefault();
        G.held[l] = true; z.classList.add("on");
        judge(l, now());
      });
      const off = () => { G.held[l] = false; z.classList.remove("on"); };
      z.addEventListener("pointerup", off);
      z.addEventListener("pointerleave", off);
    });
    ov.querySelector(".lg-quit").onclick = () => quit();

    /* canvas — one continuous 0..59 bar with 4 key zones */
    const ctx = cv.getContext("2d");
    let W, H, hitY, trackX, trackW;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = ov.clientWidth; H = ov.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      hitY = H * .86;
      trackW = W < 640 ? W * .96 : Math.min(W * .72, 780);
      trackX = (W - trackW) / 2;
      zones.style.left = trackX + "px";
      zones.style.width = trackW + "px";
    };
    resize();
    const onRs = () => resize();
    addEventListener("resize", onRs);

    const xOf = pos => trackX + pos / 60 * trackW;
    const wOf = (l, r) => Math.max(10, (r - l + 1) / 60 * trackW);

    const pill = (x, y, w, hgt, col) => {
      ctx.fillStyle = col;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y - hgt / 2, w, hgt, hgt / 2);
      ctx.fill(); ctx.stroke();
    };
    /* interpolated l/r of a hold polyline at time t */
    const holdAt = (pts, t) => {
      if(t <= pts[0][0]) return [pts[0][1], pts[0][2]];
      for(let i = 1; i < pts.length; i++){
        if(t <= pts[i][0]){
          const [t0,l0,r0] = pts[i-1], [t1,l1,r1] = pts[i];
          const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
          return [l0 + (l1 - l0) * k, r0 + (r1 - r0) * k];
        }
      }
      return [pts[pts.length-1][1], pts[pts.length-1][2]];
    };

    const draw = () => {
      const tNow = now();
      ctx.clearRect(0, 0, W, H);
      const yOf = t => hitY - (t - tNow) / APPR * (hitY + 40);

      /* track & key zones */
      ctx.fillStyle = "rgba(255,255,255,.045)";
      ctx.fillRect(trackX, 0, trackW, hitY);
      for(let l = 0; l < LANES; l++){
        if(G.held[l]){
          const g = ctx.createLinearGradient(0, 0, 0, hitY);
          g.addColorStop(0, "rgba(255,255,255,0)");
          g.addColorStop(1, "rgba(255,255,255,.10)");
          ctx.fillStyle = g;
          ctx.fillRect(trackX + l * trackW / LANES, 0, trackW / LANES, hitY);
        }
        if(l){
          ctx.strokeStyle = "rgba(255,255,255,.10)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(trackX + l * trackW / LANES, 0);
          ctx.lineTo(trackX + l * trackW / LANES, hitY);
          ctx.stroke();
        }
      }
      /* hit line */
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(trackX - 6, hitY - 2, trackW + 12, 4);

      const horizon = tNow + APPR;

      /* hold strips (behind heads/taps) */
      for(const hd of G.holds){
        if(hd.t > horizon || hd.end < tNow - .05 || hd.tailHit === -1) continue;
        if(hd.hit === "MISS") continue;
        const t0 = Math.max(hd.t, tNow), t1 = Math.min(hd.end, horizon);
        if(t1 <= t0 - .001) continue;
        /* sample AT the polyline knots (fixed in time, so they scroll
           smoothly) — a uniform grid re-anchored to the moving window makes
           curvy sections shimmer as the sample points slide along the curve */
        const leftPts = [], rightPts = [];
        const push = t => {
          const [l, r] = holdAt(hd.pts, t);
          const y = Math.max(-20, yOf(t));
          leftPts.push([xOf(l), y]);
          rightPts.push([xOf(r + 1), y]);
        };
        push(t0);
        for(const p of hd.pts) if(p[0] > t0 && p[0] < t1) push(p[0]);
        push(t1);
        ctx.fillStyle = hd.hit ? "rgba(127,212,240,.5)" : "rgba(127,212,240,.3)";
        ctx.beginPath();
        ctx.moveTo(leftPts[0][0], leftPts[0][1]);
        for(const [x,y] of leftPts) ctx.lineTo(x, y);
        for(let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i][0], rightPts[i][1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(180,230,250,.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        /* head pill / active press marker */
        if(!hd.hit && hd.t <= horizon)
          pill(xOf(hd.l), yOf(hd.t), wOf(hd.l, hd.r), 15, NCOL.hold);
        else if(hd.hit && tNow < hd.end){
          const [l, r] = holdAt(hd.pts, tNow);
          ctx.fillStyle = "rgba(200,240,255,.9)";
          ctx.beginPath();
          ctx.roundRect(xOf(l), hitY - 9, wOf(l, r), 18, 9);
          ctx.fill();
        }
      }

      /* taps & flicks */
      for(const n of G.notes){
        if(n.k === 1) continue;
        if(n.t > horizon) break;
        if(n.hit) continue;
        const y = yOf(n.t);
        if(y < -30) continue;
        const x = xOf(n.l), w = wOf(n.l, n.r);
        if(n.k === 3){                        /* trace: slim yellow, hold a key over it */
          pill(x, y, w, 9, NCOL.trace);
        } else if(n.k === 2){                 /* flick: green with chevron (tap counts) */
          pill(x, y, w, 15, NCOL.flick);
          ctx.fillStyle = "#0e2a1e";
          ctx.beginPath();
          ctx.moveTo(x + w/2, y - 5);
          ctx.lineTo(x + w/2 - 6, y + 4);
          ctx.lineTo(x + w/2 + 6, y + 4);
          ctx.closePath();
          ctx.fill();
        } else {
          pill(x, y, w, 15, NCOL.tap);
        }
      }

      /* hit pulses */
      const pn = performance.now();
      G.pulses = G.pulses.filter(p => pn - p.t < 300);
      for(const p of G.pulses){
        const k = (pn - p.t) / 300;
        ctx.strokeStyle = `rgba(255,255,255,${.8 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(trackX + (p.lane + .5) * trackW / LANES, hitY, 20 + k * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
      /* combo + judgement text */
      if(G.combo >= 5){
        ctx.textAlign = "center";
        ctx.font = "800 42px Jost, sans-serif";
        ctx.fillStyle = tNow < G.feverUntil ? "#ffd97a" : "rgba(255,255,255,.92)";
        ctx.fillText(G.combo, W / 2, H * .28);
        ctx.font = "600 13px Jost, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.55)";
        ctx.fillText("COMBO", W / 2, H * .28 + 20);
      }
      G.texts = G.texts.filter(t => pn - t.t < 480);
      for(const t of G.texts){
        const k = (pn - t.t) / 480;
        ctx.globalAlpha = 1 - k;
        ctx.font = "800 20px Jost, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = t.col;
        ctx.fillText(t.n, W / 2, H * .38 - k * 26);
        ctx.globalAlpha = 1;
      }
    };

    let raf = 0;
    const loop = () => {
      if(G.done) return;
      const tNow = now();
      missSweep(tNow);
      draw();
      progEl.style.width = Math.min(100, tNow / dur * 100) + "%";
      if((song.ended || tNow > Math.max(dur, chartEnd) + .5) && tNow > 5) return finish();
      raf = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      G.done = true;
      cancelAnimationFrame(raf);
      removeEventListener("keydown", onKey);
      removeEventListener("keyup", onKeyUp);
      removeEventListener("resize", onRs);
      song.pause();
      G.holds.forEach(stopHoldSnd);
      Audio_.stopVoice();
    };

    const quit = () => {
      cleanup();
      ov.remove();
      this.active = false;
      if(App.current === "live") App.go("live");
    };

    const finish = () => {
      cleanup();
      const acc = G.totalWeight ? G.weight / G.totalWeight : 0;
      const fc = G.counts.MISS === 0 && G.holds.every(n => n.tailHit >= 0);
      const rank = acc >= .98 ? "S" : acc >= .93 ? "A" : acc >= .82 ? "B" : "C";
      const key = m.snd + "_" + diffKey;
      const first = !State.live[key];
      const prev = State.live[key];
      const sc = Math.round(G.score);
      if(!prev || sc > prev.sc)
        State.live[key] = {sc, rank, fc: fc || (prev && prev.fc) || false, acc:+(acc * 100).toFixed(1)};
      else if(fc && !prev.fc) prev.fc = true;
      const coins = {S:1500, A:1000, B:600, C:300}[rank] + (fc ? 500 : 0) + (first ? 300 : 0);
      State.coins += coins;
      State.save(); App.updateWallet();

      Audio_.se("se_rhythm_result_0001", .5);
      const resBgm = new Audio(AUD.se("bgm_soundtest_rhythm_result_0001_loopoff"));
      resBgm.loop = true; resBgm.volume = .28;
      if(State.bgmOn) resBgm.play().catch(()=>{});

      const res = h("div",{class:"lg-result"},
        h("div",{class:"lg-res-rank r" + rank}, rank),
        fc ? h("div",{class:"lg-res-fc"},"✦ FULL COMBO ✦") : null,
        h("div",{class:"lg-res-song"}, m.t + " — " + D.label),
        h("div",{class:"lg-res-score"}, sc.toLocaleString()),
        h("div",{class:"lg-res-acc"}, t("live.result", (acc * 100).toFixed(1), G.maxCombo)),
        h("div",{class:"lg-res-counts"},
          Object.entries(G.counts).map(([k,v]) =>
            h("span",{class:"lg-rc " + k.toLowerCase()}, k + " " + v))),
        h("div",{class:"lg-res-coins"},t("live.coins", coins.toLocaleString())),
        h("div",{class:"lg-res-btns"},
          h("button",{class:"cta primary", onclick:() => {
            resBgm.pause(); res.remove(); ov.remove(); this.active = false;
            LiveGame.start(m, unit, diffKey);
          }},t("live.retry")),
          h("button",{class:"cta ghost", onclick:() => {
            resBgm.pause(); ov.remove(); this.active = false;
            App.go("live");
          }},t("live.songSel")),
        ),
      );
      ov.append(res);
      requestAnimationFrame(() => requestAnimationFrame(() => res.classList.add("in")));
    };

    /* countdown & go */
    const count = h("div",{class:"lg-count"},"READY…");
    ov.append(count);
    Audio_.se("se_rhythm_start_0001", .55);
    await new Promise(r => setTimeout(r, 1400));
    if(G.done || !document.body.contains(ov)) return;
    count.textContent = "START!";
    setTimeout(() => count.remove(), 700);
    clockBase = performance.now();
    try{
      await song.play();
      useAudioClock = true;
    }catch(e){
      useAudioClock = false;   /* autoplay blocked → run on perf clock (silent) */
    }
    loop();
  },
};
