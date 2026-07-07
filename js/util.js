/* ═══ util.js — constants, state, audio, helpers ═══ */
"use strict";

const ASSET = (location.protocol === "file:" || !ASSET_REMOTE) ? "assets/" : ASSET_REMOTE;
const IMG = {
  full:  id => `${ASSET}full/${id}.webp`,
  thumb: id => `${ASSET}thumb/${id}.webp`,
  icon:  id => `${ASSET}icon/${id}.webp`,
  banner:id => `${ASSET}banner/${id}.webp`,
  pack:  id => `${ASSET}pack/${id}.webp`,
  packopen:id => `${ASSET}packopen/${id}.webp`,
  chibi: id => `${ASSET}chibi/${id}.webp`,
  jacket:id => `${ASSET}jacket/${id}.webp`,
};
const AUD = {
  se:    n => `${ASSET}se/${n}.m4a`,
  voice: n => `${ASSET}voice/${n}.m4a`,
  bgm:   n => `${ASSET}bgm/${n}.m4a`,
  live:  n => `${ASSET}live/${n}.m4a`,
  ost:   n => `${ASSET}ost/${n}.m4a`,
};

const RAR = {
  3:{n:"R",  c:"#8fb8de", coin:20,  tier:1},
  4:{n:"SR", c:"#ffd066", coin:100, tier:2},
  5:{n:"UR", c:"#ff9ec6", coin:500, tier:3},
  7:{n:"LR", c:"#69e0b8", coin:800, tier:4},
  8:{n:"DR", c:"#b48cff", coin:800, tier:4},
  9:{n:"BR", c:"#ff8fa3", coin:500, tier:3},
  93:{n:"mR", c:"#c9b18f", coin:20, tier:1},
  94:{n:"mSR",c:"#e0b184", coin:100,tier:2},
  95:{n:"mUR",c:"#f0a86e", coin:500,tier:3},
};
const STYLE = {1:"パフォーマー",2:"ムードメーカー",3:"チアリーダー",4:"トリックスター"};
const STYLE_C = {1:"#ff9ec6",2:"#ffd066",3:"#8ee5c0",4:"#b48cff"};
const MOOD = {1:"ハッピー",2:"ニュートラル",3:"メロウ"};
const MOOD_C = {1:"#ffb066",2:"#8ee5c0",3:"#8fa8ff"};
const LIMITED = {0:"恒常",1:"期間限定",2:"フェス限定",3:"コラボ",4:"イベント",5:"スペシャル",6:"リンクラ限定",7:"限定"};
const VO_KIND = {
  gacha:"ガチャ", livestart:"ライブ開始", message:"メッセージ",
  skill:"スキル", spappeal:"アピール", training:"特訓", duet:"デュエット",
};
/* m-rarity cards have no per-card acb; they use per-character line banks
   (vo_chara_m{charId} → voice/m{charId}_{kind}.m4a) */
const M_VO = [
  ["clear1_0001","ライブクリア①"], ["clear2_0001","ライブクリア②"], ["clear3_0001","ライブクリア③"],
  ["spduet_0001","SPデュエット①"], ["spduet_0002","SPデュエット②"], ["spduet_0003","SPデュエット③"],
  ["sectionpositive_0001","セクション好調"], ["skillpositive_0001","スキル発動"],
  ["stylelv_0001","スタイルLv UP"], ["stylemax_0001","スタイルMAX"], ["starrank_0001","スターランクUP"],
];
const UNIT_C = {101:"#f5b1cc",102:"#8fa8d8",103:"#f7d277",105:"#b48cff",100:"#9aa3c7",104:"#9aa3c7",201:"#9aa3c7"};

/* quick DB indexes */
const CARD_BY_S = {};
DB.cards.forEach(c => CARD_BY_S[c.s] = c);

/* banners actually released (placeholder entries carry far-future dates) */
const TODAY = new Date().toISOString().slice(0,10);
const realBanners = () => DB.banners.filter(b => b.start <= TODAY);
const futureBanners = () => DB.banners.filter(b => b.start > TODAY);

/* ───── persistent state ───── */
const SAVE_KEY = "hasu_atelier_v1";
const State = {
  owned:{}, coins:0, pulls:0, pity:{}, history:[], newFlags:{},
  live:{}, liveUnit:null, lgSpeed:2,
  bgmOn:true, seOn:true,
  load(){
    try{
      const j = JSON.parse(localStorage.getItem(SAVE_KEY));
      if(j) Object.assign(this, j);
    }catch(e){}
  },
  save(){
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      owned:this.owned, coins:this.coins, pulls:this.pulls, pity:this.pity,
      history:this.history.slice(-80), newFlags:this.newFlags,
      live:this.live, liveUnit:this.liveUnit, lgSpeed:this.lgSpeed,
      bgmOn:this.bgmOn, seOn:this.seOn,
    }));
  },
  ownCount(){ return Object.keys(this.owned).length; },
};
State.load();

/* ───── audio manager ───── */
const Audio_ = {
  bgmEl:null, bgmName:null, unlocked:false, fadeTimer:null,
  voiceEl:null,
  init(){
    const unlock = () => {
      this.unlocked = true;
      if(this.wantBgm) this.playBgm(this.wantBgm);
      document.removeEventListener("pointerdown", unlock);
    };
    document.addEventListener("pointerdown", unlock);
  },
  se(name, vol=0.9){
    if(!State.seOn) return;
    const a = new Audio(AUD.se(name));
    a.volume = vol;
    a.play().catch(()=>{});
    return a;
  },
  voice(file, vol=1){
    this.stopVoice();
    const a = new Audio(AUD.voice(file));
    a.volume = vol;
    a.play().catch(()=>{});
    this.voiceEl = a;
    return a;
  },
  stopVoice(){ if(this.voiceEl){ this.voiceEl.pause(); this.voiceEl = null; } },
  playBgm(name, vol=0.35){
    this.wantBgm = name;
    if(!State.bgmOn || !this.unlocked) return;
    if(this.bgmName === name && this.bgmEl && !this.bgmEl.paused) return;
    this.stopBgm(true);
    const a = new Audio(AUD.se(name));
    a.loop = true; a.volume = 0;
    a.play().catch(()=>{});
    this.bgmEl = a; this.bgmName = name;
    let v = 0;
    clearInterval(this.fadeTimer);
    this.fadeTimer = setInterval(() => {
      v = Math.min(vol, v + 0.03);
      a.volume = v;
      if(v >= vol) clearInterval(this.fadeTimer);
    }, 60);
  },
  stopBgm(instant){
    clearInterval(this.fadeTimer);
    const el = this.bgmEl;
    this.bgmEl = null; this.bgmName = null;
    if(!el) return;
    if(instant){ el.pause(); return; }
    this.fadeTimer = setInterval(() => {
      el.volume = Math.max(0, el.volume - 0.05);
      if(el.volume <= 0){ el.pause(); clearInterval(this.fadeTimer); }
    }, 50);
  },
};
Audio_.init();

/* ───── tiny dom helpers ───── */
function h(tag, attrs={}, ...kids){
  const el = document.createElement(tag);
  if(typeof attrs !== "object" || attrs === null || attrs.nodeType){
    kids.unshift(attrs); attrs = {};
  }
  for(const [k,v] of Object.entries(attrs)){
    if(k === "class") el.className = v;
    else if(k === "style") el.style.cssText = v;
    else if(k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if(k === "html") el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for(const kid of kids.flat()){
    if(kid == null) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}
const esc = s => String(s).replace(/[&<>"]/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
/* $..$ number markup in skill text → gold bold */
const fmtDesc = s => esc(s||"").replace(/\$(.+?)\$/g, "<b>$1</b>");

function toast(msg){
  const t = h("div", {class:"toast", html:msg});
  document.getElementById("toast-wrap").append(t);
  setTimeout(() => { t.style.opacity = 0; t.style.transition = "opacity .4s"; }, 2600);
  setTimeout(() => t.remove(), 3100);
}

function charOf(c){ return DB.chars[c.c] || {n:"？？？", col:"#888", en:"", units:[]}; }
function rarOf(c){ return RAR[c.r] || {n:"?", c:"#999", coin:10, tier:0}; }

/* pointer-tracked 3D tilt + holo foil. tier>=3 gets rainbow foil. */
function attachHolo(wrap, tier, maxTilt = 10){
  wrap.classList.add("holo");
  wrap.style.setProperty("--foil", tier >= 4 ? .85 : tier === 3 ? .6 : 0);
  const glare = h("div",{class:"holo-glare"});
  const foil = h("div",{class:"holo-foil"});
  wrap.append(glare, foil);
  const move = e => {
    const r = wrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    wrap.classList.add("active");
    wrap.style.transform =
      `rotateY(${(px - .5) * maxTilt * 2}deg) rotateX(${(py - .5) * -maxTilt * 2}deg) scale(1.015)`;
    wrap.style.setProperty("--hx", (px * 100).toFixed(1) + "%");
    wrap.style.setProperty("--hy", (py * 100).toFixed(1) + "%");
    foil.style.backgroundPosition = `${(px * 130).toFixed(1)}% ${(py * 130).toFixed(1)}%`;
  };
  wrap.addEventListener("pointermove", move);
  wrap.addEventListener("pointerleave", () => {
    wrap.classList.remove("active");
    wrap.style.transform = "";
  });
  return wrap;
}

/* ───── drifting petals canvas ───── */
(function petals(){
  const cv = document.getElementById("petals");
  const ctx = cv.getContext("2d");
  let W, H, ps = [];
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  addEventListener("resize", resize); resize();
  const COLORS = ["255,158,198","196,165,245","127,212,240","255,217,122"];
  for(let i=0;i<26;i++) ps.push(spawn(true));
  function spawn(anyY){
    return {
      x:Math.random()*W, y:anyY?Math.random()*H:-20,
      s:4+Math.random()*7, vy:.25+Math.random()*.6, vx:-.15+Math.random()*.4,
      rot:Math.random()*Math.PI*2, vr:(-.5+Math.random())*.02,
      c:COLORS[Math.random()*COLORS.length|0], a:.12+Math.random()*.22,
      sway:Math.random()*Math.PI*2,
    };
  }
  (function tick(){
    ctx.clearRect(0,0,W,H);
    for(let p of ps){
      p.y += p.vy; p.x += p.vx + Math.sin(p.sway += .008)*.3; p.rot += p.vr;
      if(p.y > H+30 || p.x < -40 || p.x > W+40) Object.assign(p, spawn());
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${p.c},${p.a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s*.62, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(tick);
  })();
})();
