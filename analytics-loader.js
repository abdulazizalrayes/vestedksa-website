(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function loadAnalyticsScripts() {
    if (window.__vestedAnalyticsLoaded) return;
    window.__vestedAnalyticsLoaded = true;

    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-7STG2HDV42';
    document.head.appendChild(gtagScript);

    window.gtag('js', new Date());
    window.gtag('config', 'G-7STG2HDV42');

    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-WL2FN4PR';
    document.head.appendChild(gtmScript);

    ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
      window.removeEventListener(eventName, triggerAnalyticsLoad, passiveOnceOptions);
    });
  }

  function triggerAnalyticsLoad() {
    loadAnalyticsScripts();
  }

  const passiveOnceOptions = { passive: true, once: true };

  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
    window.addEventListener(eventName, triggerAnalyticsLoad, passiveOnceOptions);
  });

  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadAnalyticsScripts, { timeout: 2500 });
    } else {
      setTimeout(loadAnalyticsScripts, 1500);
    }
  }, { once: true });
}());
