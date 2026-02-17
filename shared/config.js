// shared/config.js — Auto-detect server host for LAN/remote multiplayer
// Override with ?server=HOST:PORT (e.g. ?server=192.168.1.5:8000)
(function () {
  var params = new URLSearchParams(window.location.search);
  var serverOverride = params.get('server');

  if (serverOverride) {
    // Explicit server: use it directly
    var s = serverOverride.replace(/\/+$/, '');
    if (!/^https?:\/\//.test(s)) s = 'http://' + s;
    var wsProto = s.startsWith('https') ? 'wss' : 'ws';
    window.TofConfig = {
      API_BASE: s,
      WS_BASE: s.replace(/^https?/, wsProto)
    };
    return;
  }

  var host = window.location.hostname;
  var protocol = window.location.protocol;

  // Local dev: file://, localhost, or 127.0.0.1 → talk to localhost:8000
  var isLocal = protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';

  var apiHost = isLocal ? 'http://127.0.0.1:8000' : protocol + '//' + host + ':8000';
  var wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  var wsHost = isLocal ? 'ws://127.0.0.1:8000' : wsProtocol + '//' + host + ':8000';

  window.TofConfig = {
    API_BASE: apiHost,
    WS_BASE: wsHost
  };
})();
