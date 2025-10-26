document.addEventListener('DOMContentLoaded', () => {
	const startTime = Date.now();

	// --- DOM Element Selectors ---
	const body = document.body;
	const timeDisplay = document.getElementById('time-display');
	const newTabTime = document.getElementById('new-tab-time');
	const pageLoadTime = document.getElementById('page-load-time');

	// Settings Modal
	const settingsModal = document.getElementById('settings-modal');
	const openSettingsBtn = document.getElementById('settings-open-btn');
	const closeSettingsBtn = document.getElementById('settings-close-btn');

	// Theme and Wallpaper
	const themeSelector = document.getElementById('theme-selector');
	const wallpaperSelector = document.getElementById('wallpaper-selector');

	// Panic Key
	const panicKeyInput = document.getElementById('panic-key-input');
	const panicUrlInput = document.getElementById('panic-url-input');

	// Cloak
	const cloakToggle = document.getElementById('cloak-toggle');

	// Stealth Mode
	const stealthToggle = document.getElementById('stealth-toggle');
	const stealthOverlay = document.getElementById('stealth-overlay');
    const stealthImageInput = document.getElementById('stealth-image-input');

	// TeachGone
	const teachgoneToggle = document.getElementById('teachgone-toggle');
	const webcamContainer = document.getElementById('webcam-container');
	const webcamFeed = document.getElementById('webcam-feed');
	let webcamStream = null;

	// Sidebars
	const musicBtn = document.getElementById('music-btn');
	const chatBtn = document.getElementById('chat-btn');
	const musicSidebar = document.getElementById('music-sidebar');
	const chatSidebar = document.getElementById('chat-sidebar');

	// Proxy Interface
	const homeScreen = document.getElementById('home-screen');
	const proxyContainer = document.getElementById('proxy-container');
	const sjForm = document.getElementById('sj-form');
	const sjAddress = document.getElementById('sj-address');
	const sjForm2 = document.getElementById('sj-form-2'); // New tab search
	const sjAddress2 = document.getElementById('sj-address-2');
	const tabList = document.getElementById('tab-list');
	const addTabBtn = document.getElementById('add-tab-btn');
	const proxyView = document.getElementById('proxy-view');
	const newTabView = document.getElementById('new-tab-view');
	const sjFrame = document.getElementById('sj-frame');
    const shortcuts = document.querySelectorAll('.shortcut-item[data-url]');


	// --- Initial Setup ---
	loadSettings();
	updateClock();
	setInterval(updateClock, 1000);
	pageLoadTime.textContent = `Page: ${(Date.now() - startTime).toFixed(2)}ms`;
    
    // --- Cloak Logic ---
    // This MUST run at the very start of the script
    if (localStorage.getItem('vøid_cloak') === 'true') {
        const url = window.location.href;
        if (!url.startsWith('about:blank')) {
            const blank = window.open('about:blank', '_blank');
            if (blank) {
                const doc = blank.document;
                doc.title = document.title;
                const iframe = doc.createElement('iframe');
                iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
                iframe.src = url;
                doc.body.appendChild(iframe);
                window.location.replace('https://classroom.google.com');
            } else {
                alert('Please allow popups for About:Blank Cloak to work.');
            }
        }
    }


	// --- Core Functions ---
	function updateClock() {
		const now = new Date();
		const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (timeDisplay) timeDisplay.textContent = timeString;
		if (newTabTime) newTabTime.textContent = timeString;
	}

	function loadSettings() {
		// Theme
		const savedTheme = localStorage.getItem('vøid_theme') || 'dark-theme';
		body.className = savedTheme;
		themeSelector.value = savedTheme;

		// Wallpaper
		const savedWallpaper = localStorage.getItem('vøid_wallpaper') || '6.png';
		body.style.backgroundImage = `url('Wallpapers/${savedWallpaper}')`;
		wallpaperSelector.value = savedWallpaper;

		// Panic Key
		panicKeyInput.value = localStorage.getItem('vøid_panic_key') || 'p';
		panicUrlInput.value = localStorage.getItem('vøid_panic_url') || 'https://classroom.google.com';

		// Cloak
		cloakToggle.checked = localStorage.getItem('vøid_cloak') === 'true';
        
        // Stealth
        stealthToggle.checked = localStorage.getItem('vøid_stealth') === 'true';
        const savedStealthImage = localStorage.getItem('vøid_stealth_image');
        if (savedStealthImage) {
            stealthOverlay.style.backgroundImage = `url(${savedStealthImage})`;
        }

		// TeachGone
		teachgoneToggle.checked = localStorage.getItem('vøid_teachgone') === 'true';
		if (teachgoneToggle.checked) toggleTeachGone(true);
	}

	// --- Event Listeners ---

	// Settings
	openSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
	closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
	settingsModal.addEventListener('click', (e) => {
		if (e.target === settingsModal) settingsModal.style.display = 'none';
	});

	themeSelector.addEventListener('change', (e) => {
		body.className = e.target.value;
		localStorage.setItem('vøid_theme', e.target.value);
	});

	wallpaperSelector.addEventListener('change', (e) => {
		body.style.backgroundImage = `url('Wallpapers/${e.target.value}')`;
		localStorage.setItem('vøid_wallpaper', e.target.value);
	});

	panicKeyInput.addEventListener('change', (e) => localStorage.setItem('vøid_panic_key', e.target.value.toLowerCase()));
	panicUrlInput.addEventListener('change', (e) => localStorage.setItem('vøid_panic_url', e.target.value));

	cloakToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            alert('About:Blank Cloak enabled. You may need to allow popups for this site. The effect will apply on your next visit.');
        }
		localStorage.setItem('vøid_cloak', e.target.checked);
	});
    
    stealthToggle.addEventListener('change', e => localStorage.setItem('vøid_stealth', e.target.checked));

    stealthImageInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target.result;
                stealthOverlay.style.backgroundImage = `url(${imageUrl})`;
                localStorage.setItem('vøid_stealth_image', imageUrl);
            };
            reader.readAsDataURL(file);
        }
    });

	teachgoneToggle.addEventListener('change', (e) => {
		localStorage.setItem('vøid_teachgone', e.target.checked);
		toggleTeachGone(e.target.checked);
	});

	// Panic Key Listener
	document.addEventListener('keydown', (e) => {
		const panicKey = localStorage.getItem('vøid_panic_key') || 'p';
		if (e.key.toLowerCase() === panicKey && !isInputFocused()) {
			const panicUrl = localStorage.getItem('vøid_panic_url') || 'https://classroom.google.com';
			window.open(panicUrl, '_blank');
		}
        // Ctrl + E to focus search
        if (e.ctrlKey && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            sjAddress.focus();
        }
	});

	// Stealth Mode Listeners
    document.addEventListener('mouseleave', () => {
        if (stealthToggle.checked) {
            stealthOverlay.style.opacity = '1';
            stealthOverlay.style.pointerEvents = 'all';
        }
    });
    document.addEventListener('mouseenter', () => {
        if (stealthToggle.checked) {
            stealthOverlay.style.opacity = '0';
            stealthOverlay.style.pointerEvents = 'none';
        }
    });

	// Sidebar Listeners
	musicBtn.addEventListener('click', () => musicSidebar.classList.add('show'));
	chatBtn.addEventListener('click', () => chatSidebar.classList.add('show'));
	document.querySelectorAll('.close-sidebar').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.target.closest('.sidebar').classList.remove('show');
		});
	});

	// --- TeachGone Logic ---
	async function toggleTeachGone(enable) {
		if (enable) {
			try {
				if (!webcamStream) {
					webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
					webcamFeed.srcObject = webcamStream;
				}
				webcamContainer.style.display = 'block';
			} catch (err) {
				console.error("Error accessing webcam:", err);
                alert("Could not access webcam. Please check permissions.");
				teachgoneToggle.checked = false;
                localStorage.setItem('vøid_teachgone', false);
			}
		} else {
			if (webcamStream) {
				webcamStream.getTracks().forEach(track => track.stop());
				webcamStream = null;
			}
			webcamContainer.style.display = 'none';
		}
	}

	// --- Proxy and Tab Management ---
    let tabIdCounter = 0;

    function createTab(url, title = 'New Tab') {
        const tabId = `tab-${tabIdCounter++}`;
        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';
        tabElement.dataset.tabId = tabId;
        tabElement.dataset.url = url || '';

        const icon = document.createElement('img');
        icon.className = 'tab-icon';
        icon.src = url ? `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}` : 'about:blank';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'tab-title';
        titleSpan.textContent = title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-tab';
        closeBtn.innerHTML = '&times;';
        
        tabElement.append(icon, titleSpan, closeBtn);
        tabList.appendChild(tabElement);

        tabElement.addEventListener('click', () => switchTab(tabId));
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tabId);
        });

        return tabId;
    }
    
    function switchTab(tabId) {
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const tabToActivate = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        
        if (!tabToActivate) {
            // If the tab was closed, switch to the last available tab or new tab screen
            const lastTab = tabList.lastElementChild;
            if (lastTab) {
                switchTab(lastTab.dataset.tabId);
            } else {
                showNewTabView();
            }
            return;
        }

        tabToActivate.classList.add('active');
        const url = tabToActivate.dataset.url;

        if (url) {
            proxyView.classList.add('active');
            newTabView.classList.remove('active');
            if (sjFrame.src !== url) {
                sjFrame.src = url;
            }
        } else {
            showNewTabView();
        }
    }

    function closeTab(tabId) {
        const tabToClose = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
        if (tabToClose) {
            const wasActive = tabToClose.classList.contains('active');
            tabToClose.remove();
            if (wasActive) {
                // Activate the last tab, or show the new tab view
                const lastTab = tabList.lastElementChild;
                if (lastTab) {
                    switchTab(lastTab.dataset.tabId);
                } else {
                    showNewTabView();
                }
            }
        }
    }
    
    function showNewTabView() {
        proxyView.classList.remove('active');
        newTabView.classList.add('active');
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        const activeNewTab = document.querySelector('.tab-item:not([data-url])');
        if (activeNewTab) activeNewTab.classList.add('active');
    }

    function launchProxy(searchValue) {
        // This function uses the Scramjet `search` function if it's globally available
        if (typeof search === 'function') {
            const url = search(searchValue);
            homeScreen.style.opacity = '0';
            setTimeout(() => {
                homeScreen.style.display = 'none';
                proxyContainer.style.display = 'flex';
                const tabId = createTab(url, searchValue.split(' ')[0]);
                switchTab(tabId);
            }, 300);
        } else {
            console.error("Scramjet's `search` function is not available.");
            alert("Proxy search logic is not loaded.");
        }
    }

    sjForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (sjAddress.value.trim()) launchProxy(sjAddress.value);
    });

    sjForm2.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchValue = sjAddress2.value.trim();
        if (searchValue) {
            const url = search(searchValue); // from Scramjet's search.js
            let activeTab = document.querySelector('.tab-item.active');
            if (!activeTab || activeTab.dataset.url) {
                // If no "New Tab" is active, create a new one
                const tabId = createTab(url, searchValue.split(' ')[0]);
                switchTab(tabId);
            } else {
                // Update the current "New Tab" to be a real tab
                activeTab.dataset.url = url;
                activeTab.querySelector('.tab-title').textContent = searchValue.split(' ')[0];
                activeTab.querySelector('.tab-icon').src = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}`;
                switchTab(activeTab.dataset.tabId);
            }
            sjAddress2.value = '';
        }
    });

    addTabBtn.addEventListener('click', () => {
        const tabId = createTab('', 'New Tab');
        switchTab(tabId);
    });

    // Handle shortcut clicks
    shortcuts.forEach(shortcut => {
        shortcut.addEventListener('click', (e) => {
            e.preventDefault();
            launchProxy(shortcut.dataset.url);
        });
    });

    // Special Terminal Button
    terminal-btn.addEventListener('click', e => {
        e.preventDefault();
        // Uses scramjet's __scramjet.url.encode to proxy the internal file path
        const encodedUrl = __scramjet.url.encode('jor1k/demos/main.html');
        launchProxy(encodedUrl);
    });
    
	function isInputFocused() {
		return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
	}
});