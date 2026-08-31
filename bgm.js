/* 採用クエスト 共有BGMエンジン v4 (オーケストラ音源のシームレスループ再生)
   使い方: <script src="bgm.js?v=12"></script> のあと BGM.mount('prelude'|'status'|'quest'|'boss1'|'boss2'|'boss3', 'right'|'left')
   音源: bgm/*.m4a (fluidsynth+GM音源でレンダリングしたオリジナル曲)
   設定はlocalStorageでページ間共有: saiyo-bgm-on ('on'/'off'), saiyo-bgm-vol ('0'〜'1') */
const BGM = (() => {
  const LS_ON = 'saiyo-bgm-on', LS_VOL = 'saiyo-bgm-vol';
  const FILES = {
    prelude: 'bgm/prelude.m4a',
    status:  'bgm/status.m4a',
    quest:   'bgm/quest.m4a?v=7',
    boss1:   'bgm/boss1.m4a',
    boss2:   'bgm/boss2.m4a?v=2',
    boss3:   'bgm/boss3.m4a?v=4',
    gacha:   'bgm/gacha.m4a?v=2',
    exboss:  'bgm/exboss.m4a?v=2',
    // ▼試聴候補（採用が決まったら削除する）
    questQA: 'bgm/quest_qa.m4a',
    questQB: 'bgm/quest_qb.m4a',
    questQC: 'bgm/quest_qc.m4a',
    bossS1:  'bgm/boss_s1.m4a',
    bossS2:  'bgm/boss_s2.m4a',
    bossS3:  'bgm/boss_s3.m4a',
    bossS4:  'bgm/boss_s4.m4a',
    bossS5:  'bgm/boss_s5.m4a',

  };
  let actx = null, master = null, srcNode = null, current = null, gestureBound = false;
  const buffers = {};

  const isOn = () => localStorage.getItem(LS_ON) !== 'off';
  const getVol = () => { const v = parseFloat(localStorage.getItem(LS_VOL)); return isNaN(v) ? 0.85 : v; };

  function ctx() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = getVol();
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  async function load(name) {
    if (buffers[name]) return buffers[name];
    const res = await fetch(FILES[name]);
    const ab = await res.arrayBuffer();
    buffers[name] = await ctx().decodeAudioData(ab);
    return buffers[name];
  }

  function killSrc() {
    if (srcNode) { try { srcNode.stop(); } catch (e) {} srcNode = null; }
  }

  async function play(name) {
    if (!FILES[name]) return;
    const c = ctx();
    current = name;
    killSrc();
    master.gain.cancelScheduledValues(c.currentTime);
    master.gain.setValueAtTime(0.0001, c.currentTime);
    // いきなり最大音量で始まると唐突なので0.5秒でフェードイン（ループ自体は無加工）
    master.gain.exponentialRampToValueAtTime(Math.max(0.0002, getVol()), c.currentTime + 0.5);
    try {
      const buf = await load(name);
      if (current !== name) return;  // 待っている間に停止/切替された
      killSrc();
      srcNode = c.createBufferSource();
      srcNode.buffer = buf;
      srcNode.loop = true;
      srcNode.connect(master);
      srcNode.start();
    } catch (e) { /* 読み込み失敗時は無音のまま */ }
  }

  function stop() {
    current = null;
    killSrc();
    if (master && actx) {
      master.gain.cancelScheduledValues(actx.currentTime);
      master.gain.setTargetAtTime(0.0001, actx.currentTime, 0.04);
    }
  }

  function setVol(v) {
    localStorage.setItem(LS_VOL, String(v));
    if (master && current) master.gain.value = v;
  }

  /* 足音SE「タッタッタッタ」(4歩) — 効果音設定に従う。doneは足音後に呼ばれる */
  async function footsteps(done) {
    if (localStorage.getItem('saiyo-quiz-sound') === 'off') { if (done) done(); return; }
    const c = ctx();
    try { if (c.state === 'suspended') await c.resume(); } catch (e) {}
    const steps = 4, gap = 0.115;
    const t0 = c.currentTime + 0.03;
    for (let i = 0; i < steps; i++) {
      const t = t0 + i * gap;
      const len = 0.06;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 2.2);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = 900 + (i % 2) * 350;
      const g = c.createGain(); g.gain.value = 1.0;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t);
    }
    if (done) setTimeout(done, steps * gap * 1000 + 100);
  }

  /* 決定音「キラリン」(ステータスを開くとき等のクリスタル・チャイム) */
  async function chime(done) {
    if (localStorage.getItem('saiyo-quiz-sound') === 'off') { if (done) done(); return; }
    const c = ctx();
    try { if (c.state === 'suspended') await c.resume(); } catch (e) {}
    const t0 = c.currentTime + 0.03;
    [[1318.5, 0, .30], [1760, .07, .30], [2637, .14, .40]].forEach(([f, dt, dur]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + dt);
      g.gain.linearRampToValueAtTime(.28, t0 + dt + .012);
      g.gain.exponentialRampToValueAtTime(.001, t0 + dt + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0 + dt); o.stop(t0 + dt + dur + .05);
    });
    const o2 = c.createOscillator(), g2 = c.createGain();  // きらめき
    o2.type = 'sine'; o2.frequency.setValueAtTime(3520, t0 + .2);
    o2.frequency.exponentialRampToValueAtTime(5274, t0 + .42);
    g2.gain.setValueAtTime(0, t0 + .2);
    g2.gain.linearRampToValueAtTime(.10, t0 + .23);
    g2.gain.exponentialRampToValueAtTime(.001, t0 + .5);
    o2.connect(g2); g2.connect(c.destination);
    o2.start(t0 + .2); o2.stop(t0 + .55);
    if (done) setTimeout(done, 430);
  }

  /* ⚙️ 設定UI + 初回操作での自動再生 */
  function mount(name, side) {
    const pos = side === 'left' ? 'left:max(12px, env(safe-area-inset-left))' : 'right:max(12px, env(safe-area-inset-right))';
    const el = document.createElement('div');
    el.innerHTML =
      `<button id="bgmGear" style="position:fixed;top:max(12px, env(safe-area-inset-top));${pos};z-index:300;width:40px;height:40px;border-radius:50%;border:2px solid #ffffff;background:#0c1560;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 0 0 2px #3858e8,0 4px 14px rgba(0,0,0,.7);line-height:1">⚙️</button>` +
      `<div id="bgmPanel" style="display:none;position:fixed;top:calc(max(12px, env(safe-area-inset-top)) + 48px);${pos};max-width:calc(100vw - 24px);z-index:300;background:#0a1148;border:2px solid #fff;border-radius:12px;padding:14px 16px;color:#eef2ff;font-size:13px;font-family:'Hiragino Kaku Gothic ProN',sans-serif;min-width:200px;box-shadow:0 0 0 2px #3858e8,0 8px 28px rgba(0,0,0,.75)">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>🎵 BGM</b>` +
      `<button id="bgmToggle" style="border:1px solid #8890d8;background:none;color:#dfe8ff;border-radius:999px;padding:3px 14px;font-size:12px;cursor:pointer;font-family:inherit"></button></div>` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">🔈<input id="bgmVol" type="range" min="0" max="100" style="flex:1">🔊</div>` +
      `<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed rgba(160,190,255,.4);padding-top:10px"><b>🔔 効果音</b>` +
      `<button id="seToggle" style="border:1px solid #8890d8;background:none;color:#dfe8ff;border-radius:999px;padding:3px 14px;font-size:12px;cursor:pointer;font-family:inherit"></button></div>` +
      `</div>`;
    document.body.appendChild(el);
    const gear = document.getElementById('bgmGear'), panel = document.getElementById('bgmPanel');
    const tgl = document.getElementById('bgmToggle'), slider = document.getElementById('bgmVol');
    const paint = () => { tgl.textContent = isOn() ? 'ON' : 'OFF'; tgl.style.color = isOn() ? '#8fe8a0' : '#8890d8'; tgl.style.borderColor = tgl.style.color; };
    slider.value = Math.round(getVol() * 100);
    paint();
    gear.addEventListener('click', () => { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; });
    tgl.addEventListener('click', () => {
      localStorage.setItem(LS_ON, isOn() ? 'off' : 'on');
      paint();
      if (isOn()) play(name); else stop();
    });
    slider.addEventListener('input', () => setVol(slider.value / 100));
    const seBtn = document.getElementById('seToggle');
    const SE_KEY = 'saiyo-quiz-sound';
    const seOn = () => localStorage.getItem(SE_KEY) !== 'off';
    const paintSe = () => { seBtn.textContent = seOn() ? 'ON' : 'OFF'; seBtn.style.color = seOn() ? '#8fe8a0' : '#8890d8'; seBtn.style.borderColor = seBtn.style.color; };
    paintSe();
    seBtn.addEventListener('click', () => { localStorage.setItem(SE_KEY, seOn() ? 'off' : 'on'); paintSe(); });

    // まず即時再生を試みる(コンテキストがsuspendedでも音源を待機させておく)
    if (isOn()) { try { play(name); } catch (e) {} }
    // 自動再生がブロックされた場合: 最初のタップ/クリック/キーでresume→即座に鳴る
    const kick = () => { if (!isOn()) return; if (!current) play(name); else { try { ctx(); } catch (e) {} } };
    if (!gestureBound) {
      gestureBound = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, kick, { once: true, passive: true }));
    }
  }

  return { mount, play, stop, setVol, isOn, footsteps, chime };
})();
/* const は window に載らないため、window.BGM を見ている呼び出し側のために明示的に公開する
   （これが無いと menu の足音・BGMブリッジ、boss の BGM停止が黙って無効化される） */
window.BGM = BGM;
