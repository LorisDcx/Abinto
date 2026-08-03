'use strict';

const {
  getAvailableSlots,
  getSettings,
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError('Date de réservation invalide.', 400);

    const settings = getSettings();
    requireBookingConfiguration(settings);
    const slots = await getAvailableSlots(settings, date);

    return res.status(200).json({
      date,
      slots,
      timezone: settings.timezone,
      durationMinutes: settings.durationMinutes
    });
  } catch (error) {
    console.error('Availability API error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Impossible de charger les créneaux.' });
  }
};
