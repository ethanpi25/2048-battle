var SoundManager = (function () {
  var audioCtx = null;
  var muted = false;
  var lastMilestone = 0;
  var zhVoice = null;

  // Pre-load Chinese voice when available
  function loadVoices() {
    if (!window.speechSynthesis) return;
    var voices = speechSynthesis.getVoices();
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang.indexOf('zh') === 0) {
        zhVoice = voices[i];
        break;
      }
    }
  }

  function init() {
    // Pre-load voices
    loadVoices();
    if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function ensureContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playMove() {
    if (muted) return;
    var ctx = ensureContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  function playMerge() {
    if (muted) return;
    var ctx = ensureContext();

    var frequencies = [523, 659, 784]; // C5, E5, G5 chord
    for (var i = 0; i < frequencies.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencies[i], ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  }

  function playCountdown() {
    if (muted) return;
    var ctx = ensureContext();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  function playGameOver() {
    if (muted) return;
    var ctx = ensureContext();

    var notes = [440, 370, 330, 262]; // A4, F#4, E4, C4 descending
    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      var startTime = ctx.currentTime + i * 0.15;
      osc.frequency.setValueAtTime(notes[i], startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

      osc.start(startTime);
      osc.stop(startTime + 0.3);
    }
  }

  function checkMilestone(score) {
    if (muted) return;
    var currentMilestone = Math.floor(score / 100) * 100;
    if (currentMilestone > lastMilestone && currentMilestone > 0) {
      lastMilestone = currentMilestone;
      speakGreat();
    }
  }

  function speakGreat() {
    if (muted) return;
    if (!window.speechSynthesis) return;

    var utterance = new SpeechSynthesisUtterance('太棒了');
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    utterance.volume = 0.8;

    // Use cached Chinese voice if available
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    speechSynthesis.speak(utterance);
  }

  function toggleMute() {
    muted = !muted;
    if (muted) {
      if (window.speechSynthesis) speechSynthesis.cancel();
      stopBGM();
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function resetMilestone() {
    lastMilestone = 0;
  }

  // BGM - 20 upbeat energetic tracks, randomly selected
  var bgmPlaying = false;
  var bgmNodes = [];
  var bgmTimer = null;
  var lastTrackIndex = -1;

  var bgmTracks = [
    // Track 1: Bouncy high energy
    { melody: [
      {f:784,d:0.15},{f:880,d:0.15},{f:1047,d:0.12},{f:880,d:0.18},{f:784,d:0.12},
      {f:659,d:0.15},{f:784,d:0.2},{f:523,d:0.12},{f:659,d:0.15},{f:784,d:0.12},
      {f:880,d:0.18},{f:1047,d:0.15},{f:1175,d:0.12},{f:1047,d:0.15},{f:880,d:0.12},
      {f:784,d:0.2},{f:659,d:0.15},{f:784,d:0.12},{f:880,d:0.15},{f:1047,d:0.2}
    ], bass: [
      {f:262,d:0.3},{f:196,d:0.3},{f:220,d:0.3},{f:262,d:0.3},
      {f:196,d:0.3},{f:262,d:0.3},{f:220,d:0.3},{f:196,d:0.3}
    ], wave: 'triangle' },

    // Track 2: Cheerful dance
    { melody: [
      {f:659,d:0.12},{f:784,d:0.12},{f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.18},
      {f:523,d:0.12},{f:659,d:0.12},{f:784,d:0.25},{f:880,d:0.12},{f:1047,d:0.12},
      {f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.12},{f:784,d:0.18},{f:880,d:0.12},
      {f:1047,d:0.2},{f:880,d:0.12},{f:784,d:0.15},{f:659,d:0.18},{f:523,d:0.25}
    ], bass: [
      {f:196,d:0.25},{f:262,d:0.25},{f:220,d:0.25},{f:196,d:0.25},
      {f:262,d:0.25},{f:220,d:0.25},{f:196,d:0.25},{f:262,d:0.35}
    ], wave: 'triangle' },

    // Track 3: Sprinting forward
    { melody: [
      {f:1047,d:0.1},{f:880,d:0.1},{f:784,d:0.1},{f:880,d:0.15},{f:1047,d:0.1},
      {f:1175,d:0.15},{f:1047,d:0.1},{f:880,d:0.1},{f:784,d:0.15},{f:659,d:0.1},
      {f:784,d:0.1},{f:880,d:0.15},{f:1047,d:0.1},{f:1175,d:0.1},{f:1319,d:0.15},
      {f:1175,d:0.1},{f:1047,d:0.1},{f:880,d:0.15},{f:784,d:0.1},{f:880,d:0.2}
    ], bass: [
      {f:262,d:0.2},{f:330,d:0.2},{f:262,d:0.2},{f:196,d:0.2},
      {f:262,d:0.2},{f:330,d:0.2},{f:262,d:0.2},{f:196,d:0.25}
    ], wave: 'square' },

    // Track 4: Playful skip
    { melody: [
      {f:523,d:0.18},{f:659,d:0.12},{f:784,d:0.18},{f:659,d:0.12},{f:523,d:0.12},
      {f:659,d:0.18},{f:784,d:0.12},{f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.18},
      {f:784,d:0.12},{f:880,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},{f:784,d:0.12},
      {f:659,d:0.18},{f:523,d:0.12},{f:659,d:0.18},{f:784,d:0.18},{f:523,d:0.25}
    ], bass: [
      {f:196,d:0.35},{f:220,d:0.35},{f:262,d:0.35},{f:220,d:0.35},
      {f:196,d:0.35},{f:262,d:0.35},{f:220,d:0.3}
    ], wave: 'triangle' },

    // Track 5: Victory march
    { melody: [
      {f:784,d:0.2},{f:784,d:0.1},{f:880,d:0.15},{f:1047,d:0.2},{f:880,d:0.1},
      {f:784,d:0.15},{f:659,d:0.2},{f:784,d:0.1},{f:880,d:0.15},{f:784,d:0.2},
      {f:659,d:0.1},{f:523,d:0.15},{f:659,d:0.2},{f:784,d:0.1},{f:880,d:0.15},
      {f:1047,d:0.2},{f:1175,d:0.1},{f:1047,d:0.15},{f:880,d:0.2},{f:784,d:0.2}
    ], bass: [
      {f:262,d:0.35},{f:196,d:0.35},{f:220,d:0.35},{f:262,d:0.35},
      {f:330,d:0.35},{f:262,d:0.35},{f:196,d:0.35}
    ], wave: 'triangle' },

    // Track 6: Quick staccato
    { melody: [
      {f:880,d:0.1},{f:1047,d:0.1},{f:880,d:0.1},{f:784,d:0.15},{f:880,d:0.1},
      {f:659,d:0.1},{f:784,d:0.15},{f:880,d:0.1},{f:1047,d:0.1},{f:1175,d:0.1},
      {f:1047,d:0.15},{f:880,d:0.1},{f:784,d:0.1},{f:880,d:0.1},{f:1047,d:0.15},
      {f:880,d:0.1},{f:784,d:0.1},{f:659,d:0.1},{f:784,d:0.15},{f:880,d:0.2}
    ], bass: [
      {f:220,d:0.2},{f:262,d:0.2},{f:220,d:0.2},{f:196,d:0.2},
      {f:220,d:0.2},{f:262,d:0.2},{f:330,d:0.2},{f:262,d:0.25}
    ], wave: 'square' },

    // Track 7: Sunshine waltz
    { melody: [
      {f:659,d:0.2},{f:784,d:0.1},{f:880,d:0.2},{f:784,d:0.1},{f:659,d:0.2},
      {f:784,d:0.1},{f:1047,d:0.2},{f:880,d:0.1},{f:784,d:0.2},{f:659,d:0.1},
      {f:523,d:0.2},{f:659,d:0.1},{f:784,d:0.2},{f:880,d:0.1},{f:1047,d:0.2},
      {f:880,d:0.1},{f:784,d:0.2},{f:659,d:0.1},{f:784,d:0.2},{f:659,d:0.25}
    ], bass: [
      {f:196,d:0.3},{f:262,d:0.3},{f:220,d:0.3},{f:262,d:0.3},
      {f:196,d:0.3},{f:220,d:0.3},{f:262,d:0.3},{f:196,d:0.35}
    ], wave: 'triangle' },

    // Track 8: Racing pulse
    { melody: [
      {f:1047,d:0.12},{f:1175,d:0.12},{f:1319,d:0.12},{f:1175,d:0.12},{f:1047,d:0.15},
      {f:880,d:0.12},{f:784,d:0.12},{f:880,d:0.15},{f:1047,d:0.12},{f:1175,d:0.12},
      {f:1047,d:0.15},{f:880,d:0.12},{f:784,d:0.12},{f:659,d:0.15},{f:784,d:0.12},
      {f:880,d:0.12},{f:1047,d:0.15},{f:1175,d:0.12},{f:1047,d:0.12},{f:880,d:0.2}
    ], bass: [
      {f:262,d:0.25},{f:330,d:0.25},{f:262,d:0.25},{f:220,d:0.25},
      {f:262,d:0.25},{f:196,d:0.25},{f:262,d:0.25},{f:330,d:0.3}
    ], wave: 'sawtooth' },

    // Track 9: Happy bounce
    { melody: [
      {f:523,d:0.15},{f:784,d:0.15},{f:523,d:0.12},{f:880,d:0.15},{f:523,d:0.12},
      {f:784,d:0.15},{f:659,d:0.12},{f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.15},
      {f:784,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},{f:784,d:0.15},{f:659,d:0.12},
      {f:784,d:0.15},{f:880,d:0.12},{f:1047,d:0.15},{f:880,d:0.12},{f:784,d:0.2}
    ], bass: [
      {f:262,d:0.28},{f:196,d:0.28},{f:220,d:0.28},{f:262,d:0.28},
      {f:196,d:0.28},{f:220,d:0.28},{f:262,d:0.28},{f:196,d:0.3}
    ], wave: 'triangle' },

    // Track 10: Carnival swing
    { melody: [
      {f:880,d:0.12},{f:784,d:0.18},{f:880,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},
      {f:784,d:0.18},{f:659,d:0.12},{f:784,d:0.18},{f:880,d:0.12},{f:1047,d:0.18},
      {f:1175,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},{f:784,d:0.18},{f:659,d:0.12},
      {f:784,d:0.18},{f:880,d:0.12},{f:784,d:0.18},{f:659,d:0.12},{f:784,d:0.22}
    ], bass: [
      {f:220,d:0.3},{f:262,d:0.3},{f:330,d:0.3},{f:262,d:0.3},
      {f:220,d:0.3},{f:196,d:0.3},{f:220,d:0.3},{f:262,d:0.3}
    ], wave: 'triangle' },

    // Track 11: Electric groove
    { melody: [
      {f:659,d:0.1},{f:659,d:0.1},{f:784,d:0.15},{f:880,d:0.1},{f:880,d:0.1},
      {f:1047,d:0.15},{f:880,d:0.1},{f:784,d:0.1},{f:659,d:0.15},{f:784,d:0.1},
      {f:784,d:0.1},{f:880,d:0.15},{f:1047,d:0.1},{f:1047,d:0.1},{f:1175,d:0.15},
      {f:1047,d:0.1},{f:880,d:0.1},{f:784,d:0.15},{f:659,d:0.1},{f:784,d:0.2}
    ], bass: [
      {f:196,d:0.2},{f:196,d:0.2},{f:262,d:0.2},{f:262,d:0.2},
      {f:220,d:0.2},{f:220,d:0.2},{f:196,d:0.2},{f:262,d:0.25}
    ], wave: 'square' },

    // Track 12: Feather float
    { melody: [
      {f:1047,d:0.18},{f:880,d:0.12},{f:1047,d:0.18},{f:1175,d:0.12},{f:1047,d:0.18},
      {f:880,d:0.12},{f:784,d:0.18},{f:880,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},
      {f:784,d:0.18},{f:659,d:0.12},{f:784,d:0.18},{f:880,d:0.12},{f:1047,d:0.18},
      {f:1175,d:0.12},{f:1319,d:0.18},{f:1175,d:0.12},{f:1047,d:0.18},{f:880,d:0.22}
    ], bass: [
      {f:262,d:0.3},{f:330,d:0.3},{f:262,d:0.3},{f:220,d:0.3},
      {f:262,d:0.3},{f:330,d:0.3},{f:262,d:0.3},{f:220,d:0.35}
    ], wave: 'sine' },

    // Track 13: Drum roll energy
    { melody: [
      {f:784,d:0.1},{f:784,d:0.1},{f:880,d:0.1},{f:1047,d:0.2},{f:880,d:0.1},
      {f:784,d:0.1},{f:659,d:0.1},{f:784,d:0.2},{f:880,d:0.1},{f:880,d:0.1},
      {f:1047,d:0.1},{f:1175,d:0.2},{f:1047,d:0.1},{f:880,d:0.1},{f:784,d:0.1},
      {f:880,d:0.2},{f:784,d:0.1},{f:659,d:0.1},{f:784,d:0.1},{f:880,d:0.22}
    ], bass: [
      {f:196,d:0.2},{f:262,d:0.2},{f:196,d:0.2},{f:220,d:0.2},
      {f:262,d:0.2},{f:196,d:0.2},{f:220,d:0.2},{f:262,d:0.25}
    ], wave: 'square' },

    // Track 14: Spring garden
    { melody: [
      {f:523,d:0.18},{f:659,d:0.15},{f:784,d:0.18},{f:880,d:0.15},{f:1047,d:0.18},
      {f:880,d:0.15},{f:784,d:0.18},{f:659,d:0.15},{f:523,d:0.18},{f:659,d:0.15},
      {f:784,d:0.18},{f:1047,d:0.15},{f:1175,d:0.18},{f:1047,d:0.15},{f:880,d:0.18},
      {f:784,d:0.15},{f:659,d:0.18},{f:523,d:0.15},{f:659,d:0.18},{f:784,d:0.22}
    ], bass: [
      {f:262,d:0.35},{f:220,d:0.35},{f:196,d:0.35},{f:262,d:0.35},
      {f:220,d:0.35},{f:262,d:0.35},{f:196,d:0.35}
    ], wave: 'triangle' },

    // Track 15: Neon city
    { melody: [
      {f:880,d:0.12},{f:1047,d:0.12},{f:1175,d:0.18},{f:1047,d:0.12},{f:880,d:0.12},
      {f:1047,d:0.18},{f:880,d:0.12},{f:784,d:0.12},{f:880,d:0.18},{f:1047,d:0.12},
      {f:1175,d:0.12},{f:1319,d:0.18},{f:1175,d:0.12},{f:1047,d:0.12},{f:880,d:0.18},
      {f:784,d:0.12},{f:880,d:0.12},{f:1047,d:0.18},{f:880,d:0.12},{f:784,d:0.2}
    ], bass: [
      {f:220,d:0.25},{f:262,d:0.25},{f:330,d:0.25},{f:262,d:0.25},
      {f:220,d:0.25},{f:262,d:0.25},{f:220,d:0.25},{f:196,d:0.28}
    ], wave: 'sawtooth' },

    // Track 16: Festival drums
    { melody: [
      {f:784,d:0.12},{f:880,d:0.12},{f:784,d:0.12},{f:659,d:0.18},{f:784,d:0.12},
      {f:880,d:0.12},{f:1047,d:0.12},{f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.12},
      {f:784,d:0.12},{f:880,d:0.18},{f:1047,d:0.12},{f:1175,d:0.12},{f:1047,d:0.12},
      {f:880,d:0.18},{f:784,d:0.12},{f:659,d:0.12},{f:784,d:0.18},{f:880,d:0.2}
    ], bass: [
      {f:262,d:0.2},{f:196,d:0.2},{f:262,d:0.2},{f:220,d:0.2},
      {f:262,d:0.2},{f:196,d:0.2},{f:262,d:0.2},{f:220,d:0.25}
    ], wave: 'triangle' },

    // Track 17: Ocean breeze
    { melody: [
      {f:659,d:0.2},{f:784,d:0.15},{f:880,d:0.2},{f:1047,d:0.15},{f:880,d:0.2},
      {f:784,d:0.15},{f:659,d:0.2},{f:523,d:0.15},{f:659,d:0.2},{f:784,d:0.15},
      {f:880,d:0.2},{f:1047,d:0.15},{f:1175,d:0.2},{f:1047,d:0.15},{f:880,d:0.2},
      {f:784,d:0.15},{f:659,d:0.2},{f:784,d:0.15},{f:880,d:0.2},{f:784,d:0.22}
    ], bass: [
      {f:196,d:0.35},{f:262,d:0.35},{f:220,d:0.35},{f:262,d:0.35},
      {f:196,d:0.35},{f:220,d:0.35},{f:262,d:0.35}
    ], wave: 'sine' },

    // Track 18: Pixel adventure
    { melody: [
      {f:523,d:0.12},{f:659,d:0.12},{f:784,d:0.12},{f:1047,d:0.15},{f:784,d:0.12},
      {f:659,d:0.12},{f:523,d:0.15},{f:659,d:0.12},{f:784,d:0.12},{f:880,d:0.12},
      {f:1047,d:0.15},{f:1175,d:0.12},{f:1047,d:0.12},{f:880,d:0.15},{f:784,d:0.12},
      {f:659,d:0.12},{f:784,d:0.12},{f:880,d:0.15},{f:1047,d:0.12},{f:880,d:0.2}
    ], bass: [
      {f:262,d:0.22},{f:220,d:0.22},{f:196,d:0.22},{f:262,d:0.22},
      {f:220,d:0.22},{f:262,d:0.22},{f:196,d:0.22},{f:220,d:0.25}
    ], wave: 'square' },

    // Track 19: Bamboo flute dance
    { melody: [
      {f:880,d:0.18},{f:1047,d:0.12},{f:880,d:0.15},{f:784,d:0.18},{f:659,d:0.12},
      {f:784,d:0.15},{f:880,d:0.18},{f:1047,d:0.12},{f:1175,d:0.15},{f:1047,d:0.18},
      {f:880,d:0.12},{f:784,d:0.15},{f:659,d:0.18},{f:784,d:0.12},{f:880,d:0.15},
      {f:784,d:0.18},{f:659,d:0.12},{f:523,d:0.15},{f:659,d:0.18},{f:784,d:0.22}
    ], bass: [
      {f:220,d:0.3},{f:262,d:0.3},{f:220,d:0.3},{f:196,d:0.3},
      {f:220,d:0.3},{f:262,d:0.3},{f:220,d:0.3},{f:196,d:0.32}
    ], wave: 'triangle' },

    // Track 20: Starlight express
    { melody: [
      {f:1175,d:0.12},{f:1047,d:0.12},{f:880,d:0.15},{f:1047,d:0.12},{f:1175,d:0.12},
      {f:1319,d:0.15},{f:1175,d:0.12},{f:1047,d:0.12},{f:880,d:0.15},{f:784,d:0.12},
      {f:880,d:0.12},{f:1047,d:0.15},{f:1175,d:0.12},{f:1319,d:0.12},{f:1175,d:0.15},
      {f:1047,d:0.12},{f:880,d:0.12},{f:784,d:0.15},{f:880,d:0.12},{f:1047,d:0.2}
    ], bass: [
      {f:262,d:0.25},{f:330,d:0.25},{f:262,d:0.25},{f:220,d:0.25},
      {f:262,d:0.25},{f:330,d:0.25},{f:262,d:0.25},{f:220,d:0.28}
    ], wave: 'triangle' }
  ];

  function startBGM() {
    if (muted || bgmPlaying) return;
    bgmPlaying = true;
    playBGMLoop();
  }

  function stopBGM() {
    bgmPlaying = false;
    if (bgmTimer) {
      clearTimeout(bgmTimer);
      bgmTimer = null;
    }
    for (var i = 0; i < bgmNodes.length; i++) {
      try { bgmNodes[i].stop(); } catch(e) {}
    }
    bgmNodes = [];
  }

  function pickRandomTrack() {
    var idx;
    do {
      idx = Math.floor(Math.random() * bgmTracks.length);
    } while (idx === lastTrackIndex && bgmTracks.length > 1);
    lastTrackIndex = idx;
    return bgmTracks[idx];
  }

  function playBGMLoop() {
    if (!bgmPlaying || muted) { bgmPlaying = false; return; }
    var ctx = ensureContext();
    var track = pickRandomTrack();
    var melody = track.melody;
    var bass = track.bass;
    var waveType = track.wave || 'triangle';

    bgmNodes = [];
    var t = ctx.currentTime;
    var totalDuration = 0;

    // Play melody
    for (var i = 0; i < melody.length; i++) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = waveType;
      osc.frequency.setValueAtTime(melody[i].f, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035, t + 0.02);
      gain.gain.setValueAtTime(0.035, t + melody[i].d * 0.6);
      gain.gain.linearRampToValueAtTime(0, t + melody[i].d * 0.95);

      osc.start(t);
      osc.stop(t + melody[i].d);
      bgmNodes.push(osc);
      t += melody[i].d;
    }
    totalDuration = t - ctx.currentTime;

    // Play bass layer
    var bt = ctx.currentTime;
    for (var j = 0; j < bass.length; j++) {
      if (bt - ctx.currentTime >= totalDuration) break;
      var bOsc = ctx.createOscillator();
      var bGain = ctx.createGain();
      bOsc.connect(bGain);
      bGain.connect(ctx.destination);

      bOsc.type = 'sine';
      bOsc.frequency.setValueAtTime(bass[j].f, bt);

      bGain.gain.setValueAtTime(0, bt);
      bGain.gain.linearRampToValueAtTime(0.025, bt + 0.02);
      bGain.gain.setValueAtTime(0.025, bt + bass[j].d * 0.5);
      bGain.gain.linearRampToValueAtTime(0, bt + bass[j].d * 0.9);

      bOsc.start(bt);
      bOsc.stop(bt + bass[j].d);
      bgmNodes.push(bOsc);
      bt += bass[j].d;
    }

    // Play next random track after current one completes
    bgmTimer = setTimeout(function() {
      if (bgmPlaying) playBGMLoop();
    }, totalDuration * 1000 + 150);
  }

  return {
    init: init,
    playMove: playMove,
    playMerge: playMerge,
    playCountdown: playCountdown,
    playGameOver: playGameOver,
    checkMilestone: checkMilestone,
    toggleMute: toggleMute,
    isMuted: isMuted,
    resetMilestone: resetMilestone,
    startBGM: startBGM,
    stopBGM: stopBGM
  };
})();
