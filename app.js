/**
 * GPX Viewer - Main Application
 * 
 * A minimal, mobile-friendly GPX track viewer with GPS tracking and compass support.
 * Designed for GitHub Pages hosting (static, no build step).
 */

(function () {
    'use strict';

    // ===========================================
    // Configuration
    // ===========================================

    const CONFIG = {
        // Tile layer (OpenStreetMap)
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

        // Default map settings
        defaultCenter: [45.4642, 9.19],  // Milan, Italy as fallback
        defaultZoom: 13,
        maxZoom: 19,

        // GPS settings
        gpsOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        },

        // Movement threshold to reduce jitter (meters)
        minMovement: 3,

        // Heading smoothing (degrees threshold to update)
        minHeadingChange: 5,

        // GPX track style - darker for minimal UI
        trackStyle: {
            color: '#222222',
            weight: 3,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        },

        // Toast duration (ms)
        toastDuration: 4000
    };

    // ===========================================
    // State
    // ===========================================

    const state = {
        map: null,
        gpxLayer: null,
        userMarker: null,
        accuracyCircle: null,

        // Tracking state
        watchId: null,
        lastPosition: null,
        lastHeading: null,
        isGpsActive: false,

        // Lock mode
        isLocked: false,
        wasManuallyPanned: false,

        // Compass
        isCompassEnabled: false,
        hasCompassPermission: false,
        compassHeading: null,

        // Heading fallback
        positionHistory: []  // For computing heading from movement
    };

    // ===========================================
    // DOM Elements
    // ===========================================

    const elements = {
        map: document.getElementById('map'),
        trackTitle: document.getElementById('track-title'),
        statusBadge: document.getElementById('status-badge'),
        statusText: document.getElementById('status-text'),
        btnGps: document.getElementById('btn-gps'),
        btnLock: document.getElementById('btn-lock'),
        btnCompass: document.getElementById('btn-compass'),
        toastContainer: document.getElementById('toast-container')
    };

    // ===========================================
    // Initialization
    // ===========================================

    function init() {
        // Set up Leaflet image path for vendored icons
        L.Icon.Default.imagePath = 'vendor/leaflet/';

        // Initialize map
        initMap();

        // Parse query string and load GPX
        loadGpxFromQuery();

        // Set up event listeners
        setupEventListeners();
    }

    function initMap() {
        state.map = L.map('map', {
            center: CONFIG.defaultCenter,
            zoom: CONFIG.defaultZoom,
            zoomControl: true,
            attributionControl: true
        });

        // Add tile layer
        L.tileLayer(CONFIG.tileUrl, {
            attribution: CONFIG.tileAttribution,
            maxZoom: CONFIG.maxZoom
        }).addTo(state.map);

        // Detect manual pan to disable lock
        state.map.on('dragstart', function () {
            if (state.isLocked) {
                state.wasManuallyPanned = true;
                setLockMode(false);
                showToast('Lock disabled', 'info');
            }
        });
    }

    function setupEventListeners() {
        // GPS button
        elements.btnGps.addEventListener('click', toggleGps);

        // Lock button
        elements.btnLock.addEventListener('click', toggleLock);

        // Compass button
        elements.btnCompass.addEventListener('click', toggleCompass);
    }

    // ===========================================
    // GPX Loading
    // ===========================================

    function loadGpxFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const gpxParam = params.get('gpx');

        if (!gpxParam) {
            showToast('No GPX file specified in URL', 'error');
            elements.trackTitle.textContent = 'No Track';
            return;
        }

        // Security: Validate filename
        if (!isValidGpxFilename(gpxParam)) {
            showToast('Invalid GPX filename', 'error');
            elements.trackTitle.textContent = 'Invalid File';
            return;
        }

        const gpxUrl = './gpx/' + gpxParam;
        elements.trackTitle.textContent = 'Loading...';

        // Use leaflet-gpx plugin
        state.gpxLayer = new L.GPX(gpxUrl, {
            async: true,
            marker_options: {
                startIconUrl: null,
                endIconUrl: null,
                shadowUrl: null,
                wptIconUrls: {}
            },
            polyline_options: CONFIG.trackStyle
        });

        state.gpxLayer.on('loaded', function (e) {
            const gpx = e.target;

            // Get track name (fallback to filename)
            const trackName = gpx.get_name() || gpxParam.replace('.gpx', '');
            elements.trackTitle.textContent = trackName;

            // Fit map to track bounds
            state.map.fitBounds(gpx.getBounds(), {
                padding: [40, 40]
            });
        });

        state.gpxLayer.on('error', function (e) {
            console.error('GPX load error:', e);
            showToast('Failed to load: ' + gpxParam, 'error');
            elements.trackTitle.textContent = 'Load Error';
        });

        state.gpxLayer.addTo(state.map);
    }

    /**
     * Validate GPX filename to prevent path traversal attacks
     */
    function isValidGpxFilename(filename) {
        // Must end with .gpx (case insensitive)
        if (!filename.toLowerCase().endsWith('.gpx')) {
            return false;
        }

        // Must not contain path separators or traversal
        if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
            return false;
        }

        // Only allow alphanumeric, dash, underscore, dot
        const validPattern = /^[\w\-\.]+\.gpx$/i;
        return validPattern.test(filename);
    }

    // ===========================================
    // GPS Tracking
    // ===========================================

    function toggleGps() {
        if (state.isGpsActive) {
            stopGps();
        } else {
            startGps();
        }
    }

    function startGps() {
        if (!navigator.geolocation) {
            showToast('Geolocation not supported', 'error');
            return;
        }

        setStatus('Locating...', 'active');

        state.watchId = navigator.geolocation.watchPosition(
            onPositionUpdate,
            onPositionError,
            CONFIG.gpsOptions
        );

        state.isGpsActive = true;
        updateGpsButton();
        elements.btnLock.disabled = false;
        elements.btnCompass.disabled = false;
    }

    function stopGps() {
        if (state.watchId !== null) {
            navigator.geolocation.clearWatch(state.watchId);
            state.watchId = null;
        }

        // Remove user marker
        if (state.userMarker) {
            state.map.removeLayer(state.userMarker);
            state.userMarker = null;
        }
        if (state.accuracyCircle) {
            state.map.removeLayer(state.accuracyCircle);
            state.accuracyCircle = null;
        }

        state.isGpsActive = false;
        state.lastPosition = null;
        state.positionHistory = [];

        // Disable dependent features
        setLockMode(false);
        if (state.isCompassEnabled) {
            disableCompass();
        }

        updateGpsButton();
        elements.btnLock.disabled = true;
        elements.btnCompass.disabled = true;
        hideStatus();
    }

    function onPositionUpdate(position) {
        const coords = position.coords;
        const latlng = [coords.latitude, coords.longitude];

        // Check if we should update (movement threshold)
        if (state.lastPosition && !shouldUpdatePosition(latlng, state.lastPosition)) {
            return;
        }

        // Store for heading calculation
        if (state.lastPosition) {
            state.positionHistory.push({
                latlng: state.lastPosition,
                time: Date.now() - 1000  // Approximate
            });
            // Keep only last 5 positions
            if (state.positionHistory.length > 5) {
                state.positionHistory.shift();
            }
        }

        state.lastPosition = latlng;

        // Update or create user marker
        updateUserMarker(latlng, coords.accuracy);

        // Update heading from GPS if compass not available
        if (!state.isCompassEnabled && coords.heading !== null && !isNaN(coords.heading)) {
            updateHeading(coords.heading);
        } else if (!state.isCompassEnabled) {
            // Try to compute heading from movement
            const computedHeading = computeHeadingFromMovement();
            if (computedHeading !== null) {
                updateHeading(computedHeading);
            }
        }

        // Auto-center if locked
        if (state.isLocked) {
            state.map.setView(latlng, state.map.getZoom(), { animate: true });
        }

        // Update status
        const accuracy = Math.round(coords.accuracy);
        setStatus('±' + accuracy + 'm', 'active');
    }

    function onPositionError(error) {
        let message = '';
        switch (error.code) {
            case error.PERMISSION_DENIED:
                message = 'Location permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message = 'Position unavailable';
                break;
            case error.TIMEOUT:
                message = 'Location timeout';
                break;
            default:
                message = 'Location error';
        }
        setStatus(message, 'error');
        showToast(message, 'error');
        console.error('Geolocation error:', error);
    }

    function shouldUpdatePosition(newPos, oldPos) {
        const distance = getDistance(newPos, oldPos);
        return distance >= CONFIG.minMovement;
    }

    /**
     * Haversine distance in meters
     */
    function getDistance(pos1, pos2) {
        const R = 6371000; // Earth radius in meters
        const dLat = toRad(pos2[0] - pos1[0]);
        const dLon = toRad(pos2[1] - pos1[1]);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(pos1[0])) * Math.cos(toRad(pos2[0])) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function toRad(deg) {
        return deg * (Math.PI / 180);
    }

    function toDeg(rad) {
        return rad * (180 / Math.PI);
    }

    // ===========================================
    // User Marker
    // ===========================================

    function updateUserMarker(latlng, accuracy) {
        if (!state.userMarker) {
            // Create marker with custom icon
            const markerHtml = `
                <div class="user-marker-inner">
                    <div class="user-arrow" id="user-arrow"></div>
                    <div class="user-dot"></div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'user-marker',
                html: markerHtml,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            state.userMarker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 });
            state.userMarker.addTo(state.map);
        } else {
            state.userMarker.setLatLng(latlng);
        }

        // Update accuracy circle
        if (accuracy && accuracy < 500) {  // Only show if reasonable accuracy
            if (!state.accuracyCircle) {
                state.accuracyCircle = L.circle(latlng, {
                    radius: accuracy,
                    className: 'accuracy-circle',
                    interactive: false
                });
                state.accuracyCircle.addTo(state.map);
            } else {
                state.accuracyCircle.setLatLng(latlng);
                state.accuracyCircle.setRadius(accuracy);
            }
        }
    }

    function updateHeading(heading) {
        if (heading === null || isNaN(heading)) {
            return;
        }

        // Check if change is significant
        if (state.lastHeading !== null) {
            const diff = Math.abs(heading - state.lastHeading);
            if (diff < CONFIG.minHeadingChange && diff < 360 - CONFIG.minHeadingChange) {
                return;
            }
        }

        state.lastHeading = heading;

        // Rotate the arrow element
        const arrow = document.getElementById('user-arrow');
        if (arrow) {
            arrow.style.transform = `translate(-50%, -100%) rotate(${heading}deg)`;
        }
    }

    // ===========================================
    // Lock Mode
    // ===========================================

    function toggleLock() {
        setLockMode(!state.isLocked);
    }

    function setLockMode(enabled) {
        state.isLocked = enabled;
        state.wasManuallyPanned = false;

        const btn = elements.btnLock;
        const icon = btn.querySelector('i');

        if (enabled) {
            btn.classList.add('active');
            icon.className = 'fa-solid fa-lock';

            // Center on user immediately
            if (state.lastPosition) {
                state.map.setView(state.lastPosition, state.map.getZoom(), { animate: true });
            }
        } else {
            btn.classList.remove('active');
            icon.className = 'fa-solid fa-lock-open';
        }
    }

    // ===========================================
    // Compass
    // ===========================================

    function toggleCompass() {
        if (state.isCompassEnabled) {
            disableCompass();
        } else {
            enableCompass();
        }
    }

    function enableCompass() {
        // Check for DeviceOrientationEvent
        if (!window.DeviceOrientationEvent) {
            showToast('Compass not supported', 'info');
            return;
        }

        // iOS 13+ requires permission
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(function (response) {
                    if (response === 'granted') {
                        startCompassListening();
                    } else {
                        showToast('Compass permission denied', 'error');
                    }
                })
                .catch(function (error) {
                    console.error('Compass permission error:', error);
                    showToast('Compass error', 'error');
                });
        } else {
            // Non-iOS or older browsers
            startCompassListening();
        }
    }

    function startCompassListening() {
        window.addEventListener('deviceorientation', onDeviceOrientation, true);
        window.addEventListener('deviceorientationabsolute', onDeviceOrientation, true);

        state.isCompassEnabled = true;
        state.hasCompassPermission = true;
        updateCompassButton();
    }

    function disableCompass() {
        window.removeEventListener('deviceorientation', onDeviceOrientation, true);
        window.removeEventListener('deviceorientationabsolute', onDeviceOrientation, true);

        state.isCompassEnabled = false;
        state.compassHeading = null;
        updateCompassButton();
    }

    function onDeviceOrientation(event) {
        let heading = null;

        // Try to get absolute heading
        if (event.webkitCompassHeading !== undefined) {
            // iOS Safari
            heading = event.webkitCompassHeading;
        } else if (event.absolute && event.alpha !== null) {
            // Android Chrome with absolute orientation
            heading = 360 - event.alpha;
        } else if (event.alpha !== null) {
            // Fallback (may not be accurate)
            heading = 360 - event.alpha;
        }

        if (heading !== null) {
            state.compassHeading = heading;
            updateHeading(heading);
        }
    }

    function updateCompassButton() {
        const btn = elements.btnCompass;

        if (state.isCompassEnabled) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    /**
     * Compute heading from movement history
     */
    function computeHeadingFromMovement() {
        if (!state.lastPosition || state.positionHistory.length < 1) {
            return null;
        }

        const prev = state.positionHistory[state.positionHistory.length - 1];
        const bearing = getBearing(prev.latlng, state.lastPosition);
        return bearing;
    }

    /**
     * Calculate bearing between two points
     */
    function getBearing(from, to) {
        const dLon = toRad(to[1] - from[1]);
        const lat1 = toRad(from[0]);
        const lat2 = toRad(to[0]);

        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

        let bearing = toDeg(Math.atan2(y, x));
        return (bearing + 360) % 360;
    }

    // ===========================================
    // UI Helpers
    // ===========================================

    function updateGpsButton() {
        const btn = elements.btnGps;
        const icon = btn.querySelector('i');

        if (state.isGpsActive) {
            btn.classList.add('active');
            icon.className = 'fa-solid fa-location-dot';
        } else {
            btn.classList.remove('active');
            icon.className = 'fa-solid fa-location-crosshairs';
        }
    }

    function setStatus(text, type) {
        elements.statusBadge.classList.remove('hidden', 'active', 'error');
        elements.statusBadge.classList.add(type || 'active');

        const icon = elements.statusBadge.querySelector('i');
        if (type === 'error') {
            icon.className = 'fa-solid fa-exclamation-circle';
        } else if (type === 'active') {
            icon.className = 'fa-solid fa-signal';
        }

        elements.statusText.textContent = text;
    }

    function hideStatus() {
        elements.statusBadge.classList.add('hidden');
    }

    // ===========================================
    // Toast Notifications
    // ===========================================

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let iconClass = 'fa-solid fa-circle-info';
        if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
        if (type === 'success') iconClass = 'fa-solid fa-circle-check';

        toast.innerHTML = `
            <i class="${iconClass}"></i>
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-dismiss" aria-label="Dismiss">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        const dismissBtn = toast.querySelector('.toast-dismiss');
        dismissBtn.addEventListener('click', () => removeToast(toast));

        elements.toastContainer.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => removeToast(toast), CONFIG.toastDuration);
    }

    function removeToast(toast) {
        if (!toast.parentNode) return;

        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 200);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===========================================
    // Start App
    // ===========================================

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
