# Admin panel mockups

The reference direction for the admin redesign in `14b5a51`. Renamed from their
export filenames; content unchanged.

**These are references, not a specification.** The shipped admin deliberately
differs in three places, and the mockups are the older document:

- **Customers, Reports and Settings do not exist.** They appear in the mockup
  navigation with nothing behind them. A nav item that leads nowhere teaches
  the operator to distrust the nav, so they were left out until there is a
  backend. See the commit message on `14b5a51`.
- **TOTP is not implemented.** The login mockup shows a 2FA step. Admin auth is
  bcrypt plus rotating refresh tokens today — see [AUTH.md](../../AUTH.md).
- **Shipments** was added afterwards and is not in any mockup. Its design is in
  [COURIER.md §11](../../COURIER.md).

Where the mockups and the shipped panel disagree on anything else, the shipped
panel is what was reviewed against WCAG 2.2 AA and should be treated as
current.
