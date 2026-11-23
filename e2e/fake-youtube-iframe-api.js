// Finto YouTube IFrame API, SOLO per test end-to-end in un ambiente senza YouTube.
(function () {
  window.__ytSpeed = window.__ytSpeed || 1;
  window.__ytLoads = [];
  window.__ytErrors = window.__ytErrors || {};
  window.__ytCalls = [];
  function Player(el, opts) {
    var iframe = document.createElement('iframe');
    iframe.setAttribute('data-fake-yt', '1');
    iframe.style.border = '0';
    iframe.width = opts.width; iframe.height = opts.height;
    iframe.srcdoc = '<body style="margin:0;background:linear-gradient(135deg,#7a1f2b,#1f2b7a);color:#fff;font:600 16px sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">▶ Player YouTube (finto)</body>';
    el.parentNode.replaceChild(iframe, el);
    this.opts = opts; this.state = -1; this.t = 0; this.d = 0; this.vid = null; this.vol = 100; this.muted = false;
    var self = this;
    setTimeout(function () { opts.events.onReady && opts.events.onReady({ target: self }); }, 50);
    setInterval(function () {
      if (self.state === 1) {
        self.t += 0.5 * window.__ytSpeed;
        if (self.t >= self.d) { self.t = self.d; self._set(0); }
      }
    }, 500);
  }
  Player.prototype._set = function (s) { this.state = s; this.opts.events.onStateChange && this.opts.events.onStateChange({ target: this, data: s }); };
  Player.prototype.loadVideoById = function (id, start) {
    var self = this; this.vid = id; this.t = start || 0; this.d = 200; window.__ytLoads.push(id); this._set(-1);
    setTimeout(function () {
      if (window.__ytErrors[id]) { self.opts.events.onError({ target: self, data: window.__ytErrors[id] }); return; }
      self._set(3); setTimeout(function () { self._set(1); }, 80);
    }, 80);
  };
  Player.prototype.cueVideoById = function (id, start) { this.vid = id; this.t = start || 0; this.d = 200; this._set(5); };
  Player.prototype.playVideo = function () { window.__ytCalls.push('play'); if (this.vid) this._set(1); };
  Player.prototype.pauseVideo = function () { window.__ytCalls.push('pause'); this._set(2); };
  Player.prototype.stopVideo = function () { this._set(5); };
  Player.prototype.seekTo = function (t) { window.__ytCalls.push('seek:' + Math.round(t)); this.t = t; };
  Player.prototype.getCurrentTime = function () { return this.t; };
  Player.prototype.getDuration = function () { return this.d; };
  Player.prototype.getPlayerState = function () { return this.state; };
  Player.prototype.setVolume = function (v) { window.__ytCalls.push('vol:' + v); this.vol = v; };
  Player.prototype.getVolume = function () { return this.vol; };
  Player.prototype.mute = function () { this.muted = true; };
  Player.prototype.unMute = function () { this.muted = false; };
  Player.prototype.isMuted = function () { return this.muted; };
  Player.prototype.destroy = function () {};
  window.YT = { Player: Player };
  setTimeout(function () { window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady(); }, 0);
})();
