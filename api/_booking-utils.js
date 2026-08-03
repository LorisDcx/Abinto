'use strict';

const { createSign } = require('crypto');

const DEFAULT_AVAILABILITY = {
  1: ['09:00-12:00', '14:00-18:00'],
  2: ['09:00-12:00', '14:00-18:00'],
  3: ['09:00-12:00', '14:00-18:00'],
  4: ['09:00-12:00', '14:00-18:00'],
  5: ['09:00-12:00', '14:00-17:00']
};

const formatterCache = new Map();

function httpError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;

  try {
    return JSON.parse(req.body);
  } catch (_) {
    return Object.fromEntries(new URLSearchParams(req.body));
  }
}

function readPositiveInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function readAvailability(value) {
  if (!value) return DEFAULT_AVAILABILITY;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();

    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([day, ranges]) => /^(0|[1-6])$/.test(day) && Array.isArray(ranges))
        .map(([day, ranges]) => [day, ranges.filter((range) => /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(range))])
    );
  } catch (_) {
    throw httpError('La configuration des horaires de réservation est invalide.', 503);
  }
}

function getSettings() {
  return {
    timezone: process.env.BOOKING_TIMEZONE || 'Europe/Paris',
    durationMinutes: readPositiveInteger(process.env.BOOKING_DURATION_MINUTES, 30, 15, 180),
    slotMinutes: readPositiveInteger(process.env.BOOKING_SLOT_MINUTES, 30, 15, 60),
    minNoticeHours: readPositiveInteger(process.env.BOOKING_MIN_NOTICE_HOURS, 24, 1, 168),
    windowDays: readPositiveInteger(process.env.BOOKING_WINDOW_DAYS, 45, 7, 180),
    availability: readAvailability(process.env.BOOKING_AVAILABILITY),
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.BOOKING_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL,
    ownerEmail: process.env.CONTACT_TO_EMAIL
  };
}

function requireBookingConfiguration(settings) {
  if (!settings.calendarId || !settings.serviceAccountEmail || !settings.serviceAccountPrivateKey) {
    throw httpError('La réservation est en cours de configuration. Merci de réessayer un peu plus tard.', 503);
  }
  if (!settings.resendApiKey || !settings.fromEmail || !settings.ownerEmail) {
    throw httpError('La confirmation par e-mail est en cours de configuration. Merci de réessayer un peu plus tard.', 503);
  }
}

function getFormatter(timezone) {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(timezone, new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }));
  }
  return formatterCache.get(timezone);
}

function zonedParts(date, timezone) {
  const result = {};
  getFormatter(timezone).formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') result[part.type] = Number(part.value);
  });
  return result;
}

function dateKey(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year, month, day] = value.split('-').map(Number);
  const checked = new Date(Date.UTC(year, month - 1, day));
  if (checked.getUTCFullYear() !== year || checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) return null;
  return { year, month, day };
}

function parseMonthKey(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return null;
  const [year, month] = value.split('-').map(Number);
  return { year, month };
}

function zonedDateTimeToUtc({ year, month, day, hour, minute }, timezone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);

  // Two passes account for the timezone offset, including the usual DST switch.
  for (let pass = 0; pass < 2; pass += 1) {
    const actual = zonedParts(new Date(utc), timezone);
    const wantedTimestamp = Date.UTC(year, month - 1, day, hour, minute, 0);
    const actualTimestamp = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second || 0);
    utc += wantedTimestamp - actualTimestamp;
  }

  return new Date(utc);
}

function minutesFromTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function rangesForDate(parts, settings) {
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return settings.availability[String(weekday)] || [];
}

function isWithinBookingWindow(dayKey, settings, now = new Date()) {
  const requested = parseDateKey(dayKey);
  if (!requested) return false;
  const today = zonedParts(now, settings.timezone);
  const startOfToday = zonedDateTimeToUtc({ ...today, hour: 0, minute: 0 }, settings.timezone);
  const requestedStart = zonedDateTimeToUtc({ ...requested, hour: 0, minute: 0 }, settings.timezone);
  const max = new Date(startOfToday.getTime() + settings.windowDays * 86400000);
  return requestedStart >= startOfToday && requestedStart <= max;
}

function buildSlots(dayKey, settings, busyPeriods = [], now = new Date()) {
  const day = parseDateKey(dayKey);
  if (!day || !isWithinBookingWindow(dayKey, settings, now)) return [];

  const earliest = now.getTime() + settings.minNoticeHours * 3600000;
  const slots = [];

  rangesForDate(day, settings).forEach((range) => {
    const [rangeStart, rangeEnd] = range.split('-').map(minutesFromTime);
    for (let minute = rangeStart; minute + settings.durationMinutes <= rangeEnd; minute += settings.slotMinutes) {
      const start = zonedDateTimeToUtc({ ...day, hour: Math.floor(minute / 60), minute: minute % 60 }, settings.timezone);
      const end = new Date(start.getTime() + settings.durationMinutes * 60000);
      const isBusy = busyPeriods.some((period) => start < period.end && end > period.start);
      if (start.getTime() >= earliest && !isBusy) {
        slots.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: formatTime(minute)
        });
      }
    }
  });

  return slots;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function getGoogleAccessToken(settings) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: settings.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedToken);
  signer.end();
  const signature = base64Url(signer.sign(settings.serviceAccountPrivateKey));

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsignedToken}.${signature}`
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) {
    console.error('Google OAuth error:', result);
    throw httpError('La connexion à l’agenda est momentanément indisponible.', 502);
  }
  return result.access_token;
}

async function googleCalendarRequest(settings, path, options = {}) {
  const token = await getGoogleAccessToken(settings);
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Google Calendar error:', result);
    throw httpError('La connexion à l’agenda est momentanément indisponible.', 502);
  }
  return result;
}

async function getBusyPeriods(settings, timeMin, timeMax) {
  const result = await googleCalendarRequest(settings, '/freeBusy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: settings.timezone,
      items: [{ id: settings.calendarId }]
    })
  });

  const calendar = result.calendars?.[settings.calendarId];
  if (calendar?.errors?.length) throw httpError('La connexion à l’agenda est momentanément indisponible.', 502);
  return (calendar?.busy || []).map((period) => ({ start: new Date(period.start), end: new Date(period.end) }));
}

async function getAvailableSlots(settings, dayKey) {
  const day = parseDateKey(dayKey);
  if (!day || !isWithinBookingWindow(dayKey, settings)) return [];
  const dayStart = zonedDateTimeToUtc({ ...day, hour: 0, minute: 0 }, settings.timezone);
  const dayEnd = new Date(dayStart.getTime() + 36 * 3600000);
  const busyPeriods = await getBusyPeriods(settings, dayStart, dayEnd);
  return buildSlots(dayKey, settings, busyPeriods);
}

async function getMonthAvailableSlots(settings, monthKey) {
  const month = parseMonthKey(monthKey);
  if (!month) return [];

  const firstDay = zonedDateTimeToUtc({ ...month, day: 1, hour: 0, minute: 0 }, settings.timezone);
  const nextMonth = month.month === 12 ? { year: month.year + 1, month: 1 } : { year: month.year, month: month.month + 1 };
  const end = zonedDateTimeToUtc({ ...nextMonth, day: 1, hour: 0, minute: 0 }, settings.timezone);
  const busyPeriods = await getBusyPeriods(settings, firstDay, end);
  const dayCount = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();

  return Array.from({ length: dayCount }, (_, index) => {
    const date = `${monthKey}-${String(index + 1).padStart(2, '0')}`;
    return { date, slots: buildSlots(date, settings, busyPeriods) };
  });
}

async function createCalendarEvent(settings, event) {
  return googleCalendarRequest(settings, `/calendars/${encodeURIComponent(settings.calendarId)}/events?sendUpdates=all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
}

function formatBookingDate(start, timezone) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(start);
}

function formatIcsDate(date) {
  return date.toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '');
}

function escapeIcs(value = '') {
  return String(value).replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
}

function createIcs({ id, start, end, name, timezone }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ABINTO//Réservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${id}@abinto-production.fr`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    'SUMMARY:Échange ABINTO',
    `DESCRIPTION:${escapeIcs(`Votre échange ABINTO avec ${name}. Heure locale : ${timezone}.`)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

async function sendResendEmail(settings, message) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: settings.fromEmail, ...message })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Resend booking error:', result);
    throw new Error('Resend booking email failed');
  }
}

module.exports = {
  buildSlots,
  createCalendarEvent,
  createIcs,
  escapeHtml,
  formatBookingDate,
  getAvailableSlots,
  getMonthAvailableSlots,
  getSettings,
  httpError,
  parseBody,
  requireBookingConfiguration,
  sendResendEmail,
  zonedParts
};
