# GPX Viewer

A minimal, mobile-friendly GPX track viewer designed for GitHub Pages. Load GPX files from a local folder and view them on an interactive map with live GPS tracking and compass support.

## Features

- 📍 **GPX Track Display** - Load and render GPX tracks on an OpenStreetMap base map
- 🗺️ **Interactive Map** - Pan, zoom, and pinch-to-zoom support (mobile-optimized)
- 📡 **Live GPS Tracking** - Show your current position with accuracy indicator
- 🔒 **Lock-on-User Mode** - Keep the map centered on your position as you move
- 🧭 **Compass Heading** - Display your facing direction (with GPS fallback)

## UI Design

The interface follows a **minimal, white-first aesthetic** inspired by Airbnb:
- Clean white floating control panel with subtle shadows
- Inter font family (via Google Fonts) for modern typography
- Font Awesome 6 icons (vendored locally)
- Toast notifications for non-intrusive feedback
- Mobile-first responsive design with thumb-friendly controls

## Quick Start

### Run Locally

```bash
# Navigate to the project directory
cd gpx-viewer

# Start a local server (Python 3)
python3 -m http.server 8000

# Or with Python 2
python -m SimpleHTTPServer 8000

# Or with Node.js (npx)
npx serve .
```

Then open: **http://localhost:8000/?gpx=example.gpx**

### Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Select **Source: Deploy from a branch** → **main** (or your default branch)
4. Your site will be live at: `https://yourusername.github.io/gpx-viewer/?gpx=example.gpx`

## Usage

### Loading a GPX File

Add a `?gpx=` query parameter to the URL:

```
https://yoursite.com/?gpx=my-track.gpx
```

The app will fetch the file from the `/gpx/` folder.

### Adding New GPX Files

1. Copy your `.gpx` file to the `/gpx/` folder
2. Commit and push to GitHub
3. Access it via `/?gpx=your-file-name.gpx`

**Filename rules:**
- Only alphanumeric characters, dashes (`-`), and underscores (`_`) are allowed
- Must end with `.gpx`
- Examples: `trail-01.gpx`, `my_hike.gpx`, `route2024.gpx`

## Controls

| Button | Function |
|--------|----------|
| **GPS** | Start/stop location tracking |
| **Lock** | Toggle auto-centering on your position |
| **Heading** | Enable compass direction indicator |

### Lock Mode Behavior

- When **Lock** is enabled, the map auto-centers on your position
- If you manually pan the map, lock is automatically disabled
- Tap **Lock** again to re-enable

## iOS Compass Permission

On iOS 13+, the compass requires explicit user permission. When you tap the **Heading** button, you'll see a system permission dialog. You must grant permission for heading to work.

If you denied permission:
1. Go to **Settings → Safari → Settings for This Website**
2. Enable **Motion & Orientation Access**

**Fallback:** If compass is unavailable, the app uses GPS course heading when you're moving.

## File Structure

```
gpx-viewer/
├── index.html              # Main HTML
├── style.css               # Minimal white-first styles
├── app.js                  # Application logic
├── vendor/
│   ├── leaflet/            # Leaflet.js 1.9.4 (vendored)
│   ├── leaflet-gpx/        # GPX plugin 2.1.2 (vendored)
│   └── fontawesome/        # Font Awesome 6.5.1 (vendored)
│       ├── css/
│       └── webfonts/
├── gpx/
│   └── example.gpx         # Sample GPX track
└── README.md
```

## External Dependencies

| Dependency | Source | Notes |
|------------|--------|-------|
| Inter Font | Google Fonts CDN | Clean modern typography |
| Leaflet.js | Vendored | Map library |
| leaflet-gpx | Vendored | GPX rendering plugin |
| Font Awesome 6 | Vendored | UI icons |

## Browser Support

- ✅ iOS Safari (primary target)
- ✅ Android Chrome (primary target)
- ✅ Desktop browsers (secondary)

## Accessibility

- All buttons have `aria-label` attributes
- Focus states for keyboard navigation
- Respects `prefers-reduced-motion` setting
- High contrast text on controls

## Graceful Degradation

The app works even without GPS or compass:
- Denied location? → Track still displays, you can explore the map
- No compass support? → Falls back to GPS heading when moving
- Nothing works? → Toast notification explains the limitation

## License

MIT License - Use freely for personal or commercial projects.
