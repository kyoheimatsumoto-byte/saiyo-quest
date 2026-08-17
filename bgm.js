/* 採用クエスト 共有BGMエンジン v4 (オーケストラ音源のシームレスループ再生)
   使い方: <script src="bgm.js?v=8"></script> のあと BGM.mount('prelude'|'quest'|'boss1'|'boss2'|'boss3', 'right'|'left')
   音源: bgm/*.m4a (fluidsynth+GM音源でレンダリングしたオリジナル曲)
   設定はlocalStorageでページ間共有: saiyo-bgm-on ('on'/'off'), saiyo-bgm-vol ('0'〜'1') */
const BGM = (() => {
  const LS_ON = 'saiyo-bgm-on', LS_VOL = 'saiyo-bgm-vol';
  const FILES = {
    prelude: 'bgm/prelude.m4a',
    quest:   'bgm/quest.m4a',
    boss1:   'bgm/boss1.m4a',
    boss2:   'bgm/boss2.m4a?v=2',
    boss3:   'bgm/boss3.m4a?v=3',
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
    master.gain.setValueAtTime(getVol(), c.currentTime);
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
  function footsteps(done) {
    if (localStorage.getItem('saiyo-quiz-sound') === 'off') { if (done) done(); return; }
    const c = ctx();
    const steps = 4, gap = 0.115;
    for (let i = 0; i < steps; i++) {
      const t = c.currentTime + 0.02 + i * gap;
      const len = 0.055;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / d.length, 2.2);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = 850 + (i % 2) * 300;   // 左右の足で音色を少し変える
      const g = c.createGain(); g.gain.value = 0.6;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t);
    }
    if (done) setTimeout(done, steps * gap * 1000 + 60);
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

    // ブラウザの自動再生制限: 最初のタップ/クリック/キーで開始
    const kick = () => { if (isOn() && !current) play(name); };
    if (!gestureBound) {
      gestureBound = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, kick, { once: true, passive: true }));
    }
  }

  return { mount, play, stop, setVol, isOn, footsteps };
})();
