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

// Secure API & Model Handling
let GEMINI_API_KEY = localStorage.getItem('aikon_gemini_key') || '';
let GEMINI_MODEL = localStorage.getItem('aikon_model') || 'gemini-3.5-flash';

function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.className = `message msg-${sender}`;
    msg.innerText = text;
    feed.appendChild(msg);
    feed.scrollTop = feed.scrollHeight;
}

// Initial Boot Logic
function checkSystemStatus() {
    if (!GEMINI_API_KEY) {
        addMessage("⚙️ [SYSTEM READY] Local engines active. Gemini is offline. Type 'set key YOUR_KEY' to link.", 'aikon');
    } else {
        addMessage(`📡 [SYSTEM READY] Model: ${GEMINI_MODEL}. Type '/ask' to chat or 'set model [name]' to switch brains.`, 'aikon');
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
    } catch (e) { console.log("Audio feedback error", e); }
}

function renderTimers() {
    if (activeTimers.length === 0) { widgetArea.style.display = 'none'; return; }
    widgetArea.style.display = 'flex';
    widgetArea.innerHTML = '';
    activeTimers.forEach((t, idx) => {
        const el = document.createElement('div');
        el.className = 'timer-widget';
        el.innerHTML = `<span class="timer-label">⏱️ ${t.label}</span><span class="timer-time" id="timer-display-${idx}">${t.secondsLeft}s</span>`;
        widgetArea.appendChild(el);
    });
}

function startLocalTimer(seconds, label) {
    const timerObj = { id: Date.now() + Math.random(), label: label || "Timer", secondsLeft: seconds, interval: null };
    timerObj.interval = setInterval(() => {
        timerObj.secondsLeft--;
        if (timerObj.secondsLeft <= 0) {
            clearInterval(timerObj.interval);
            activeTimers = activeTimers.filter(t => t.id !== timerObj.id);
            renderTimers();
            playEnergyTone();
            addMessage(`⚡ Timer complete! "${timerObj.label}" finished.`, 'aikon');
        } else {
            const el = document.getElementById(`timer-display-${activeTimers.indexOf(timerObj)}`);
            if (el) el.innerText = `${timerObj.secondsLeft}s`;
        }
    }, 1000);
    activeTimers.push(timerObj);
    renderTimers();
    addMessage(`⏱️ Timer set: "${timerObj.label}".`, 'aikon');
}

function safeEval(str) { try { return Function(`"use strict"; return (${str.replace(/[^0-9+\-*/().\s]/g, '')})`)(); } catch (e) { return null; } }

// Call Gemini API with Dynamic Model
async function queryGemini(promptText) {
    if (!GEMINI_API_KEY) { addMessage("❌ Error: Gemini not linked.", 'aikon'); return; }

    addMessage("⚡ Channelling...", 'aikon');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    try {
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }) });
        const data = await response.json();
        
        const messages = document.querySelectorAll('.message');
        if (messages.length > 0) messages[messages.length - 1].remove();

        if (data.error) { addMessage(`❌ [API ERROR] ${data.error.message}`, 'aikon'); return; }
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            addMessage(data.candidates[0].content.parts[0].text, 'aikon');
        } else {
            addMessage("📡 [LINK FAIL] Empty response.", 'aikon');
        }
    } catch (error) {
        addMessage("💥 [LINK CRASH] Neural network unreachable.", 'aikon');
    }
}

function handleCommand(raw) {
    const text = raw.trim();
    if (!text) return;

    // Model & Key Setup
    if (text.toLowerCase().startsWith("set key ")) {
        GEMINI_API_KEY = text.substring(8).trim();
        localStorage.setItem('aikon_gemini_key', GEMINI_API_KEY);
        addMessage("🔑 API Key updated.", 'aikon');
        return;
    }
    if (text.toLowerCase().startsWith("set model ")) {
        GEMINI_MODEL = text.substring(10).trim();
        localStorage.setItem('aikon_model', GEMINI_MODEL);
        addMessage(`⚙️ Model switched to: ${GEMINI_MODEL}`, 'aikon');
        return;
    }

    if (text.toLowerCase() === "/disconnect") {
        GEMINI_API_KEY = '';
        localStorage.removeItem('aikon_gemini_key');
        addMessage("🔒 Disconnected.", 'aikon');
        return;
    }

    addMessage(text, 'user');
    inputCmd.value = '';
    const lower = text.toLowerCase();

    // AI Trigger
    if (lower.startsWith("/ask ") || lower.startsWith("/gemini ")) {
        queryGemini(text.substring(text.indexOf(" ") + 1));
        return;
    }

    // Local Tools (Clock, Timer, Notes, Math)
    if (lower.includes("time") || lower.includes("date")) {
        addMessage(`🕒 ${new Date().toLocaleString()}`, 'aikon');
    } else if (lower.includes("timer")) {
        startLocalTimer(60, "Generic Timer");
    } else {
        addMessage("🤖 Command unrecognized.", 'aikon');
    }
}

btnSend.addEventListener('click', () => handleCommand(inputCmd.value));
inputCmd.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleCommand(inputCmd.value); });
