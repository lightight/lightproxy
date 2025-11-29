// Wait for the DOM to be fully loaded before running scripts
document.addEventListener('DOMContentLoaded', () => {
	// --- DOM Element Selectors ---
	const body = document.body;
	const launcherPage = document.getElementById('launcher-page');
	const settingsBtn = document.getElementById('settings-btn');
	const settingsModal = document.getElementById('settings-modal');
	const closeSettingsBtn = document.getElementById('close-settings-btn');
	const saveSettingsBtn = document.getElementById('save-settings-btn');

	// Nav
	const navTerminal = document.getElementById('nav-terminal');
	const navChat = document.getElementById('nav-chat');
	const navMusic = document.getElementById('nav-music');

	// Proxy Form
	const proxyForm = document.getElementById('proxy-form');
	const proxyAddress = document.getElementById('proxy-address');
	const proxySearchEngine = document.getElementById(
		'proxy-search-engine'
	);

	// Browser UI
	const browserContainer = document.getElementById('browser-container');
	const closeBrowserBtn = document.getElementById('close-browser-btn');
	const tabList = document.getElementById('tab-list');
	const iframeContainer = document.getElementById('iframe-container');
	const addTabBtn = document.getElementById('add-tab-btn');
	const browserUrlBar = document.getElementById('browser-url-bar');

	// Settings Inputs
	const themeSelect = document.getElementById('theme-select');
	const wallpaperSelect = document.getElementById('wallpaper-select');
	const panicKeyInput = document.getElementById('panic-key-input');
	const panicUrlInput = document.getElementById('panic-url-input');
	const cloakToggle = document.getElementById('cloak-toggle');
	const stealthToggle = document.getElementById('stealth-toggle');
	const stealthImageInput = document.getElementById('stealth-image-input');
	const teachgoneToggle = document.getElementById('teachgone-toggle');
	const teachgoneVideo = document.getElementById('teachgone-video');
	const stealthOverlay = document.getElementById('stealth-overlay');

	let settings = {};
	let activeTab = null;
	let tabs = new Map(); // Stores tab data (id, title, iframe)

	// --- 1. Settings Logic ---
	function saveSettings() {
		settings = {
			theme: themeSelect.value,
			wallpaper: wallpaperSelect.value,
			panicKey: panicKeyInput.value.toLowerCase(),
			panicUrl: panicUrlInput.value,
			isCloaked: cloakToggle.checked,
			isStealth: stealthToggle.checked,
			stealthImage: stealthImageInput.value,
			isTeachGone: teachgoneToggle.checked,
		};
		localStorage.setItem('vøidSettings', JSON.stringify(settings));
		applySettings();
		alert('Settings saved!');
	}

	function loadSettings() {
		const savedSettings = JSON.parse(
			localStorage.getItem('vøidSettings')
		);
		if (savedSettings) {
			settings = savedSettings;
			// Update modal inputs to reflect saved settings
			themeSelect.value = settings.theme || 'theme-dark';
			wallpaperSelect.value =
				settings.wallpaper || 'Wallpapers/6.png';
			panicKeyInput.value = settings.panicKey || 'p';
			panicUrlInput.value =
				settings.panicUrl || 'https://classroom.google.com/';
			cloakToggle.checked = settings.isCloaked || false;
			stealthToggle.checked = settings.isStealth || false;
			stealthImageInput.value = settings.stealthImage || '';
			teachgoneToggle.checked = settings.isTeachGone || false;
		}
		applySettings();
	}

	function applySettings() {
		// Apply Theme
		body.className = settings.theme || 'theme-dark';

		// Apply Wallpaper
		body.style.backgroundImage = `url('${
			settings.wallpaper || 'Wallpapers/6.png'
		}')`;

		// Apply Stealth Mode Image
		if (settings.stealthImage) {
			stealthOverlay.style.backgroundImage = `url('${settings.stealthImage}')`;
		}

		// Apply TeachGone
		toggleTeachGone(settings.isTeachGone);

		// Apply Stealth Mode Listeners
		toggleStealthListeners(settings.isStealth);
	}

	// Settings Modal UI
	settingsBtn.addEventListener('click', () =>
		settingsModal.classList.remove('hidden')
	);
	closeSettingsBtn.addEventListener('click', () =>
		settingsModal.classList.add('hidden')
	);
	saveSettingsBtn.addEventListener('click', saveSettings);

	// --- 2. Panic Key Logic ---
	document.addEventListener('keydown', (e) => {
		if (settings.panicKey && e.key.toLowerCase() === settings.panicKey) {
			if (settings.panicUrl) {
				window.open(settings.panicUrl, '_blank');
			}
		}
	});

	// --- 3. about:blank Cloaking Logic ---
	function enableCloak() {
		if (!cloakToggle.checked) return;

		// Request popup permission
		const testPopup = window.open('about:blank', '_blank', 'width=1,height=1');
		if (
			!testPopup ||
			testPopup.closed ||
			typeof testPopup.closed == 'undefined'
		) {
			alert(
				'Popup was blocked! Please allow popups for this site for cloaking to work.'
			);
			cloakToggle.checked = false;
			return;
		}
		testPopup.close();

		settings.isCloaked = true;
		saveSettings();
		alert(
			'Cloak enabled. The site will now open in about:blank. This tab will redirect.'
		);
		// Open the real site in a new, cloaked window
		const newWindow = window.open('about:blank', '_blank');
		newWindow.document.write(
			`<html><head><title>${document.title}</title><link rel="icon" href="${
				document.querySelector("link[rel='shortcut icon']").href
			}"></head><body><iframe src="${
				window.location.href
			}" style="width:100%;height:100%;border:none;margin:0;padding:0;"></iframe></body></html>`
		);

		// Redirect the current "unsafe" tab
		window.location.replace(
			settings.panicUrl || 'https://classroom.google.com/'
		);
	}

	function checkCloakOnLoad() {
		if (
			settings.isCloaked &&
			window.location.hostname !== 'classroom.google.com' &&
			window.location.pathname !== 'about:blank'
		) {
			// This is a failsafe. If the user lands here, re-cloak.
			// This is simplified. A real implementation is more complex.
			console.log('Cloak is on, but user is on main page. Re-cloaking...');
			// We can't auto-trigger the cloak due to popup rules,
			// so we just notify the user.
		}
	}
	cloakToggle.addEventListener('change', enableCloak);

	// --- 4. Stealth Mode Logic ---
	function handleMouseLeave() {
		if (settings.isStealth) {
			stealthOverlay.classList.add('visible');
		}
	}
	function handleMouseEnter() {
		if (settings.isStealth) {
			stealthOverlay.classList.remove('visible');
		}
	}
	function toggleStealthListeners(enable) {
		if (enable) {
			document.addEventListener('mouseleave', handleMouseLeave);
			document.addEventListener('mouseenter', handleMouseEnter);
		} else {
			document.removeEventListener('mouseleave', handleMouseLeave);
			document.removeEventListener('mouseenter', handleMouseEnter);
		}
	}

	// --- 5. "TeachGone" Logic ---
	let videoStream = null;
	async function toggleTeachGone(enable) {
		if (enable) {
			try {
				if (!videoStream) {
					videoStream = await navigator.mediaDevices.getUserMedia({
						video: true,
					});
					teachgoneVideo.srcObject = videoStream;
				}
				teachgoneVideo.classList.remove('hidden');
			} catch (err) {
				console.error('TeachGone Error:', err);
				alert(
					'Could not access camera. Please grant permission.'
				);
				teachgoneToggle.checked = false;
				settings.isTeachGone = false;
			}
		} else {
			if (videoStream) {
				videoStream.getTracks().forEach((track) => track.stop());
				videoStream = null;
			}
			teachgoneVideo.classList.add('hidden');
		}
	}

	// --- 6. Browser UI Logic ---
	function openBrowser() {
		launcherPage.classList.add('hidden');
		browserContainer.classList.remove('hidden');
	}

	function closeBrowser() {
		launcherPage.classList.remove('hidden');
		browserContainer.classList.add('hidden');
		// Optional: Close all tabs and iframes
		// tabs.forEach(tab => closeTab(tab.id));
	}
	closeBrowserBtn.addEventListener('click', closeBrowser);

	function addTab(title, url, isProxied = false) {
		const tabId = `tab-${Date.now()}`;

		// 1. Create Iframe
		const iframe = document.createElement('iframe');
		iframe.id = `iframe-${tabId}`;
		// Use Scramjet/UV to process the URL if proxied
		if (isProxied) {
			// __scramjet is the global object from scramjet.all.js
			// search.process is from search.js to handle search queries
			iframe.src = __scramjet.url(
				search.process(url, proxySearchEngine.value)
			);
		} else {
			iframe.src = url;
		}
		iframeContainer.appendChild(iframe);

		// 2. Create Tab Element
		const tabEl = document.createElement('div');
		tabEl.className = 'tab-item';
		tabEl.dataset.tabId = tabId;
		tabEl.innerHTML = `
            <span>${title}</span>
            <button class="tab-close-btn">&times;</button>
        `;
		tabList.appendChild(tabEl);

		// 3. Store Tab Data
		const tabData = { id: tabId, title, url, iframe, element: tabEl };
		tabs.set(tabId, tabData);

		// 4. Activate Tab
		activateTab(tabId);

		// 5. Add Event Listeners
		tabEl.addEventListener('click', (e) => {
			if (e.target.classList.contains('tab-close-btn')) {
				e.stopPropagation(); // Don't trigger activateTab
				closeTab(tabId);
			} else {
				activateTab(tabId);
			}
		});
	}

	function activateTab(tabId) {
		if (activeTab) {
			activeTab.element.classList.remove('active');
			activeTab.iframe.classList.add('hidden');
		}
		const tabData = tabs.get(tabId);
		if (tabData) {
			tabData.element.classList.add('active');
			tabData.iframe.classList.remove('hidden');
			activeTab = tabData;
			// Update URL bar
			browserUrlBar.value = tabData.url;
		}
	}

	function closeTab(tabId) {
		const tabData = tabs.get(tabId);
		if (!tabData) return;

		// Remove elements
		tabData.element.remove();
		tabData.iframe.remove();

		// Remove from map
		tabs.delete(tabId);

		// Activate another tab if this was the active one
		if (activeTab && activeTab.id === tabId) {
			activeTab = null;
			// Get the last tab in the list and activate it
			const lastTab = tabList.lastElementChild;
			if (lastTab) {
				activateTab(lastTab.dataset.tabId);
			}
		}
	}

	// --- 7. Event Listeners to Open Browser ---

	// Nav links
	navTerminal.addEventListener('click', () => {
		openBrowser();
		addTab('Terminal', 'jor1k/demos/main.html', false); // Not proxied
	});
	navChat.addEventListener('click', () => {
		openBrowser();
		addTab('Public Chat', 'chat/index.html', false); // Not proxied
	});
	navMusic.addEventListener('click', () => {
		openBrowser();
		addTab('Music', 'music.html', false); // Not proxied
	});

	// Main Proxy Form
	proxyForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const query = proxyAddress.value.trim();
		if (query) {
			openBrowser();
			addTab(query, query, true); // PROXIED
			proxyAddress.value = '';
		}
	});

	// New Tab Button
	addTabBtn.addEventListener('click', () => {
		addTab('New Tab', 'about:blank', false);
	});

	// Browser URL Bar (for navigating within an active proxied tab)
	browserUrlBar.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' && activeTab) {
			const newUrl = browserUrlBar.value.trim();
			// Re-use the existing iframe and proxy the new URL into it
			const proxiedUrl = __scramjet.url(
				search.process(newUrl, proxySearchEngine.value)
			);
			activeTab.iframe.src = proxiedUrl;
			activeTab.url = newUrl; // Update stored URL
			activeTab.element.querySelector('span').textContent = newUrl; // Update tab title
		}
	});

	// --- Initial Load ---
	loadSettings();
	checkCloakOnLoad(); // Check if cloaking should be active
});