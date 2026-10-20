# Micheal’sPeace — Premium Wedding Web Application

A full-stack, editorial wedding website, private RSVP verification system, and administrator dashboard built specifically for **Peace and Micheal**.

---

## Confirmed Wedding Information

- **Couple's Official Names:** Peace and Micheal
- **Wedding Date:** Saturday, 7 November 2026
- **Ceremony Time:** 10:00 AM West Africa Time (WAT, UTC+1)
- **Ceremony Venue:** Dunamis Intl Gospel Centre (DIGC), 117, Agbani Road, Achara Layout, Enugu, Nigeria
- **Official RSVP Contact Numbers:**
  - `08114203510`
  - `07082975978`
  - `08148756975`
- **Official Brand Colors:** White (`#FFFFFF`), Gold (`#C5A46D`), Black (`#111111`)
- **Supporting Palette:** Soft ivory (`#F7F2E9`), Warm champagne (`#E9DFD0`), Muted taupe (`#766452`)
- **Typography:** Cormorant Garamond (Editorial Serif headings & names) & Inter (Body, forms, labels)

---

## Key Architecture & Features

### 1. Public Experience
- **Cinematic Homepage (`/`):** Full-bleed editorial portrait of Peace & Micheal, live Africa/Lagos (WAT, UTC+1) countdown, couple narrative previews, venue summary, photo preview, and RSVP access.
- **Our Love Story (`/our-story`):** Chronological milestone timeline detailing their first meeting, courtship, engagement, and personal messages from each partner.
- **Wedding Details (`/wedding-details`):** Precise schedule, interactive Google Maps directions, Add-to-Calendar (.ics file download and direct Google Calendar export), dress code, reception info, and clickable `tel:` links for all three official RSVP phone lines.
- **Photograph Gallery (`/gallery`):** High-resolution photography grid with category filtering (Portraits, Engagement, Ceremony Sanctuary, Celebration) and full-screen accessible lightbox modal (keyboard Esc, Left, Right arrows).
- **Private RSVP Experience (`/rsvp`):** Genuine invitation-based verification flow. Guests enter a private invitation token. The system verifies allocated attendee quotas, collects optional notes when enabled, and reports confirmation or notification status clearly.
- **Wedding Wishes Guestbook (`/wishes`):** Public guestbook where guests submit congratulatory prayers and messages that pass through administrator moderation before publication.

### 2. Protected Administration Dashboard (`/admin`)
- **Executive Analytics:** Live counts of total invited parties, confirmed attendees, accepted vs. declined RSVPs, response rates, and recent submissions.
- **Guest Registry Management (`/admin/guests`):** Add invitees, assign custom or auto-generated tokens, adjust maximum allowed seats, revoke/restore tokens, and export a complete records report to CSV.
- **RSVP Deep Dive (`/admin/responses`):** Detailed breakdown of all guest responses, course preferences, mobility/seating needs, and private prayers.
- **Gallery Management (`/admin/gallery`):** Upload, publish/unpublish, reorder, and curate wedding images.
- **Love Story Editor (`/admin/story`):** Manage milestones and editorial entries.
- **Wishes Moderation (`/admin/wishes`):** Approve, reject, or hide incoming guestbook messages.
- **Wedding Settings (`/admin/settings`):** Live editing of couple names, dates, times, venue address, RSVP contact numbers, and dress codes.

---

## Administrator access

There are no credentials or fictional guest records in the repository. Create an administrator in Supabase Auth, then add that user to `public.admin_profiles` using the SQL shown below. The local-only demonstration mode requires `LOCAL_DEMO=true`, `LOCAL_ADMIN_EMAIL`, and a strong `LOCAL_ADMIN_PASSWORD`; it is rejected when `NODE_ENV=production` or `VERCEL` is present.

---

## Project Structure

```
micheal'speace/
├── public/
│   └── images/                     # Approved static wedding photographs
├── src/
│   ├── admin/                      # Administration dashboard views & controls
│   │   ├── AdminContent.tsx
│   │   ├── AdminGuests.tsx
│   │   ├── AdminLayout.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── AdminOverview.tsx
│   │   ├── AdminResponses.tsx
│   │   ├── AdminSettings.tsx
│   │   └── types.ts
│   ├── assets/                     # Editorial imagery & icons
│   ├── components/                 # Reusable UI components
│   │   ├── Countdown.tsx           # Africa/Lagos WAT countdown
│   │   ├── Footer.tsx
│   │   ├── LightboxModal.tsx       # Accessible full-screen lightbox
│   │   ├── Navbar.tsx
│   │   └── WeddingCalendarExport.tsx # .ics & Google Calendar export
│   ├── data/
│   │   └── initialData.ts          # Seed data with confirmed wedding details
│   ├── lib/
│   │   ├── email/                  # Resend transactional email notification service
│   │   │   └── resend.ts
│   │   ├── supabase/               # Supabase browser & server clients
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── validation/             # Validation schemas, sanitization, token hashing
│   │   │   └── rsvp.ts
│   │   ├── seo.ts                  # Dynamic OpenGraph, Twitter card & Meta management
│   │   └── api.ts                  # Typed browser API client
│   ├── pages/                      # Public routes
│   │   ├── Gallery.tsx             # Photo grid & category filter
│   │   ├── Home.tsx                # Cinematic editorial landing
│   │   ├── OurStory.tsx            # Romantic timeline & couple messages
│   │   ├── RSVP.tsx                # Private invitation verification & submission
│   │   ├── WeddingDetails.tsx      # Venue, schedule, map, and official phone numbers
│   │   └── Wishes.tsx              # Moderated wedding guestbook
│   ├── types/
│   │   └── wedding.ts              # TypeScript type definitions
│   ├── App.tsx                     # Main client router
│   └── main.tsx                    # React DOM entry
├── supabase/
│   └── migrations/
│       └── 20261107000000_init_michealspeace.sql # Complete SQL schema, RLS policies & seed
├── .env.example                    # Documented environment variable template
├── index.html                      # HTML5 entry with Google Fonts & JSON-LD schema
├── package.json                    # Dependencies & build scripts
├── server.ts                       # Express full-stack API & SSR/Vite dev server
├── tsconfig.json                   # TypeScript configuration
└── vite.config.ts                  # Vite build configuration
```

---

## Local Development & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate the server-only Supabase values before using live data. For a deliberately local demonstration, set `LOCAL_DEMO=true` and provide a local administrator email and password; the demo database is created under `server/data` and is never allowed in production.

### 3. Run Development Server
```bash
npm run dev
```
The server starts at `http://localhost:3000` with the Express API and Vite live reload.

### 4. Build for Production
```bash
npm run build
```

---

## Supabase PostgreSQL & Row Level Security (RLS) Setup

1. Create a project at [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/migrations/20261107000000_init_michealspeace.sql`.
4. Copy and paste the entire script into the SQL Editor and click **Run**.
5. This migration provisions:
   - `weddings` table with official details seeded for Peace & Micheal.
   - `guests` table with invitation codes, attendee limits, and status constraints.
   - `rsvps` table with unique guest references and audit timestamps.
   - `gallery_images` table with categories and publication states.
   - `love_story_entries` table with milestones and chronological ordering.
   - `wishes` table with moderation statuses (`pending`, `approved`, `rejected`, `hidden`).
   - `admin_profiles` table linked to Supabase Auth `auth.users`.
   - **Row Level Security (RLS)** policies enabled across every table:
     - Public can only read published wedding details, published gallery photos, published love stories, and approved wishes.
     - Public CANNOT enumerate or view private guests or RSVP lists.
     - Administrative operations are strictly constrained to authenticated users with records in `admin_profiles`.

### Creating the First Administrator in Supabase
1. Navigate to **Authentication > Users** in Supabase and invite or create the coordinator email you choose.
2. In the **SQL Editor**, register the user into `admin_profiles`:
```sql
INSERT INTO public.admin_profiles (user_id, wedding_id, role, full_name)
VALUES ('<PASTE-USER-UUID-HERE>', 'michealspeace-2026', 'super_admin', 'Peace & Micheal Lead Coordinator');
```

---

## Resend Transactional Email Setup

1. Create an account at [Resend](https://resend.com) and generate an API key (`re_...`).
2. Add your verified domain (or use onboarding sender) and update `.env`:
```env
RESEND_API_KEY="re_your_api_key_here"
RESEND_FROM_EMAIL="invitations@michealspeace.com"
```
3. Whenever a guest submits or updates their RSVP, a branded confirmation email (White, Gold, and Black theme) is delivered to their email address. If email delivery is unavailable or fails, the RSVP is preserved safely in the database and the error is reported without disrupting the guest.
4. New wedding wishes are also forwarded to the couple's inbox while remaining pending moderation. Set `WISHES_NOTIFICATION_EMAIL` if the notification recipient changes.
5. To use Web3Forms for wish notifications, add `WEB3FORMS_ACCESS_KEY` to the server environment. It takes priority over Resend for wishes; the wish is still saved and moderated by this site first.
6. Supabase is optional for a Vercel-only launch: if no Supabase variables are configured, wishes are sent directly through Web3Forms and are not stored in the site guestbook. Add Supabase later if you want persistent moderation and public wish history.

---

## Deployment to Vercel

1. Push this repository to GitHub or GitLab.
2. In your [Vercel Dashboard](https://vercel.com), click **"Add New Project"**.
3. Import the repository.
4. Set:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
5. Under **Environment Variables**, provide `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `PUBLIC_SITE_URL`, and the Resend variables when email is enabled. Do not expose `SUPABASE_SECRET_KEY` to the browser.
6. Click **Deploy**. Your wedding application is immediately accessible on your free Vercel subdomain (e.g. `https://michealspeace.vercel.app`).
