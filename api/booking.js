'use strict';

const {
  createCalendarEvent,
  createIcs,
  escapeHtml,
  formatBookingDate,
  getAvailableSlots,
  getSettings,
  httpError,
  parseBody,
  requireBookingConfiguration,
  sendResendEmail,
  zonedParts
} = require('./_booking-utils');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLength = 400) {
  return String(value || '').trim().slice(0, maxLength);
}

module.exports = async function bookingHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const body = parseBody(req);
    const firstname = clean(body.firstname, 80);
    const lastname = clean(body.lastname, 80);
    const email = clean(body.email, 320).toLowerCase();
    const phone = clean(body.phone, 80);
    const company = clean(body.company, 160);
    const message = clean(body.message, 1500);
    const website = clean(body.website, 200);
    const startValue = clean(body.start, 80);

    if (website) return res.status(200).json({ ok: true });
    if (!firstname || !lastname || !email || body.consent !== 'yes' || !startValue) {
      throw httpError('Merci de compléter les informations obligatoires et de choisir un créneau.', 400);
    }
    if (!emailPattern.test(email)) throw httpError('L’adresse e-mail semble incorrecte.', 400);

    const start = new Date(startValue);
    if (Number.isNaN(start.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(startValue)) {
      throw httpError('Créneau de réservation invalide.', 400);
    }

    const settings = getSettings();
    requireBookingConfiguration(settings);
    const local = zonedParts(start, settings.timezone);
    const selectedDate = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
    const slots = await getAvailableSlots(settings, selectedDate);
    const slot = slots.find((candidate) => candidate.start === start.toISOString());

    if (!slot) {
      throw httpError('Ce créneau vient d’être réservé. Choisissez-en un autre.', 409);
    }

    const end = new Date(slot.end);
    const name = `${firstname} ${lastname}`;
    const dateLabel = formatBookingDate(start, settings.timezone);
    const calendarEvent = await createCalendarEvent(settings, {
      summary: `Échange ABINTO — ${name}`,
      description: [
        'Rendez-vous pris depuis le site ABINTO.',
        '',
        `Nom : ${name}`,
        `E-mail : ${email}`,
        `Téléphone : ${phone || 'Non renseigné'}`,
        `Entreprise : ${company || 'Non renseignée'}`,
        message ? `Contexte : ${message}` : ''
      ].filter(Boolean).join('\n'),
      start: { dateTime: start.toISOString(), timeZone: settings.timezone },
      end: { dateTime: end.toISOString(), timeZone: settings.timezone },
      reminders: { useDefault: true }
    });

    const safe = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      phone: escapeHtml(phone || 'Non renseigné'),
      company: escapeHtml(company || 'Non renseignée'),
      message: escapeHtml(message || 'Aucun détail supplémentaire').replaceAll('\n', '<br>'),
      date: escapeHtml(dateLabel)
    };
    const ics = createIcs({ id: calendarEvent.id, start, end, name, timezone: settings.timezone });

    await Promise.allSettled([
      sendResendEmail(settings, {
        to: [email],
        reply_to: settings.ownerEmail,
        subject: 'Votre échange ABINTO est confirmé',
        text: `Bonjour ${name},\n\nVotre échange ABINTO est confirmé : ${dateLabel}.\n\nVous recevrez également une invitation agenda. À bientôt !`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171416"><div style="padding:24px;background:#b51f2a;color:#fff"><h1 style="margin:0;font-size:24px">Échange confirmé</h1></div><div style="padding:28px;border:1px solid #e3dbd6;border-top:0;background:#fffdfa"><p>Bonjour ${safe.name},</p><p>Votre échange ABINTO est bien réservé :</p><p style="font-size:18px"><strong>${safe.date}</strong></p><p>Une invitation agenda vous a également été envoyée. À bientôt !</p></div></div>`,
        attachments: [{ filename: 'echange-abinto.ics', content: Buffer.from(ics).toString('base64') }]
      }),
      sendResendEmail(settings, {
        to: [settings.ownerEmail],
        reply_to: email,
        subject: `Nouveau rendez-vous ABINTO — ${dateLabel}`,
        text: `Nouveau rendez-vous ABINTO\n\n${dateLabel}\nNom : ${name}\nE-mail : ${email}\nTéléphone : ${phone || 'Non renseigné'}\nEntreprise : ${company || 'Non renseignée'}\n\nContexte :\n${message || 'Aucun détail supplémentaire'}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#171416"><div style="padding:24px;background:#b51f2a;color:#fff"><h1 style="margin:0;font-size:24px">Nouveau rendez-vous ABINTO</h1></div><div style="padding:28px;border:1px solid #e3dbd6;border-top:0;background:#fffdfa"><p style="font-size:18px"><strong>${safe.date}</strong></p><p><strong>Nom :</strong> ${safe.name}</p><p><strong>E-mail :</strong> ${safe.email}</p><p><strong>Téléphone :</strong> ${safe.phone}</p><p><strong>Entreprise :</strong> ${safe.company}</p><hr style="border:0;border-top:1px solid #e3dbd6;margin:24px 0"><p style="line-height:1.65"><strong>Contexte :</strong><br>${safe.message}</p></div></div>`
      })
    ]);

    return res.status(201).json({
      ok: true,
      start: slot.start,
      end: slot.end,
      timezone: settings.timezone,
      durationMinutes: settings.durationMinutes
    });
  } catch (error) {
    console.error('Booking API error:', error);
    return res.status(error.statusCode || 500).json({ error: error.message || 'Impossible de confirmer le rendez-vous.' });
  }
};
