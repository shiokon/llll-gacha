/* ═══ gallery.js — card grid, filters, detail modal ═══ */
"use strict";

const Gallery = {
  f: { chars:new Set(), rars:new Set(), styles:new Set(), moods:new Set(),
       units:new Set(), owned:"all", q:"", sort:"order", dim:false },

  charIdsInOrder(){
    const ids = Object.keys(DB.chars).map(Number);
    const solo = ids.filter(i => DB.chars[i].units.length || ["101"].includes(DB.chars[i].gen));
    const rest = ids.filter(i => !solo.includes(i));
    return [...solo.sort((a,b)=>a-b), ...rest.sort((a,b)=>a-b)];
  },

  render(root, presetChar){
    if(presetChar){ this.f.chars = new Set([presetChar]); }
    const bar = h("div", {class:"filter-bar"});
    this._chips = [];

    /* creates a chip that keeps its .on state in sync with the filter */
    const mkChip = (parent, label, test, act, color, title) => {
      const chip = h("button", {
        class:"chip", style: color ? `--chip-c:${color}` : "",
        title: title || "",
        onclick:() => { act(); this.sync(); this.refresh(); },
      }, color ? h("span",{class:"dot"}) : null, label);
      this._chips.push({el:chip, test});
      parent.append(chip);
    };

    /* character chips */
    const gChar = h("div", {class:"filter-group"});
    for(const cid of this.charIdsInOrder()){
      const ch = DB.chars[cid];
      if(!DB.cards.some(c => c.c === cid)) continue;
      const label = ch.n.includes("＆")
        ? ch.n.split("＆").map(s => s.trim().split(/[\s ]+/).pop()).join("・")
        : ch.n.replace(/[\s ]/g,"").slice(0,5);
      mkChip(gChar, label, () => this.f.chars.has(cid),
        () => this.togg(this.f.chars, cid), ch.col, ch.en);
    }
    bar.append(gChar);

    /* rarity chips */
    const gRar = h("div", {class:"filter-group"});
    for(const [rid, r] of Object.entries(RAR)){
      if(!DB.cards.some(c => c.r === +rid)) continue;
      mkChip(gRar, r.n, () => this.f.rars.has(+rid),
        () => this.togg(this.f.rars, +rid), r.c);
    }
    bar.append(gRar);

    /* style & mood */
    const gSt = h("div", {class:"filter-group"});
    for(const [sid, sn] of Object.entries(STYLE)){
      mkChip(gSt, sn, () => this.f.styles.has(+sid),
        () => this.togg(this.f.styles, +sid), STYLE_C[sid]);
    }
    for(const [mid, mn] of Object.entries(MOOD)){
      mkChip(gSt, mn, () => this.f.moods.has(+mid),
        () => this.togg(this.f.moods, +mid), MOOD_C[mid]);
    }
    bar.append(gSt);

    /* owned filter + display toggle + theater */
    const gOwn = h("div", {class:"filter-group"});
    for(const [k, lab] of [["all","すべて"],["own","入手済"],["not","未入手"]]){
      mkChip(gOwn, lab, () => this.f.owned === k, () => { this.f.owned = k; });
    }
    mkChip(gOwn, "未入手を暗く", () => this.f.dim,
      () => { this.f.dim = !this.f.dim; }, null, "未入手カードをグレー表示");
    gOwn.append(h("button",{class:"chip", style:"--chip-c:#ffd97a",
      title:"表示中のカードをフルアートスライドショーで鑑賞",
      onclick:() => Theater.start(this.filtered())},
      "▶ シアター"));
    bar.append(gOwn);

    /* search + sort */
    const search = h("input", {placeholder:"カード名で検索…", value:this.f.q,
      oninput:e => { this.f.q = e.target.value; this.refresh(); }});
    bar.append(h("div", {class:"search-box"}, "🔍", search));
    const sel = h("select", {class:"select-sort", onchange:e => { this.f.sort = e.target.value; this.refresh(); }},
      h("option",{value:"order"},"実装順"),
      h("option",{value:"order-old"},"実装順（古い）"),
      h("option",{value:"rarity"},"レアリティ"),
      h("option",{value:"char"},"メンバー順"),
      h("option",{value:"appeal"},"アピール値"),
      h("option",{value:"mental"},"メンタル"),
    );
    sel.value = this.f.sort;
    bar.append(sel);

    const count = h("div", {class:"result-count"});
    const grid = h("div", {class:"card-grid"});
    root.append(bar, count, grid);
    this._grid = grid; this._count = count; this._root = root;
    this.sync();
    this.refresh(true);
  },

  togg(set, v){ set.has(v) ? set.delete(v) : set.add(v); },

  sync(){
    for(const {el, test} of (this._chips || [])) el.classList.toggle("on", !!test());
  },

  filtered(){
    const f = this.f, q = f.q.trim().toLowerCase();
    let list = DB.cards.filter(c => {
      if(f.chars.size && !f.chars.has(c.c)) return false;
      if(f.rars.size && !f.rars.has(c.r)) return false;
      if(f.styles.size && !f.styles.has(c.st)) return false;
      if(f.moods.size && !f.moods.has(c.md)) return false;
      if(f.owned === "own" && !State.owned[c.s]) return false;
      if(f.owned === "not" && State.owned[c.s]) return false;
      if(q && !(c.n.toLowerCase().includes(q) || charOf(c).n.toLowerCase().includes(q))) return false;
      return true;
    });
    const app = c => Math.max(c.stat[4], c.stat[5], c.stat[6]);
    switch(f.sort){
      case "order":     list.sort((a,b) => b.o - a.o || b.s - a.s); break;
      case "order-old": list.sort((a,b) => a.o - b.o || a.s - b.s); break;
      case "rarity":    list.sort((a,b) => rarOf(b).tier - rarOf(a).tier || b.o - a.o); break;
      case "char":      list.sort((a,b) => a.c - b.c || b.o - a.o); break;
      case "appeal":    list.sort((a,b) => app(b) - app(a)); break;
      case "mental":    list.sort((a,b) => b.stat[7] - a.stat[7]); break;
    }
    return list;
  },

  refresh(first){
    const list = this.filtered();
    this.lastList = list;
    this._count.textContent = `${list.length} / ${DB.cards.length} cards`;
    this._grid.replaceChildren();
    const frag = document.createDocumentFragment();
    for(const c of list) frag.append(this.cardEl(c, {list}));
    this._grid.append(frag);
  },

  cardEl(c, opts={}){
    const r = rarOf(c), ch = charOf(c);
    const owned = !!State.owned[c.s];
    const el = h("div", {
      class:"ccard" + (!owned && !opts.noDim && Gallery.f.dim ? " unowned" : ""),
      style:`--rc:${r.c}`,
      onclick:() => Detail.open(c, opts.list),
    },
      h("img", {src:IMG.thumb(c.th), loading:"lazy", alt:c.n}),
      h("span", {class:"rar"}, r.n),
      owned && State.owned[c.s] > 1 ? h("span",{class:"own"},`×${State.owned[c.s]}`) : null,
      State.newFlags[c.s] ? h("span",{class:"newtag"},"NEW") : null,
      h("div", {class:"nm"},
        h("i",{class:"cdot", style:`background:${ch.col};color:${ch.col}`}),
        c.n),
    );
    return el;
  },
};

/* ───── detail modal ───── */
const Detail = {
  _list:null, _idx:-1,

  open(c, list){
    if(list) this._list = list;
    else if(!this._list || !this._list.includes(c)) this._list = Gallery.lastList || DB.cards;
    this._idx = this._list.indexOf(c);

    delete State.newFlags[c.s]; State.save();
    const modal = document.getElementById("modal");
    const body = document.getElementById("modal-body");
    body.replaceChildren();
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    Audio_.stopVoice();

    const r = rarOf(c), ch = charOf(c);
    let artIdx = c.arts.length - 1;

    const art = h("img", {class:"det-art", src:IMG.full(c.arts[artIdx])});
    const bgblur = h("div", {class:"bgblur", style:`background-image:url(${IMG.full(c.arts[artIdx])})`});
    /* {sid}0 = 通常, {sid}1 = 覚醒 */
    const evoLabel = aid => aid % 10 === 0 ? "通常" : "覚醒";
    const tabs = h("div", {class:"det-evotabs"});
    c.arts.forEach((aid, i) => {
      tabs.append(h("button", {
        class:"evotab" + (i === artIdx ? " on" : ""),
        onclick:e => {
          artIdx = i;
          tabs.querySelectorAll(".evotab").forEach((t,j)=>t.classList.toggle("on", j===i));
          art.classList.add("swapping");
          setTimeout(() => {
            art.src = IMG.full(aid);
            bgblur.style.backgroundImage = `url(${IMG.full(aid)})`;
            art.onload = () => art.classList.remove("swapping");
          }, 180);
        },
      }, evoLabel(aid)));
    });

    const holoWrap = attachHolo(
      h("div",{style:"border-radius:14px;display:inline-block"}, art), r.tier, 7);

    const hero = h("div", {class:"det-hero"},
      bgblur,
      h("button", {class:"icon-btn det-close", onclick:() => this.close()}, "✕"),
      this._list.length > 1 ? h("button",{class:"icon-btn det-nav prev", onclick:() => this.nav(-1)},"‹") : null,
      this._list.length > 1 ? h("button",{class:"icon-btn det-nav next", onclick:() => this.nav(1)},"›") : null,
      h("div", {class:"det-art-wrap", style:"perspective:1100px"}, holoWrap),
      c.arts.length > 1 ? tabs : h("div",{style:"padding-bottom:16px"}),
      c.chibi ? h("img",{class:"det-chibi", src:IMG.chibi(c.s)}) : null,
    );

    /* left column: name / badges / stats */
    const statDefs = [["スマイル","--smile",0,4],["ピュア","--pure",1,5],["クール","--cool",2,6],["メンタル","--mental",3,7]];
    const maxStat = Math.max(c.stat[4], c.stat[5], c.stat[6], 1);
    const stats = h("div", {class:"stats-block"});
    for(const [lab, cvar, i0, i1] of statDefs){
      const isMental = lab === "メンタル";
      const pct = isMental ? Math.min(100, c.stat[i1]/8) : c.stat[i1]/maxStat*100;
      const bar = h("i", {style:`--sc:var(${cvar});background:var(${cvar})`});
      stats.append(h("div", {class:"stat-row"},
        h("span",{class:"lab"},lab),
        h("div",{class:"bar"}, bar),
        h("span",{class:"val", html:`${c.stat[i0]} → <b>${c.stat[i1]}</b>`}),
      ));
      requestAnimationFrame(() => requestAnimationFrame(() => bar.style.width = pct + "%"));
    }

    const left = h("div", {},
      h("div", {class:"det-name"}, c.n),
      h("div", {class:"det-charline"},
        h("i",{class:"cdot",style:`background:${ch.col};color:${ch.col}`}),
        ch.n, h("small",{style:"opacity:.6;font-family:Jost"}, ch.en),
      ),
      h("div", {class:"badge-row"},
        h("span",{class:"badge rb", style:`background:${r.c}`}, r.n),
        h("span",{class:"badge", style:`color:${STYLE_C[c.st]};border-color:${STYLE_C[c.st]}44`}, STYLE[c.st]||"?"),
        h("span",{class:"badge", style:`color:${MOOD_C[c.md]};border-color:${MOOD_C[c.md]}44`}, "ムード：" + (MOOD[c.md]||"?")),
        c.lt ? h("span",{class:"badge", style:"color:var(--gold);border-color:rgba(255,217,122,.4)"}, LIMITED[c.lt]||"限定") : null,
        h("span",{class:"badge"}, `BP ${c.bp}`),
        State.owned[c.s] ? h("span",{class:"badge",style:"color:var(--mint);border-color:rgba(142,229,192,.4)"},`入手済 ×${State.owned[c.s]}`) : h("span",{class:"badge"},"未入手"),
      ),
      stats,
      this.voiceBlock(c),
    );

    /* right column: skills */
    const right = h("div", {});
    const skillRow = (kind, s, extra) => {
      if(!s) return null;
      return h("div", {class:"skill-card"},
        h("div", {class:"skill-head"},
          s.i ? h("img",{src:IMG.icon(s.i)}) : null,
          h("div", {},
            h("span",{class:"skill-kind"}, kind),
            h("span",{class:"skill-name"}, s.n)),
          s.cost ? h("span",{class:"skill-cost"},`AP ${s.cost}`) : null,
        ),
        h("div",{class:"skill-desc", html: fmtDesc(s.d) + (s.lv ? ` <span style="opacity:.55">(Lv.${s.lv})</span>` : "")}),
      );
    };
    right.append(
      skillRow("SPECIAL APPEAL", c.ap),
      skillRow("SKILL", c.sk),
      skillRow("CENTER SKILL", c.cs),
      skillRow("CENTER ATTRIBUTE", c.ca),
    );

    body.append(hero, h("div",{class:"det-body"}, left, right));
    body.scrollTop = 0;
    modal.onclick = e => { if(e.target === modal) this.close(); };
  },

  voiceBlock(c){
    /* gacha voicelines only — [file, label] pairs */
    const items = (c.vo || []).filter(v => v.includes("_gacha_"))
      .map((v, i, arr) => [v, "ガチャ" + (arr.length > 1 ? ` ${i+1}` : "")]);
    if(!items.length) return null;
    const wrap = h("div", {style:"margin-top:18px"});
    wrap.append(h("div",{style:"font-size:11px;letter-spacing:.2em;color:var(--sky);margin-bottom:8px"},
      "VOICE"));
    const row = h("div", {class:"voice-row"});
    for(const [v, label] of items){
      const btn = h("button", {class:"voice-btn", onclick:e => {
        document.querySelectorAll(".voice-btn.playing").forEach(b=>b.classList.remove("playing"));
        btn.classList.add("playing");
        const a = Audio_.voice(v);
        a.onended = () => btn.classList.remove("playing");
      }}, "▶ " + label);
      row.append(btn);
    }
    wrap.append(row);
    return wrap;
  },

  nav(dir){
    if(!this._list || this._list.length < 2) return;
    const i = (this._idx + dir + this._list.length) % this._list.length;
    this.open(this._list[i]);
  },

  isOpen(){
    return !document.getElementById("modal").classList.contains("hidden");
  },

  close(){
    Audio_.stopVoice();
    document.getElementById("modal").classList.add("hidden");
    document.body.style.overflow = "";
  },
};
