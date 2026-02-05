# GPX Viewer

A minimal, mobile-friendly GPX track viewer designed for GitHub Pages. Load GPX files from a local folder and view them on an interactive map with live GPS tracking, follow mode, and compass support.

## Features

- 📍 **GPX Track Display** - Load and render GPX tracks via `?gpx=filename.gpx`.
- 📡 **Unified Tracking** - Single "Start" button to enable GPS, Lock-on-me, and Compass at once.
- 🔗 **Easy Sharing** - Built-in sharing tools (Web Share API) and clipboard copy.
- 🧩 **Embed Mode** - Minimal interface for iframes via `?embed=1`.
- 🧭 **Heading Support** - Visual compass arrow (requires device orientation support).
- 📱 **Mobile First** - Airbnb-inspired clean design with thumb-friendly controls.

## Embedding

You can easily embed the GPX viewer into your own website using an iframe. Use the `embed=1` parameter for a cleaner, compact interface.

### Example Iframe Code

```html
<iframe 
  src="https://yourusername.github.io/gpx-viewer/?gpx=example.gpx&embed=1" 
  width="100%" 
  height="450" 
  frameborder="0" 
  allow="fullscreen; clipboard-write; geolocation"
  style="border-radius: 12px; border: 1px solid #e8e8e8;"
></iframe>
```

> [!NOTE]
> For GPS and Compass to work inside an iframe, ensure the `allow` attribute includes `geolocation`. Some browsers still restrict motion sensors (Compass) inside cross-origin iframes. In these cases, users can tap the **"Open"** button to view the track in a full browser tab.

## Quick Start

### Run Locally

```bash
# Navigate to the project directory
cd gpx-viewer

# Start a local server (Python 3)
python3 -m http.server 8000
```

Then open: **http://localhost:8000/?gpx=example.gpx**

### URL Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `gpx` | `filename.gpx` | The track file located in the `/gpx/` folder. |
| `embed` | `1` | Enables a minimal interface for embedding. |

## Controls

### The "Start" Button
- Activates **GPS Tracking**, **Auto-Lock** (centering), and **Compass Heading** simultaneously.
- Tapping **Stop** disables all tracking features together.

### Settings Panel
- **Share Track**: Opens the native share dialog or copies the link to your clipboard.
- **Embed Code**: Copies a ready-to-use HTML iframe snippet for the current track.
- **Advanced Controls**: Independently toggle GPS, Lock, or Heading for custom behavior.
- **Open Full Page**: Opens the current track in a new tab without embed mode (useful for iframe users).

## File Structure

```
gpx-viewer/
├── index.html              # Main HTML
├── style.css               # Airbnb-inspired styles
├── app.js                  # Application logic
├── vendor/
│   ├── leaflet/            # Leaflet.js 1.9.4
│   ├── leaflet-gpx/        # GPX plugin 2.1.2
│   └── fontawesome/        # Font Awesome 6 icons
├── gpx/
│   └── example.gpx         # Your GPX files
└── README.md
```

## Accessibility & Performance
- **Aria-labels** on all icon buttons.
- **Semantic HTML** used throughout.
- **Minimal dependencies**: Vanilla JS + Leaflet (vendored).
- **Reduced Motion** support via CSS.

## License
MIT License. Free for personal and commercial use.
