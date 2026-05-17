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
    if (muted && window.speechSynthesis) {
      speechSynthesis.cancel();
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  function resetMilestone() {
    lastMilestone = 0;
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
    resetMilestone: resetMilestone
  };
})();
