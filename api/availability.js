'use strict';

const {
  getAvailableSlots,
  getBookingService,
  getMonthAvailableSlots,
  getSettings,
  getSettingsForService,
  httpError,
  requireBookingConfiguration
} = require('./_booking-utils');

module.exports = async function availabilityHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  res.setHeader('Cache-Control', 'no-store');

  try {
    const url = new URL(req.url, 'https://abinto-production.fr');
    const date = url.searchParams.get('date');
    const month = url.searchParams.get('month');
    const service = getBookingService(url.searchParams.get('service'));
    if (Boolean(date) === Boolean(month)) throw httpError('Indiquez une date ou un mois de réservation.', 400);

    const settings = getSettings();
    requireBookingConfiguration(settings);
    const bookingSettings = getSettingsForService(settings, service);

    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw httpError('Mois de réservation invalide.', 400);
      const days = await getMonthAvailableSlots(bookingSettings, month);
      return res.status(200).json({
        month,
        days,
        service: service.id,
        timezone: bookingSettings.timezone,
        durationMinutes: bookingSettings.durationMinutes,
        windowDays: bookingSettings.windowDays
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError('Date de réservation invalide.', 400);
    const slots = await getAvailableSlots(bookingSettings, date);

    return res.status(200).json({
      date,
      slots,
      service: service.id,
      timezone: bookingSettings.timezone,
      durationMinutes: bookingSettings.durationMinutes
    });
  } catch (error) {
    console.error('Availability API error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Impossible de charger les créneaux.' });
  }
};
