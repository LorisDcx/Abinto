# ABINTO — V15

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
