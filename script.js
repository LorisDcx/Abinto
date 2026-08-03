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
    let touchStartedInsideOffer = false;

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
      touchStartedInsideOffer = Boolean(event.target.closest('.offers-grid'));
    }, { passive: true });

    serviceViewport.addEventListener('touchend', (event) => {
      if (touchStartedInsideOffer) {
        touchStartedInsideOffer = false;
        return;
      }
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

  function applyOfferContext() {
    const params = new URLSearchParams(window.location.search);
    const formula = params.get('formula');
    if (!formula || !contactForm) return;

    const offerField = contactForm.querySelector('[data-offer-field]');
    const offerInput = contactForm.querySelector('[name="offer"]');
    const projectType = params.get('projectType');
    const projectSelect = contactForm.querySelector('[name="projectType"]');
    const message = contactForm.querySelector('[name="message"]');

    if (offerInput) offerInput.value = formula;
    if (offerField) offerField.hidden = false;
    if (projectType && projectSelect && [...projectSelect.options].some((option) => option.value === projectType)) {
      projectSelect.value = projectType;
    }
    if (message && !message.value.trim()) {
      message.value = `Bonjour ABINTO,\n\nJe souhaite échanger à propos de la formule « ${formula} ».\n\n`;
    }
  }

  applyOfferContext();

  const booking = document.querySelector('[data-booking]');
  if (booking) {
    const calendarGrid = booking.querySelector('[data-booking-calendar]');
    const monthLabel = booking.querySelector('[data-booking-month-label]');
    const previousMonth = booking.querySelector('[data-booking-month-prev]');
    const nextMonth = booking.querySelector('[data-booking-month-next]');
    const slotsContainer = booking.querySelector('[data-booking-slots]');
    const selectedDateLabel = booking.querySelector('[data-booking-selected-date]');
    const durationLabel = booking.querySelector('[data-booking-duration]');
    const bookingForm = booking.querySelector('[data-booking-form]');
    const bookingStart = booking.querySelector('[data-booking-start]');
    const selection = booking.querySelector('[data-booking-selection]');
    const selectionLabel = booking.querySelector('[data-booking-selection-label]');
    const bookingStatus = booking.querySelector('[data-booking-status]');
    const submitButton = bookingForm?.querySelector('button[type="submit"]');
    const success = booking.querySelector('[data-booking-success]');
    const successDate = booking.querySelector('[data-booking-success-date]');
    const googleCalendarLink = booking.querySelector('[data-booking-google-calendar]');
    const icsButton = booking.querySelector('[data-booking-ics]');
    const dayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
    const defaultButtonText = submitButton?.textContent || 'Confirmer le rendez-vous';
    let requestId = 0;
    let selectedDay = '';
    let selectedSlot = null;
    let bookingTimezone = 'Europe/Paris';
    let bookingDuration = 30;
    let bookingWindowDays = 45;
    let monthSlots = new Map();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const firstAvailableMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let visibleMonth = new Date(firstAvailableMonth);

    function localDateKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function dayFromKey(key) {
      const [year, month, day] = key.split('-').map(Number);
      return new Date(year, month - 1, day, 12);
    }

    function monthKey(date) {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function clearSelectedSlot() {
      selectedSlot = null;
      if (bookingStart) bookingStart.value = '';
      if (selection) selection.hidden = true;
      submitButton?.setAttribute('disabled', '');
    }

    function setBookingStatus(message, state = '') {
      if (!bookingStatus) return;
      bookingStatus.textContent = message;
      bookingStatus.classList.toggle('is-success', state === 'success');
      bookingStatus.classList.toggle('is-error', state === 'error');
    }

    function formatSlotDate(iso) {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: bookingTimezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(iso));
    }

    function renderSlots(slots) {
      if (!slotsContainer) return;
      slotsContainer.replaceChildren();
      if (!slots.length) {
        const message = document.createElement('p');
        message.className = 'booking-empty';
        message.textContent = 'Aucun créneau ce jour-là. Essayez une autre date.';
        slotsContainer.appendChild(message);
        return;
      }

      slots.forEach((slot) => {
        const button = document.createElement('button');
        button.className = 'booking-slot';
        button.type = 'button';
        button.textContent = slot.label;
        button.setAttribute('aria-label', `${formatSlotDate(slot.start)}, durée ${bookingDuration} minutes`);
        button.addEventListener('click', () => selectSlot(slot, button));
        slotsContainer.appendChild(button);
      });
    }

    function selectSlot(slot, button) {
      selectedSlot = slot;
      if (bookingStart) bookingStart.value = slot.start;
      slotsContainer?.querySelectorAll('.booking-slot').forEach((item) => item.classList.toggle('is-selected', item === button));
      if (selection) selection.hidden = false;
      if (selectionLabel) selectionLabel.textContent = formatSlotDate(slot.start);
      submitButton?.removeAttribute('disabled');
      setBookingStatus('');
    }

    function selectDay(dayKey) {
      const day = monthSlots.get(dayKey);
      if (!day?.slots?.length) return;
      selectedDay = dayKey;
      clearSelectedSlot();
      setBookingStatus('');
      if (selectedDateLabel) selectedDateLabel.textContent = dayFormatter.format(dayFromKey(dayKey));
      renderCalendar();
      renderSlots(day.slots);
    }

    function renderCalendar() {
      if (!calendarGrid) return;
      calendarGrid.replaceChildren();
      if (monthLabel) monthLabel.textContent = monthFormatter.format(visibleMonth);

      const year = visibleMonth.getFullYear();
      const month = visibleMonth.getMonth();
      const leadingDays = (new Date(year, month, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const lastBookableDate = new Date(today);
      lastBookableDate.setDate(lastBookableDate.getDate() + bookingWindowDays);

      for (let blank = 0; blank < leadingDays; blank += 1) {
        const spacer = document.createElement('span');
        spacer.className = 'booking-calendar-empty';
        spacer.setAttribute('aria-hidden', 'true');
        calendarGrid.appendChild(spacer);
      }

      for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
        const date = new Date(year, month, dayNumber, 12);
        const key = localDateKey(date);
        const availability = monthSlots.get(key);
        const available = Boolean(availability?.slots?.length);
        const inRange = date >= today && date <= lastBookableDate;
        const button = document.createElement('button');
        button.className = 'booking-calendar-day';
        button.type = 'button';
        button.disabled = !available || !inRange;
        button.textContent = String(dayNumber);
        button.setAttribute('aria-label', `${dayFormatter.format(date)}${available ? ', créneaux disponibles' : ', indisponible'}`);
        button.setAttribute('aria-pressed', String(key === selectedDay));
        button.classList.toggle('is-today', key === localDateKey(today));
        button.classList.toggle('has-slots', available && inRange);
        button.classList.toggle('is-selected', key === selectedDay);
        if (available && inRange) {
          const indicator = document.createElement('i');
          indicator.setAttribute('aria-hidden', 'true');
          button.appendChild(indicator);
          button.addEventListener('click', () => selectDay(key));
        }
        calendarGrid.appendChild(button);
      }

      const lastBookableMonth = new Date(lastBookableDate.getFullYear(), lastBookableDate.getMonth(), 1);
      const followingMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      if (previousMonth) previousMonth.disabled = visibleMonth <= firstAvailableMonth;
      if (nextMonth) nextMonth.disabled = followingMonth > lastBookableMonth;
    }

    function showCalendarMessage(messageText) {
      if (!slotsContainer) return;
      slotsContainer.replaceChildren();
      const message = document.createElement('p');
      message.className = 'booking-empty';
      message.textContent = messageText;
      slotsContainer.appendChild(message);
    }

    async function loadMonth(preferredDate = '') {
      const thisRequest = ++requestId;
      clearSelectedSlot();
      selectedDay = '';
      setBookingStatus('');
      monthSlots = new Map();
      if (selectedDateLabel) selectedDateLabel.textContent = 'Chargement des disponibilités…';
      if (slotsContainer) slotsContainer.innerHTML = '<p class="booking-loading">Lecture de l’agenda en cours…</p>';
      renderCalendar();

      try {
        const response = await fetch(`/api/availability?month=${encodeURIComponent(monthKey(visibleMonth))}`, { headers: { Accept: 'application/json' } });
        const result = await response.json().catch(() => ({}));
        if (thisRequest !== requestId) return;
        if (!response.ok) throw new Error(result.error || 'Impossible de charger le calendrier.');
        bookingTimezone = result.timezone || bookingTimezone;
        bookingDuration = result.durationMinutes || bookingDuration;
        bookingWindowDays = result.windowDays || bookingWindowDays;
        if (durationLabel) durationLabel.textContent = `${bookingDuration} min`;
        monthSlots = new Map((result.days || []).map((day) => [day.date, day]));
        const requested = monthSlots.get(preferredDate);
        const firstAvailableDay = [...monthSlots.values()].find((day) => day.slots?.length);
        renderCalendar();
        if (requested?.slots?.length) {
          selectDay(preferredDate);
        } else if (firstAvailableDay) {
          selectDay(firstAvailableDay.date);
        } else {
          if (selectedDateLabel) selectedDateLabel.textContent = 'Aucune disponibilité ce mois-ci';
          showCalendarMessage('Aucun créneau n’est disponible ce mois-ci. Essayez le mois suivant.');
        }
      } catch (error) {
        if (thisRequest !== requestId) return;
        if (selectedDateLabel) selectedDateLabel.textContent = 'Calendrier indisponible';
        showCalendarMessage(error.message || 'Les créneaux sont momentanément indisponibles.');
      }
    }

    function createIcs(slot) {
      const compactDate = (date) => new Date(date).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ABINTO//Réservation//FR',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:abinto-${Date.now()}@abinto-production.fr`,
        `DTSTAMP:${compactDate(new Date())}`,
        `DTSTART:${compactDate(slot.start)}`,
        `DTEND:${compactDate(slot.end)}`,
        'SUMMARY:Échange ABINTO',
        'DESCRIPTION:Votre échange ABINTO.',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');
    }

    function configureCalendarActions(slot) {
      if (googleCalendarLink) {
        const dates = `${new Date(slot.start).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')}/${new Date(slot.end).toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')}`;
        googleCalendarLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('Échange ABINTO')}&dates=${dates}&details=${encodeURIComponent('Votre échange ABINTO.')}`;
        googleCalendarLink.target = '_blank';
        googleCalendarLink.rel = 'noopener noreferrer';
      }
      icsButton?.addEventListener('click', () => {
        const file = new Blob([createIcs(slot)], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'echange-abinto.ics';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }, { once: true });
    }

    bookingForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!selectedSlot || !bookingStart?.value) {
        setBookingStatus('Choisissez d’abord un créneau.', 'error');
        return;
      }
      if (!bookingForm.reportValidity()) return;

      const payload = Object.fromEntries(new FormData(bookingForm).entries());
      submitButton?.setAttribute('disabled', '');
      if (submitButton) submitButton.textContent = 'Confirmation en cours…';
      setBookingStatus('');

      try {
        const response = await fetch(bookingForm.action, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Impossible de confirmer le rendez-vous.');

        const confirmedSlot = { start: result.start, end: result.end };
        bookingTimezone = result.timezone || bookingTimezone;
        if (successDate) successDate.textContent = formatSlotDate(confirmedSlot.start);
        configureCalendarActions(confirmedSlot);
        bookingForm.hidden = true;
        if (success) success.hidden = false;
      } catch (error) {
        setBookingStatus(error.message || 'Une erreur est survenue. Réessayez dans quelques instants.', 'error');
        submitButton?.removeAttribute('disabled');
        if (submitButton) submitButton.textContent = defaultButtonText;
        if (error.message?.includes('vient d’être réservé')) loadMonth(selectedDay);
      }
    });

    previousMonth?.addEventListener('click', () => {
      if (visibleMonth <= firstAvailableMonth) return;
      visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
      loadMonth();
    });
    nextMonth?.addEventListener('click', () => {
      const lastBookableDate = new Date(today);
      lastBookableDate.setDate(lastBookableDate.getDate() + bookingWindowDays);
      const candidate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
      const lastBookableMonth = new Date(lastBookableDate.getFullYear(), lastBookableDate.getMonth(), 1);
      if (candidate > lastBookableMonth) return;
      visibleMonth = candidate;
      loadMonth();
    });

    loadMonth();
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
