# Citation System (prototype)

Records every pre-numbered paper Citation by its Control Number: Done, Cancelled or Voided, never skipped and never used twice. Plain HTML/CSS/JS, no build step.

## Run it

The app loads `data/*.json` at start-up, so it must be served over HTTP (double-clicking `index.html` won't work):

```sh
npx serve .          # or: python -m http.server 8000
```

Open the printed address. To try it on a phone, open the same address using the PC's LAN IP. On a phone the camera opens directly; on a PC without a camera, the camera window offers a labelled sample photo.

## Signing in

Accounts from `data/enforcers.json` and `data/admins.json` accept any password (prototype only). Try:

| Name | Role | Starts on |
|---|---|---|
| Maria Santos | Enforcer, Police | Home, Traffic #18104558 |
| Juan Dela Cruz | Enforcer, Traffic Enforcement | Home |
| Ana Reyes | Enforcer, Public Safety Office | Citation Type (Booklet used up) |
| Ben Villanueva Jr. | Enforcer, Civil Security Unit | Citation Type (Booklet used up) |
| Carlo Navarro, Grace Villamor | Enforcers, Police | Home (Grace has had no Citations for 2 weeks) |
| Dennis Ramos, Joy Castillo | Enforcers, Traffic Enforcement | Home (a third of Dennis's forms this month are spoiled) |
| Mark Flores / Rhea Lim | Enforcer, Public Safety Office / Civil Security Unit | Home |
| Liza Fernandez | Office Admin, Traffic Enforcement | Overview |
| Carlos Mendoza | Office Admin, Police | Overview |
| Teresa Garcia | Verifier, Treasury Office | Summary |

New sign-ups (“Create an account”) are stored in this browser with a salted SHA-256 password hash and must be approved by their Agency's Office Admin.

The **Demo** button switches users and goes offline/online. It's for testing, not a product feature.

## What resets

- Reset on reload: Booklets, Citations and new Violator Records (kept in memory).
- Kept in this browser: Registrations, account status changes, and the theme.

## Files

- `data/*.json`: reference data, checked at start-up. If an entry is wrong, the app lists the problems instead of starting. These files contain no passwords and only made-up Violators.
- `js/strings.js`: every user-facing message. Add a Filipino table here later.
- `js/store.js`: all the rules (Booklets, numbering, Violator Records, accounts, payment) plus the sample data.
- `js/views/`: screens for each role.
- `css/app.css`: the visual system.

## Moving to a backend

Serve the same JSON shapes from an API. Store Citations, Booklets and Violator Records in a database, with real sign-in and access control. Never put real Violators' personal data in a file the app serves (Data Privacy Act, RA 10173).

## Heatmap

The Heatmap uses [Leaflet](https://leafletjs.com/) and the leaflet.heat plugin, loaded from a CDN, so it needs an internet connection. When offline it says so.

- **Map tiles:** the prototype uses OpenStreetMap's public tile server, with the required credit. That server is only for light use. **Before going live, change `TILES` in `js/views/heatmap.js`** to a tile provider or the City's own tile server.
- **Privacy:** `areaTotals()` in `js/views/heatmap.js` turns Citations into counts per area (about 280 m), and the map only ever gets those totals: no pins, no names. With a backend, compute those totals on the server so exact locations never reach an Office Admin's browser. Office Admins see their own Agency, This month only, and areas with fewer than 3 Citations aren't drawn.
"# Ticket-System" 
