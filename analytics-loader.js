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
}());
