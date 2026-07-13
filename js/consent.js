// Cookie consent — gates Google Analytics behind explicit opt-in, as
// required by UK PECR + GDPR. GA (and its cookies) load ONLY after the
// visitor clicks Accept. The choice persists in localStorage. No third
// parties, no inline styles/scripts (respects the site's strict CSP).
//
// Reopen the banner from anywhere with an element id="cookie-settings"
// (wired below) or by calling window.ltCookieSettings().
(function () {
  var KEY = 'lt-consent';        // stored value: 'granted' | 'denied'
  var GA_ID = 'G-MCH2DVW5WZ';

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Load GA4 dynamically (googletagmanager.com is allowlisted in the CSP).
  function loadGA() {
    if (window.__ltGA) return;
    window.__ltGA = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }

  // Best-effort removal of GA cookies when consent is withdrawn.
  function clearGA() {
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n === '_ga' || n.indexOf('_ga_') === 0 || n === '_gid') {
        document.cookie = n + '=; Max-Age=0; path=/';
        document.cookie = n + '=; Max-Age=0; path=/; domain=.' + location.hostname;
      }
    });
  }

  function removeBanner() {
    var b = document.getElementById('cookie-banner');
    if (b) b.remove();
  }

  function buildBanner() {
    var wrap = document.createElement('div');
    wrap.id = 'cookie-banner';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie consent');

    var text = document.createElement('p');
    text.className = 'cookie-banner__text';
    var lead = document.createTextNode('We use Google Analytics cookies to understand site usage. See our ');
    var link = document.createElement('a');
    link.href = '/privacy/';
    link.textContent = 'privacy & cookie policy';
    text.appendChild(lead);
    text.appendChild(link);
    text.appendChild(document.createTextNode('.'));

    var actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';

    // Reject and Accept given equal prominence (ICO requirement).
    var reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'cookie-btn cookie-btn--ghost';
    reject.textContent = 'Reject';
    reject.addEventListener('click', function () { store('denied'); clearGA(); removeBanner(); });

    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'cookie-btn cookie-btn--solid';
    accept.textContent = 'Accept';
    accept.addEventListener('click', function () { store('granted'); removeBanner(); loadGA(); });

    actions.appendChild(reject);
    actions.appendChild(accept);
    wrap.appendChild(text);
    wrap.appendChild(actions);
    document.body.appendChild(wrap);
  }

  // Public hook so a "Cookie settings" control can reopen the choice.
  window.ltCookieSettings = function () { removeBanner(); buildBanner(); };

  function init() {
    var el = document.getElementById('cookie-settings');
    if (el) el.addEventListener('click', function (e) { e.preventDefault(); window.ltCookieSettings(); });

    var choice = read();
    if (choice === 'granted') { loadGA(); return; }
    if (choice === 'denied') { return; }
    buildBanner();  // no decision yet → ask
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
