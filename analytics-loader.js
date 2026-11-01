(function () {
  const CONSENT_KEY = 'vested-ksa-cookie-consent';
  const LEGACY_CONSENT_KEY = 'cookieConsent';
  const GA4_ID = 'G-7STG2HDV42';
  const GTM_ID = 'GTM-WL2FN4PR';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function consentPayload(analyticsGranted) {
    return {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      functionality_storage: analyticsGranted ? 'granted' : 'denied',
      personalization_storage: 'denied',
      security_storage: 'granted',
    };
  }

  window.gtag('consent', 'default', {
    ...consentPayload(false),
    wait_for_update: 500,
  });
  window.gtag('set', 'ads_data_redaction', true);

  function readConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) || localStorage.getItem(LEGACY_CONSENT_KEY) || '';
    } catch (_error) {
      return '';
    }
  }

  function persistConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
      localStorage.setItem(LEGACY_CONSENT_KEY, value);
    } catch (_error) {
      // Consent still applies for the current page when storage is unavailable.
    }
  }

  function loadAnalyticsScripts() {
    if (window.__vestedAnalyticsScriptsLoaded) return;
    window.__vestedAnalyticsScriptsLoaded = true;

    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(gtagScript);

    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);

    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
    document.head.appendChild(gtmScript);
  }

  function notify(status) {
    window.dispatchEvent(new CustomEvent('vested:consent-update', {
      detail: { status },
    }));
  }

  function accept() {
    persistConsent('accepted');
    window.gtag('consent', 'update', consentPayload(true));
    loadAnalyticsScripts();
    window.gtag('event', 'cookie_consent_update', { consent_status: 'accepted' });
    notify('accepted');
  }

  function decline() {
    persistConsent('declined');
    window.gtag('consent', 'update', consentPayload(false));
    notify('declined');
  }

  window.VestedConsent = Object.freeze({
    accept,
    decline,
    getStatus: readConsent,
    hasAnalyticsConsent: function () {
      return readConsent() === 'accepted';
    },
  });

  function showDirectEntryConsent() {
    if (readConsent() || document.getElementById('cookieBanner') || document.getElementById('cookieConsent')) return;
    const language = document.documentElement.lang || 'en';
    const copy = language.startsWith('ar')
      ? ['نستخدم ملفات تعريف ارتباط اختيارية لقياس استخدام الموقع. يمكنك القبول أو الرفض.', 'قبول', 'رفض', 'تفضيلات الخصوصية']
      : language.startsWith('zh')
        ? ['我们使用可选 Cookie 来衡量网站使用情况。您可以接受或拒绝。', '接受', '拒绝', '隐私偏好']
        : ['We use optional analytics cookies to measure website usage. You can accept or decline.', 'Accept', 'Decline', 'Privacy preferences'];
    const banner = document.createElement('section');
    banner.id = 'vested-direct-consent';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', copy[3]);
    if (language.startsWith('ar')) banner.dir = 'rtl';
    const style = document.createElement('style');
    style.textContent = '#vested-direct-consent{position:fixed;inset-inline-start:20px;bottom:20px;box-sizing:border-box;width:380px;max-width:calc(100% - 40px);max-height:calc(100dvh - 40px);overflow:auto;padding:20px;background:#1d1d1f;color:#fff;border-radius:8px;z-index:500;font:14px/1.6 Inter,Arial,sans-serif;letter-spacing:0;box-shadow:0 4px 20px #0003}#vested-direct-consent p{margin:0 0 16px;color:inherit;font:inherit}#vested-direct-consent div{display:flex;gap:12px;flex-wrap:wrap}#vested-direct-consent button{min-height:44px;padding:8px 16px;border:1px solid #fff;border-radius:6px;font:500 14px/1.4 Inter,Arial,sans-serif;letter-spacing:0;background:transparent;color:#fff;cursor:pointer}#vested-direct-consent button:first-child{background:#0071e3;border-color:#0071e3}#vested-direct-consent button:focus-visible{outline:3px solid #fff;outline-offset:3px}';
    const paragraph = document.createElement('p');
    paragraph.textContent = copy[0];
    const actions = document.createElement('div');
    [accept, decline].forEach(function (choice, index) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = copy[index + 1];
      button.addEventListener('click', function () {
        choice();
        banner.remove();
        style.remove();
      });
      actions.appendChild(button);
    });
    banner.appendChild(paragraph);
    banner.appendChild(actions);
    document.head.appendChild(style);
    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showDirectEntryConsent, { once: true });
  } else {
    showDirectEntryConsent();
  }

  // Prevent legacy inline loaders from bypassing this consent gate.
  window.__vestedAnalyticsLoaded = true;

  if (readConsent() === 'accepted') {
    window.gtag('consent', 'update', consentPayload(true));
    loadAnalyticsScripts();
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== CONSENT_KEY && event.key !== LEGACY_CONSENT_KEY) return;
    if (event.newValue === 'accepted') {
      window.gtag('consent', 'update', consentPayload(true));
      loadAnalyticsScripts();
    } else {
      window.gtag('consent', 'update', consentPayload(false));
    }
  });

  if (typeof document.addEventListener === 'function') {
    document.addEventListener('click', function (event) {
      const link = event.target && typeof event.target.closest === 'function'
        ? event.target.closest('a[href]')
        : null;
      if (!link) return;

      const href = String(link.getAttribute('href') || '').toLowerCase();
      const eventName = href.startsWith('tel:')
        ? 'phone_click'
        : href.startsWith('https://wa.me/')
          ? 'whatsapp_click'
          : '';
      if (!eventName) return;

      const payload = {
        page_path: window.location.pathname,
        language: document.documentElement.lang || 'en',
      };
      window.dataLayer.push({ event: eventName, ...payload });
      if (window.VestedConsent.hasAnalyticsConsent()) {
        window.gtag('event', eventName, payload);
      }
    });
  }
}());
