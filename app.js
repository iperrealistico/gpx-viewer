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
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        defaultCenter: [45.4642, 9.19],
        defaultZoom: 13,
        maxZoom: 19,
        gpsOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        },
        minMovement: 3,
        minHeadingChange: 5,
        trackStyle: {
            color: '#222222',
            weight: 3,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        },
        toastDuration: 4000,
        trackingZoom: 16,        // Closer zoom when tracking
        springBackTimeout: 5000 // Inactivity before returning to user
    };

    // ===========================================
    // State
    // ===========================================

    const state = {
        map: null,
        gpxLayer: null,
        userMarker: null,
        accuracyCircle: null,
        watchId: null,
        lastPosition: null,
        lastHeading: null,
        isGpsActive: false,
        isLocked: false,
        isCompassEnabled: false,
        isStarted: false,
        isEmbedMode: false,
        gpxFilename: null,
        positionHistory: [],
        hasInitialZoomed: false
    };

    // ===========================================
    // DOM Elements
    // ===========================================

    const elements = {
        map: document.getElementById('map'),
        trackTitle: document.getElementById('track-title'),
        statusBadge: document.getElementById('status-badge'),
        statusText: document.getElementById('status-text'),
        btnStart: document.getElementById('btn-start'),
        btnSettings: document.getElementById('btn-settings'),
        btnOpenFull: document.getElementById('btn-open-full'),
        settingsOverlay: document.getElementById('settings-overlay'),
        btnCloseSettings: document.getElementById('btn-close-settings'),
        btnShare: document.getElementById('btn-share'),
        btnCopyEmbed: document.getElementById('btn-copy-embed'),
        btnFullPageFallback: document.getElementById('btn-full-page-fallback'),
        toggleGps: document.getElementById('toggle-gps'),
        toggleLock: document.getElementById('toggle-lock'),
        toggleHeading: document.getElementById('toggle-heading'),
        toastContainer: document.getElementById('toast-container')
    };

    // ===========================================
    // Initialization
    // ===========================================

    function init() {
        L.Icon.Default.imagePath = 'vendor/leaflet/';

        checkEmbedMode();
        initMap();
        loadGpxFromQuery();
        setupEventListeners();
    }

    function checkEmbedMode() {
        const params = new URLSearchParams(window.location.search);
        state.isEmbedMode = params.get('embed') === '1';
        if (state.isEmbedMode) {
            document.body.classList.add('embed-mode');
            elements.btnOpenFull.classList.remove('hidden');
        }
    }

    function initMap() {
        state.map = L.map('map', {
            center: CONFIG.defaultCenter,
            zoom: CONFIG.defaultZoom,
            zoomControl: !state.isEmbedMode,
            attributionControl: !state.isEmbedMode
        });

        L.tileLayer(CONFIG.tileUrl, {
            attribution: CONFIG.tileAttribution,
            maxZoom: CONFIG.maxZoom
        }).addTo(state.map);

        state.map.on('dragstart', () => {
            if (state.isStarted) {
                setLockMode(false);
                elements.toggleLock.checked = false;
            }
        });

        state.map.on('dragend zoomend', () => {
            if (state.isStarted && state.isGpsActive) {
                setLockMode(true);
                elements.toggleLock.checked = true;
            }
        });
    }

    function setupEventListeners() {
        // Main controls
        elements.btnStart.addEventListener('click', toggleUnifiedStart);
        elements.btnSettings.addEventListener('click', toggleSettingsPanel);
        elements.btnCloseSettings.addEventListener('click', toggleSettingsPanel);
        elements.btnOpenFull.addEventListener('click', openFullPage);
        elements.btnFullPageFallback.addEventListener('click', openFullPage);

        // Advanced Toggles
        elements.toggleGps.addEventListener('change', (e) => toggleFeature('gps', e.target.checked));
        elements.toggleLock.addEventListener('change', (e) => toggleFeature('lock', e.target.checked));
        elements.toggleHeading.addEventListener('change', (e) => toggleFeature('heading', e.target.checked));

        // Sharing
        elements.btnShare.addEventListener('click', shareTrack);
        elements.btnCopyEmbed.addEventListener('click', copyEmbedCode);

        // Close modal on background click
        elements.settingsOverlay.addEventListener('click', (e) => {
            if (e.target === elements.settingsOverlay) toggleSettingsPanel();
        });
    }

    // ===========================================
    // GPX Loading
    // ===========================================

    function loadGpxFromQuery() {
        const params = new URLSearchParams(window.location.search);
        const gpxParam = params.get('gpx');

        if (!gpxParam || !isValidGpxFilename(gpxParam)) {
            showToast('GPX file missing or invalid', 'error');
            elements.trackTitle.textContent = 'Invalid Track';
            return;
        }

        state.gpxFilename = gpxParam;
        const gpxUrl = './gpx/' + gpxParam;
        elements.trackTitle.textContent = 'Loading...';

        state.gpxLayer = new L.GPX(gpxUrl, {
            async: true,
            marker_options: { startIconUrl: null, endIconUrl: null, shadowUrl: null, wptIconUrls: {} },
            polyline_options: CONFIG.trackStyle
        });

        state.gpxLayer.on('loaded', (e) => {
            const trackName = e.target.get_name() || gpxParam.replace('.gpx', '');
            elements.trackTitle.textContent = trackName;
            state.map.fitBounds(e.target.getBounds(), { padding: [40, 40] });
        });

        state.gpxLayer.on('error', () => {
            showToast('Failed to load track', 'error');
            elements.trackTitle.textContent = 'Load Error';
        });

        state.gpxLayer.addTo(state.map);
    }

    function isValidGpxFilename(filename) {
        if (!filename.toLowerCase().endsWith('.gpx')) return false;
        if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
        return /^[\w\-\.]+\.gpx$/i.test(filename);
    }

    // ===========================================
    // Unified Control Logic
    // ===========================================

    function toggleUnifiedStart() {
        state.isStarted = !state.isStarted;

        if (state.isStarted) {
            // UI state first for robustness
            elements.btnStart.classList.add('active');
            elements.btnStart.querySelector('i').className = 'fa-solid fa-stop';

            elements.toggleGps.checked = true;
            elements.toggleLock.checked = true;
            elements.toggleHeading.checked = true;

            // Then activate logic
            toggleFeature('gps', true);
            toggleFeature('lock', true);
            toggleFeature('heading', true);
        } else {
            elements.btnStart.classList.remove('active');
            elements.btnStart.querySelector('i').className = 'fa-solid fa-play';

            elements.toggleGps.checked = false;
            elements.toggleLock.checked = false;
            elements.toggleHeading.checked = false;

            toggleFeature('gps', false);
            toggleFeature('lock', false);
            toggleFeature('heading', false);
        }
    }

    function toggleFeature(feature, enabled) {
        switch (feature) {
            case 'gps': if (enabled) startGps(); else stopGps(); break;
            case 'lock': setLockMode(enabled); break;
            case 'heading': if (enabled) enableCompass(); else disableCompass(); break;
        }

        // If all features are turned off manually, stop the "Start" state
        if (!elements.toggleGps.checked && !elements.toggleLock.checked && !elements.toggleHeading.checked && state.isStarted) {
            state.isStarted = false;
            elements.btnStart.classList.remove('active');
            elements.btnStart.querySelector('i').className = 'fa-solid fa-play';
        }
    }

    // ===========================================
    // GPS / Geolocation
    // ===========================================

    function startGps() {
        if (!navigator.geolocation) { showToast('GPS not supported', 'error'); return; }
        setStatus('Locating...', 'active');
        state.watchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, CONFIG.gpsOptions);
        state.isGpsActive = true;
    }

    function stopGps() {
        if (state.watchId !== null) { navigator.geolocation.clearWatch(state.watchId); state.watchId = null; }
        if (state.userMarker) { state.map.removeLayer(state.userMarker); state.map.removeLayer(state.accuracyCircle); state.userMarker = null; state.accuracyCircle = null; }
        state.isGpsActive = false;
        state.lastPosition = null;
        state.hasInitialZoomed = false; // Reset for next start
        hideStatus();
    }

    function onPositionUpdate(pos) {
        const latlng = [pos.coords.latitude, pos.coords.longitude];
        const acc = pos.coords.accuracy;

        if (state.lastPosition && getDistance(latlng, state.lastPosition) < CONFIG.minMovement) return;
        state.lastPosition = latlng;

        // Show marker only if accuracy is reasonable (< 100m)
        if (acc < 100) {
            updateUserMarker(latlng, acc);
        }

        // Stable Lock Logic: Only zoom/follow once accuracy is tight (< 60m)
        if (state.isLocked && acc < 60) {
            const currentZoom = state.map.getZoom();
            // Initial zoom when first stable position found
            const targetZoom = (!state.hasInitialZoomed || currentZoom < CONFIG.trackingZoom) ? CONFIG.trackingZoom : currentZoom;

            const bounds = state.map.getBounds();
            if (!bounds.contains(latlng)) {
                state.map.setView(latlng, targetZoom, { animate: !state.hasInitialZoomed ? false : true });
            } else {
                state.map.setView(latlng, targetZoom, { animate: true });
            }

            state.hasInitialZoomed = true;
        }

        if (!state.isCompassEnabled && pos.coords.heading) updateHeading(pos.coords.heading);
        setStatus('±' + Math.round(acc) + 'm', 'active');
    }

    function onPositionError(err) {
        let msg = 'Location error';
        if (err.code === 1) msg = 'Location denied';
        showToast(msg, 'error');
        setStatus(msg, 'error');
    }

    function setLockMode(enabled) {
        state.isLocked = enabled;
        if (enabled && state.lastPosition) {
            const currentZoom = state.map.getZoom();
            const targetZoom = currentZoom < CONFIG.trackingZoom ? CONFIG.trackingZoom : currentZoom;

            // If the user's position is way off screen, just jump there without animation
            const bounds = state.map.getBounds();
            if (!bounds.contains(state.lastPosition)) {
                state.map.setView(state.lastPosition, targetZoom, { animate: false });
            } else {
                state.map.setView(state.lastPosition, targetZoom, { animate: true });
            }
        }
    }

    // ===========================================
    // Compass / Heading
    // ===========================================

    function enableCompass() {
        if (!window.DeviceOrientationEvent) return;
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(res => {
                if (res === 'granted') startCompassListening();
                else showToast('Compass denied', 'error');
            }).catch(() => showToast('Compass error', 'error'));
        } else {
            startCompassListening();
        }
    }

    function startCompassListening() {
        window.addEventListener('deviceorientation', onOrientation, true);
        window.addEventListener('deviceorientationabsolute', onOrientation, true);
        state.isCompassEnabled = true;
    }

    function disableCompass() {
        window.removeEventListener('deviceorientation', onOrientation, true);
        window.removeEventListener('deviceorientationabsolute', onOrientation, true);
        state.isCompassEnabled = false;
    }

    function onOrientation(e) {
        let h = e.webkitCompassHeading || (e.absolute ? 360 - e.alpha : null);
        if (h !== null) updateHeading(h);
    }

    function updateHeading(h) {
        const arrow = document.getElementById('user-arrow');
        if (arrow) arrow.style.transform = `translate(-50%, -100%) rotate(${h}deg)`;
    }

    // ===========================================
    // Sharing & Embed
    // ===========================================

    async function shareTrack() {
        const url = window.location.href;
        const title = elements.trackTitle.textContent;

        if (navigator.share) {
            try { await navigator.share({ title, url }); }
            catch (e) { copyToClipboard(url); }
        } else {
            copyToClipboard(url);
        }
    }

    function copyEmbedCode() {
        const url = new URL(window.location.href);
        url.searchParams.set('embed', '1');
        const iframe = `<iframe src="${url.href}" width="100%" height="450" frameborder="0" allow="fullscreen; clipboard-write; geolocation"></iframe>`;
        copyToClipboard(iframe, 'Embed code copied');
    }

    function copyToClipboard(text, successMsg = 'Link copied') {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMsg, 'success');
        }).catch(() => showToast('Failed to copy', 'error'));
    }

    function openFullPage() {
        const url = new URL(window.location.href);
        url.searchParams.delete('embed');
        window.open(url.href, '_blank', 'noopener,noreferrer');
    }

    // ===========================================
    // UI Helpers
    // ===========================================

    function toggleSettingsPanel() {
        elements.settingsOverlay.classList.toggle('hidden');
    }

    function setStatus(text, type) {
        elements.statusBadge.classList.remove('hidden', 'active', 'error');
        elements.statusBadge.classList.add(type);
        elements.statusText.textContent = text;
    }

    function hideStatus() { elements.statusBadge.classList.add('hidden'); }

    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-exclamation' : 'circle-info'}"></i> <span>${msg}</span>`;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 200); }, CONFIG.toastDuration);
    }

    function updateUserMarker(latlng, acc) {
        if (!state.userMarker) {
            const icon = L.divIcon({ className: 'user-marker', html: '<div class="user-marker-inner"><div class="user-arrow" id="user-arrow"></div><div class="user-dot"></div></div>', iconSize: [28, 28], iconAnchor: [14, 14] });
            state.userMarker = L.marker(latlng, { icon: icon, zIndexOffset: 1000 }).addTo(state.map);
        } else state.userMarker.setLatLng(latlng);

        if (acc < 500) {
            if (!state.accuracyCircle) state.accuracyCircle = L.circle(latlng, { radius: acc, className: 'accuracy-circle' }).addTo(state.map);
            else { state.accuracyCircle.setLatLng(latlng); state.accuracyCircle.setRadius(acc); }
        }
    }

    function getDistance(p1, p2) {
        const R = 6371000, dLat = (p2[0] - p1[0]) * Math.PI / 180, dLon = (p2[1] - p1[1]) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1[0] * Math.PI / 180) * Math.cos(p2[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    init();
})();
