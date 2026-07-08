/* ═══ gacha.js — banners, pull logic, reveal ceremony ═══ */
"use strict";

const Gacha = {
  banner:null,

  /* GachaSeries.GachaStartBgm drives banner-specific music (0 = default).
     bgm_gacha_start_{id} = ceremony, bgm_collection_gacha_{id, 8-digit} = screen bgm */
  homeBgm(b){
    return b && b.bgm ? "bgm_collection_gacha_" + String(b.bgm).padStart(8, "0")
                      : "bgm_gacha_home_0001";
  },
  startBgm(b){
    return b && b.bgm ? "bgm_gacha_start_" + b.bgm : "bgm_gacha_start_0001";
  },

  render(root){
    const banners = [...realBanners(), ...futureBanners()]
      .filter(b => b.picks.length || b.type === 1);
    if(!this.banner) this.banner = banners[0];

    const list = h("div", {class:"banner-list"});
    let stageEl = this.stage(this.banner);
    for(const b of banners){
      const item = h("div", {
        class:"banner-item" + (b === this.banner ? " on" : ""),
        onclick:() => {
          this.banner = b;
          list.querySelectorAll(".banner-item").forEach(x => x.classList.remove("on"));
          item.classList.add("on");
          const ns = this.stage(b);      /* swap stage only — list keeps its scroll */
          stageEl.replaceWith(ns);
          stageEl = ns;
          Audio_.se("se_gacha_turn_0001", .5);
          Audio_.playBgm(this.homeBgm(b), .3);
        },
      },
        h("img", {src:IMG.banner(b.id), loading:"lazy"}),
        h("span", {class:"bi-date"}, b.start),
      );
      list.append(item);
    }
    list.addEventListener("scroll", () => { this._listScroll = list.scrollTop; });

    root.append(
      h("div",{class:"section-title"},t("gacha.title"), h("small","GACHA")),
      h("div",{class:"gacha-wrap"}, list, stageEl),
    );
    /* restore scroll position after full page re-renders (e.g. post-ceremony) */
    requestAnimationFrame(() => { list.scrollTop = this._listScroll || 0; });
    Audio_.playBgm(this.homeBgm(this.banner), .3);
  },

  stage(b){
    const pool = this.buildPool(b);
    const pts = (State.pity[b.id] || 0);
    const stage = h("div", {class:"gacha-stage"});
    const picks = h("div", {class:"gs-picks"});
    for(const sid of b.picks){
      const c = CARD_BY_S[sid];
      if(!c) continue;
      picks.append(h("div", {class:"pickup-thumb", style:`--rc:${rarOf(c).c}`, onclick:() => Detail.open(c)},
        h("img",{src:IMG.thumb(c.th), loading:"lazy"}),
        h("span",{class:"pu"},"PICK UP"),
      ));
    }
    stage.append(
      h("div",{class:"gs-name"}, b.n),
      h("div",{class:"gs-dates"}, `${b.start} 〜 ${b.end}`),
      b.pack ? h("img",{class:"gs-pack", src:IMG.pack(b.id),
          onclick:() => this.pull(b, pool, 10)}) : null,
      picks,
      h("div",{class:"gs-btns"},
        h("button",{class:"pull-btn p1", onclick:() => this.pull(b, pool, 1)},
          t("gacha.pull1"), h("small",t("gacha.pull1s"))),
        h("button",{class:"pull-btn p10", onclick:() => this.pull(b, pool, 10)},
          t("gacha.pull10"), h("small",t("gacha.pull10s"))),
      ),
      h("div",{class:"gs-meta"},
        h("span",{html:t("gacha.total", State.pulls)}),
        h("span",{html:t("gacha.pts", pts)}),
        pts >= 600 && b.picks.length ?
          h("button",{class:"chip on", onclick:() => this.spark(b)},t("gacha.spark")) : null,
      ),
      h("div",{class:"gs-rates"}, this.rateText(pool)),
    );
    return stage;
  },

  /*
   * Rate model:
   *   DR 0.1% (any banner) / LR 1% (only if the banner picks up an LR)
   *   UR 3% / BR 3% (only if picked up) / SR 10% / R = remainder.
   *   m-rarities share the base rarity's odds (mUR≡UR, mSR≡SR, mR≡R).
   *   UR/SR pickups collectively take HALF their tier's rate — 50/50 to
   *   "lose" to another card of the same rarity.
   *   LR/BR tiers hold ONLY the rate-ups (no 50/50): the tier rate is
   *   split evenly among them. BR banners have no UR tier at all.
   */
  TIERS:[
    {key:"DR", rate:.001, rars:[8],     always:true },
    {key:"LR", rate:.01,  rars:[7],     always:false},
    {key:"BR", rate:.03,  rars:[9],     always:false},
    {key:"UR", rate:.03,  rars:[5,95],  always:true },
    {key:"SR", rate:.10,  rars:[4,94],  always:true },
  ],

  buildPool(b){
    const pickCards = b.picks.map(s => CARD_BY_S[s]).filter(Boolean);
    const hasBR = pickCards.some(c => c.r === 9);
    const pool = {tiers:[], r:{pick:[], std:[]}};
    for(const t of this.TIERS){
      const pick = pickCards.filter(c => t.rars.includes(c.r));
      if(!t.always && !pick.length) continue;      /* LR/BR only when picked up */
      if(t.key === "UR" && hasBR) continue;        /* BR banners drop the UR tier */
      const std = t.key === "LR" || t.key === "BR"
        ? []                                       /* rate-ups only, no 50/50 */
        : t.key === "UR" || t.key === "SR"
        ? DB.cards.filter(c => t.rars.includes(c.r) && (c.lt === 0 || c.lt === 101) && !b.picks.includes(c.s))
        : DB.cards.filter(c => t.rars.includes(c.r) && !b.picks.includes(c.s));
      if(!pick.length && !std.length) continue;
      pool.tiers.push({...t, pick, std});
    }
    pool.r.pick = pickCards.filter(c => [3,93].includes(c.r));
    pool.r.std = DB.cards.filter(c => [3,93].includes(c.r) && c.lt === 0 && !b.picks.includes(c.s));
    return pool;
  },

  rateText(pool){
    const parts = pool.tiers.map(tr => `${tr.key} ${(tr.rate*100).toFixed(tr.rate<.01?1:0)}%`);
    const rRate = 1 - pool.tiers.reduce((s,tr) => s + tr.rate, 0);
    parts.push(`R ${(rRate*100).toFixed(1)}%`);
    return t("gacha.rates", parts.join(" ／ "));
  },

  drawFromTier(t){
    const rnd = a => a[Math.random()*a.length|0];
    if(t.pick.length && t.std.length) return Math.random() < .5 ? rnd(t.pick) : rnd(t.std);
    return t.pick.length ? rnd(t.pick) : rnd(t.std);
  },

  drawOne(pool, guaranteeSRplus){
    if(guaranteeSRplus){
      /* tiers above SR keep their normal absolute odds;
         the R remainder folds into SR (always the last tier) */
      let roll = Math.random();
      for(const t of pool.tiers){
        if(roll < t.rate) return this.drawFromTier(t);
        roll -= t.rate;
      }
      return this.drawFromTier(pool.tiers[pool.tiers.length-1]);
    }
    let roll = Math.random();
    for(const t of pool.tiers){
      if(roll < t.rate) return this.drawFromTier(t);
      roll -= t.rate;
    }
    const r = pool.r;
    if(r.pick.length && Math.random() < .5) return r.pick[Math.random()*r.pick.length|0];
    return r.std.length ? r.std[Math.random()*r.std.length|0]
                        : this.drawFromTier(pool.tiers[pool.tiers.length-1]);
  },

  pull(b, pool, n){
    const results = [];
    for(let i=0;i<n;i++) results.push(this.drawOne(pool));
    /* 10-pull: the 10th card is ALWAYS drawn from the SR-and-above table
       (guaranteed SR, but it can still hit UR/LR/DR/BR at their odds) */
    if(n >= 10) results[n-1] = this.drawOne(pool, true);
    /* apply to state */
    const gains = results.map(c => {
      const isNew = !State.owned[c.s];
      State.owned[c.s] = (State.owned[c.s]||0) + 1;
      if(isNew) State.newFlags[c.s] = 1;
      else State.coins += rarOf(c).coin;
      return {c, isNew};
    });
    State.pulls += n;
    State.pity[b.id] = (State.pity[b.id]||0) + n;
    State.history.push(...results.map(c => c.s));
    State.save();
    App.updateWallet();
    Ceremony.start(b, gains);
  },

  spark(b){
    const body = document.getElementById("modal-body");
    body.replaceChildren(
      h("div",{style:"padding:30px"},
        h("div",{class:"det-name",style:"margin-bottom:6px"},t("gacha.sparkTitle")),
        h("div",{style:"color:var(--ink-dim);font-size:13px;margin-bottom:18px"},t("gacha.sparkDesc")),
        h("div",{class:"res-grid"},
          b.picks.map((sid,i) => {
            const c = CARD_BY_S[sid];
            return h("div",{class:"res-card", style:`--rc:${rarOf(c).c};animation-delay:${i*.06}s`,
              onclick:() => {
                State.pity[b.id] -= 600;
                const isNew = !State.owned[c.s];
                State.owned[c.s] = (State.owned[c.s]||0)+1;
                if(isNew) State.newFlags[c.s] = 1; else State.coins += rarOf(c).coin;
                State.save(); App.updateWallet();
                Detail.close();
                Audio_.se("se_gacha_urget_0001");
                toast(t("gacha.sparkDone", esc(c.n)));
                App.go("gacha");
              }},
              h("img",{src:IMG.thumb(c.th)}),
              h("span",{class:"rr"},rarOf(c).n));
          })),
      ));
    const modal = document.getElementById("modal");
    modal.classList.remove("hidden");
    modal.onclick = e => { if(e.target === modal) Detail.close(); };
    document.body.style.overflow = "hidden";
  },
};

/* ───── ceremony ───── */
const Ceremony = {
  el:null, skipFlag:false, particles:null,

  async start(b, gains){
    this.skipFlag = false;
    Audio_.playBgm(Gacha.startBgm(b), .32);
    const cer = document.getElementById("ceremony");
    cer.classList.remove("hidden");
    cer.replaceChildren();
    this.el = cer;
    document.body.style.overflow = "hidden";

    const canvas = h("canvas",{class:"cer-canvas"});
    cer.append(canvas);
    this.initParticles(canvas);

    const skip = h("button",{class:"cer-skip", onclick:() => { this.skipFlag = true; }},"SKIP ≫");
    cer.append(skip);

    const stage = h("div",{class:"cer-stage"});
    cer.append(stage);
    const flash = h("div",{class:"cer-flash"});
    cer.append(flash);

    const maxTier = Math.max(...gains.map(g => rarOf(g.c).tier));

    /* ── phase 1: the pack ── */
    const packImg = h("img",{class:"pk", src: b.pack ? IMG.pack(b.id) : IMG.banner(b.id)});
    const tearImg = h("img",{class:"cer-tear"});
    const wrap = h("div",{class:"cer-packwrap"}, packImg, b.pack ? tearImg : null);
    const hint = h("div",{class:"cer-hint"},t("cer.open"));
    stage.append(wrap, hint);

    /* preload tear frames + the opened-pack art while the pack floats */
    const frames = [];
    let openPack = null;
    if(b.pack){
      for(let i = 0; i < 19; i++){
        const im = new Image();
        im.src = `${ASSET}turn/${String(i).padStart(2,"0")}_${b.id}.webp`;
        frames.push(im);
      }
      openPack = new Image();
      openPack.src = IMG.packopen(b.id);
    }

    if(maxTier >= 3){
      await this.wait(900);
      if(!this.skipFlag){
        Audio_.se("se_gacha_rareeffect_0001");
        const colors = maxTier >= 4 ? ["#69e0b8","#b48cff","#ffd97a"] : ["#ff9ec6","#ffd97a","#7fd4f0"];
        for(let i=0;i<7;i++){
          const beam = h("div",{class:"cer-beam go",
            style:`--beam:${colors[i%colors.length]};transform:translate(-50%,-50%) rotate(${i*26-78}deg);animation-delay:${i*.07}s`});
          stage.prepend(beam);
        }
        this.burst(innerWidth/2, innerHeight/2, 40, colors);
      }
    }

    /* wait for the tap, then tear the pack open. a SKIP here (or anywhere
       below) drops every remaining phase and cuts straight to the results —
       showing the tear img without a src paints a broken-image box */
    await this.tapOnly(wrap);
    if(!this.skipFlag){
      wrap.classList.add("shaking");
      Audio_.se("se_gacha_start_0002");
      if(frames.length && frames[0].complete && frames[0].naturalWidth){
        wrap.classList.remove("shaking");
        tearImg.style.display = "block";
        for(let i = 0; i < frames.length; i++){
          if(this.skipFlag) break;
          if(frames[i].naturalWidth) tearImg.src = frames[i].src;
          /* the pack itself switches to the torn/open art as the strip lifts */
          if(i === 2 && openPack && openPack.naturalWidth) packImg.src = openPack.src;
          await new Promise(r => setTimeout(r, 30));
        }
        await this.wait(120);
      } else {
        await this.wait(600);
      }
    }
    if(!this.skipFlag){
      Audio_.se("se_gacha_start_0003");
      flash.classList.add("go");
      this.burst(innerWidth/2, innerHeight/2, 90);
      await this.wait(350);
    }
    wrap.remove(); hint.remove();
    stage.querySelectorAll(".cer-beam").forEach(x=>x.remove());

    /* ── phase 2: rarity ring preview ── */
    if(!this.skipFlag) await this.ringPhase(stage, gains);

    /* ── phase 3: one-by-one reveals, clockwise ring order ── */
    const counter = h("div",{class:"cer-count"});
    cer.append(counter);
    for(let i = 0; i < gains.length; i++){
      if(this.skipFlag) break;
      counter.textContent = `${i+1} / ${gains.length}`;
      await this.revealCard(stage, gains[i]);
    }
    counter.remove();

    /* ── phase 4: results ── */
    this.results(b, gains);
  },

  /* back color class per rarity: R cyan / SR yellow / UR+BR purple-blue /
     LR pink / DR dark aura. m-rarities follow their base rarity. */
  backClass(c){
    if(c.r === 7) return "back-LR";
    if(c.r === 8) return "back-DR";
    const t = rarOf(c).tier;
    return t >= 3 ? "back-UR" : t === 2 ? "back-SR" : "back-R";
  },

  /* all card backs fan out clockwise into a circle (1 o'clock first),
     colored by rarity — then one tap proceeds to the reveals */
  async ringPhase(stage, gains){
    const n = gains.length;
    stage.replaceChildren();
    const ring = h("div",{class:"cer-ring"});
    const hint = h("div",{class:"cer-tap"},t("cer.flip"));
    stage.append(ring, hint);
    gains.forEach((g, i) => {
      const ang = n === 1 ? 0 : 30 + i * (360 / n);
      ring.append(h("div",{
        class:"ring-card" + (n === 1 ? " solo" : ""),
        style:`--ang:${ang}deg;--d:${i * 75}ms;${n === 1 ? "--ty:0%" : ""}`,
      }, h("div",{class:`face rar-back ${this.backClass(g.c)}`})));
    });
    Audio_.se("se_gacha_turn_0001", .45);
    requestAnimationFrame(() => requestAnimationFrame(() => ring.classList.add("spread")));
    await this.wait(680 + n * 75);          /* let the spread finish */
    await this.tapOnly(stage);
    stage.replaceChildren();
  },

  async revealCard(stage, g){
    const c = g.c, r = rarOf(c), tier = r.tier;
    stage.replaceChildren();
    /* the holo tilt is attached to fr-in (art only) — the name plate and
       badges live beside it so nothing can nudge the bottom gradient */
    const frIn = h("div",{class:"fr-in"},
      h("img",{src:IMG.thumb(c.th)}),
    );
    const card = h("div",{class:"cer-card"},
      h("div",{class:`face rar-back ${this.backClass(c)}`}),
      h("div",{class:"face front", style:`--rc:${r.c}`},
        frIn,
        h("span",{class:"fr-rar"}, r.n),
        g.isNew ? h("span",{class:"fr-new"},"NEW") : null,
        h("div",{class:"fr-nm"}, c.n),
      ),
    );
    const tap = h("div",{class:"cer-tap", style:"opacity:0"},t("cer.next"));
    stage.append(card, tap);

    /* the back shows briefly, then the card flips on its own
       (an early tap flips it right away) */
    await this.tapOrWait(card, tier >= 3 ? 900 : 650);
    if(this.skipFlag) return;

    Audio_.se(tier >= 3 ? "se_gacha_urturn_0001" : "se_gacha_turn_0001");
    card.classList.add("flipped");
    /* card voice right as the face turns over — every rarity */
    const gv = (c.vo||[]).find(v => v.includes("_gacha_"));
    if(gv) Audio_.voice(gv);
    await this.wait(580);                     /* let the .55s flip settle */
    if(tier >= 3) attachHolo(frIn, tier, 8);
    card.classList.add(tier >= 4 ? "glow-hi" : tier === 3 ? "glow-UR" : tier === 2 ? "glow-SR" : "x");
    if(tier >= 3){
      Audio_.se("se_gacha_urget_0001");
      this.burst(innerWidth/2, innerHeight/2, 60, [r.c, "#ffd97a", "#fff"]);
    } else if(tier === 2){
      Audio_.se("se_gacha_srget_0001");
      this.burst(innerWidth/2, innerHeight/2, 30, [r.c, "#fff"]);
    } else {
      Audio_.se("se_gacha_rget_0001");
    }
    tap.style.opacity = "";
    /* ONE tap moves to the next card — cut any running voice on advance */
    await this.tapOnly(stage);
    Audio_.stopVoice();
    stage.replaceChildren();
  },

  results(b, gains){
    const cer = this.el;
    cer.querySelectorAll(".cer-stage,.cer-count").forEach(x=>x.remove());
    Audio_.playBgm("bgm_gacha_result_0001", .3);
    const grid = h("div",{class:"res-grid" + (gains.length === 1 ? " solo" : "")});
    gains.forEach((g, i) => {
      const r = rarOf(g.c);
      grid.append(h("div",{class:"res-card",
        style:`--rc:${r.c};animation-delay:${i*.09}s`,
        onclick:() => Detail.open(g.c)},
        h("img",{src:IMG.thumb(g.c.th)}),
        h("span",{class:"rr"},r.n),
        g.isNew ? h("span",{class:"rn"},"NEW") : h("span",{class:"rdupe"},`❀+${r.coin}`),
      ));
    });
    const wrap = h("div",{class:"cer-results"},
      h("div",{class:"res-title"},"RESULTS"),
      grid,
      h("div",{class:"res-btns"},
        h("button",{class:"cta ghost", onclick:() => this.close()},t("cer.close")),
        h("button",{class:"cta primary", onclick:() => {
          this.close(false);
          const pool = Gacha.buildPool(b);
          Gacha.pull(b, pool, gains.length);
        }},t("cer.again", gains.length)),
      ),
    );
    cer.append(wrap);
    const hi = gains.filter(g => rarOf(g.c).tier >= 3).length;
    if(hi) this.burst(innerWidth/2, innerHeight*0.25, 80, ["#ffd97a","#ff9ec6","#7fd4f0"]);
  },

  close(backToBgm = true){
    this.stopParticles();
    Audio_.stopVoice();
    if(backToBgm){
      Audio_.playBgm(Gacha.homeBgm(Gacha.banner), .3);
      App.go(App.current === "gacha" ? "gacha" : App.current);
    } else {
      Audio_.stopBgm(true);
    }
    this.el.classList.add("hidden");
    this.el.replaceChildren();
    document.body.style.overflow = "";
  },

  tapOrWait(el, ms){
    return new Promise(res => {
      let done = false;
      const finish = () => { if(!done){ done = true; res(); } };
      el.addEventListener("click", finish, {once:true});
      const t0 = Date.now();
      const iv = setInterval(() => {
        if(this.skipFlag || Date.now() - t0 > ms){ clearInterval(iv); finish(); }
      }, 90);
    });
  },
  /* waits for a tap — never auto-advances (SKIP still breaks out) */
  tapOnly(el){
    return new Promise(res => {
      let done = false;
      let iv;
      const finish = () => { if(!done){ done = true; clearInterval(iv); res(); } };
      el.addEventListener("click", finish, {once:true});
      iv = setInterval(() => { if(this.skipFlag) finish(); }, 90);
    });
  },
  wait(ms){
    return new Promise(res => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if(this.skipFlag || Date.now() - t0 > ms){ clearInterval(iv); res(); }
      }, 40);
    });
  },

  /* particle engine */
  initParticles(cv){
    const ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const parts = [];
    this.particles = {cv, ctx, parts, alive:true};
    const loop = () => {
      if(!this.particles || !this.particles.alive) return;
      ctx.clearRect(0,0,cv.width,cv.height);
      for(let i=parts.length-1;i>=0;i--){
        const p = parts[i];
        p.x += p.vx; p.y += p.vy; p.vy += .08; p.life -= 1; p.rot += p.vr;
        if(p.life <= 0){ parts.splice(i,1); continue; }
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life/40);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if(p.shape){ ctx.fillRect(-p.s/2,-p.s/4,p.s,p.s/2); }
        else { ctx.beginPath(); ctx.ellipse(0,0,p.s,p.s*.6,0,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      }
      requestAnimationFrame(loop);
    };
    loop();
  },
  burst(x, y, n, colors=["#ff9ec6","#7fd4f0","#ffd97a","#c4a5f5"]){
    if(!this.particles) return;
    for(let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2, sp = 2+Math.random()*7;
      this.particles.parts.push({
        x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp-2.5,
        s:3+Math.random()*6, c:colors[Math.random()*colors.length|0],
        life:60+Math.random()*50, rot:Math.random()*6, vr:(-.5+Math.random())*.3,
        shape:Math.random()<.5,
      });
    }
  },
  stopParticles(){ if(this.particles){ this.particles.alive = false; this.particles = null; } },
};
