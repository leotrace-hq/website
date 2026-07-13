// Google Analytics 4 (GA4) — self-hosted gtag config so the strict CSP
// (`script-src 'self'`) needs no 'unsafe-inline'. The tag loader itself
// (googletagmanager.com/gtag/js) is allowlisted in each page's CSP.
//
// NOTE: this fires on page load and sets analytics cookies. Under UK/EU
// law (PECR + GDPR) that requires prior consent — gate this behind a
// consent banner (or Google Consent Mode set to denied-by-default)
// before treating the site as compliant.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-MCH2DVW5WZ');
