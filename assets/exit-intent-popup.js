/**
 * exit-intent-popup.js
 * Handles exit-intent detection (desktop mouseleave + mobile back-gesture).
 * Config is injected by the Liquid section via window.__EIP_CONFIG__.
 */

(function () {
  'use strict';

  const config = window.__EIP_CONFIG__ || {};
  const STORAGE_KEY = config.storageKey || 'eip_dismissed';
  const SHOW_ONCE   = config.showOnce !== false;
  const DELAY_MS    = (config.delaySeconds || 3) * 1000;
  const CODE        = config.discountCode || null;

  // ── Elements ──────────────────────────────────────────────────
  const overlay  = document.getElementById('exit-intent-overlay');
  const backdrop = document.getElementById('eip-backdrop');
  const closeBtn = document.getElementById('eip-close');
  const dismiss  = document.getElementById('eip-dismiss');
  const copyBtn  = document.getElementById('eip-copy-btn');
  const copiedEl = document.getElementById('eip-copied');
  const cta      = document.getElementById('eip-cta');

  if (!overlay) return;

  // ── State ──────────────────────────────────────────────────────
  let triggered    = false;
  let pageReadyAt  = Date.now();
  let copyTimeout  = null;

  // ── Session / localStorage guard ──────────────────────────────
  function wasDismissed() {
    if (!SHOW_ONCE) return false;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function markDismissed() {
    if (!SHOW_ONCE) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch (_) {}
  }

  // ── Open / close ───────────────────────────────────────────────
  function openPopup() {
    if (triggered || wasDismissed()) return;
    triggered = true;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-visible');
    document.body.style.overflow = 'hidden';
    // Focus the modal for accessibility
    overlay.querySelector('.eip-modal').setAttribute('tabindex', '-1');
    overlay.querySelector('.eip-modal').focus({ preventScroll: true });
  }

  function closePopup() {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    markDismissed();
  }

  // ── Desktop: mouse leaves toward top of viewport ───────────────
  function onMouseLeave(e) {
    // Only trigger when mouse exits through the top edge
    if (e.clientY > 20) return;
    if (Date.now() - pageReadyAt < DELAY_MS) return;
    document.removeEventListener('mouseleave', onMouseLeave);
    openPopup();
  }

  // ── Mobile: History API back-gesture intercept ─────────────────
  // Pushes a dummy state so the first back press triggers our popup
  // instead of leaving the page.
  function initMobileBackIntercept() {
    if (typeof history === 'undefined' || !history.pushState) return;
    history.pushState({ eipGuard: true }, '');

    window.addEventListener('popstate', function onPop(e) {
      if (triggered || wasDismissed()) {
        window.removeEventListener('popstate', onPop);
        return;
      }
      if (Date.now() - pageReadyAt < DELAY_MS) return;
      // Push the guard state back so the user stays on the page
      history.pushState({ eipGuard: true }, '');
      openPopup();
    });
  }

  // ── Copy discount code ─────────────────────────────────────────
  function copyCode() {
    if (!CODE) return;
    clearTimeout(copyTimeout);
    navigator.clipboard.writeText(CODE)
      .then(showCopied)
      .catch(() => {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = CODE;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        try { document.execCommand('copy'); } catch (_) {}
        document.body.removeChild(el);
        showCopied();
      });
  }

  function showCopied() {
    if (!copiedEl) return;
    copiedEl.textContent = 'Copied!';
    copiedEl.classList.add('show');
    copyTimeout = setTimeout(() => {
      copiedEl.classList.remove('show');
      copiedEl.textContent = '';
    }, 2000);
  }

  // ── CTA: apply discount code before redirecting ────────────────
  // If the store uses Shopify's discount URL param, we append it.
  if (cta && CODE) {
    cta.addEventListener('click', function (e) {
      e.preventDefault();
      // Apply discount via the discount endpoint then redirect to checkout
      fetch(`/discount/${encodeURIComponent(CODE)}`, { method: 'GET' })
        .finally(() => {
          window.location.href = '/checkout';
        });
    });
  }

  // ── Event listeners ────────────────────────────────────────────
  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (dismiss)  dismiss.addEventListener('click', closePopup);
  if (backdrop) backdrop.addEventListener('click', closePopup);
  if (copyBtn)  copyBtn.addEventListener('click', copyCode);

  // Close on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('is-visible')) {
      closePopup();
    }
  });

  // ── Init ───────────────────────────────────────────────────────
  if (!wasDismissed()) {
    // Desktop
    document.addEventListener('mouseleave', onMouseLeave);
    // Mobile
    initMobileBackIntercept();
  }
})();
