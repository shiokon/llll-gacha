/* ═══ pages.js — home / collection / members / jukebox ═══ */
"use strict";

const Home = {
  heroTimer:null,

  render(root){
    const urs = DB.cards.filter(c => rarOf(c).tier >= 3);
    const pick = () => urs[Math.random()*urs.length|0];
    let cur = pick();

    const art = h("div",{class:"hero-art", style:`background-image:url(${IMG.full(cur.arts[cur.arts.length-1])})`});
    const nameTag = h("div",{class:"hero-cardname"}, `${cur.n} — ${charOf(cur).n}`);
    clearInterval(this.heroTimer);
    this.heroTimer = setInterval(() => {
      if(!document.body.contains(art)){ clearInterval(this.heroTimer); return; }
      art.classList.add("fade");
      setTimeout(() => {
        cur = pick();
        art.style.backgroundImage = `url(${IMG.full(cur.arts[cur.arts.length-1])})`;
        nameTag.textContent = `${cur.n} — ${charOf(cur).n}`;
        art.classList.remove("fade");
      }, 1250);
    }, 9000);

    const owned = State.ownCount();
    const hero = h("div",{class:"hero"},
      art,
      h("div",{class:"hero-veil"}),
      h("div",{class:"hero-inner"},
        h("div",{class:"hero-kicker"},"HASUNOSORA GIRLS' HIGH SCHOOL IDOL CLUB"),
        h("div",{class:"hero-title", html:"蓮ノ空 <em>カードガチャ</em>"}),
        h("div",{class:"hero-cta"},
          h("button",{class:"cta primary", onclick:() => App.go("gacha")},t("home.ctaGacha")),
          h("button",{class:"cta ghost", onclick:() => App.go("live")},t("home.ctaLive")),
          h("button",{class:"cta ghost", onclick:() => App.go("gallery")},t("home.ctaGallery")),
          h("button",{class:"cta ghost", onclick:() => Theater.start()},t("home.ctaTheater")),
        ),
      ),
      nameTag,
    );

    const tiles = h("div",{class:"stat-band"},
      this.tile(owned + " / " + DB.cards.length, "COLLECTION", "♡"),
      this.tile(State.pulls, "TOTAL PULLS", "✦"),
      this.tile(State.coins, "PETAL COINS", "❀"),
      this.tile(Object.entries(DB.chars).filter(([k, ch]) =>
        !isSpecialChar(ch) && DB.cards.some(c => c.c == k)).length, "MEMBERS", "☘"),
      this.tile(DB.musics.filter(m => m.chart).length, "SONGS", "♪"),
    );

    /* current banners + recent cards */
    const nowB = realBanners().filter(b => b.picks.length).slice(0, 5);
    const bcol = h("div",{class:"panel"},
      h("div",{class:"section-title"},t("home.banners"), h("small","BANNERS")),
      nowB.map(b => h("div",{class:"mini-banner", onclick:() => { Gacha.banner = b; App.go("gacha"); }},
        h("img",{src:IMG.banner(b.id), loading:"lazy"}),
        h("div",{},
          h("div",{class:"mb-name"}, b.n),
          h("div",{class:"mb-date"}, `${b.start} 〜 ${b.end}`)),
      )),
    );
    const latest = [...DB.cards].sort((a,b) => b.o - a.o).slice(0, 8);
    const lcol = h("div",{class:"panel"},
      h("div",{class:"section-title"},t("home.latest"), h("small","LATEST")),
      h("div",{class:"card-grid", style:"grid-template-columns:repeat(auto-fill,minmax(118px,1fr))"},
        latest.map(c => Gallery.cardEl(c, {noDim:true}))),
    );

    /* chibi parade — fresh random lineup every visit */
    const chibis = DB.cards.filter(c => c.chibi)
      .sort(() => Math.random() - .5).slice(0, 18);
    const parade = h("div",{class:"chibi-parade"},
      chibis.map(c =>
        h("img",{src:IMG.chibi(c.s), loading:"lazy", title:c.n, onclick:() => Detail.open(c)})),
    );

    root.append(hero, tiles, h("div",{class:"home-cols"}, bcol, lcol), parade);
  },

  tile(v, lab, ico){
    return h("div",{class:"stat-tile"},
      h("span",{class:"tile-ico"},ico), h("b",{},String(v)), h("span",{},lab));
  },
};

/* ───── collection ───── */
const Collection = {
  render(root){
    root.append(h("div",{class:"section-title"},t("coll.luck"), h("small","LUCK REPORT")));
    root.append(this.luckPanel());
    root.append(h("div",{class:"section-title"},t("coll.title"), h("small","COLLECTION")));

    const chars = Object.entries(DB.chars)
      .map(([id, ch]) => [+id, ch])
      .filter(([id]) => DB.cards.some(c => c.c === id));
    const charRow = ([id, ch]) => {
      const all = DB.cards.filter(c => c.c === id);
      const own = all.filter(c => State.owned[c.s]).length;
      const pct = all.length ? own/all.length*100 : 0;
      return h("div",{class:"coll-char", style:`--cc:${ch.col}`,
        onclick:() => { Gallery.f.chars = new Set([id]); App.go("gallery"); }},
        ch.chibi ? h("img",{src:IMG.chibi(ch.chibi), loading:"lazy"}) : null,
        h("div",{style:"flex:1"},
          h("div",{class:"cc-name"}, ch.n),
          h("div",{class:"cc-nums"}, `${own} / ${all.length}　(${pct.toFixed(0)}%)`),
          h("div",{class:"cc-bar"}, h("i",{style:`width:${pct}%`})),
        ),
      );
    };
    const main = chars.filter(([,ch]) => !isSpecialChar(ch));
    const others = chars.filter(([,ch]) => isSpecialChar(ch));
    root.append(h("div",{class:"coll-head"}, main.map(charRow)));
    if(others.length){
      root.append(h("div",{class:"section-title"},t("coll.others"), h("small","OTHERS")));
      root.append(h("div",{class:"coll-head"}, others.map(charRow)));
    }

    /* recent history */
    if(State.history.length){
      root.append(h("div",{class:"section-title"},t("coll.recent"), h("small","RECENT")));
      const grid = h("div",{class:"card-grid", style:"grid-template-columns:repeat(auto-fill,minmax(110px,1fr))"});
      [...State.history].reverse().slice(0, 24).forEach(sid => {
        const c = CARD_BY_S[sid];
        if(c) grid.append(Gallery.cardEl(c, {noDim:true}));
      });
      root.append(grid);
    }

    root.append(h("div",{style:"margin-top:30px;text-align:center"},
      h("button",{class:"chip", onclick:() => {
        if(confirm(t("coll.resetConfirm"))){
          localStorage.removeItem(SAVE_KEY);
          location.reload();
        }
      }},t("coll.reset"))));
  },

  luckPanel(){
    const hist = State.history.map(s => CARD_BY_S[s]).filter(Boolean);
    const n = hist.length;
    const groups = [
      ["UR", [5,95], "var(--r-UR)"], ["SR", [4,94], "var(--r-SR)"],
      ["R", [3,93], "var(--r-R)"], ["LR", [7], "var(--r-LR)"],
      ["BR", [9], "var(--r-BR)"], ["DR", [8], "var(--r-DR)"],
    ];
    const counts = groups.map(([k, rs, col]) =>
      [k, hist.filter(c => rs.includes(c.r)).length, col]);
    const hi = hist.filter(c => rarOf(c).tier >= 3).length;
    const hiRate = n ? hi/n : 0;
    const EXPECT = .031 + .01 + .03/2;             /* rough UR帯 expectation ~ */
    /* drought: pulls since last UR-or-better */
    let drought = 0;
    for(let i = hist.length-1; i >= 0 && rarOf(hist[i]).tier < 3; i--) drought++;

    let kanji = "？", sub = t("luck.needPulls");
    if(n >= 10){
      const ratio = hiRate / .061;
      kanji = ratio >= 1.6 ? "大吉" : ratio >= 1.15 ? "吉" : ratio >= .8 ? "中吉" :
              ratio >= .5 ? "小吉" : ratio > 0 ? "凶" : "大凶";
      sub = t("luck.sub", (hiRate*100).toFixed(2), hi, n);
    }
    const maxC = Math.max(1, ...counts.map(c => c[1]));
    const rows = h("div",{class:"rate-rows"},
      counts.filter(c => c[1] > 0 || ["UR","SR","R"].includes(c[0])).map(([k, v, col]) => {
        const bar = h("i",{style:`background:${col}`});
        requestAnimationFrame(() => requestAnimationFrame(() =>
          bar.style.width = (v/maxC*100) + "%"));
        return h("div",{class:"rate-row"},
          h("span",{class:"rr-lab", style:`color:${col}`}, k),
          h("div",{class:"rr-bar"}, bar),
          h("span",{class:"rr-val", html:t("luck.cnt", v, n?`(${(v/n*100).toFixed(1)}%)`:"")}),
        );
      }),
      h("div",{style:"font-size:11px;color:var(--ink-faint);margin-top:4px"},
        n ? t("luck.foot", drought, State.pulls, State.coins.toLocaleString()) : t("luck.none")),
    );
    return h("div",{class:"luck-wrap"},
      h("div",{class:"luck-badge"},
        h("span",{class:"lb-lab"},"FORTUNE"),
        h("span",{class:"lb-kanji"}, kanji),
        h("span",{class:"lb-sub"}, sub)),
      rows);
  },
};

/* ───── theater mode ───── */
const Theater = {
  el:null, list:[], idx:0, timer:null, audio:null, layers:[], cur:0,
  SLIDE_MS: 7500,

  start(list){
    let src = (list && list.length ? list : DB.cards).filter(c => c.arts.length);
    if(!src.length){ toast(t("th.noCards")); return; }
    /* shuffle a copy for ambience */
    src = [...src];
    for(let i = src.length-1; i > 0; i--){
      const j = Math.random()*(i+1)|0; [src[i], src[j]] = [src[j], src[i]];
    }
    this.list = src; this.idx = 0;

    Jukebox.stop();
    Audio_.stopBgm(true);
    Audio_.stopVoice();

    const l0 = h("div",{class:"th-img kb1"});
    const l1 = h("div",{class:"th-img kb2"});
    this.layers = [l0, l1]; this.cur = 0;
    this.cap = h("div",{class:"th-cap"});
    this.songPill = h("div",{class:"th-song"});
    this.bar = h("div",{class:"th-bar"});
    this.el = h("div",{id:"theater",
      onclick:e => { if(!e.target.closest(".th-close,.th-song")) this.next(1); }},
      l0, l1,
      h("div",{class:"th-veil"}),
      this.bar, this.cap, this.songPill,
      h("button",{class:"icon-btn th-close", onclick:() => this.stop()},"✕"),
      h("div",{class:"th-hint"},t("th.hint")),
    );
    document.body.append(this.el);
    document.body.style.overflow = "hidden";
    this.show(0);
    this.playSong();
  },

  show(i){
    this.idx = (i + this.list.length) % this.list.length;
    const c = this.list[this.idx];
    const art = c.arts[c.arts.length-1];
    const r = rarOf(c), ch = charOf(c);
    const nextL = this.layers[this.cur ^= 1];
    const prevL = this.layers[this.cur ^ 1];
    nextL.style.backgroundImage = `url(${IMG.full(art)})`;
    nextL.classList.add("show");
    prevL.classList.remove("show");
    this.cap.replaceChildren(
      h("div",{class:"tc-name"}, c.n),
      h("div",{class:"tc-sub"},
        h("i",{class:"cdot", style:`background:${ch.col};color:${ch.col}`}),
        ch.n,
        h("span",{class:"tc-rar", style:`color:${r.c}`}, r.n)),
    );
    /* progress bar restart */
    this.bar.style.transition = "none"; this.bar.style.width = "0";
    void this.bar.offsetWidth;
    this.bar.style.transition = `width ${this.SLIDE_MS}ms linear`;
    this.bar.style.width = "100%";
    /* preload next art */
    const nc = this.list[(this.idx+1) % this.list.length];
    new Image().src = IMG.full(nc.arts[nc.arts.length-1]);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.next(1), this.SLIDE_MS);
  },

  next(d){ if(this.el) this.show(this.idx + d); },

  playSong(){
    const m = DB.musics[Math.random()*DB.musics.length|0];
    if(!m) return;
    if(this.audio) this.audio.pause();
    const a = new Audio(AUD.live(m.snd));
    a.volume = .4;
    a.play().catch(()=>{});
    a.onended = () => { if(this.el) this.playSong(); };
    this.audio = a;
    this.songPill.replaceChildren(
      m.j ? h("img",{src:IMG.jacket(m.j)}) : "♪",
      h("span",{}, m.t));
  },

  stop(){
    clearTimeout(this.timer);
    if(this.audio){ this.audio.pause(); this.audio = null; }
    if(this.el){ this.el.remove(); this.el = null; }
    document.body.style.overflow = "";
  },

  isOpen(){ return !!this.el; },
};

/* ───── members ───── */
const Members = {
  render(root){
    const memCard = ([ids, ch]) => {
      const id = +ids;
      const cards = DB.cards.filter(c => c.c === id);
      const units = ch.units.map(u => DB.units[u]).filter(Boolean);
      return h("div",{class:"mem-card", style:`--mc:${ch.col}`},
        h("div",{class:"mem-top"},
          ch.chibi ? h("img",{src:IMG.chibi(ch.chibi), loading:"lazy"}) : null,
          h("div",{},
            h("div",{class:"mem-name"}, ch.n),
            h("div",{class:"mem-en"}, ch.en),
            ch.cv ? h("div",{class:"mem-cv"},"CV: " + ch.cv) : null,
            h("div",{class:"mem-tags"},
              ch.gen ? h("span",{class:"mem-tag"},t("mem.gen", ch.gen)) : null,
              units.map(u => h("span",{class:"mem-tag", style:`color:${ch.col};border-color:${ch.col}55`}, u)),
            ),
          ),
        ),
        ch.intro ? h("div",{class:"mem-intro"}, ch.intro) : null,
        h("div",{class:"mem-cards-link", onclick:() => {
          Gallery.f.chars = new Set([id]); App.go("gallery");
        }}, t("mem.viewCards", cards.filter(c=>State.owned[c.s]).length, cards.length)),
      );
    };
    /* keep card-less members (沙知) if they have a profile */
    const entries = Object.entries(DB.chars)
      .filter(([ids, ch]) => DB.cards.some(c => c.c === +ids) || ch.intro);
    const main = entries.filter(([,ch]) => !isSpecialChar(ch));
    const others = entries.filter(([,ch]) => isSpecialChar(ch));
    root.append(h("div",{class:"section-title"},t("mem.title"), h("small","MEMBERS")));
    root.append(h("div",{class:"mem-grid"}, main.map(memCard)));
    if(others.length){
      root.append(h("div",{class:"section-title"},t("mem.others"), h("small","OTHERS")));
      root.append(h("div",{class:"mem-grid"}, others.map(memCard)));
    }
  },
};

/* ───── jukebox (full songs — the chart-bearing 154) ───── */
const Jukebox = {
  cur:null, audio:null,

  render(root){
    root.append(h("div",{class:"section-title"},t("juke.title"),
      h("small",t("juke.small"))));

    const body = h("div");
    const tabs = h("div",{class:"juke-tabs"});
    tabs.append(h("button",{class:"juke-tab on"}, t("juke.songs", DB.musics.length)));
    this.renderSongs(body);
    root.append(tabs, body);
  },

  renderSongs(body){
    const grid = h("div",{class:"juke-grid"});
    for(const m of DB.musics){
      const uc = UNIT_C[m.u] || "#9aa3c7";
      const unitName = DB.units[m.u] || "";
      const el = h("div",{class:"juke-card" + (this.cur === m ? " playing" : ""), style:`--uc:${uc}`,
        onclick:() => this.play(m, el)},
        m.j ? h("img",{src:IMG.jacket(m.j), loading:"lazy"}) : h("div",{style:"width:64px;height:64px;border-radius:10px;background:var(--bg2);display:grid;place-items:center"},"♪"),
        h("div",{style:"min-width:0;flex:1"},
          h("div",{class:"juke-title"}, m.t),
          h("div",{class:"juke-sub"}, unitName + (m.desc && m.desc !== unitName ? "・" + m.desc : "")),
        ),
        h("div",{class:"juke-eq"}, h("i"), h("i"), h("i")),
      );
      grid.append(el);
    }
    body.replaceChildren(grid);
  },

  play(m, el){
    const dock = document.getElementById("dock");
    if(this.cur === m){ this.stop(); return; }
    document.querySelectorAll(".juke-card.playing")
      .forEach(x => x.classList.remove("playing"));
    if(this.audio) this.audio.pause();
    Audio_.stopBgm(true);
    this.cur = m;
    el && el.classList.add("playing");
    const a = new Audio(AUD.live(m.snd));
    a.volume = .55;
    a.play().catch(()=>{});
    this.audio = a;

    dock.classList.remove("hidden");
    const jk = document.getElementById("dock-jacket");
    if(m.j){ jk.style.display = ""; jk.src = IMG.jacket(m.j); }
    else { jk.style.display = "none"; }
    document.getElementById("dock-title").textContent = m.t;
    const playBtn = document.getElementById("dock-play");
    playBtn.textContent = "⏸";
    playBtn.onclick = () => {
      if(a.paused){ a.play(); playBtn.textContent = "⏸"; }
      else { a.pause(); playBtn.textContent = "▶"; }
    };
    document.getElementById("dock-close").onclick = () => this.stop();
    /* timeline: click to seek, hold-and-drag to scrub. handlers rebind per
       song (like the buttons above) so the closure targets the current audio */
    const bar = dock.querySelector(".dock-bar");
    const prog = document.getElementById("dock-progress");
    const seek = e => {
      if(!a.duration) return;
      const r = bar.getBoundingClientRect();
      const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      a.currentTime = f * a.duration;
      prog.style.width = f * 100 + "%";
    };
    bar.onpointerdown = e => { e.preventDefault(); bar.setPointerCapture(e.pointerId); seek(e); };
    bar.onpointermove = e => { if(e.buttons & 1) seek(e); };
    a.ontimeupdate = () => {
      prog.style.width = (a.duration ? a.currentTime/a.duration*100 : 0) + "%";
    };
    a.onended = () => {
      /* autoplay next track */
      const next = DB.musics[(DB.musics.indexOf(m) + 1) % DB.musics.length];
      this.cur = null;
      const els = document.querySelectorAll(".juke-card");
      this.play(next, els[DB.musics.indexOf(next)]);
    };
  },

  stop(){
    if(this.audio) this.audio.pause();
    this.audio = null; this.cur = null;
    document.querySelectorAll(".juke-card.playing")
      .forEach(x => x.classList.remove("playing"));
    document.getElementById("dock").classList.add("hidden");
  },
};
