// games.js - Truffled as Default

const PROVIDERS = {
    'Truffled': {
        url: "https://truffled.lol/js/json/g.json",
        assets: "https://truffled.lol",
        type: 'truffled'
    },
    'GN-Math': {
        url: "https://cdn.jsdelivr.net/gh/gn-math/assets@main/zones.json",
        assets: "https://cdn.jsdelivr.net/gh/gn-math/covers@main",
        html: "https://rawcdn.githack.com/gn-math/html/main", 
        type: 'gn'
    },
    'Selenite': {
        url: "https://selenite.cc/resources/games.json",
        assets: "https://selenite.cc/resources/semag",
        type: 'selenite'
    },
    'Velara': {
        url: "https://velara.cc/json/gg.json",
        assets: "https://velara.cc",
        type: 'velara'
    },
    'DuckMath': {
        url: "https://cdn.jsdelivr.net/gh/duckmath/duckmath.github.io@main/backup_classes.json",
        type: 'duckmath'
    }
};

async function safeFetch(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn("Fetch failed:", e);
        throw e;
    }
}

async function getGames() {
    // CHANGED: Default is now 'Truffled'
    const pref = localStorage.getItem('void-game-provider') || 'Truffled';
    const provider = PROVIDERS[pref] || PROVIDERS['Truffled'];
    
    // Clear cache slightly more aggressively to ensure provider switches work instantly
    const cacheKey = `void_games_v5_${pref}`;
    const cached = sessionStorage.getItem(cacheKey);
    if(cached) return JSON.parse(cached);

    const data = await safeFetch(provider.url);
    let games = [];

    // --- DATA PROCESSING ---
    if(provider.type === 'truffled') {
        games = (data.games || []).map(g => {
            let u = g.url;
            if(!u.startsWith('http')) u = `${provider.assets}/${u}`;
            u = u.replace(/([^:]\/)\/+/g, "$1"); // remove double slashes
            
            let i = g.thumbnail;
            if(!i.startsWith('http')) i = `${provider.assets}/${i}`;
            
            return { name: g.name, img: i, url: u, source: 'Truffled' };
        });
    }
    else if(provider.type === 'gn') {
        games = data.map(g => {
            let u = g.url.startsWith('http') ? g.url : g.url.replace("{HTML_URL}", provider.html);
            if (u.endsWith('/')) u += 'index.html';
            return {
                name: g.name,
                img: g.cover.replace("{COVER_URL}", provider.assets),
                url: u,
                source: 'GN-Math'
            };
        });
    } 
    else if(provider.type === 'selenite') {
        games = data.map(g => ({
            name: g.name,
            img: `${provider.assets}/${g.directory}/${g.image}`,
            url: `${provider.assets}/${g.directory}/`,
            source: 'Selenite'
        }));
    }
    else if(provider.type === 'velara') {
        games = data.filter(g => g.name !== "!!DMCA" && g.name !== "!!Game Request").map(g => {
            let u = g.link || g.grdmca;
            if(u && !u.startsWith('http')) u = `${provider.assets}/${u}`;
            return { 
                name: g.name, 
                img: `${provider.assets}/assets/game-imgs/${g.imgpath}`, 
                url: u, 
                source: 'Velara' 
            };
        });
    }
    else if(provider.type === 'duckmath') {
        games = data.map(g => ({
            name: g.title.replace(/-/g, ' '),
            img: g.icon,
            url: g.link,
            source: 'DuckMath'
        }));
    }

    games.sort((a,b) => a.name.localeCompare(b.name));
    sessionStorage.setItem(cacheKey, JSON.stringify(games));
    return games;
}

window.renderGamesToContainer = async function(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;

    container.innerHTML = `
        <div style="margin-bottom:20px; position:sticky; top:0; background:var(--bg-dark); z-index:10; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
            <input id="game-search-input" placeholder="search games..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); padding:10px; color:#fff; border-radius:var(--radius-sm); font-family:var(--ui-font);">
        </div>
        <div class="game-grid grid-layout" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:15px;">
            <div style="color:var(--text-secondary); grid-column:1/-1; text-align:center; padding: 20px;">loading games...</div>
        </div>
    `;

    try {
        const games = await getGames();
        const grid = container.querySelector('.game-grid');
        const input = container.querySelector('#game-search-input');

        const render = (query = '') => {
            const filtered = games.filter(g => g.name.toLowerCase().includes(query.toLowerCase()));
            
            if(!filtered.length) { 
                grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-tertiary);">no games found.</div>`; 
                return; 
            }
            
            grid.innerHTML = '';
            
            filtered.forEach(g => {
                const card = document.createElement('div');
                card.className = 'card game-card';
                card.style.cssText = "padding:0; overflow:hidden; cursor:pointer; transition:0.2s; border:1px solid rgba(255,255,255,0.05);";
                card.onclick = () => window.launchProxiedGame(g.url, g.name);

                card.innerHTML = `
                    <div style="height:100px; width:100%;">
                        <img src="${g.img}" style="width:100%; height:100%; object-fit:cover;" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjMjIyIj48L3N2Zz4='">
                    </div>
                    <div style="padding:10px;">
                        <div style="font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${g.name}</div>
                        <div style="font-size:10px; color:var(--text-tertiary);">${g.source}</div>
                    </div>
                `;
                grid.appendChild(card);
            });
        };

        render();
        input.addEventListener('input', (e) => render(e.target.value));

    } catch(e) {
        container.querySelector('.game-grid').innerHTML = `<div style="color:#ef4444; text-align:center;">error loading games: ${e.message}</div>`;
    }
}