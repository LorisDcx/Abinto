'use strict';

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

module.exports = async function contactHandler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const body = parseBody(req);
  const {
    firstname = '',
    lastname = '',
    company = '',
    email = '',
    phone = '',
    projectType = '',
    message = '',
    website = '',
    consent = ''
  } = body;

  const name = `${firstname} ${lastname}`.trim();

  // Honeypot : réponse neutre pour les robots.
  if (website) return res.status(200).json({ ok: true });

  if (!firstname.trim() || !lastname.trim() || !email.trim() || !projectType.trim() || !message.trim() || consent !== 'yes') {
    return res.status(400).json({ error: 'Merci de remplir tous les champs obligatoires.' });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'L’adresse e-mail semble incorrecte.' });
  }

  if (message.length > 8000 || name.length > 160 || email.length > 320) {
    return res.status(400).json({ error: 'Le contenu envoyé est trop long.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.CONTACT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !toEmail || !fromEmail) {
    return res.status(503).json({ error: 'Le formulaire n’est pas encore configuré sur le serveur.' });
  }

  const safe = {
    name: escapeHtml(name),
    firstname: escapeHtml(firstname.trim()),
    lastname: escapeHtml(lastname.trim()),
    company: escapeHtml(company.trim() || 'Non renseignée'),
    email: escapeHtml(email.trim()),
    phone: escapeHtml(phone.trim() || 'Non renseigné'),
    projectType: escapeHtml(projectType.trim()),
    message: escapeHtml(message.trim()).replaceAll('\n', '<br>')
  };

  const subject = `Nouvelle demande ABINTO — ${projectType.trim()} — ${name.trim()}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#171416">
      <div style="padding:24px;background:#b51f2a;color:#fff">
        <h1 style="margin:0;font-size:24px">Nouvelle demande ABINTO</h1>
      </div>
      <div style="padding:28px;border:1px solid #e3dbd6;border-top:0;background:#fffdfa">
        <p><strong>Prénom :</strong> ${safe.firstname}</p>
        <p><strong>Nom :</strong> ${safe.lastname}</p>
        <p><strong>Entreprise :</strong> ${safe.company}</p>
        <p><strong>E-mail :</strong> ${safe.email}</p>
        <p><strong>Téléphone :</strong> ${safe.phone}</p>
        <p><strong>Projet :</strong> ${safe.projectType}</p>
        <hr style="border:0;border-top:1px solid #e3dbd6;margin:24px 0">
        <p style="line-height:1.65"><strong>Message :</strong><br>${safe.message}</p>
      </div>
    </div>`;

  const text = [
    'Nouvelle demande ABINTO',
    `Prénom : ${firstname.trim()}`,
    `Nom : ${lastname.trim()}`,
    `Entreprise : ${company.trim() || 'Non renseignée'}`,
    `E-mail : ${email.trim()}`,
    `Téléphone : ${phone.trim() || 'Non renseigné'}`,
    `Projet : ${projectType.trim()}`,
    '',
    message.trim()
  ].join('\n');

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email.trim(),
        subject,
        html,
        text
      })
    });

    const resendResult = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      console.error('Resend error:', resendResult);
      return res.status(502).json({ error: 'Le message n’a pas pu être transmis.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return res.status(500).json({ error: 'Une erreur serveur est survenue.' });
  }
};
