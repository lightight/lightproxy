
// --- Native Calculator ---
function renderCalculator(container) {
    container.innerHTML = `
            <div style="display:flex; flex-direction:column; height:100%; padding:10px; background:#222;">
                <input type="text" id="calc-display" readonly style="width:100%; padding:15px; font-size:24px; text-align:right; margin-bottom:10px; border:none; border-radius:8px; background:#333; color:#fff;">
                <div style="flex:1; display:grid; grid-template-columns:repeat(4, 1fr); gap:8px;">
                    <button class="calc-btn btn-op" onclick="calcAppend('C')">C</button>
                    <button class="calc-btn btn-op" onclick="calcAppend('/')">/</button>
                    <button class="calc-btn btn-op" onclick="calcAppend('*')">×</button>
                    <button class="calc-btn btn-op" onclick="calcAppend('bs')">⌫</button>
                    <button class="calc-btn" onclick="calcAppend('7')">7</button>
                    <button class="calc-btn" onclick="calcAppend('8')">8</button>
                    <button class="calc-btn" onclick="calcAppend('9')">9</button>
                    <button class="calc-btn btn-op" onclick="calcAppend('-')">-</button>
                    <button class="calc-btn" onclick="calcAppend('4')">4</button>
                    <button class="calc-btn" onclick="calcAppend('5')">5</button>
                    <button class="calc-btn" onclick="calcAppend('6')">6</button>
                    <button class="calc-btn btn-op" onclick="calcAppend('+')">+</button>
                    <button class="calc-btn" onclick="calcAppend('1')">1</button>
                    <button class="calc-btn" onclick="calcAppend('2')">2</button>
                    <button class="calc-btn" onclick="calcAppend('3')">3</button>
                    <button class="calc-btn btn-eq" onclick="calcCalculate()" style="grid-row:span 2;">=</button>
                    <button class="calc-btn" onclick="calcAppend('0')" style="grid-column:span 2;">0</button>
                    <button class="calc-btn" onclick="calcAppend('.')">.</button>
                </div>
            </div>
            <style>
                .calc-btn { border:none; border-radius:8px; background:#444; color:#fff; font-size:18px; cursor:pointer; transition:0.1s; }
                .calc-btn:hover { filter:brightness(1.2); }
                .calc-btn:active { transform:scale(0.95); }
                .btn-op { background:#555; color:var(--accent-primary); }
                .btn-eq { background:var(--accent-primary); color:#000; font-weight:bold; }
            </style>
            `;
    window.calcDisplay = container.querySelector('#calc-display');
}

window.calcAppend = function (val) {
    const display = window.calcDisplay;
    if (val === 'C') display.value = '';
    else if (val === 'bs') display.value = display.value.slice(0, -1);
    else display.value += val;
}

window.calcCalculate = function () {
    try { window.calcDisplay.value = eval(window.calcDisplay.value) || ''; } catch { window.calcDisplay.value = 'Error'; }
}

// --- Native Paint ---
function renderPaint(container) {
    container.innerHTML = `
            <div style="height:100%; display:flex; flex-direction:column;">
                <div style="padding:10px; background:#333; display:flex; gap:10px; align-items:center;">
                    <input type="color" id="paint-color" value="#ffffff">
                    <input type="range" id="paint-size" min="1" max="20" value="5" style="width:100px;">
                    <button class="btn btn-primary" onclick="paintClear()">Clear</button>
                    <button class="btn" onclick="paintSave()">Save</button>
                </div>
                <div style="flex:1; position:relative; overflow:hidden; background:#fff; cursor:crosshair;" id="paint-area">
                    <canvas id="paint-canvas"></canvas>
                </div>
            </div>
            `;
    const canvas = container.querySelector('#paint-canvas');
    const parent = container.querySelector('#paint-area');
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const ctx = canvas.getContext('2d');
    let painting = false;

    function startPosition(e) { painting = true; draw(e); }
    function finishedPosition() { painting = false; ctx.beginPath(); }
    function draw(e) {
        if (!painting) return;
        const rect = canvas.getBoundingClientRect();
        ctx.lineWidth = document.getElementById('paint-size').value;
        ctx.lineCap = 'round';
        ctx.strokeStyle = document.getElementById('paint-color').value;

        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }

    canvas.addEventListener('mousedown', startPosition);
    canvas.addEventListener('mouseup', finishedPosition);
    canvas.addEventListener('mousemove', draw);

    // Resize handler could be added here
    window.paintClear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.paintSave = () => {
        const link = document.createElement('a');
        link.download = 'drawing.png';
        link.href = canvas.toDataURL();
        link.click();
    };
}

// --- OS Settings ---
function renderOSSettings(container) {
    container.style.padding = '20px';
    container.style.color = '#fff';
    container.style.height = '100%';
    container.style.overflowY = 'auto';
    container.innerHTML = `
            <h2 style="margin-bottom:20px; font-weight:700;">OS Settings</h2>
            
            <!-- Taskbar & Layout -->
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:15px;">
                <h3 style="font-size:12px; margin-bottom:12px; color:#aaa; text-transform:uppercase; font-weight:600;">Desktop & Taskbar</h3>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span style="font-size:14px;">Taskbar Position</span>
                    <select onchange="window.setLayout(this.value)" style="background:#333; color:#fff; border:1px solid rgba(255,255,255,0.1); padding:6px 10px; border-radius:6px; font-size:13px; outline:none;">
                        <option value="bottom" ${localStorage.getItem('light-layout') !== 'top' ? 'selected' : ''}>Bottom</option>
                        <option value="top" ${localStorage.getItem('light-layout') === 'top' ? 'selected' : ''}>Top</option>
                    </select>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:14px;">Clock Position</span>
                    <select onchange="window.setClockPos(this.value)" style="background:#333; color:#fff; border:1px solid rgba(255,255,255,0.1); padding:6px 10px; border-radius:6px; font-size:13px; outline:none;">
                        <option value="right" ${localStorage.getItem('light-clock-pos') !== 'left' && localStorage.getItem('light-clock-pos') !== 'center' ? 'selected' : ''}>Right</option>
                        <option value="center" ${localStorage.getItem('light-clock-pos') === 'center' ? 'selected' : ''}>Center</option>
                        <option value="left" ${localStorage.getItem('light-clock-pos') === 'left' ? 'selected' : ''}>Left</option>
                    </select>
                </div>
            </div>

            <!-- Appearance -->
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px; margin-bottom:15px;">
                <h3 style="font-size:12px; margin-bottom:12px; color:#aaa; text-transform:uppercase; font-weight:600;">Appearance</h3>
                
                <div style="margin-bottom:15px;">
                    <div style="margin-bottom:8px; font-size:14px;">Wallpaper URL</div>
                    <div style="display:flex; gap:10px;">
                        <input type="text" id="set-wp-input" placeholder="https://example.com/image.png" value="${(localStorage.getItem('vøid-wallpaper') || '').replace('url(\'', '').replace('\')', '')}" 
                            style="flex:1; background:#222; border:1px solid rgba(255,255,255,0.1); color:#fff; padding:8px; border-radius:6px; font-size:13px;">
                        <button class="btn btn-primary" onclick="window.applyWallpaper(document.getElementById('set-wp-input').value)">Set</button>
                    </div>
                </div>

                <div style="margin-bottom:15px;">
                     <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <span style="font-size:14px;">Window Radius</span>
                        <span id="rad-val" style="font-size:12px; opacity:0.7;">${localStorage.getItem('ez-radius') || '12'}px</span>
                    </div>
                    <input type="range" min="0" max="24" value="${localStorage.getItem('ez-radius') || '12'}" 
                        oninput="window.setRadius(this.value); document.getElementById('rad-val').textContent=this.value+'px'" 
                        style="width:100%; cursor:pointer;">
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:14px;">System Font</span>
                    <select onchange="window.setFont(this.value)" style="background:#333; color:#fff; border:1px solid rgba(255,255,255,0.1); padding:6px 10px; border-radius:6px; font-size:13px; outline:none;">
                        <option value="'Inter', sans-serif">Inter (Default)</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Courier New', monospace">Monospace</option>
                        <option value="'Comic Sans MS', cursive">Comic Sans</option>
                    </select>
                </div>
            </div>

            <!-- Data Management -->
            <div style="background:rgba(255,255,255,0.05); padding:15px; border-radius:8px;">
                <h3 style="font-size:12px; margin-bottom:10px; color:#aaa; text-transform:uppercase; font-weight:600;">Data & Reset</h3>
                <div style="display:flex; gap:10px; flex-wrap:wrap;">
                    <button class="btn btn-danger" onclick="if(confirm('Reset all OS preferences?')){localStorage.clear();location.reload();}">Factory Reset</button>
                    <button class="btn" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.1);" onclick="const data = JSON.stringify(localStorage); const blob = new Blob([data], {type: 'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'lightOS-backup.json'; a.click();">Export Data</button>
                </div>
            </div>
            `;
}

window.setClockPos = function (pos) {
    localStorage.setItem('light-clock-pos', pos);
    const taskbar = document.getElementById('os-taskbar');
    taskbar.className = ''; // Reset
    if (pos === 'center') taskbar.classList.add('clock-center');
    else if (pos === 'left') taskbar.classList.add('clock-left');
    // Default is right
}
