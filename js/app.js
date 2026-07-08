/* ═══ app.js — router & boot ═══ */
"use strict";

const App = {
  current:"home",
  pages:{
    home:      root => Home.render(root),
    gacha:     root => Gacha.render(root),
    gallery:   root => Gallery.render(root),
    collection:root => Collection.render(root),
    members:   root => Members.render(root),
    live:      root => LiveStage.render(root),
    jukebox:   root => Jukebox.render(root),
  },

  go(name){
    if(!this.pages[name]) name = "home";
    this.current = name;
    document.querySelectorAll(".nav-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.nav === name));
    const view = document.getElementById("view");
    view.replaceChildren();
    /* leaving pages with their own audio */
    if(name !== "jukebox" && Jukebox.audio && !Jukebox.audio.paused){ /* keep playing, it's nice */ }
    if(name !== "gacha" && /^bgm_(gacha_home|collection_gacha)/.test(Audio_.bgmName || "")) Audio_.stopBgm();
    if(name !== "live") LiveStage.leave();
    this.pages[name](view);
    scrollTo({top:0, behavior:"instant"});
  },

  updateWallet(){
    document.getElementById("coin-count").textContent = State.coins.toLocaleString();
  },

  /* apply the current UI language to the static chrome (topbar/nav) */
  applyLang(){
    document.documentElement.lang = State.lang;
    document.body.classList.toggle("lang-en", State.lang === "en");
    document.querySelectorAll(".nav-btn").forEach(b => {
      const lab = b.querySelector(".nv-lab");
      if(lab) lab.textContent = t("nav." + b.dataset.nav);
    });
    document.getElementById("wallet").title = t("title.wallet");
    document.getElementById("se-toggle").title = t("title.se");
    document.getElementById("reset-btn").title = t("title.reset");
    const lt = document.getElementById("lang-toggle");
    lt.textContent = State.lang === "ja" ? "JA" : "EN";
    lt.title = t("title.lang");
  },

  boot(){
    /* nav */
    document.querySelectorAll("[data-nav]").forEach(el =>
      el.addEventListener("click", () => this.go(el.dataset.nav)));

    /* language toggle — re-renders the current page */
    this.applyLang();
    document.getElementById("lang-toggle").onclick = () => {
      State.lang = State.lang === "ja" ? "en" : "ja";
      State.save();
      this.applyLang();
      this.go(this.current);
    };

    /* audio toggles */
    const bgmBtn = document.getElementById("bgm-toggle");
    const seBtn = document.getElementById("se-toggle");
    const sync = () => {
      bgmBtn.classList.toggle("off", !State.bgmOn);
      seBtn.classList.toggle("off", !State.seOn);
    };
    bgmBtn.onclick = () => {
      State.bgmOn = !State.bgmOn; State.save(); sync();
      if(!State.bgmOn) Audio_.stopBgm();
      else if(Audio_.wantBgm) Audio_.playBgm(Audio_.wantBgm);
    };
    seBtn.onclick = () => { State.seOn = !State.seOn; State.save(); sync(); };
    sync();

    /* data reset */
    document.getElementById("reset-btn").onclick = () => {
      const modal = document.getElementById("modal");
      const body = document.getElementById("modal-body");
      const close = () => modal.classList.add("hidden");
      body.replaceChildren(
        h("div",{style:"padding:34px;max-width:480px"},
          h("div",{class:"det-name",style:"margin-bottom:6px"},t("reset.title")),
          h("div",{style:"color:var(--ink-dim);font-size:13px;line-height:1.7;margin-bottom:20px"},
            t("reset.desc1"),
            h("br"),
            t("reset.desc2")),
          h("div",{style:"display:flex;flex-direction:column;gap:10px"},
            h("button",{class:"cta primary", onclick:() => {
              if(!confirm(t("reset.gachaConfirm"))) return;
              Object.assign(State, {owned:{}, coins:0, pulls:0, pity:{}, history:[], newFlags:{}});
              State.save(); location.reload();
            }},t("reset.gacha")),
            h("button",{class:"cta ghost", style:"border-color:#c0455f;color:#e888a0", onclick:() => {
              if(!confirm(t("reset.allConfirm"))) return;
              localStorage.removeItem(SAVE_KEY); location.reload();
            }},t("reset.all")),
            h("button",{class:"cta ghost", onclick:close},t("reset.cancel")),
          ),
        ),
      );
      modal.classList.remove("hidden");
      modal.onclick = e => { if(e.target === modal) close(); };
    };

    /* keyboard: ESC closes, arrows navigate */
    addEventListener("keydown", e => {
      if(e.key === "Escape"){
        if(Theater.isOpen()) Theater.stop();
        else if(Detail.isOpen()) Detail.close();
        else if(!document.getElementById("ceremony").classList.contains("hidden"))
          Ceremony.skipFlag = true;
      }
      if(e.key === "ArrowRight" || e.key === "ArrowLeft"){
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if(Theater.isOpen()){ Theater.next(dir); e.preventDefault(); }
        else if(Detail.isOpen()){ Detail.nav(dir); e.preventDefault(); }
      }
    });

    this.updateWallet();
    const hash = location.hash.slice(1);
    if(hash === "test-gacha"){
      this.go("gacha");
      setTimeout(() => {
        const b = Gacha.banner;
        if(b) Gacha.pull(b, Gacha.buildPool(b), 10);
      }, 400);
    } else if(hash === "test-detail"){
      this.go("gallery");
      const c = DB.cards.find(c => c.r === 5 && c.vo && c.arts.length >= 2);
      setTimeout(() => Detail.open(c), 400);
    } else if(hash === "test-theater"){
      this.go("home");
      setTimeout(() => Theater.start(), 400);
    } else if(hash === "test-tear"){
      this.go("gacha");
      setTimeout(() => {
        const b = realBanners().find(x => x.pack);
        const cer = document.getElementById("ceremony");
        cer.classList.remove("hidden");
        cer.replaceChildren();
        const frame = (location.search.match(/frame=(\d+)/) || [])[1] || "06";
        const tear = h("img",{class:"cer-tear", style:"display:block",
          src:`${ASSET}turn/${frame.padStart(2,"0")}_${b.id}.webp`});
        const pk = h("img",{class:"pk", src: +frame >= 2 ? IMG.packopen(b.id) : IMG.pack(b.id)});
        cer.append(h("div",{class:"cer-stage"},
          h("div",{class:"cer-packwrap", style:"animation:none"}, pk, tear)));
      }, 500);
    } else if(hash === "test-live"){
      this.go("live");
    } else if(hash === "test-livegame"){
      this.go("live");
      setTimeout(() => {
        const m = DB.musics.find(x => x.full && x.chart);
        LiveStage.stopMenuBgm();
        const diff = (location.search.match(/diff=(\w+)/) || [])[1] || "NORMAL";
        LiveGame.start(m, LiveStage.unitCards(), diff);
      }, 500);
    } else if(hash === "test-reveal"){
      this.go("gacha");
      setTimeout(() => {
        const cer = document.getElementById("ceremony");
        cer.classList.remove("hidden");
        cer.replaceChildren();
        if(location.search.includes("notrans")) cer.classList.add("notrans");
        const stage = h("div",{class:"cer-stage"});
        cer.append(stage);
        const rar = +((location.search.match(/rar=(\d+)/) || [])[1] || 3);
        const c = DB.cards.find(x => x.r === rar) || DB.cards[0];
        Ceremony.el = cer; Ceremony.skipFlag = false;
        Ceremony.revealCard(stage, {c, isNew:true});
        /* force the flipped end-state for deterministic screenshots */
        setTimeout(() => {
          const card = stage.querySelector(".cer-card");
          if(card) card.classList.add("flipped");
        }, 200);
        if(location.search.includes("red"))
          setTimeout(() => {
            const nm = stage.querySelector(".fr-nm");
            if(nm) nm.style.background = "red";
          }, 2000);
        if(location.search.includes("measure"))
          setTimeout(() => {
            const g = s => { const e = stage.querySelector(s); return e ? e.getBoundingClientRect() : null; };
            const f = g(".face.front"), nm = g(".fr-nm"), im = g(".fr-in img"), cd = g(".cer-card");
            document.title = JSON.stringify({
              card:[cd.top, cd.bottom, cd.height],
              face:[f.top, f.bottom, f.height],
              img:[im.top, im.bottom, im.height],
              nm:[nm.top, nm.bottom, nm.height],
              nmStyle: getComputedStyle(stage.querySelector(".fr-nm")).cssText.slice(0, 0) ||
                       ["bottom","height","padding","transform"].map(p =>
                         p + ":" + getComputedStyle(stage.querySelector(".fr-nm"))[p]).join(" | "),
            });
          }, 2500);
      }, 500);
    } else if(hash === "test-ring"){
      this.go("gacha");
      setTimeout(() => {
        const cer = document.getElementById("ceremony");
        cer.classList.remove("hidden");
        cer.replaceChildren();
        const stage = h("div",{class:"cer-stage"});
        cer.append(stage);
        const pick = r => DB.cards.find(c => c.r === r) || DB.cards[0];
        const gains = [3,4,3,5,3,7,3,8,4,5].map(r => ({c:pick(r), isNew:true}));
        Ceremony.el = cer; Ceremony.skipFlag = false;
        if(location.search.includes("notrans")) cer.classList.add("notrans");
        Ceremony.ringPhase(stage, gains);
        /* headless screenshots race the double-rAF; force the final state */
        setTimeout(() => {
          const r = stage.querySelector(".cer-ring");
          if(r) r.classList.add("spread");
        }, 100);
      }, 500);
    } else {
      this.go(this.pages[hash] ? hash : "home");
    }
  },
};

addEventListener("DOMContentLoaded", () => App.boot());
