# ABINTO — V19

## Ajustements

- Le renard `abinto-fox.png` et le mot-symbole ABINTO ont désormais la même hauteur rouge visible dans le header. Les dimensions tiennent compte des marges transparentes propres à chaque PNG.
- La section Contact a été compactée pour tenir dans la hauteur d’un écran sur ordinateur, tout en conservant le formulaire complet.
- La mention `REC • ABINTO • 135 MM` a été retirée.
- Une ligne rouge de progression apparaît sous le header. Elle se remplit en descendant dans la page et se vide en remontant.

## Formulaire

L’envoi utilise `/api/contact` avec Resend. Variables nécessaires :

- `RESEND_API_KEY`
- `CONTACT_TO_EMAIL`
- `CONTACT_FROM_EMAIL`

## Réservation d’un échange

La section « Réserver l’échange » est une réservation native : elle ne montre que les créneaux libres du calendrier Google choisi, crée l’événement au moment de la confirmation, envoie les invitations Google, puis envoie une confirmation Resend au client et une notification à ABINTO. Le client peut aussi ajouter le rendez-vous à Google Agenda ou télécharger un fichier `.ics` (Outlook / Apple Calendar).

### Mise en service

1. Créer ou choisir un calendrier Google réservé aux rendez-vous ABINTO, puis activer l’API Google Calendar dans un projet Google Cloud.
2. Créer un compte de service Google Cloud, générer une clé JSON et partager le calendrier avec son adresse e-mail, avec l’autorisation « Modifier les événements ».
3. Renseigner dans Vercel les variables `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, ainsi que les variables Resend existantes. Pour la clé privée, copier uniquement la valeur `private_key` du fichier JSON Google (sans guillemets autour), en gardant les retours à la ligne sous la forme `\n`.
4. Ajuster les règles `BOOKING_*` si besoin. Les horaires sont en heure de Paris ; `BOOKING_AVAILABILITY` accepte des plages par jour, de `0` (dimanche) à `6` (samedi). Les horaires déjà occupés dans Google Calendar sont automatiquement retirés.

Le fichier `.env.example` contient une configuration complète à adapter. Ne jamais y mettre la vraie clé privée du compte de service.
