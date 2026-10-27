# Cucu Connect

> Bringing digital financial and commerce services to the elderly and physically challenged.

Cucu Connect is an accessibility-first platform that helps older adults and people with
disabilities access healthcare, pay bills, shop for essentials, book physical therapy,
manage medications, track vitals, and trigger emergency alerts — from the comfort of
their home or with the help of a caregiver.

**Zero runtime dependencies.** The entire application runs on the Node.js standard
library, making it trivial to deploy, audit and self-host.

## Why Cucu Connect?

- **Inclusion first** – large targets, high-contrast mode, screen-reader friendly,
  keyboard navigation, voice assistant and text-to-speech.
- **Caregiver aware** – profiles link to caregivers and emergency contacts.
- **Commerce + care** – groceries, medicines, assistive devices, therapy and
  telehealth in one place.
- **Privacy respecting** – self-hosted, data export, no third-party trackers.

## Features

- **Authentication** – register/login with secure password hashing (scrypt) and
  bearer tokens.
- **Healthcare** – book appointments (telehealth, home visits), buy health products,
  insurance profile.
- **Bills & Payments** – track and pay electricity, water, insurance bills.
- **Commerce** – product catalog with search/filter, cart, checkout, order tracking,
  reviews, delivery scheduling.
- **Physical Therapy** – book therapy sessions at home.
- **Medication Reminders** – schedules, adherence logging, adherence stats.
- **Vitals Tracking** – blood pressure, glucose, heart rate, weight, temperature.
- **Subscriptions** – recurring grocery/medicine orders with auto-processing.
- **Emergency SOS** – alert caregivers, capture location, notify contacts.
- **Notifications** – in-app notification center.
- **Accessibility** – font scaling, high contrast, voice commands, TTS.
- **Admin Dashboard** – stats, users, subscription processing.
- **PWA** – installable, offline-capable.
- **USSD** – mobile money style USSD menu (*123#) for feature phones.
- **Data Export** – download all personal data as JSON.

## Quick Start

```bash
git clone https://github.com/your-org/cucu-connect.git
cd cucu-connect
npm start
```

Open http://localhost:3000

Default admin account (change in production): `admin@cucu.local` / `admin123`

### Configuration

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `VERIFY_TOKEN` | cucu | Facebook Messenger webhook verify token |

### Docker

```bash
docker build -t cucu-connect .
docker run -p 3000:3000 cucu-connect
```

## API

See [docs/API.md](docs/API.md) for the full REST API reference.

## Accessibility

See [ACCESSIBILITY.md](ACCESSIBILITY.md) for our accessibility commitment and how to
use assistive features.

## Security

See [SECURITY.md](SECURITY.md).

## Privacy

See [PRIVACY.md](PRIVACY.md) and [TERMS.md](TERMS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Testing

```bash
npm test
```

## Project Structure

```
app.js              # HTTP server + routing
src/store.js        # JSON data store (zero deps)
public/             # Frontend (HTML/CSS/JS, PWA)
data/data.json      # Runtime data (auto-created)
tests/run.js        # Smoke tests
docs/               # Documentation
```

## License

MIT – see [LICENSE](LICENSE).