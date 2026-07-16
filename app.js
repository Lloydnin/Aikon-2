// System Clock updating
function updateClock() {
    const now = new Date();
    document.getElementById('time').innerText = now.toLocaleTimeString();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    document.getElementById('date').innerText = now.toLocaleDateString(undefined, options);
}
setInterval(updateClock, 1000);
updateClock();

const feed = document.getElementById('feed');
const inputCmd = document.getElementById('input-cmd');
const btnSend = document.getElementById('btn-send');
const widgetArea = document.getElementById('widget-area');

let notes = JSON.parse(localStorage.getItem('aikon_notes')) || [];
let activeTimers = [];

// Secure API Key Handling
let GEMINI_API_KEY = localStorage.getItem('aikon_gemini_key') || '';

function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message msg-${sender}`;
    msg.innerText = text;
    feed.appendChild(msg);
    feed.scrollTop = feed.scrollHeight;
}

function fillCommand(val) {
    inputCmd.value = val;
    inputCmd.focus();
}

// Initial Boot Logic
function checkSystemStatus() {
    if (!GEMINI_API_KEY) {
        addMessage("⚙️ [SYSTEM READY] Local engines active. Gemini is offline. To link it, type: 'set key YOUR_KEY'.", 'aikon');
    } else {
        addMessage("📡 [SYSTEM READY] Local engines active. To prompt Gemini, start with '/ask'. To disconnect, type '/disconnect'.", 'aikon');
    }
}

window.addEventListener('DOMContentLoaded', checkSystemStatus);

// Web Audio Synth for Energy Tone
function playEnergyTone() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator();
        let gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 1.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.6);
    } catch (e) {
        console.log("Audio couldn't trigger automatically.", e);
    }
}

function renderTimers() {
    if (activeTimers.length === 0) {
        widgetArea.style.display = 'none';
        return;
    }
    widgetArea.style.display = 'flex';
    widgetArea.innerHTML = '';
    activeTimers.forEach((t, idx) => {
        const el = document.createElement('div');
        el.className = 'timer-widget';
        el.innerHTML = `
            <span class="timer-label">⏱️ ${t.label}</span>
            <span class="timer-time" id="timer-display-${idx}">${t.secondsLeft}s</span>
        `;
        widgetArea.appendChild(el);
    });
}

function startLocalTimer(seconds, label) {
    const timerObj = {
        id: Date.now() + Math.random(),
        label: label || "Timer Run",
        secondsLeft: seconds,
        interval: null
    };

    timerObj.interval = setInterval(() => {
        timerObj.secondsLeft--;
        if (timerObj.secondsLeft <= 0) {
            clearInterval(timerObj.interval);
            activeTimers = activeTimers.filter(t => t.id !== timerObj.id);
            renderTimers();
            playEnergyTone();
            addMessage(`⚡ [Aikon Notification] Timer complete! "${timerObj.label}" has reached zero.`, 'aikon');
        } else {
            const displayEl = document.getElementById(`timer-display-${activeTimers.indexOf(timerObj)}`);
            if (displayEl) displayEl.innerText = `${timerObj.secondsLeft}s`;
        }
    }, 1000);

    activeTimers.push(timerObj);
    renderTimers();
    addMessage(`⏱️ Timer initiated for ${seconds} seconds: "${timerObj.label}". Monitoring...`, 'aikon');
}

function safeEval(str) {
    try {
        const clean = str.replace(/[^0-9+\-*/().\s]/g, '');
        return Function(`"use strict"; return (${clean})`)();
    } catch (e) {
        return null;
    }
}

// Call Gemini API Direct REST EndPoint with Error Debugging
async function queryGemini(promptText) {
    if (!GEMINI_API_KEY) {
        addMessage("❌ Error: Gemini is not linked. Type 'set key YOUR_KEY' to connect.", 'aikon');
        return;
    }

    addMessage("⚡ Channelling neural link...", 'aikon');
    
    // Updated to gemini-3.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are Aikon, a sleek operating system companion engineered with "Ultra Instinct" parameters. You speak with a confident, modern, and cosmic aesthetic. Keep responses relatively concise and focused on the user's prompt: ${promptText}`
                    }]
                }]
            })
        });

        const data = await response.json();
        
        // Remove loading message
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }

        // Catch explicit API issues from Google's response payload
        if (data.error) {
            addMessage(`❌ [API ERROR] ${data.error.message} (Code: ${data.error.code})`, 'aikon');
            return;
        }

        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0].text) {
            const reply = data.candidates[0].content.parts[0].text;
            addMessage(reply, 'aikon');
        } else {
            addMessage("📡 [LINK FAIL] Received an unrecognized format from the Gemini server.", 'aikon');
            console.log("Unparsed Response: ", data);
        }
    } catch (error) {
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) {
            messages[messages.length - 1].remove();
        }
        addMessage("💥 [LINK CRASH] Connection to neural network failed. Check your network or API key status.", 'aikon');
        console.error(error);
    }
}

function handleCommand(raw) {
    const text = raw.trim();
    if (!text) return;

    // 1. API Key Setup Commands
    if (text.toLowerCase().startsWith("set key ")) {
        const inputKey = text.substring(8).trim();
        if (inputKey) {
            GEMINI_API_KEY = inputKey;
            localStorage.setItem('aikon_gemini_key', inputKey);
            addMessage("User action: Key input received.", 'user');
            inputCmd.value = '';
            addMessage("🔑 Success! Your secure Gemini API Key has been saved locally. Use '/ask [prompt]' to chat with Gemini.", 'aikon');
        }
        return;
    }

    // 2. DISCONNECT COMMANDS
    if (text.toLowerCase() === "clear key" || text.toLowerCase() === "/disconnect" || text.toLowerCase() === "disconnect") {
        GEMINI_API_KEY = '';
        localStorage.removeItem('aikon_gemini_key');
        addMessage(text, 'user');
        inputCmd.value = '';
        addMessage("🔒 [DISCONNECTED] Gemini neural link terminated. All API credentials purged from local memory. Core is now 100% Offline Secure.", 'aikon');
        return;
    }

    addMessage(text, 'user');
    inputCmd.value = '';
    const lower = text.toLowerCase();

    // 3. EXPLICIT GEMINI TRIGGER
    if (lower.startsWith("/ask ") || lower.startsWith("/gemini ")) {
        const promptText = text.substring(text.indexOf(" ") + 1).trim();
        if (!promptText) {
            addMessage("❌ Please provide a prompt after the command. Example: '/ask what is gravity?'", 'aikon');
            return;
        }
        queryGemini(promptText);
        return;
    }

    // 4. Clock & Date
    if (lower.includes("time") || lower.includes("what time")) {
        addMessage(`🕒 System time: ${new Date().toLocaleTimeString()}`, 'aikon');
        return;
    }
    if (lower.includes("date") || lower.includes("what day") || lower.includes("today")) {
        addMessage(`📅 System Date: ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 'aikon');
        return;
    }

    // 5. Local Timer Engine
    const timerMatch = lower.match(/(?:timer|remind|reminder)\s+(?:for\s+)?(\d+)\s*(second|sec|minute|min|hour)/i);
    if (timerMatch) {
        let amt = parseInt(timerMatch[1]);
        let unit = timerMatch[2].toLowerCase();
        let seconds = amt;
        if (unit.startsWith('min')) seconds = amt * 60;
        if (unit.startsWith('hour')) seconds = amt * 3600;

        let label = "Timer";
        const labelMatch = raw.match(/(?:remind me to|reminder to)\s+([^in|for]+)/i);
        if (labelMatch) {
            label = labelMatch[1].trim();
        } else {
            label = raw.replace(/(timer|remind|for|\d+|second|sec|minute|min|hour)/gi, "").trim() || "Local Timer";
        }

        startLocalTimer(seconds, label);
        return;
    }

    if (lower === "show timers" || lower === "timers") {
        if (activeTimers.length === 0) {
            addMessage("⏱️ No current timers active in system storage.", 'aikon');
        } else {
            addMessage(`⏱️ Current: ${activeTimers.map((t, idx) => `[${idx}] ${t.label} (${t.secondsLeft}s)`).join(', ')}`, 'aikon');
        }
        return;
    }

    if (lower.startsWith("cancel timer")) {
        const num = parseInt(lower.replace("cancel timer", "").trim());
        if (!isNaN(num) && activeTimers[num]) {
            clearInterval(activeTimers[num].interval);
            addMessage(`❌ Cancelled timer: "${activeTimers[num].label}"`, 'aikon');
            activeTimers.splice(num, 1);
            renderTimers();
        } else {
            addMessage("❌ Timer ID unrecognized.", 'aikon');
        }
        return;
    }

    // 6. Local Notes Engine
    if (lower.startsWith("note:") || lower.startsWith("remember that")) {
        const noteVal = raw.replace(/(note:|remember that)/i, "").trim();
        notes.push(noteVal);
        localStorage.setItem('aikon_notes', JSON.stringify(notes));
        addMessage(`📝 Logged to memory: "${noteVal}"`, 'aikon');
        return;
    }

    if (lower === "show my notes" || lower === "show notes" || lower === "notes") {
        if (notes.length === 0) {
            addMessage("📝 No local notes saved yet.", 'aikon');
        } else {
            addMessage("📝 Local Memories:\n" + notes.map((n, idx) => `${idx + 1}. ${n}`).join('\n'), 'aikon');
        }
        return;
    }

    if (lower.startsWith("delete note")) {
        const idx = parseInt(lower.replace("delete note", "").trim()) - 1;
        if (!isNaN(idx) && notes[idx] !== undefined) {
            addMessage(`🗑️ Memory erased: "${notes[idx]}"`, 'aikon');
            notes.splice(idx, 1);
            localStorage.setItem('aikon_notes', JSON.stringify(notes));
        } else {
            addMessage("❌ Memory location index invalid.", 'aikon');
        }
        return;
    }

    if (lower === "clear notes") {
        notes = [];
        localStorage.removeItem('aikon_notes');
        addMessage("🗑️ All memory files cleared successfully.", 'aikon');
        return;
    }

    // 7. Local Math
    const mathMatch = text.match(/[\d+\-*/().\s]{3,}/g);
    if (mathMatch && (lower.includes("calculate") || !isNaN(safeEval(text)))) {
        const expr = text.replace(/calculate/i, "").trim();
        const res = safeEval(expr);
        if (res !== null) {
            addMessage(`🧮 Answer: ${expr} = ${res}`, 'aikon');
            return;
        }
    }

    // 8. Unrecognized Local Command
    addMessage("🤖 Command unrecognized locally. To ask Gemini, start your prompt with '/ask'.", 'aikon');
}

btnSend.addEventListener('click', () => handleCommand(inputCmd.value));
inputCmd.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCommand(inputCmd.value);
});
