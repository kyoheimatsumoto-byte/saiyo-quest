/* 採用クエスト 共有BGMエンジン(WebAudio・全曲オリジナル)
   使い方: <script src="bgm.js"></script> のあと BGM.mount('prelude'|'quest'|'boss1'|'boss2'|'boss3', 'right'|'left')
   設定はlocalStorageでページ間共有: saiyo-bgm-on ('on'/'off'), saiyo-bgm-vol ('0'〜'1') */
const BGM = (() => {
  const LS_ON = 'saiyo-bgm-on', LS_VOL = 'saiyo-bgm-vol';
  let actx = null, master = null, loopTimer = null, current = null, nextT = 0, gestureBound = false;

  const isOn = () => localStorage.getItem(LS_ON) !== 'off';
  const getVol = () => { const v = parseFloat(localStorage.getItem(LS_VOL)); return isNaN(v) ? 0.5 : v; };
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function ctx() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain();
      master.gain.value = getVol() * 0.5;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  function tone(t, dur, midi, wave, vol, detune) {
    const c = ctx();
    const o = c.createOscillator(), g = c.createGain();
    o.type = wave; o.frequency.value = freq(midi);
    if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, Math.max(t + 0.015, t + dur - 0.06));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* トラック定義: bpm, steps(16分の総数), seq層(1音/step), long層(持続音) */
  function preludeTrack() {
    // 神秘のアルペジオ(4小節): Am9 → Fmaj7 → Cmaj7 → Gsus4
    const chords = [[57,60,64,71],[53,57,60,69],[48,52,59,67],[55,60,62,67]];
    const seq = [];
    chords.forEach(ch => {
      const up = [ch[0],ch[1],ch[2],ch[3],ch[0]+12,ch[1]+12,ch[2]+12,ch[3]+12];
      seq.push(...up, ...up.slice().reverse());
    });
    return { bpm: 74, steps: 64,
      layers: [{ wave: 'sine', vol: 0.16, seq, gate: 2.6 }],
      long: [
        { s: 0,  m: [33, 40], len: 16, wave: 'triangle', vol: 0.10 },
        { s: 16, m: [29, 36], len: 16, wave: 'triangle', vol: 0.10 },
        { s: 32, m: [24, 31], len: 16, wave: 'triangle', vol: 0.10 },
        { s: 48, m: [31, 38], len: 16, wave: 'triangle', vol: 0.10 },
      ] };
  }
  function questTrack() {
    // 疾走バトル(2小節ループ・Em)
    const bass = [], kick = [];
    for (let i = 0; i < 16; i += 2) bass.push(40, 0);           // 小節1: E2の8分
    [38,38,38,38,36,36,36,36].forEach(n => bass.push(n, 0));    // 小節2: D2→C2
    for (let i = 0; i < 32; i += 4) kick.push(i);
    const lead = [64,0,67,0, 71,0,74,0, 76,74,71,67, 69,0,67,0,
                  62,0,65,0, 69,0,74,0, 74,0,73,0,  71,69,67,65];
    return { bpm: 150, steps: 32,
      layers: [
        { wave: 'square',   vol: 0.10, seq: bass, gate: 0.9 },
        { wave: 'square',   vol: 0.07, seq: lead, gate: 0.95 },
        { wave: 'triangle', vol: 0.16, seq: Array.from({length:32},(_,i)=> kick.includes(i)?33:0), gate: 0.4 },
      ], long: [] };
  }
  function boss1Track() {
    // 軽快で熱いボス曲(ギャロップ・Am)
    const gallop = [];
    for (let b = 0; b < 8; b++) { const n = (b < 6) ? 45 : (b === 6 ? 43 : 41); gallop.push(n,0,n,n); }
    const lead = [69,0,72,74, 76,0,74,72, 69,0,72,74, 77,0,76,74,
                  69,0,72,74, 76,0,79,0,  77,76,74,72, 74,0,71,0];
    return { bpm: 168, steps: 32,
      layers: [
        { wave: 'square',   vol: 0.11, seq: gallop, gate: 0.85 },
        { wave: 'square',   vol: 0.075, seq: lead, gate: 0.95 },
        { wave: 'triangle', vol: 0.15, seq: Array.from({length:32},(_,i)=> i%4===0?31:0), gate: 0.4 },
      ], long: [] };
  }
  function boss2Track() {
    // 重厚な決戦曲(Dm・遅めで威圧)
    const bass = [];
    [38,38,38,38,36,36,41,41].forEach(n => bass.push(n,0,0,0));
    const lead = [62,0,0,0, 65,0,63,0, 62,0,0,58, 60,0,62,0,
                  65,0,0,0, 69,0,68,0, 65,0,63,0, 62,0,0,0];
    return { bpm: 116, steps: 32,
      layers: [
        { wave: 'sawtooth', vol: 0.07, seq: bass, gate: 3.2 },
        { wave: 'square',   vol: 0.07, seq: lead, gate: 1.6 },
        { wave: 'triangle', vol: 0.16, seq: Array.from({length:32},(_,i)=> (i%8===0||i%8===6)?26:0), gate: 0.5 },
      ],
      long: [
        { s: 0,  m: [50, 57], len: 16, wave: 'sawtooth', vol: 0.035 },
        { s: 16, m: [48, 55], len: 16, wave: 'sawtooth', vol: 0.035 },
      ] };
  }
  function boss3Track() {
    // 絶望(三全音の軋み・不穏な鐘)
    const bell = Array.from({length: 32}, () => 0);
    bell[0] = 72; bell[6] = 78; bell[12] = 73; bell[20] = 79; bell[26] = 74; bell[30] = 66;
    const creep = Array.from({length: 32}, (_, i) => (i % 8 === 0) ? [36,37,38,37][i/8] : 0);
    return { bpm: 66, steps: 32,
      layers: [
        { wave: 'sine',     vol: 0.10, seq: bell, gate: 4.0 },
        { wave: 'sawtooth', vol: 0.05, seq: creep, gate: 7.0 },
      ],
      long: [
        { s: 0,  m: [36, 42], len: 32, wave: 'sawtooth', vol: 0.030 },
        { s: 0,  m: [36.06, 42.06], len: 32, wave: 'sawtooth', vol: 0.022 },
      ] };
  }
  const TRACKS = { prelude: preludeTrack, quest: questTrack, boss1: boss1Track, boss2: boss2Track, boss3: boss3Track };

  function scheduleOnce(track, t0) {
    const stepDur = 60 / track.bpm / 4;
    track.layers.forEach(L => {
      L.seq.forEach((m, i) => { if (m) tone(t0 + i * stepDur, stepDur * (L.gate || 0.9), m, L.wave, L.vol); });
    });
    (track.long || []).forEach(P => {
      P.m.forEach(m => tone(t0 + P.s * stepDur, P.len * stepDur, m, P.wave, P.vol));
    });
    return track.steps * stepDur;
  }
  function loop() {
    const track = TRACKS[current]();
    const dur = scheduleOnce(track, nextT);
    nextT += dur;
    loopTimer = setTimeout(loop, Math.max(200, (nextT - ctx().currentTime - 0.4) * 1000));
  }

  function play(name) {
    if (!TRACKS[name]) return;
    stop();
    current = name;
    nextT = ctx().currentTime + 0.15;
    loop();
  }
  function stop() {
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    current = null;
  }
  function setVol(v) {
    localStorage.setItem(LS_VOL, String(v));
    if (master) master.gain.value = v * 0.5;
  }

  /* ⚙️ 設定UI + 初回操作での自動再生 */
  function mount(name, side) {
    const pos = side === 'left' ? 'left:12px' : 'right:12px';
    const el = document.createElement('div');
    el.innerHTML =
      `<button id="bgmGear" style="position:fixed;top:12px;${pos};z-index:300;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(10,16,50,.72);color:#dfe8ff;font-size:18px;cursor:pointer;backdrop-filter:blur(4px)">⚙️</button>` +
      `<div id="bgmPanel" style="display:none;position:fixed;top:56px;${pos};z-index:300;background:rgba(8,14,46,.94);border:1px solid rgba(160,190,255,.45);border-radius:12px;padding:14px 16px;color:#dfe8ff;font-size:13px;font-family:'Hiragino Kaku Gothic ProN',sans-serif;min-width:190px;box-shadow:0 6px 24px rgba(0,0,0,.5)">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b>🎵 BGM</b>` +
      `<button id="bgmToggle" style="border:1px solid #8890d8;background:none;color:#dfe8ff;border-radius:999px;padding:3px 14px;font-size:12px;cursor:pointer;font-family:inherit"></button></div>` +
      `<div style="display:flex;align-items:center;gap:8px">🔈<input id="bgmVol" type="range" min="0" max="100" style="flex:1">🔊</div>` +
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

    // ブラウザの自動再生制限: 最初のタップ/クリック/キーで開始
    const kick = () => { if (isOn() && !current) play(name); };
    if (!gestureBound) {
      gestureBound = true;
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
        document.addEventListener(ev, kick, { once: true, passive: true }));
    }
  }

  return { mount, play, stop, setVol, isOn };
})();
