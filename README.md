# Cucu Connect

> Accessibility-first digital and commerce services for older adults and people with disabilities.

Cucu Connect brings healthcare, bill payments, shopping, therapy, medication
reminders, vitals tracking, subscriptions, and emergency support into one
self-hosted platform. It is designed for elderly users and people with
disabilities, with large touch targets, high contrast, screen-reader support,
keyboard navigation, voice commands, and text-to-speech.

**Zero runtime dependencies.** The entire application runs on the Node.js
standard library, making it trivial to deploy, audit, and self-host.

## Highlights

- **Authentication** – registration/login with scrypt password hashing and
  expiring bearer tokens.
- **Healthcare** – telehealth, home visits, appointments, insurance profiles.
- **Bills & Payments** – track and pay electricity, water, and insurance bills.
- **Commerce** – catalog search/filter, cart, checkout, orders, reviews,
  delivery scheduling.
- **Therapy** – book and manage physical therapy sessions.
- **Medications** – schedules, adherence logging, adherence statistics.
- **Vitals** – blood pressure, glucose, heart rate, weight, temperature.
- **Subscriptions** – recurring orders with auto-processing.
- **Emergency SOS** – alert caregivers and emergency contacts with location.
- **Notifications** – in-app notification center.
- **Accessibility** – persisted font scaling, high contrast, voice, TTS.
- **Admin Dashboard** – stats, users, subscription processing.
- **Companion Apps** – provider, caregiver, and delivery views.
- **PWA** – installable, offline-capable.
- **USSD** – feature-phone menu (`*123#`) with bills, shop, therapy, SOS.
- **Gateways** – SMS (Twilio-style) and WhatsApp webhooks.
- **Data Export** – download all personal data as JSON.

## Quick Start

```bash
git clone https://github.com/WilliamMajanja/Cucu-Connect.git
cd Cucu-Connect
npm start
```

Open http://localhost:3000

Default admin account (change in production): `admin@cucu.local` / `admin123`

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `VERIFY_TOKEN` | cucu | Facebook Messenger webhook verify token |

## Docker

```bash
docker build -t cucu-connect .
docker run -p 3000:3000 cucu-connect
```

## Testing

```bash
npm test
```

The smoke suite starts the server on port 3099 and exercises the core flows.

## Project Structure

```
app.js              # HTTP server + routing
src/store.js        # JSON data store (zero deps)
src/ussd.js         # USSD session handler
public/             # Frontend (HTML/CSS/JS, PWA)
data/data.json      # Runtime data (auto-created, gitignored)
tests/run.js        # Smoke tests
docs/API.md         # REST API reference
```

## Accessibility

See [ACCESSIBILITY.md](ACCESSIBILITY.md).

## Security

See [SECURITY.md](SECURITY.md).

## Privacy

See [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

MIT – see [LICENSE](LICENSE).
