(() => {
  'use strict';

  const VIDEO_ID = '381YANFlA3Q';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);

  const header = document.querySelector('#site-header');
  const hero = document.querySelector('.hero');
  const heroStage = document.querySelector('#hero-stage');
  const heroPlayer = document.querySelector('#hero-player');
  const heroFocalValue = document.querySelector('#hero-focal-value');
  const heroFocalProgress = document.querySelector('#hero-focal-progress');

  function youtubeEmbedUrl(videoId, options = {}) {
    const params = new URLSearchParams({
      rel: '0',
      playsinline: '1',
      ...options
    });

    if (['http:', 'https:'].includes(window.location.protocol)) {
      params.set('origin', window.location.origin);
    }

    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  }

  function createHeroVideo() {
    if (!hero || !heroPlayer || reducedMotion || new URLSearchParams(location.search).has('preview')) return;
    if (!['http:', 'https:'].includes(window.location.protocol)) return;

    const iframe = document.createElement('iframe');
    iframe.src = youtubeEmbedUrl(VIDEO_ID, {
      autoplay: '1',
      mute: '1',
      controls: '0',
      loop: '1',
      playlist: VIDEO_ID,
      disablekb: '1',
      iv_load_policy: '3',
      modestbranding: '1'
    });
    iframe.title = 'Court métrage ABINTO en arrière-plan';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.tabIndex = -1;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.addEventListener('load', () => {
      window.setTimeout(() => hero.classList.add('has-video'), 350);
    }, { once: true });
    heroPlayer.appendChild(iframe);
  }

  function updateHero() {
    if (!hero || !heroStage) return;
    const scrollDistance = Math.max(1, hero.offsetHeight - window.innerHeight);
    const progress = clamp((window.scrollY - hero.offsetTop) / scrollDistance, 0, 1);
    const focusIn = smooth(clamp(progress / .22, 0, 1));
    const exit = smooth(clamp((progress - .58) / .34, 0, 1));
    const focalProgress = smooth(progress);

    const scale = reducedMotion ? 1.04 : lerp(1.055, 1.19, focalProgress);
    const blur = reducedMotion ? 0 : lerp(12, 0, focusIn) + exit * 2.5;
    const copyOpacity = 1 - exit;
    const copyY = reducedMotion ? 0 : -18 * exit;
    const focal = Math.round(lerp(24, 35, focalProgress));

    heroStage.style.setProperty('--hero-scale', scale.toFixed(4));
    heroStage.style.setProperty('--hero-blur', `${blur.toFixed(2)}px`);
    heroStage.style.setProperty('--copy-opacity', copyOpacity.toFixed(3));
    heroStage.style.setProperty('--copy-y', `${copyY.toFixed(1)}px`);
    if (heroFocalValue) heroFocalValue.textContent = String(focal);
    if (heroFocalProgress) heroFocalProgress.style.width = `${(focalProgress * 100).toFixed(1)}%`;
    header?.classList.toggle('is-solid', window.scrollY > window.innerHeight * .72);
  }

  function playInlineVideo(container) {
    if (!container || container.classList.contains('is-playing')) return;
    const media = container.querySelector('.inline-video-media');
    const videoId = container.dataset.videoId;
    const title = container.dataset.videoTitle || 'Film ABINTO';
    if (!media || !videoId) return;

    const iframe = document.createElement('iframe');
    iframe.src = youtubeEmbedUrl(videoId, {
      autoplay: '1',
      controls: '1',
      modestbranding: '1'
    });
    iframe.title = title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';

    media.replaceChildren(iframe);
    container.classList.add('is-playing');
  }

  document.querySelectorAll('[data-inline-video]').forEach((container) => {
    container.querySelector('.inline-video-trigger')?.addEventListener('click', () => playInlineVideo(container));
  });

  document.querySelectorAll('[data-launch-inline]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.querySelector(button.dataset.launchInline);
      if (!target) return;
      playInlineVideo(target);
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: .08, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.reveal').forEach((element) => {
    if (reducedMotion || element.getBoundingClientRect().top < window.innerHeight * .92) {
      element.classList.add('is-visible');
    } else {
      revealObserver.observe(element);
    }
  });

  const serviceSlider = document.querySelector('[data-service-slider]');
  const serviceSlides = [...document.querySelectorAll('.service-slide')];
  const serviceTrack = serviceSlider?.querySelector('.services-slider-track');
  const serviceViewport = serviceSlider?.querySelector('.services-slider-viewport');
  const categoryLinks = [...document.querySelectorAll('[data-slider-go]')];
  const previousCategory = document.querySelector('[data-slider-prev]');
  const nextCategory = document.querySelector('[data-slider-next]');
  const sliderCurrent = document.querySelector('[data-slider-current]');
  const sliderTotal = document.querySelector('[data-slider-total]');

  if (serviceSlider && serviceTrack && serviceViewport && serviceSlides.length) {
    const count = serviceSlides.length;
    let activeIndex = Math.max(0, serviceSlides.findIndex((slide) => `#${slide.id}` === window.location.hash));
    let resizeObserver;
    let touchStartX = 0;
    let touchStartY = 0;

    const twoDigits = (number) => String(number).padStart(2, '0');
    if (sliderTotal) sliderTotal.textContent = twoDigits(count);

    function updateSliderHeight() {
      const activeSlide = serviceSlides[activeIndex];
      if (!activeSlide) return;
      serviceViewport.style.height = `${activeSlide.scrollHeight}px`;
    }

    function revealSlide(slide) {
      slide.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
    }

    function setActiveSlide(index, options = {}) {
      const { updateHash = true, moveFocus = false } = options;
      activeIndex = (index + count) % count;
      // A hash target inside the horizontal carousel can make the browser scroll
      // the viewport sideways by itself. Reset that native movement so only
      // our track transition moves the formula list.
      serviceViewport.scrollLeft = 0;
      serviceTrack.style.transform = `translate3d(${-activeIndex * 100}%, 0, 0)`;

      serviceSlides.forEach((slide, slideIndex) => {
        const active = slideIndex === activeIndex;
        slide.setAttribute('aria-hidden', String(!active));
        if (active) {
          slide.removeAttribute('inert');
          revealSlide(slide);
        } else {
          slide.setAttribute('inert', '');
        }
      });

      categoryLinks.forEach((link, linkIndex) => {
        const active = linkIndex === activeIndex;
        link.classList.toggle('is-active', active);
        if (active) {
          link.setAttribute('aria-current', 'page');
          link.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
        } else {
          link.removeAttribute('aria-current');
        }
      });

      if (sliderCurrent) sliderCurrent.textContent = twoDigits(activeIndex + 1);
      const previousLabel = serviceSlides[(activeIndex - 1 + count) % count].dataset.slideLabel;
      const nextLabel = serviceSlides[(activeIndex + 1) % count].dataset.slideLabel;
      previousCategory?.setAttribute('aria-label', `Voir ${previousLabel}`);
      nextCategory?.setAttribute('aria-label', `Voir ${nextLabel}`);

      window.requestAnimationFrame(updateSliderHeight);
      window.setTimeout(updateSliderHeight, reducedMotion ? 0 : 760);

      if (updateHash) {
        const activeSlide = serviceSlides[activeIndex];
        history.replaceState(null, '', `#${activeSlide.id}`);
      }

      if (moveFocus) {
        const heading = serviceSlides[activeIndex].querySelector('h2');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
    }

    categoryLinks.forEach((link, index) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        setActiveSlide(index, { updateHash: true });
      });
    });

    previousCategory?.addEventListener('click', () => setActiveSlide(activeIndex - 1));
    nextCategory?.addEventListener('click', () => setActiveSlide(activeIndex + 1));

    [serviceSlider, document.querySelector('[data-service-slider-controls]')].filter(Boolean).forEach((region) => {
      region.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          setActiveSlide(activeIndex - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          setActiveSlide(activeIndex + 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          setActiveSlide(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          setActiveSlide(count - 1);
        }
      });
    });

    serviceViewport.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    serviceViewport.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
      setActiveSlide(activeIndex + (deltaX < 0 ? 1 : -1));
    }, { passive: true });

    window.addEventListener('hashchange', () => {
      const index = serviceSlides.findIndex((slide) => `#${slide.id}` === window.location.hash);
      if (index >= 0) setActiveSlide(index, { updateHash: false });
    });

    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(updateSliderHeight);
      serviceSlides.forEach((slide) => resizeObserver.observe(slide));
    }

    window.addEventListener('load', updateSliderHeight, { once: true });
    document.fonts?.ready.then(updateSliderHeight);
    setActiveSlide(activeIndex, { updateHash: false });
  }

  const contactForm = document.querySelector('[data-contact-form]');
  if (contactForm) {
    const status = contactForm.querySelector('[data-form-status]');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const initialButtonText = submitButton?.textContent || 'Envoyer la demande';

    function setFormStatus(message, state = '') {
      if (!status) return;
      status.textContent = message;
      status.classList.toggle('is-success', state === 'success');
      status.classList.toggle('is-error', state === 'error');
    }

    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      setFormStatus('');

      if (!contactForm.reportValidity()) return;

      const payload = Object.fromEntries(new FormData(contactForm).entries());
      submitButton?.setAttribute('disabled', '');
      if (submitButton) submitButton.textContent = 'Envoi en cours…';

      try {
        const response = await fetch(contactForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error || 'Le message n’a pas pu être envoyé.');
        }

        contactForm.reset();
        setFormStatus('Merci, votre demande a bien été envoyée.', 'success');
      } catch (error) {
        const localMessage = ['file:', 'http:'].includes(window.location.protocol)
          ? 'Le formulaire fonctionne une fois le site déployé avec l’API Resend configurée.'
          : (error.message || 'Une erreur est survenue. Réessayez dans quelques instants.');
        setFormStatus(localMessage, 'error');
      } finally {
        submitButton?.removeAttribute('disabled');
        if (submitButton) submitButton.textContent = initialButtonText;
      }
    });
  }

  function updateScrollProgress() {
    if (!header) return;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body?.scrollHeight || 0
    );
    const scrollable = Math.max(1, documentHeight - window.innerHeight);
    const pageProgress = clamp(window.scrollY / scrollable, 0, 1);
    header.style.setProperty('--scroll-progress', pageProgress.toFixed(4));
  }

  let ticking = false;
  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateHero();
      updateScrollProgress();
      ticking = false;
    });
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);

  createHeroVideo();
  updateHero();
  updateScrollProgress();
})();
