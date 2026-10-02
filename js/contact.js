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
      } else {
        return r.json().then(function(j) { throw new Error(j.error || 'send failed'); }).catch(function() { throw new Error('send failed'); });
      }
    }).catch(function(err) {
      if (status) {
        status.textContent = 'Failed to send: ' + err.message + '. Please try again or email us directly.';
        status.className = 'contact-form-status error';
      }
    }).finally(function() {
      btn.disabled = false;
    });
  });
});
