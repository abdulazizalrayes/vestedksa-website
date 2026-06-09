(function () {
  const localeMeta = {
    en: { label: 'EN', title: 'English' },
    ar: { label: 'AR', title: 'العربية' },
    zh: { label: '中文', title: '简体中文' },
  };

  const currentPath = window.location.pathname;
  const currentLocale = currentPath.startsWith('/ar') ? 'ar' : currentPath.startsWith('/zh') ? 'zh' : 'en';

  function reportEvent(eventName, payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...payload,
        transport_type: 'beacon',
      });
    }
  }

  function localeHref(locale) {
    if (locale === 'en') {
      if (currentLocale !== 'en') return '/';
      return currentPath || '/';
    }
    return `/${locale}`;
  }

  function buildSwitcher(context) {
    const switcher = document.createElement('div');
    switcher.className = `vested-language-switcher vested-language-switcher--${context}`;
    switcher.setAttribute('aria-label', 'Language selector');

    Object.keys(localeMeta).forEach((locale) => {
      const link = document.createElement('a');
      link.href = localeHref(locale);
      link.lang = locale === 'zh' ? 'zh-Hans' : locale;
      link.hreflang = locale === 'zh' ? 'zh-Hans' : locale;
      link.textContent = localeMeta[locale].label;
      link.title = localeMeta[locale].title;
      link.className = 'vested-language-link';
      if (locale === currentLocale) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');
      }
      link.addEventListener('click', () => {
        reportEvent('language_switch_click', {
          from_locale: currentLocale,
          to_locale: locale,
          page_path: currentPath || '/',
        });
      });
      switcher.appendChild(link);
    });

    return switcher;
  }

  function trackGlobalConversionLinks() {
    document.querySelectorAll('a[href^="mailto:"], a[href="/contact"], a[href="/contact/"], a[href$="ksa-entry-checklist.txt"], a[download]').forEach((link) => {
      if (link.dataset.vestedTracked === 'true') return;
      link.dataset.vestedTracked = 'true';
      link.addEventListener('click', () => {
        const href = link.getAttribute('href') || '';
        const isEmail = href.startsWith('mailto:');
        const isChecklist = href.includes('ksa-entry-checklist') || link.hasAttribute('download');
        const eventName = isChecklist ? 'checklist_download_click' : isEmail ? 'email_click' : 'lead_cta_click';
        reportEvent(eventName, {
          page_locale: currentLocale,
          page_path: currentPath || '/',
          destination: href,
          cta_text: (link.textContent || '').trim().slice(0, 80),
        });
      });
    });
  }

  function injectStyles() {
    if (document.getElementById('vested-language-switcher-styles')) return;
    const style = document.createElement('style');
    style.id = 'vested-language-switcher-styles';
    style.textContent = `
      .vested-language-switcher {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-inline-start: 16px;
      }

      .vested-language-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 34px;
        height: 32px;
        padding: 0 8px;
        border: 1px solid #E5E5E7;
        border-radius: 999px;
        color: #1D1D1F;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        text-decoration: none;
        background: rgba(255, 255, 255, 0.72);
        transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
      }

      .vested-language-link:hover,
      .vested-language-link.is-active {
        color: #0071E3;
        border-color: #0071E3;
        background: #F5FAFF;
      }

      .vested-language-switcher--mobile {
        margin-inline-start: 0;
        margin-top: 8px;
      }

      .mobile-menu .vested-language-switcher {
        align-self: flex-start;
      }

      @media (max-width: 767px) {
        .nav-container > .vested-language-switcher {
          margin-inline-start: auto;
          margin-inline-end: 8px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function initSwitcher() {
    injectStyles();

    const navContainer = document.querySelector('.nav-container');
    const simpleNav = document.querySelector('header nav');

    if (navContainer && !navContainer.querySelector('.vested-language-switcher')) {
      const hamburger = navContainer.querySelector('.hamburger');
      navContainer.insertBefore(buildSwitcher('desktop'), hamburger || null);
    } else if (simpleNav && !simpleNav.querySelector('.vested-language-switcher')) {
      simpleNav.appendChild(buildSwitcher('desktop'));
    }

    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu && !mobileMenu.querySelector('.vested-language-switcher')) {
      mobileMenu.appendChild(buildSwitcher('mobile'));
    }

    trackGlobalConversionLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwitcher, { once: true });
  } else {
    initSwitcher();
  }
})();
