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
const STYLE_EN = {1:"Performer",2:"Mood Maker",3:"Cheerleader",4:"Trickster"};
const STYLE_C = {1:"#ff9ec6",2:"#ffd066",3:"#8ee5c0",4:"#b48cff"};
const MOOD = {1:"ハッピー",2:"ニュートラル",3:"メロウ"};
const MOOD_EN = {1:"Happy",2:"Neutral",3:"Mellow"};
const MOOD_C = {1:"#ffb066",2:"#8ee5c0",3:"#8fa8ff"};
const LIMITED = {0:"恒常",1:"期間限定",2:"フェス限定",3:"コラボ",4:"イベント",5:"スペシャル",6:"リンクラ限定",7:"限定"};
const LIMITED_EN = {0:"Permanent",1:"Limited",2:"Fes Limited",3:"Collab",4:"Event",5:"Special",6:"Link!Like Limited",7:"Limited"};
const UNIT_C = {101:"#f5b1cc",102:"#8fa8d8",103:"#f7d277",105:"#b48cff",100:"#9aa3c7",104:"#9aa3c7",201:"#9aa3c7"};

/* quick DB indexes */
const CARD_BY_S = {};
DB.cards.forEach(c => CARD_BY_S[c.s] = c);

/* banners actually released (placeholder entries carry far-future dates) */
const TODAY = new Date().toISOString().slice(0,10);
const realBanners = () => DB.banners.filter(b => b.start <= TODAY);
const futureBanners = () => DB.banners.filter(b => b.start > TODAY);

/* ───── persistent state ───── */
const SAVE_KEY = "hasu_gacha_v1";
const State = {
  owned:{}, coins:0, pulls:0, pity:{}, history:[], newFlags:{},
  live:{}, liveUnit:null, lgSpeed:2,
  bgmOn:true, seOn:true, lang:"en",
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
      bgmOn:this.bgmOn, seOn:this.seOn, lang:this.lang,
    }));
  },
  ownCount(){ return Object.keys(this.owned).length; },
};
State.load();

/* ───── UI language (card data itself stays Japanese) ───── */
const I18N = {
  en:{
    "nav.home":"Home","nav.gacha":"Gacha","nav.gallery":"Gallery","nav.collection":"Collection",
    "nav.members":"Members","nav.live":"Live","nav.jukebox":"Jukebox",
    "title.wallet":"Petal Coins (dupes convert)","title.se":"Sound effects","title.reset":"Reset data","title.lang":"言語：日本語に切替",
    "home.sub":(c,b,s,v)=>`${c} card arts, ${b} gacha banners, ${s} full songs and ${v} voice lines. Pull the gacha, play lives, complete your collection.`,
    "home.ctaGacha":"✦ Pull Gacha","home.ctaLive":"♬ Play Live","home.ctaGallery":"❏ Gallery","home.ctaTheater":"▶ Theater Mode",
    "home.banners":"Pickup Gacha","home.latest":"Latest Cards",
    "coll.luck":"Gacha Fortune","coll.title":"Collection","coll.others":"Others","coll.recent":"Recent Pulls",
    "coll.reset":"⟲ Reset Data","coll.resetConfirm":"Reset your whole collection and gacha history?",
    "luck.needPulls":"Pull 10+ times to reveal your fortune",
    "luck.sub":(p,hi,n)=>`UR-tier actual ${p}% (${hi} / ${n} pulls)`,
    "luck.cnt":(v,p)=>`<b>${v}</b> ${p}`,
    "luck.foot":(d,p,c)=>`${d} pulls since last UR-tier ／ ${p} total pulls ／ ${c} petal coins`,
    "luck.none":"No pulls yet",
    "mem.title":"Members","mem.others":"Others",
    "mem.gen":g=>`Gen ${g}`,"mem.viewCards":(o,a)=>`View cards (${o}/${a}) →`,
    "gacha.title":"Gacha","gacha.pull1":"Pull ×1","gacha.pull1s":"SINGLE PULL",
    "gacha.pull10":"Pull ×10","gacha.pull10s":"10 PULL — SR+ GUARANTEED",
    "gacha.total":n=>`Total <b>${n}</b> pulls`,"gacha.pts":p=>`Exchange Pt. <b>${p}</b> / 600`,
    "gacha.spark":"✦ 600pt exchange: pick a rate-up",
    "gacha.sparkTitle":"Point Exchange","gacha.sparkDesc":"Spend 600pt to receive one pickup card of your choice.",
    "gacha.sparkDone":n=>`✦ <b>${n}</b> received!`,
    "gacha.rates":p=>`Rates (fan-site original): ${p}　*10th card of a 10-pull is SR+ / UR & SR pickups take half their tier / LR & BR drop pickups only (split evenly) / dupes convert to petal coins`,
    "cer.open":"Tap to open","cer.flip":"Tap to flip","cer.next":"Tap to continue","cer.close":"Close",
    "cer.again":n=>`Pull ${n} again ✦`,
    "gal.all":"All","gal.owned":"Owned","gal.notOwned":"Unowned",
    "gal.dim":"Dim unowned","gal.dimTitle":"Gray out cards you don't own",
    "gal.theater":"▶ Theater","gal.theaterTitle":"Full-art slideshow of the cards shown",
    "gal.search":"Search cards…",
    "sort.order":"Newest","sort.orderOld":"Oldest","sort.rarity":"Rarity","sort.char":"Member","sort.appeal":"Appeal","sort.mental":"Mental",
    "evo.normal":"Normal","evo.awakened":"Idolized",
    "gal.idol":"Idolized art","gal.idolTitle":"Show idolized card art in the grid",
    "stat.smile":"Smile","stat.pure":"Pure","stat.cool":"Cool","stat.mental":"Mental",
    "badge.mood":m=>`Mood: ${m}`,"badge.owned":n=>`Owned ×${n}`,"badge.notOwned":"Unowned",
    "voice.gacha":"Gacha",
    "live.title":"School Idol Show","live.small":n=>`SCHOOL IDOL SHOW — ${n} REAL CHARTS`,
    "live.appeal":"Appeal ","live.edit":"⇄ Edit Unit","live.speed":"Speed",
    "live.totalScore":"TOTAL SCORE","live.cleared":n=>`${n} charts cleared`,
    "live.help":"Keys S・D・F・J・K・L, or tap the lanes. Green flicks accept a tap; hold a key over yellow traces.",
    "live.pickerPre":"Unit (","live.pickerPost":"/3)","live.done":"Done",
    "live.needCards":"Get some cards first — guests perform until then",
    "live.noChart":"Chart data not found",
    "live.quit":"Quit (Esc)",
    "live.result":(a,c)=>`Accuracy ${a}%　Max Combo ${c}`,
    "live.coins":n=>`❀ +${n} Petal Coins`,
    "live.retry":"Retry","live.songSel":"Song Select",
    "juke.title":"Jukebox","juke.small":"JUKEBOX — SONGS",
    "juke.songs":n=>`♪ Songs (${n})`,
    "juke.full":"Full-size playback","juke.preview":"Preview playback",
    "juke.tagFull":"(Full)","juke.tagPrev":"(Preview)",
    "th.hint":"CLICK / → Next　ESC Exit","th.noCards":"No cards to display",
    "reset.title":"Reset Data",
    "reset.desc1":"“Gacha data” clears owned cards, petal coins and pull history.",
    "reset.desc2":"“Everything” also clears live scores and settings.",
    "reset.gacha":"✦ Reset gacha data","reset.gachaConfirm":"Delete gacha data (cards / coins / history). Are you sure?",
    "reset.all":"⚠ Reset ALL data","reset.allConfirm":"Delete ALL data including live scores and settings. Are you sure?",
    "reset.cancel":"Cancel",
  },
  ja:{
    "nav.home":"ホーム","nav.gacha":"ガチャ","nav.gallery":"ギャラリー","nav.collection":"コレクション",
    "nav.members":"メンバー","nav.live":"ライブ","nav.jukebox":"ジュークボックス",
    "title.wallet":"ペタルコイン（ダブり変換）","title.se":"効果音","title.reset":"データリセット","title.lang":"Language: switch to English",
    "home.sub":(c,b,s,v)=>`全${c}種のカードアート、${b}のガチャ、フルサイズ${s}曲、ボイス${v}種。ガチャを回し、ライブで遊び、コレクションを完成させよう。`,
    "home.ctaGacha":"✦ ガチャを引く","home.ctaLive":"♬ ライブで遊ぶ","home.ctaGallery":"❏ ギャラリーへ","home.ctaTheater":"▶ シアターモード",
    "home.banners":"ピックアップガチャ","home.latest":"最新カード",
    "coll.luck":"ガチャ運勢","coll.title":"コレクション","coll.others":"その他","coll.recent":"最近の入手",
    "coll.reset":"⟲ データリセット","coll.resetConfirm":"コレクション・ガチャ履歴をすべてリセットしますか？",
    "luck.needPulls":"10回以上引くと運勢が出ます",
    "luck.sub":(p,hi,n)=>`UR帯 実績 ${p}%（${hi}枚 / ${n}回）`,
    "luck.cnt":(v,p)=>`<b>${v}</b>枚 ${p}`,
    "luck.foot":(d,p,c)=>`UR帯なし連続 ${d} 回 ／ 累計 ${p} 回 ／ ペタルコイン ${c}`,
    "luck.none":"まだガチャを引いていません",
    "mem.title":"メンバー","mem.others":"その他",
    "mem.gen":g=>`${g}期生`,"mem.viewCards":(o,a)=>`カードを見る（${o}/${a}） →`,
    "gacha.title":"ガチャ","gacha.pull1":"1回引く","gacha.pull1s":"SINGLE PULL",
    "gacha.pull10":"10回引く","gacha.pull10s":"10 PULL — SR以上1枚確定",
    "gacha.total":n=>`累計 <b>${n}</b> 回`,"gacha.pts":p=>`このガチャの引き換えPt. <b>${p}</b> / 600`,
    "gacha.spark":"✦ 600pt交換：ピックアップ獲得",
    "gacha.sparkTitle":"引き換えPt.交換","gacha.sparkDesc":"600pt を消費して、ピックアップカードを1枚選んで獲得できます。",
    "gacha.sparkDone":n=>`✦ <b>${n}</b> を交換しました！`,
    "gacha.rates":p=>`提供割合（本サイト独自）: ${p}　※10連の10枚目はSR以上確定・UR/SRのピックアップは各枠の半分を占有・LR/BRはピックアップのみ排出（枠内で均等割り）・ダブりはペタルコインに変換`,
    "cer.open":"タップして開封","cer.flip":"タップでカードをめくる","cer.next":"タップで次へ","cer.close":"閉じる",
    "cer.again":n=>`もう一度 ${n}連 ✦`,
    "gal.all":"すべて","gal.owned":"入手済","gal.notOwned":"未入手",
    "gal.dim":"未入手を暗く","gal.dimTitle":"未入手カードをグレー表示",
    "gal.theater":"▶ シアター","gal.theaterTitle":"表示中のカードをフルアートスライドショーで鑑賞",
    "gal.search":"カード名で検索…",
    "sort.order":"実装順","sort.orderOld":"実装順（古い）","sort.rarity":"レアリティ","sort.char":"メンバー順","sort.appeal":"アピール値","sort.mental":"メンタル",
    "evo.normal":"通常","evo.awakened":"覚醒",
    "gal.idol":"覚醒アート","gal.idolTitle":"覚醒後のカードアートで表示",
    "stat.smile":"スマイル","stat.pure":"ピュア","stat.cool":"クール","stat.mental":"メンタル",
    "badge.mood":m=>`ムード：${m}`,"badge.owned":n=>`入手済 ×${n}`,"badge.notOwned":"未入手",
    "voice.gacha":"ガチャ",
    "live.title":"スクールアイドルショウ","live.small":n=>`SCHOOL IDOL SHOW — 実譜面 ${n}曲`,
    "live.appeal":"アピール ","live.edit":"⇄ 編成","live.speed":"スピード",
    "live.totalScore":"トータルスコア","live.cleared":n=>`${n} 譜面クリア`,
    "live.help":"S・D・F・J・K・L キー、またはレーンをタップ。緑フリックはタップでOK、黄トレースはキーを押しっぱなしで拾えます。",
    "live.pickerPre":"ユニット編成（","live.pickerPost":"/3）","live.done":"決定",
    "live.needCards":"カードを入手すると編成できます（未入手の間はゲストが出演）",
    "live.noChart":"譜面データが見つかりません",
    "live.quit":"やめる (Esc)",
    "live.result":(a,c)=>`精度 ${a}%　最大コンボ ${c}`,
    "live.coins":n=>`❀ +${n} ペタルコイン`,
    "live.retry":"もう一度","live.songSel":"曲をえらぶ",
    "juke.title":"ジュークボックス","juke.small":"JUKEBOX — 楽曲",
    "juke.songs":n=>`♪ 楽曲（${n}）`,
    "juke.full":"フルサイズ再生","juke.preview":"試聴版再生",
    "juke.tagFull":"（フル）","juke.tagPrev":"（試聴）",
    "th.hint":"CLICK / → 次へ　ESC 終了","th.noCards":"表示できるカードがありません",
    "reset.title":"データリセット",
    "reset.desc1":"「ガチャデータ」は所持カード・ペタルコイン・ガチャ履歴を消去します。",
    "reset.desc2":"「すべて」はライブのスコアや設定も含めた全データを消去します。",
    "reset.gacha":"✦ ガチャデータをリセット","reset.gachaConfirm":"ガチャデータ（所持カード・コイン・履歴）を削除します。よろしいですか？",
    "reset.all":"⚠ すべてのデータをリセット","reset.allConfirm":"ライブスコア・設定を含む すべてのデータを削除します。よろしいですか？",
    "reset.cancel":"キャンセル",
  },
};
function t(key, ...a){
  const d = I18N[State.lang] || I18N.en;
  const v = (key in d) ? d[key] : I18N.en[key];
  return typeof v === "function" ? v(...a) : (v ?? key);
}
const styleName   = id => (State.lang === "ja" ? STYLE   : STYLE_EN)[id];
const moodName    = id => (State.lang === "ja" ? MOOD    : MOOD_EN)[id];
const limitedName = id => (State.lang === "ja" ? LIMITED : LIMITED_EN)[id];
/* the 11 real members have a unit; the 5 one-off special cards don't */
const isSpecialChar = ch => !(ch.units && ch.units.length);

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
