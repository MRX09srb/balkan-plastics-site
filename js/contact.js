// Location map switcher
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.location-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.location-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var loc = tab.dataset.location;
      document.getElementById('map-factory').style.display = loc === 'factory' ? 'block' : 'none';
      var officeMap = document.getElementById('map-office');
      officeMap.style.display = loc === 'office' ? 'block' : 'none';
      if (loc === 'office' && !officeMap.getAttribute('src')) {
        officeMap.setAttribute('src', officeMap.dataset.src);
      }
    });
  });

  // Captcha in the site language (EN/SR), not the browser's (02.10). api.js is loaded with
  // render=explicit; we wait for it, render with language, and re-render on language switch
  // (main.js setLanguage fires 'bp:langchange'). Turnstile codes: 'en', 'sr'.
  var captchaEl = document.querySelector('.cf-turnstile');
  var captchaId = null, captchaLang = null;
  function siteLang() { return (localStorage.getItem('lang') || document.documentElement.lang) === 'sr' ? 'sr' : 'en'; }
  function renderCaptcha(tries) {
    if (!captchaEl) return;
    if (!window.turnstile) { if ((tries || 0) < 100) setTimeout(function() { renderCaptcha((tries || 0) + 1); }, 100); return; }
    var lang = siteLang();
    if (captchaId !== null && lang === captchaLang) return;
    if (captchaId !== null) window.turnstile.remove(captchaId);
    captchaLang = lang;
    captchaId = window.turnstile.render(captchaEl, {
      sitekey: captchaEl.dataset.sitekey, theme: captchaEl.dataset.theme, size: captchaEl.dataset.size, language: lang,
    });
  }
  renderCaptcha(0);
  document.addEventListener('bp:langchange', function() { renderCaptcha(0); });

  // Contact form: AJAX POST to /api/contact
  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = document.getElementById('contact-form-status');
  var btn = form.querySelector('button[type="submit"]');

  // Error text by reason, in the site language (09.11). SR is a draft for the translator.
  // Kept here, not in translations.js: that file is already over the size limit.
  var ERRORS = {
    en: {
      captcha: 'Please complete the security check and send again.',
      email: 'Please check your email address and try again.',
      limit: 'Too many attempts. Please wait 10 minutes or email us at info@balkanplastics.com.',
      other: 'The message could not be sent. Please try again or email us at info@balkanplastics.com.',
    },
    sr: {
      captcha: 'Molimo potvrdite sigurnosnu proveru i pošaljite ponovo.',
      email: 'Molimo proverite e-mail adresu i pokušajte ponovo.',
      limit: 'Previše pokušaja. Sačekajte 10 minuta ili nam pišite na info@balkanplastics.com.',
      other: 'Poruka nije poslata. Pokušajte ponovo ili nam pišite na info@balkanplastics.com.',
    },
  };
  // Server answers (app.py): 400 'captcha failed' | 400 'invalid input' | 429 | 502 'send failed'.
  function errorReason(code, error) {
    if (code === 429) return 'limit';
    if (error === 'captcha failed') return 'captcha';
    if (error === 'invalid input') return 'email';
    return 'other';
  }
  // The captcha token is single-use and the server spends it even when it then rejects the
  // form (bad email, mail failure, limit). Without a fresh one every retry fails until reload.
  function resetCaptcha() {
    if (window.turnstile && captchaId !== null) window.turnstile.reset(captchaId);
  }

  form.addEventListener('submit', function(ev) {
    ev.preventDefault();
    if (status) { status.textContent = ''; status.className = 'contact-form-status'; }
    btn.disabled = true;
    var data = {};
    new FormData(form).forEach(function(v, k) { data[k] = v; });
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(function(r) {
      if (r.ok) {
        form.reset();
        window.location.href = '/thanks.html';
        return;
      }
      // Body may be missing or not JSON (e.g. 502 from nginx) - then the reason is 'other'.
      return r.json().catch(function() { return {}; }).then(function(j) {
        var e = new Error('send failed');
        e.reason = errorReason(r.status, j && j.error);
        throw e;
      });
    }).catch(function(err) {
      resetCaptcha();
      if (status) {
        status.textContent = ERRORS[siteLang()][(err && err.reason) || 'other'];   // network error -> 'other'
        status.className = 'contact-form-status error';
      }
    }).finally(function() {
      btn.disabled = false;
    });
  });
});
