// =========================================================================
// --- GLOBAL STATE & LOCALSTORAGE PERSISTENCE ---
// =========================================================================
let currentUser = null;
let currentUserAvatar = "/static/icons/default-avatar.png";
let customApiKey = "";

let chatsHistory = []; // Saved sessions archive
let activeChatId = null;
let chatHistory = [];  // Active chat context sent to /api/chat

let selectedGame = "Tic Tac Toe";
let pendingImageBase64 = null;
let pendingImageMime = null;
let pendingImageSrc = null;

// Initialize persisted state on startup
window.addEventListener("DOMContentLoaded", () => {
    loadPersistedSession();
    initGoogleSignIn();
    initMobileNavIcons();
});

function loadPersistedSession() {
    try {
        const savedUser = localStorage.getItem("carl_user");
        const savedAvatar = localStorage.getItem("carl_avatar");
        const savedApiKey = localStorage.getItem("carl_api_key");
        const savedChats = localStorage.getItem("carl_chats_history");
        const savedActiveId = localStorage.getItem("carl_active_id");

        if (savedApiKey) {
            customApiKey = savedApiKey;
            const keyInput = document.getElementById('user-api-key');
            if (keyInput) keyInput.value = customApiKey;
        }

        if (savedChats) chatsHistory = JSON.parse(savedChats);
        
        if (savedUser) {
            currentUser = savedUser;
            currentUserAvatar = savedAvatar || "/static/icons/default-avatar.png";
            
            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.add('hidden');
            
            updateProfileUI();

            if (savedActiveId && chatsHistory.some(c => c.id === savedActiveId)) {
                loadChat(savedActiveId);
            } else {
                startNewChat();
            }
        }
    } catch (e) {
        console.error("Failed to restore session:", e);
    }
}

function saveSessionData() {
    try {
        if (currentUser) {
            localStorage.setItem("carl_user", currentUser);
            localStorage.setItem("carl_avatar", currentUserAvatar);
        }
        localStorage.setItem("carl_api_key", customApiKey);
        localStorage.setItem("carl_chats_history", JSON.stringify(chatsHistory));
        if (activeChatId) localStorage.setItem("carl_active_id", activeChatId);
    } catch (e) {
        console.error("Failed to save session:", e);
    }
}

// =========================================================================
// --- AUTHENTICATION, GOOGLE SIGN-IN & PROFILE HEADER ---
// =========================================================================

function updateProfileUI() {
    const avatarEl = document.getElementById("header-user-avatar");
    const nameEl = document.getElementById("header-user-name");

    if (avatarEl) avatarEl.src = currentUserAvatar;
    if (nameEl) nameEl.innerText = currentUser || "Guest";
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const usernameInput = document.getElementById('auth-username');
    const username = usernameInput ? usernameInput.value.trim() : "";
    
    if (username) {
        currentUser = username;
        currentUserAvatar = "/static/icons/default-avatar.png";
        
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.classList.add('hidden');
        
        updateProfileUI();
        saveSessionData();
        startNewChat();
    }
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function handleGoogleCredentialResponse(response) {
    const data = parseJwt(response.credential);
    if (data) {
        currentUser = data.name || data.email;
        currentUserAvatar = data.picture || "/static/icons/default-avatar.png";

        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.classList.add('hidden');

        updateProfileUI();
        saveSessionData();
        startNewChat();
    }
}

function initGoogleSignIn() {
    if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
            client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // Replace with your OAuth Client ID
            callback: handleGoogleCredentialResponse
        });
        const btnContainer = document.getElementById("google-signin-btn");
        if (btnContainer) {
            window.google.accounts.id.renderButton(btnContainer, { theme: "outline", size: "large" });
        }
    }
}

function handleSignOut() {
    localStorage.clear();
    currentUser = null;
    currentUserAvatar = "/static/icons/default-avatar.png";
    customApiKey = "";
    chatsHistory = [];
    chatHistory = [];
    activeChatId = null;

    updateProfileUI();

    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) settingsModal.classList.add('hidden');

    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function toggleSettingsModal(show) {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function toggleSidebar() {
    const sidebar = document.getElementById('desktop-sidebar');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar) return;
    if (sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
        sidebar.classList.add('collapsed');
        if (btn) btn.innerText = "❯";
    } else {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('expanded');
        if (btn) btn.innerText = "❮";
    }
}

function toggleTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        if (themeBtn) themeBtn.innerText = "Switch to Dark Mode";
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        if (themeBtn) themeBtn.innerText = "Switch to Light Mode";
    }
}

function saveSettings() {
    const keyInput = document.getElementById('user-api-key');
    customApiKey = keyInput ? keyInput.value.trim() : "";
    saveSessionData();
    toggleSettingsModal(false);
}

function getDifficulty() {
    const select = document.getElementById("difficulty-select");
    return select ? select.value : "medium";
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
}

function searchChats() {
    alert("Search functionality: Type in the search box to filter archived chats!");
}

function initMobileNavIcons() {
    const mobileChatBtn = document.getElementById("mobile-nav-chat");
    const mobileCallBtn = document.getElementById("mobile-nav-call");
    const mobileGamesBtn = document.getElementById("mobile-nav-games");

    if (mobileChatBtn) mobileChatBtn.onclick = () => startNewChat();
    if (mobileCallBtn) mobileCallBtn.onclick = () => startCall();
    if (mobileGamesBtn) mobileGamesBtn.onclick = () => switchView('view-games');
}

// =========================================================================
// --- CHAT SESSION ARCHIVING & UNLIMITED MESSAGING ---
// =========================================================================

function archiveActiveChat() {
    const log = document.getElementById("chat-log");
    if (!log) return;
    const bubbles = log.querySelectorAll('.chat-bubble');

    if (bubbles.length > 0 && activeChatId) {
        let existing = chatsHistory.find(c => c.id === activeChatId);
        if (existing) {
            existing.html = log.innerHTML;
            existing.apiHistory = [...chatHistory];
        } else {
            const firstMsgText = bubbles[0].innerText || "Chat Session";
            const newTitle = firstMsgText.length > 20 ? firstMsgText.substring(0, 20) + "..." : firstMsgText;
            chatsHistory.unshift({
                id: activeChatId,
                title: newTitle,
                html: log.innerHTML,
                apiHistory: [...chatHistory]
            });
        }
    }
    saveSessionData();
    renderChatHistorySidebar();
}

function startNewChat() {
    archiveActiveChat();
    activeChatId = "chat_" + Date.now();
    chatHistory = [];
    
    const log = document.getElementById("chat-log");
    if (log) log.innerHTML = '<div class="system-msg">Started a fresh session.</div>';
    
    const input = document.getElementById("user-input");
    if (input) input.value = "";
    
    pendingImageBase64 = null;
    pendingImageMime = null;
    pendingImageSrc = null;
    
    saveSessionData();
    switchView('view-chat');
}

function loadChat(chatId) {
    archiveActiveChat();
    const target = chatsHistory.find(c => c.id === chatId);
    if (target) {
        activeChatId = target.id;
        const log = document.getElementById("chat-log");
        if (log) log.innerHTML = target.html;
        chatHistory = [...target.apiHistory];
        saveSessionData();
        switchView('view-chat');
    }
}

function renderChatHistorySidebar() {
    const container = document.getElementById("saved-chats-list");
    if (!container) return;
    container.innerHTML = "";
    
    chatsHistory.forEach(chat => {
        const item = document.createElement("div");
        item.className = "saved-chat-item";
        item.innerText = chat.title;
        item.onclick = () => loadChat(chat.id);
        container.appendChild(item);
    });
}

// File picker handler
const filePicker = document.getElementById('native-file-picker');
if (filePicker) {
    filePicker.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            pendingImageSrc = event.target.result;
            pendingImageMime = pendingImageSrc.split(';')[0].split(':')[1];
            pendingImageBase64 = pendingImageSrc.split(',')[1];
        };
        reader.readAsDataURL(file);
    });
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    if (!input) return;
    const text = input.value.trim();
    
    if (!text && !pendingImageBase64) return;

    appendMessage(text, "user", pendingImageSrc);
    
    const payload = { 
        message: text || "Look at this image.", 
        history: chatHistory,
        image_b64: pendingImageBase64,
        image_mime: pendingImageMime,
        api_key: customApiKey
    };

    input.value = "";
    pendingImageBase64 = null;
    pendingImageMime = null;
    pendingImageSrc = null;
    if (filePicker) filePicker.value = "";

    const log = document.getElementById("chat-log");
    const carlBubble = document.createElement("div");
    carlBubble.className = "chat-bubble carl";
    const textNode = document.createElement("div");
    carlBubble.appendChild(textNode);
    log.appendChild(carlBubble);
    log.scrollTop = log.scrollHeight;

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            textNode.innerText = "Error reaching Carl.";
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            
            let cleanedResponse = fullResponse;
            for (let bad_prefix of ["Carl:", "carl:", "Carl - ", "Assistant:"]) {
                if (cleanedResponse.startsWith(bad_prefix)) {
                    cleanedResponse = cleanedResponse.substring(bad_prefix.length).trim();
                }
            }

            textNode.innerText = cleanedResponse;
            log.scrollTop = log.scrollHeight;
        }

        chatHistory.push({ role: "user", content: text || "Look at this image." });
        chatHistory.push({ role: "assistant", content: fullResponse });
        
        saveSessionData();

    } catch (err) {
        textNode.innerText = "Network error.";
    }
}

function appendMessage(msg, sender, imgSrc = null) {
    const log = document.getElementById("chat-log");
    if (!log) return;
    const bubble = document.createElement("div");
    bubble.className = `chat-bubble ${sender}`;
    
    if (msg) {
        const textNode = document.createElement("div");
        textNode.innerText = msg;
        bubble.appendChild(textNode);
    }
    
    if (imgSrc) {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.className = "chat-image";
        bubble.appendChild(img);
    }
    
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
}

const sendBtn = document.getElementById("send-btn");
if (sendBtn) sendBtn.addEventListener("click", sendMessage);

const userInput = document.getElementById("user-input");
if (userInput) {
    userInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendMessage();
    });
}

// =========================================================================
// --- CALL FEATURE SYSTEM (Web Audio, SpeechSynthesis TTS, SpeechRecognition STT) ---
// =========================================================================

let isCallActive = false;
let isCallConnected = false;
let isMuted = false;
let isSpeakerOn = true;
let callTimerInterval = null;
let callSeconds = 0;
let ringTimeout = null;
let ringInterval = null;
let audioCtx = null;

let recognition = null;
let callAbortController = null;
let carlVoice = null;

function loadCarlVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return;
    
    carlVoice = voices.find(v => v.lang.includes('en') && (
        v.name.includes('Google US English') ||
        v.name.includes('Aaron') ||
        v.name.includes('Daniel') ||
        v.name.includes('Guy') ||
        v.name.includes('Natural') ||
        v.name.includes('Male')
    )) || voices.find(v => v.lang.startsWith('en')) || voices[0];
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = loadCarlVoice;
    loadCarlVoice();
}

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playToneBurst(freq1, freq2, duration) {
    try {
        const ctx = getAudioContext();
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = freq1;
        osc2.frequency.value = freq2;

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + duration);
        osc2.stop(ctx.currentTime + duration);
    } catch (e) { console.error("Web Audio error", e); }
}

function startRingingSound() {
    playToneBurst(440, 480, 2.0);
    ringInterval = setInterval(() => {
        if (!isCallActive || isCallConnected) {
            clearInterval(ringInterval);
            return;
        }
        playToneBurst(440, 480, 2.0);
    }, 4000);
}

function stopRingingSound() {
    if (ringInterval) {
        clearInterval(ringInterval);
        ringInterval = null;
    }
}

function playPickupClick() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.08);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
}

function startCall() {
    switchView('view-call');
    isCallActive = true;
    isCallConnected = false;
    isMuted = false;
    callSeconds = 0;

    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if ('speechSynthesis' in window) {
        let wakeUp = new SpeechSynthesisUtterance('');
        wakeUp.volume = 0;
        window.speechSynthesis.speak(wakeUp);
    }

    document.getElementById("call-status").innerText = "Calling Carl...";
    document.getElementById("call-timer").innerText = "00:00";
    
    document.getElementById("mute-btn").style.opacity = "1";
    document.getElementById("speaker-btn").style.opacity = isSpeakerOn ? "1" : "0.4";

    startRingingSound();

    const delay = Math.floor(Math.random() * 6000) + 2000;

    ringTimeout = setTimeout(() => {
        if (!isCallActive) return;
        
        stopRingingSound();
        playPickupClick();

        isCallConnected = true;
        document.getElementById("call-status").innerText = "Connected";

        callTimerInterval = setInterval(() => {
            callSeconds++;
            const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
            const secs = String(callSeconds % 60).padStart(2, '0');
            document.getElementById("call-timer").innerText = `${mins}:${secs}`;
        }, 1000);

        initSpeechRecognition();
        speakCarl("Hey! Carl here. What's on your mind?");
    }, delay);
}

function endCall() {
    try {
        isCallActive = false;
        isCallConnected = false;

        if (ringTimeout) clearTimeout(ringTimeout);
        stopRingingSound();
        if (callTimerInterval) clearInterval(callTimerInterval);

        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        if (callAbortController) callAbortController.abort();
        if (recognition) {
            try { recognition.stop(); } catch(e) {}
            recognition = null;
        }

        document.getElementById("call-timer").innerText = "00:00";
        document.getElementById("call-status").innerText = "Call Ended";
        
        switchView('view-chat');
    } catch (err) {
        switchView('view-chat'); 
    }
}

function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById("mute-btn");
    if (isMuted) {
        btn.style.opacity = "0.4";
        if (recognition) try { recognition.stop(); } catch(e) {}
    } else {
        btn.style.opacity = "1";
        if (recognition && isCallActive && isCallConnected) {
            try { recognition.start(); } catch(e) {}
        }
    }
}

function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    const btn = document.getElementById("speaker-btn");
    btn.style.opacity = isSpeakerOn ? "1" : "0.4";
}

function speakCarl(text) {
    if (!('speechSynthesis' in window) || !isCallActive) return;

    let cleanText = text.replace(/[*_#~]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (!carlVoice) loadCarlVoice();
    if (carlVoice) utterance.voice = carlVoice;

    utterance.rate = 1.05; 
    utterance.pitch = 1.0;
    utterance.volume = isSpeakerOn ? 1.0 : 0.15; 

    window.speechSynthesis.speak(utterance);
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        document.getElementById("call-status").innerText = "Browser doesn't support mic!";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = async (event) => {
        if (isMuted || !isCallActive || !isCallConnected) return;

        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        let combined = finalTranscript + interimTranscript;
        if (combined.trim().length > 3 && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (callAbortController) callAbortController.abort();
        }

        if (finalTranscript.trim().length > 0) {
            const userQuery = finalTranscript.trim();
            
            window.speechSynthesis.cancel();
            if (callAbortController) callAbortController.abort();

            document.getElementById("call-status").innerText = "Carl is thinking...";

            await processCallUserMessage(userQuery);
        }
    };

    recognition.onerror = (e) => {
        if (e.error === 'not-allowed') {
            document.getElementById("call-status").innerText = "Mic Permission Denied";
        }
    };

    recognition.onend = () => {
        if (isCallActive && isCallConnected && !isMuted) {
            try { recognition.start(); } catch(e) {}
        }
    };

    try { recognition.start(); } catch(e) {}
}

async function processCallUserMessage(userText) {
    if (!isCallActive) return;

    callAbortController = new AbortController();
    chatHistory.push({ role: "user", content: userText });

    const payload = {
        message: userText,
        history: chatHistory,
        api_key: customApiKey
    };

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: callAbortController.signal
        });

        if (!response.ok) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let sentenceBuffer = "";

        document.getElementById("call-status").innerText = "Connected";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            sentenceBuffer += chunk;

            let match;
            while ((match = sentenceBuffer.match(/([^.!?]+[.!?])/))) {
                let sentence = match[0].trim();
                sentenceBuffer = sentenceBuffer.substring(match[0].length);
                
                for (let prefix of ["Carl:", "carl:", "Carl - "]) {
                    if (sentence.startsWith(prefix)) sentence = sentence.replace(prefix, "").trim();
                }

                if (sentence) {
                    speakCarl(sentence);
                }
            }
        }

        if (sentenceBuffer.trim()) {
            let leftover = sentenceBuffer.trim();
            for (let prefix of ["Carl:", "carl:", "Carl - "]) {
                if (leftover.startsWith(prefix)) leftover = leftover.replace(prefix, "").trim();
            }
            speakCarl(leftover);
        }

        chatHistory.push({ role: "assistant", content: fullResponse });

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Call response error:", err);
        }
    }
}

// =========================================================================
// --- MINI-GAMES LAUNCHER & LOGIC ---
// =========================================================================

function selectGame(element, gameName) {
    document.querySelectorAll('.game-card-img').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    selectedGame = gameName;
}

function launchGame() {
    if (selectedGame === "Tic Tac Toe") {
        switchView("view-tictactoe");
        initTicTacToe();
    } else if (selectedGame === "Rock Paper Scissors") {
        switchView("view-rps");
        initRps();
    } else if (selectedGame === "Blackjack") {
        switchView("view-blackjack");
        initBlackjack();
    } else if (selectedGame === "Hangman") {
        switchView("view-hangman");
        initHangman();
    } else if (selectedGame === "Connect Four") {
        switchView("view-connectfour");
        initConnectFour();
    } else if (selectedGame === "Battleship") {
        switchView("view-battleship");
        initBattleship();
    } else if (selectedGame === "Checkers") {
        switchView("view-checkers");
        initCheckers();
    } else if (selectedGame === "Chess") {
        switchView("view-chess");
        initChess();
    } else {
        alert(`Starting ${selectedGame}...`);
    }
}

// --- GAME 1: BLACKJACK ---
let bjDeck = [];
let bjPlayerHands = [];
let bjCarlHand = [];
let bjActiveHand = 0;
let bjGameOver = false;
let bjResults = []; 

function buildDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];
    for (let i = 0; i < 4; i++) {
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

function getCardWeight(val) {
    if (['J', 'Q', 'K'].includes(val)) return 10;
    if (val === 'A') return 11;
    return parseInt(val);
}

function getBjScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        if (['J', 'Q', 'K'].includes(card.value)) score += 10;
        else if (card.value === 'A') { score += 11; aces += 1; }
        else score += parseInt(card.value);
    }
    while (score > 21 && aces > 0) { score -= 10; aces -= 1; }
    return score;
}

function initBlackjack() {
    bjDeck = buildDeck();
    bjPlayerHands = [ [bjDeck.pop(), bjDeck.pop()] ];
    bjCarlHand = [bjDeck.pop(), bjDeck.pop()];
    bjActiveHand = 0;
    bjGameOver = false;
    bjResults = [];
    
    document.getElementById("bj-controls").style.display = "flex";
    
    let dealerScore = getBjScore(bjCarlHand);
    let playerScore = getBjScore(bjPlayerHands[0]);

    if (dealerScore === 21 && playerScore === 21) {
        bjGameOver = true;
        bjResults[0] = "Push (Tie)";
    } else if (dealerScore === 21) {
        bjGameOver = true;
        bjResults[0] = "Carl Blackjack!";
    } else if (playerScore === 21) {
        bjGameOver = true;
        bjResults[0] = "Blackjack! You Win!";
    }

    renderBj();
}

function renderBj() {
    const cCards = document.getElementById("bj-carl-cards");
    cCards.innerHTML = "";
    bjCarlHand.forEach((card, index) => {
        let el = document.createElement("div");
        if (!bjGameOver && index === 1) {
            el.className = "bj-card hidden";
            el.innerText = "";
        } else {
            el.className = `bj-card ${card.suit === '♥' || card.suit === '♦' ? 'red' : ''}`;
            el.innerText = `${card.value}${card.suit}`;
        }
        cCards.appendChild(el);
    });

    if (bjGameOver) {
        document.getElementById("bj-carl-score").innerText = getBjScore(bjCarlHand);
    } else {
        let firstVal = bjCarlHand[0].value;
        let val = ['J', 'Q', 'K'].includes(firstVal) ? 10 : (firstVal === 'A' ? 11 : parseInt(firstVal));
        document.getElementById("bj-carl-score").innerText = val;
    }

    const pHandsContainer = document.getElementById("bj-player-hands-container");
    pHandsContainer.innerHTML = "";

    bjPlayerHands.forEach((hand, index) => {
        let handDiv = document.createElement("div");
        handDiv.className = `bj-single-hand ${index === bjActiveHand && !bjGameOver ? 'active' : ''}`;

        let scoreDiv = document.createElement("div");
        scoreDiv.className = "bj-hand-score";
        scoreDiv.innerText = `Score: ${getBjScore(hand)}`;
        handDiv.appendChild(scoreDiv);

        let cardsContainer = document.createElement("div");
        cardsContainer.className = "bj-cards";
        hand.forEach(card => {
            let el = document.createElement("div");
            el.className = `bj-card ${card.suit === '♥' || card.suit === '♦' ? 'red' : ''}`;
            el.innerText = `${card.value}${card.suit}`;
            cardsContainer.appendChild(el);
        });
        handDiv.appendChild(cardsContainer);

        if (bjResults[index] && bjResults[index] !== "Doubled") {
            let resDiv = document.createElement("div");
            resDiv.className = "bj-hand-result";
            let txt = bjResults[index];
            if (txt.includes("Win") || txt.includes("Blackjack")) resDiv.classList.add("win");
            else if (txt.includes("Lose") || txt.includes("Bust")) resDiv.classList.add("lose");
            else resDiv.classList.add("push");
            resDiv.innerText = txt;
            handDiv.appendChild(resDiv);
        }

        pHandsContainer.appendChild(handDiv);
    });

    if (bjGameOver) {
        document.getElementById("bj-controls").style.display = "none";
        document.getElementById("bj-status").innerText = "Round Over";
        document.getElementById("bj-status").style.color = "#aaa";
    } else {
        document.getElementById("bj-controls").style.display = "flex";
        let currentHand = bjPlayerHands[bjActiveHand];

        document.getElementById("bj-btn-double").disabled = currentHand.length !== 2;

        let canSplit = currentHand.length === 2 && 
                       getCardWeight(currentHand[0].value) === getCardWeight(currentHand[1].value) && 
                       bjPlayerHands.length < 4;
        document.getElementById("bj-btn-split").disabled = !canSplit;

        if (bjPlayerHands.length > 1) {
            document.getElementById("bj-status").innerText = `Playing Hand ${bjActiveHand + 1}...`;
        } else {
            document.getElementById("bj-status").innerText = `Your Turn!`;
        }
        document.getElementById("bj-status").style.color = "#fff";
    }
}

function bjHit() {
    if (bjGameOver) return;
    let hand = bjPlayerHands[bjActiveHand];
    hand.push(bjDeck.pop());

    let score = getBjScore(hand);
    if (score > 21) {
        bjResults[bjActiveHand] = "Bust";
        bjNextHand();
    } else if (score === 21) {
        bjNextHand();
    } else {
        renderBj();
    }
}

function bjStand() {
    if (bjGameOver) return;
    bjNextHand();
}

function bjDouble() {
    if (bjGameOver) return;
    let hand = bjPlayerHands[bjActiveHand];
    if (hand.length !== 2) return;

    hand.push(bjDeck.pop());
    if (getBjScore(hand) > 21) {
        bjResults[bjActiveHand] = "Bust";
    } else {
        bjResults[bjActiveHand] = "Doubled";
    }
    bjNextHand();
}

function bjSplit() {
    if (bjGameOver) return;
    let hand = bjPlayerHands[bjActiveHand];
    if (hand.length !== 2 || getCardWeight(hand[0].value) !== getCardWeight(hand[1].value)) return;

    let splitCard = hand.pop();
    let newHand = [splitCard, bjDeck.pop()];
    hand.push(bjDeck.pop());
    
    bjPlayerHands.splice(bjActiveHand + 1, 0, newHand);
    renderBj();
}

function bjNextHand() {
    bjActiveHand++;
    if (bjActiveHand >= bjPlayerHands.length) {
        bjGameOver = true;
        bjDealerTurn();
    } else {
        renderBj();
    }
}

function bjDealerTurn() {
    let allBusted = bjPlayerHands.every((_, i) => bjResults[i] === "Bust");

    const playDealer = () => {
        let score = getBjScore(bjCarlHand);
        if (score < 17 && !allBusted) {
            bjCarlHand.push(bjDeck.pop());
            renderBj();
            setTimeout(playDealer, 800);
        } else {
            for (let i = 0; i < bjPlayerHands.length; i++) {
                if (bjResults[i] === "Bust" || bjResults[i] === "Blackjack! You Win!" || bjResults[i] === "Carl Blackjack!" || bjResults[i] === "Push (Tie)") continue;
                
                let pScore = getBjScore(bjPlayerHands[i]);
                if (score > 21) bjResults[i] = "Win (Carl Busts)";
                else if (pScore > score) bjResults[i] = "Win";
                else if (score > pScore) bjResults[i] = "Lose";
                else bjResults[i] = "Push";
            }
            renderBj();
        }
    };

    if (allBusted) {
        playDealer();
    } else {
        document.getElementById("bj-status").innerText = "Carl is dealing...";
        document.getElementById("bj-status").style.color = "#eccc68";
        renderBj();
        setTimeout(playDealer, 800);
    }
}

// --- GAME 2: ROCK PAPER SCISSORS ---
let rpsScore = { player: 0, carl: 0 };
let rpsPlaying = false;

const rpsCarlHands = {
    rock: '/static/icons/CarlRock.png',
    paper: '/static/icons/CarlPaper.png',
    scissors: '/static/icons/CarlScissors.png'
};

const rpsPlayerHands = {
    rock: '/static/icons/Rock.png',
    paper: '/static/icons/Paper.png',
    scissors: '/static/icons/Scissors.png'
};

function initRps() {
    rpsScore = { player: 0, carl: 0 };
    rpsPlaying = false;
    document.getElementById("rps-status").innerText = "Choose Your Move!";
    document.getElementById("rps-status").style.color = "#fff";
    document.getElementById("rps-carl-hand").src = rpsCarlHands.rock;
    document.getElementById("rps-player-hand").src = rpsPlayerHands.rock;
}

function playRps(playerChoice) {
    if (rpsPlaying) return;
    rpsPlaying = true;

    const choices = ['rock', 'paper', 'scissors'];
    
    document.getElementById("rps-player-hand").src = rpsPlayerHands[playerChoice];
    document.getElementById("rps-status").innerText = "Carl is choosing...";
    document.getElementById("rps-status").style.color = "#eccc68";

    setTimeout(() => {
        let diff = getDifficulty();
        let carlChoice;

        if (diff === "easy") {
            if (playerChoice === 'rock') carlChoice = Math.random() < 0.6 ? 'scissors' : choices[Math.floor(Math.random() * 3)];
            else if (playerChoice === 'paper') carlChoice = Math.random() < 0.6 ? 'rock' : choices[Math.floor(Math.random() * 3)];
            else carlChoice = Math.random() < 0.6 ? 'paper' : choices[Math.floor(Math.random() * 3)];
        } else if (diff === "hard") {
            if (playerChoice === 'rock') carlChoice = Math.random() < 0.6 ? 'paper' : choices[Math.floor(Math.random() * 3)];
            else if (playerChoice === 'paper') carlChoice = Math.random() < 0.6 ? 'scissors' : choices[Math.floor(Math.random() * 3)];
            else carlChoice = Math.random() < 0.6 ? 'rock' : choices[Math.floor(Math.random() * 3)];
        } else {
            carlChoice = choices[Math.floor(Math.random() * choices.length)];
        }

        document.getElementById("rps-carl-hand").src = rpsCarlHands[carlChoice];

        if (playerChoice === carlChoice) {
            document.getElementById("rps-status").innerText = `It's a Tie! (${rpsScore.player} - ${rpsScore.carl})`;
            document.getElementById("rps-status").style.color = "#fff";
        } else if (
            (playerChoice === 'rock' && carlChoice === 'scissors') ||
            (playerChoice === 'paper' && carlChoice === 'rock') ||
            (playerChoice === 'scissors' && carlChoice === 'paper')
        ) {
            rpsScore.player++;
            document.getElementById("rps-status").innerText = `You Win! (${rpsScore.player} - ${rpsScore.carl})`;
            document.getElementById("rps-status").style.color = "#84cc16";
        } else {
            rpsScore.carl++;
            document.getElementById("rps-status").innerText = `Carl Wins! (${rpsScore.player} - ${rpsScore.carl})`;
            document.getElementById("rps-status").style.color = "#ef4444";
        }

        rpsPlaying = false;
    }, 500);
}

// --- GAME 3: TIC TAC TOE ---
let board = ["", "", "", "", "", "", "", "", ""];
let playerTurn = true;
const winCombos = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function initTicTacToe() {
    board = ["", "", "", "", "", "", "", "", ""];
    playerTurn = true;
    document.getElementById("ttt-status").innerText = "Your Turn (X)";
    document.getElementById("ttt-status").style.color = "#fff";
    document.querySelectorAll(".ttt-cell").forEach(cell => {
        cell.innerText = "";
        cell.className = "ttt-cell";
    });
}

function makeMove(index) {
    if (board[index] === "" && playerTurn) {
        board[index] = "X";
        updateCell(index, "X");

        if (checkWin("X")) {
            document.getElementById("ttt-status").innerText = "You Win!";
            document.getElementById("ttt-status").style.color = "#84cc16";
            playerTurn = false;
            return;
        } else if (!board.includes("")) {
            document.getElementById("ttt-status").innerText = "It's a Draw!";
            return;
        }

        playerTurn = false;
        document.getElementById("ttt-status").innerText = "Carl is thinking...";
        setTimeout(carlMove, 500);
    }
}

function updateCell(index, player) {
    const cell = document.getElementById(`ttt-cell-${index}`);
    if (cell) {
        cell.innerText = player;
        cell.classList.add(player.toLowerCase());
    }
}

function carlMove() {
    if (checkWin("X") || checkWin("O") || !board.includes("")) return;

    let diff = getDifficulty();
    let available = board.map((v, i) => v === "" ? i : null).filter(v => v !== null);
    let bestMove;

    if (diff === "easy") {
        bestMove = available[Math.floor(Math.random() * available.length)];
    } else if (diff === "medium") {
        bestMove = Math.random() < 0.5 ? getBestMove() : available[Math.floor(Math.random() * available.length)];
    } else {
        bestMove = getBestMove();
    }

    board[bestMove] = "O";
    updateCell(bestMove, "O");

    if (checkWin("O")) {
        document.getElementById("ttt-status").innerText = "Carl Wins!";
        document.getElementById("ttt-status").style.color = "#ef4444";
    } else if (!board.includes("")) {
        document.getElementById("ttt-status").innerText = "It's a Draw!";
    } else {
        playerTurn = true;
        document.getElementById("ttt-status").innerText = "Your Turn (X)";
    }
}

function getBestMove() {
    for (let combo of winCombos) {
        let values = combo.map(i => board[i]);
        if (values.filter(v => v === "O").length === 2 && values.includes("")) return combo[values.indexOf("")];
    }
    for (let combo of winCombos) {
        let values = combo.map(i => board[i]);
        if (values.filter(v => v === "X").length === 2 && values.includes("")) return combo[values.indexOf("")];
    }
    if (board[4] === "") return 4;
    let available = board.map((v, i) => v === "" ? i : null).filter(v => v !== null);
    return available[Math.floor(Math.random() * available.length)];
}

function checkWin(player) {
    return winCombos.some(combo => combo.every(i => board[i] === player));
}

// --- GAME 4: HANGMAN ---
let hmWord = "";
let hmGuessed = new Set();
let hmMistakes = 0;
let hmPlayerTurn = true;
let hmGameOver = false;

const safeDictionary = [
    "ROBLOX", "MINECRAFT", "DEVELOPER", "PYTHON", "KEYBOARD", "MONITOR", 
    "VARIABLE", "FUNCTION", "BLENDER", "UNITY", "GODOT", "SCRIPTING",
    "ANIMATION", "TEXTURE", "PHYSICS", "CANVA", "FIGMA", "INTERFACE",
    "SURVIVAL", "MULTIPLAYER", "SERVER", "BEDROCK", "ARENA", "ISLAND",
    "ORAVON", "SCRAPWAGON", "HAVOC", "CARLAI", "DESKTOP", "COMPANION",
    "ELEPHANT", "GIRAFFE", "KANGAROO", "DOLPHIN", "PENGUIN", "CHEETAH",
    "VOLCANO", "TORNADO", "AVALANCHE", "GALAXY", "ASTEROID", "UNIVERSE",
    "BACKPACK", "TELESCOPE", "MICROSCOPE", "COMPASS", "TREASURE", "PYRAMID",
    "GUITAR", "PIANO", "BICYCLE", "SKATEBOARD", "HELICOPTER", "SPACESHIP"
];

function initHangman() {
    document.getElementById("hm-status").innerText = "Loading word...";
    document.getElementById("hm-status").style.color = "#888";
    hmWord = "";
    hmGuessed.clear();
    hmMistakes = 0;
    hmPlayerTurn = true;
    hmGameOver = false;
    
    for(let i=1; i<=6; i++) {
        const part = document.getElementById(`hm-part-${i}`);
        if (part) part.style.display = "none";
    }
    document.querySelectorAll(".hm-key").forEach(btn => {
        btn.className = "hm-key";
        btn.disabled = false;
    });

    hmWord = safeDictionary[Math.floor(Math.random() * safeDictionary.length)].toUpperCase();
    document.getElementById("hm-status").innerText = "Your Turn";
    document.getElementById("hm-status").style.color = "#fff";
    updateHmWordDisplay();
}

function updateHmWordDisplay() {
    let display = hmWord.split('').map(c => hmGuessed.has(c) ? c : "_").join(' ');
    document.getElementById("hm-word").innerText = display;
}

function hmGuess(letter) {
    if (hmGameOver || hmGuessed.has(letter)) return;
    
    hmGuessed.add(letter);
    const btn = Array.from(document.querySelectorAll('.hm-key')).find(b => b.innerText === letter);
    if (btn) btn.disabled = true;

    if (hmWord.includes(letter)) {
        if (btn) btn.classList.add("correct");
        updateHmWordDisplay();
        
        if (hmWord.split('').every(c => hmGuessed.has(c))) {
            hmGameOver = true;
            document.getElementById("hm-status").innerText = hmPlayerTurn ? "You Win!" : "Carl Wins!";
            document.getElementById("hm-status").style.color = "#84cc16";
            return;
        }
        if (!hmPlayerTurn) {
            document.getElementById("hm-status").innerText = "Carl is thinking...";
            setTimeout(carlHmMove, 1000);
        }
    } else {
        if (btn) btn.classList.add("wrong");
        hmMistakes++;
        const part = document.getElementById(`hm-part-${hmMistakes}`);
        if (part) part.style.display = "block";
        
        if (hmMistakes >= 6) {
            hmGameOver = true;
            document.getElementById("hm-status").innerText = "Game Over!";
            document.getElementById("hm-status").style.color = "#ef4444";
            document.getElementById("hm-word").innerText = hmWord.split('').join(' ');
            return;
        }

        hmPlayerTurn = !hmPlayerTurn;
        if (!hmPlayerTurn) {
            document.getElementById("hm-status").innerText = "Carl is thinking...";
            document.getElementById("hm-status").style.color = "#9333ea";
            setTimeout(carlHmMove, 1000);
        } else {
            document.getElementById("hm-status").innerText = "Your Turn";
            document.getElementById("hm-status").style.color = "#fff";
        }
    }
}

function carlHmMove() {
    if (hmGameOver) return;
    const available = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('').filter(c => !hmGuessed.has(c));
    const correctLeft = hmWord.split('').filter(c => !hmGuessed.has(c));
    let guess = null;
    let diff = getDifficulty();
    
    if (diff === "easy") {
        if (available.length > 0) guess = available[Math.floor(Math.random() * available.length)];
    } else if (diff === "medium") {
        let roll = Math.random();
        if (roll < 0.50 && correctLeft.length > 0) guess = correctLeft[Math.floor(Math.random() * correctLeft.length)];
        else {
            const common = "EARIOTNSLCUDPMHGBFYWKVXZJQ".split('').filter(c => available.includes(c));
            if (common.length > 0) guess = common[0];
            else if (available.length > 0) guess = available[Math.floor(Math.random() * available.length)];
        }
    } else {
        let roll = Math.random();
        if (roll < 0.85 && correctLeft.length > 0) guess = correctLeft[Math.floor(Math.random() * correctLeft.length)];
        else {
            const common = "EARIOTNSLCUDPMHGBFYWKVXZJQ".split('').filter(c => available.includes(c));
            if (common.length > 0) guess = common[0];
            else if (available.length > 0) guess = available[Math.floor(Math.random() * available.length)];
        }
    }

    if (guess) hmGuess(guess);
}

// --- GAME 5: CONNECT FOUR ---
const C4_ROWS = 6;
const C4_COLS = 7;
let c4Board = [];
let c4PlayerTurn = true;
let c4GameOver = false;

function initConnectFour() {
    c4Board = Array(C4_ROWS).fill().map(() => Array(C4_COLS).fill(0));
    c4PlayerTurn = true;
    c4GameOver = false;
    document.getElementById("c4-status").innerText = "Your Turn (Red)";
    document.getElementById("c4-status").style.color = "#fff";
    
    const boardDiv = document.getElementById("c4-board");
    boardDiv.innerHTML = "";
    
    for (let r = 0; r < C4_ROWS; r++) {
        for (let c = 0; c < C4_COLS; c++) {
            const cell = document.createElement("div");
            cell.className = "c4-cell";
            cell.id = `c4-${r}-${c}`;
            boardDiv.appendChild(cell);
        }
    }
}

function c4HandleClick(col) {
    if (!c4PlayerTurn || c4GameOver) return;
    let row = c4DropPiece(col, 1);
    if (row !== -1) {
        c4UpdateBoardUI();
        if (c4CheckWin(1)) {
            c4GameOver = true;
            document.getElementById("c4-status").innerText = "You Win!";
            document.getElementById("c4-status").style.color = "#ff4757";
            return;
        } else if (c4IsBoardFull()) {
            c4GameOver = true;
            document.getElementById("c4-status").innerText = "It's a Draw!";
            return;
        }
        c4PlayerTurn = false;
        document.getElementById("c4-status").innerText = "Carl is thinking...";
        document.getElementById("c4-status").style.color = "#eccc68";
        setTimeout(c4CarlMove, 600);
    }
}

function c4DropPiece(col, player) {
    for (let r = C4_ROWS - 1; r >= 0; r--) {
        if (c4Board[r][col] === 0) { c4Board[r][col] = player; return r; }
    }
    return -1;
}

function c4GetNextOpenRow(col) {
    for (let r = C4_ROWS - 1; r >= 0; r--) {
        if (c4Board[r][col] === 0) return r;
    }
    return -1;
}

function c4IsBoardFull() { return c4Board[0].every(val => val !== 0); }

function c4CheckWin(p) {
    for (let r = 0; r < C4_ROWS; r++) {
        for (let c = 0; c < C4_COLS - 3; c++) {
            if (c4Board[r][c] == p && c4Board[r][c+1] == p && c4Board[r][c+2] == p && c4Board[r][c+3] == p) return true;
        }
    }
    for (let r = 0; r < C4_ROWS - 3; r++) {
        for (let c = 0; c < C4_COLS; c++) {
            if (c4Board[r][c] == p && c4Board[r+1][c] == p && c4Board[r+2][c] == p && c4Board[r+3][c] == p) return true;
        }
    }
    for (let r = 3; r < C4_ROWS; r++) {
        for (let c = 0; c < C4_COLS - 3; c++) {
            if (c4Board[r][c] == p && c4Board[r-1][c+1] == p && c4Board[r-2][c+2] == p && c4Board[r-3][c+3] == p) return true;
        }
    }
    for (let r = 0; r < C4_ROWS - 3; r++) {
        for (let c = 0; c < C4_COLS - 3; c++) {
            if (c4Board[r][c] == p && c4Board[r+1][c+1] == p && c4Board[r+2][c+2] == p && c4Board[r+3][c+3] == p) return true;
        }
    }
    return false;
}

function c4CarlMove() {
    if (c4GameOver) return;
    let validCols = [];
    for (let c = 0; c < C4_COLS; c++) { if (c4Board[0][c] === 0) validCols.push(c); }
    if (validCols.length === 0) return;

    let diff = getDifficulty();
    let chosenCol = null;

    if (diff === "easy") {
        chosenCol = validCols[Math.floor(Math.random() * validCols.length)];
    } else {
        for (let c of validCols) {
            let r = c4GetNextOpenRow(c);
            c4Board[r][c] = 2;
            if (c4CheckWin(2)) { chosenCol = c; c4Board[r][c] = 0; break; }
            c4Board[r][c] = 0;
        }

        if (chosenCol === null && diff === "hard") {
            for (let c of validCols) {
                let r = c4GetNextOpenRow(c);
                c4Board[r][c] = 1;
                if (c4CheckWin(1)) { chosenCol = c; c4Board[r][c] = 0; break; }
                c4Board[r][c] = 0;
            }
        }

        if (chosenCol === null && diff === "medium") {
            if (Math.random() < 0.5) {
                for (let c of validCols) {
                    let r = c4GetNextOpenRow(c);
                    c4Board[r][c] = 1;
                    if (c4CheckWin(1)) { chosenCol = c; c4Board[r][c] = 0; break; }
                    c4Board[r][c] = 0;
                }
            }
        }

        if (chosenCol === null) {
            let pref = [3, 2, 4, 1, 5, 0, 6];
            for (let c of pref) { if (validCols.includes(c)) { chosenCol = c; break; } }
        }
    }

    if (chosenCol === null) chosenCol = validCols[Math.floor(Math.random() * validCols.length)];

    c4DropPiece(chosenCol, 2);
    c4UpdateBoardUI();

    if (c4CheckWin(2)) {
        c4GameOver = true;
        document.getElementById("c4-status").innerText = "Carl Wins!";
        document.getElementById("c4-status").style.color = "#eccc68";
    } else if (c4IsBoardFull()) {
        c4GameOver = true;
        document.getElementById("c4-status").innerText = "It's a Draw!";
    } else {
        c4PlayerTurn = true;
        document.getElementById("c4-status").innerText = "Your Turn (Red)";
        document.getElementById("c4-status").style.color = "#fff";
    }
}

function c4UpdateBoardUI() {
    for (let r = 0; r < C4_ROWS; r++) {
        for (let c = 0; c < C4_COLS; c++) {
            const cell = document.getElementById(`c4-${r}-${c}`);
            if (cell) {
                let val = c4Board[r][c];
                if (val === 1) cell.className = "c4-cell red";
                else if (val === 2) cell.className = "c4-cell yellow";
                else cell.className = "c4-cell";
            }
        }
    }
}

// --- GAME 6: BATTLESHIP ---
const BS_SIZE = 6;
let bsPlayerGrid = [];
let bsEnemyGrid = [];
let bsEnemyShips = [];
let bsPlayerTurn = true;
let bsGameOver = false;

let bsPlacing = true;
let bsShipSizes = [4, 3, 2];
let bsCurrentShipIndex = 0;
let bsIsHorizontal = true;
let bsPreviewOrigin = null;
let bsPreviewCoords = [];

function initBattleship() {
    bsPlayerGrid = Array(BS_SIZE).fill().map(() => Array(BS_SIZE).fill(0));
    bsEnemyGrid = Array(BS_SIZE).fill().map(() => Array(BS_SIZE).fill(0));
    bsEnemyShips = [];
    bsPlayerTurn = true;
    bsGameOver = false;
    
    bsPlacing = true;
    bsShipSizes = [4, 3, 2];
    bsCurrentShipIndex = 0;
    bsIsHorizontal = true;
    bsPreviewOrigin = null;
    bsPreviewCoords = [];

    document.getElementById("bs-status").innerText = `Place your ${bsShipSizes[bsCurrentShipIndex]}-length ship`;
    document.getElementById("bs-status").style.color = "#fff";
    document.getElementById("bs-placement-controls").style.display = "flex";
    document.getElementById("bs-enemy-label").style.display = "none";
    document.getElementById("bs-enemy-grid").style.display = "none";
    document.getElementById("bs-player-label").innerText = "Your Fleet (Select position below)";

    bsPlaceEnemyShipsRandomly();
    bsUpdateBoardsUI();
}

function bsToggleRotate() {
    bsIsHorizontal = !bsIsHorizontal;
    const btn = document.querySelector("#bs-placement-controls .bs-action-btn");
    if (btn) {
        btn.innerText = `Rotate: ${bsIsHorizontal ? "Horizontal" : "Vertical"}`;
    }

    if (bsPreviewOrigin) {
        bsPreviewCoords = bsCalculatePreview(bsPreviewOrigin.r, bsPreviewOrigin.c);
    }
    bsUpdateBoardsUI();
}

function bsPlaceEnemyShipsRandomly() {
    const shipSizes = [4, 3, 2];
    for (let size of shipSizes) {
        let placed = false;
        while (!placed) {
            let horizontal = Math.random() < 0.5;
            let r = Math.floor(Math.random() * BS_SIZE);
            let c = Math.floor(Math.random() * BS_SIZE);
            let fits = true;
            let tempCoords = [];
            for (let i = 0; i < size; i++) {
                let nr = horizontal ? r : r + i;
                let nc = horizontal ? c + i : c;
                if (nr >= BS_SIZE || nc >= BS_SIZE) { fits = false; break; }
                tempCoords.push(`${nr},${nc}`);
            }
            if (fits) {
                if (tempCoords.some(coord => bsEnemyShips.includes(coord))) continue;
                tempCoords.forEach(coord => bsEnemyShips.push(coord));
                placed = true;
            }
        }
    }
}

function bsCalculatePreview(r, c) {
    let size = bsShipSizes[bsCurrentShipIndex];
    let coords = [];
    let fits = true;

    for (let i = 0; i < size; i++) {
        let nr = bsIsHorizontal ? r : r + i;
        let nc = bsIsHorizontal ? c + i : c;
        if (nr >= BS_SIZE || nc >= BS_SIZE) { fits = false; break; }
        coords.push({r: nr, c: nc});
    }

    if (!fits) return [];

    for (let coord of coords) {
        if (bsPlayerGrid[coord.r][coord.c] === 1) return [];
    }
    return coords;
}

function bsCellClick(r, c) {
    if (bsGameOver) return;

    if (bsPlacing) {
        let coords = bsCalculatePreview(r, c);
        if (coords.length > 0) {
            bsPreviewOrigin = { r, c };
            bsPreviewCoords = coords;
        } else {
            bsPreviewOrigin = null;
            bsPreviewCoords = [];
        }
        bsUpdateBoardsUI();
    }
}

function bsConfirmPlacement() {
    if (!bsPlacing) return;

    if (bsPreviewCoords.length === 0) {
        alert("Please tap a valid spot on the grid to position your ship first!");
        return;
    }

    bsPreviewCoords.forEach(coord => {
        bsPlayerGrid[coord.r][coord.c] = 1;
    });

    bsPreviewOrigin = null;
    bsPreviewCoords = [];
    bsCurrentShipIndex++;

    if (bsCurrentShipIndex < bsShipSizes.length) {
        document.getElementById("bs-status").innerText = `Place your ${bsShipSizes[bsCurrentShipIndex]}-length ship`;
    } else {
        bsPlacing = false;
        document.getElementById("bs-placement-controls").style.display = "none";
        document.getElementById("bs-enemy-label").style.display = "block";
        document.getElementById("bs-enemy-grid").style.display = "grid";
        document.getElementById("bs-player-label").innerText = "Your Fleet";
        document.getElementById("bs-status").innerText = "Your Turn - Fire!";
    }
    bsUpdateBoardsUI();
}

function bsFire(r, c) {
    if (bsPlacing || !bsPlayerTurn || bsGameOver) return;
    if (bsEnemyGrid[r][c] !== 0) return;

    let targetCoord = `${r},${c}`;
    let isHit = bsEnemyShips.includes(targetCoord);

    if (isHit) {
        bsEnemyGrid[r][c] = 3;
        document.getElementById("bs-status").innerText = "Direct Hit! Fire Again!";
        document.getElementById("bs-status").style.color = "#84cc16";
    } else {
        bsEnemyGrid[r][c] = 2;
        document.getElementById("bs-status").innerText = "Miss!";
        document.getElementById("bs-status").style.color = "#ef4444";
    }

    bsUpdateBoardsUI();

    if (bsEnemyShips.every(coord => {
        let [tr,tc] = coord.split(',').map(Number);
        return bsEnemyGrid[tr][tc] === 3;
    })) {
        bsGameOver = true;
        document.getElementById("bs-status").innerText = "You Destroyed Carl's Fleet!";
        document.getElementById("bs-status").style.color = "#84cc16";
        return;
    }

    if (isHit) return;

    bsPlayerTurn = false;
    setTimeout(bsCarlTurn, 800);
}

function bsCarlTurn() {
    if (bsGameOver) return;
    document.getElementById("bs-status").innerText = "Carl is firing...";
    document.getElementById("bs-status").style.color = "#eccc68";

    setTimeout(() => {
        let r, c;
        do {
            r = Math.floor(Math.random() * BS_SIZE);
            c = Math.floor(Math.random() * BS_SIZE);
        } while (bsPlayerGrid[r][c] === 2 || bsPlayerGrid[r][c] === 3);

        let isHit = (bsPlayerGrid[r][c] === 1);

        if (isHit) {
            bsPlayerGrid[r][c] = 3;
            document.getElementById("bs-status").innerText = "Carl hit your ship and fires again!";
            document.getElementById("bs-status").style.color = "#ef4444";
        } else {
            bsPlayerGrid[r][c] = 2;
            document.getElementById("bs-status").innerText = "Carl missed! Your Turn - Fire!";
            document.getElementById("bs-status").style.color = "#fff";
        }

        bsUpdateBoardsUI();

        let playerLost = true;
        for (let row = 0; row < BS_SIZE; row++) {
            for (let col = 0; col < BS_SIZE; col++) {
                if (bsPlayerGrid[row][col] === 1) playerLost = false;
            }
        }

        if (playerLost) {
            bsGameOver = true;
            document.getElementById("bs-status").innerText = "Carl Destroyed Your Fleet!";
            document.getElementById("bs-status").style.color = "#ef4444";
        } else if (isHit) {
            setTimeout(bsCarlTurn, 800);
        } else {
            bsPlayerTurn = true;
        }
    }, 600);
}

function bsUpdateBoardsUI() {
    const enemyDiv = document.getElementById("bs-enemy-grid");
    const playerDiv = document.getElementById("bs-player-grid");
    if (!enemyDiv || !playerDiv) return;

    enemyDiv.innerHTML = "";
    playerDiv.innerHTML = "";

    if (!bsPlacing) {
        for (let r = 0; r < BS_SIZE; r++) {
            for (let c = 0; c < BS_SIZE; c++) {
                const cell = document.createElement("div");
                cell.className = "bs-cell";
                let val = bsEnemyGrid[r][c];
                if (val === 2) { cell.classList.add("miss"); }
                else if (val === 3) { cell.classList.add("hit"); }
                cell.onclick = () => bsFire(r, c);
                enemyDiv.appendChild(cell);
            }
        }
    }

    for (let r = 0; r < BS_SIZE; r++) {
        for (let c = 0; c < BS_SIZE; c++) {
            const cell = document.createElement("div");
            cell.className = "bs-cell";
            let val = bsPlayerGrid[r][c];
            
            let isPreview = bsPreviewCoords.some(coord => coord.r === r && coord.c === c);

            if (val === 1) { cell.classList.add("ship"); }
            else if (val === 2) { cell.classList.add("miss"); }
            else if (val === 3) { cell.classList.add("hit"); }
            else if (isPreview) { cell.classList.add("preview"); }

            if (bsPlacing) {
                cell.onclick = () => bsCellClick(r, c);
            }
            playerDiv.appendChild(cell);
        }
    }
}

// --- GAME 7: CHECKERS ---
const CHK_SIZE = 8;
let chkBoard = [];
let chkSelected = null;
let chkValidMoves = [];
let chkPlayerTurn = true;
let chkGameOver = false;

function initCheckers() {
    chkBoard = Array(CHK_SIZE).fill().map(() => Array(CHK_SIZE).fill(0));
    chkSelected = null;
    chkValidMoves = [];
    chkPlayerTurn = true;
    chkGameOver = false;

    document.getElementById("chk-status").innerText = "Your Turn (Red)";
    document.getElementById("chk-status").style.color = "#fff";

    for (let r = 0; r < CHK_SIZE; r++) {
        for (let c = 0; c < CHK_SIZE; c++) {
            if ((r + c) % 2 === 1) {
                if (r < 3) chkBoard[r][c] = 2;
                else if (r > 4) chkBoard[r][c] = 1;
            }
        }
    }

    chkRenderBoard();
}

function chkRenderBoard() {
    const boardDiv = document.getElementById("chk-board");
    if (!boardDiv) return;
    boardDiv.innerHTML = "";

    for (let r = 0; r < CHK_SIZE; r++) {
        for (let c = 0; c < CHK_SIZE; c++) {
            const tile = document.createElement("div");
            let isDark = (r + c) % 2 === 1;
            tile.className = `chk-tile ${isDark ? "dark" : "light"}`;
            
            let pieceVal = chkBoard[r][c];
            
            if (chkSelected && chkSelected.r === r && chkSelected.c === c) {
                tile.classList.add("selected");
            }

            let moveObj = chkValidMoves.find(m => m.toR === r && m.toC === c);
            if (moveObj) {
                tile.classList.add("target");
            }

            let isJumped = chkValidMoves.some(m => m.isJump && m.jumpedR === r && m.jumpedC === c);
            if (isJumped) {
                tile.classList.add("jump-capture");
            }

            if (pieceVal !== 0) {
                const piece = document.createElement("div");
                let isRed = pieceVal === 1 || pieceVal === 11;
                let isKing = pieceVal === 11 || pieceVal === 22;
                piece.className = `chk-piece ${isRed ? "red" : "black"}`;
                
                if (isKing) {
                    piece.classList.add("king");
                }
                
                tile.appendChild(piece);
            }

            tile.onclick = () => chkTileClick(r, c);
            boardDiv.appendChild(tile);
        }
    }
}

function chkTileClick(r, c) {
    if (!chkPlayerTurn || chkGameOver) return;

    let pieceVal = chkBoard[r][c];
    let isPlayerPiece = pieceVal === 1 || pieceVal === 11;

    if (isPlayerPiece) {
        chkSelected = { r, c };
        chkValidMoves = chkGetMovesForPiece(r, c, chkBoard);
        chkRenderBoard();
        return;
    }

    if (chkSelected) {
        let move = chkValidMoves.find(m => m.toR === r && m.toC === c);
        if (move) {
            chkExecuteMove(move);
            chkSelected = null;
            chkValidMoves = [];
            chkRenderBoard();

            if (chkCheckWin(1)) {
                chkGameOver = true;
                document.getElementById("chk-status").innerText = "You Win!";
                document.getElementById("chk-status").style.color = "#84cc16";
                return;
            }

            chkPlayerTurn = false;
            document.getElementById("chk-status").innerText = "Carl is thinking...";
            document.getElementById("chk-status").style.color = "#9333ea";
            setTimeout(chkCarlTurn, 600);
        } else {
            chkSelected = null;
            chkValidMoves = [];
            chkRenderBoard();
        }
    }
}

function chkGetMovesForPiece(r, c, boardState) {
    let p = boardState[r][c];
    if (p === 0) return [];

    let isRed = p === 1 || p === 11;
    let isKing = p === 11 || p === 22;
    let moves = [];

    let dirs = [];
    if (isRed || isKing) dirs.push([-1, -1], [-1, 1]);
    if (!isRed || isKing) dirs.push([1, -1], [1, 1]);

    for (let [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;

        if (nr >= 0 && nr < CHK_SIZE && nc >= 0 && nc < CHK_SIZE) {
            if (boardState[nr][nc] === 0) {
                moves.push({ fromR: r, fromC: c, toR: nr, toC: nc, isJump: false });
            } else {
                let opp = boardState[nr][nc];
                let isOpponent = isRed ? (opp === 2 || opp === 22) : (opp === 1 || opp === 11);
                
                if (isOpponent) {
                    let jR = r + 2 * dr;
                    let jC = c + 2 * dc;
                    if (jR >= 0 && jR < CHK_SIZE && jC >= 0 && jC < CHK_SIZE && boardState[jR][jC] === 0) {
                        moves.push({ fromR: r, fromC: c, toR: jR, toC: jC, isJump: true, jumpedR: nr, jumpedC: nc });
                    }
                }
            }
        }
    }
    return moves;
}

function chkExecuteMove(move) {
    let p = chkBoard[move.fromR][move.fromC];
    chkBoard[move.fromR][move.fromC] = 0;

    if (move.isJump) {
        chkBoard[move.jumpedR][move.jumpedC] = 0;
    }

    if (p === 1 && move.toR === 0) p = 11;
    if (p === 2 && move.toR === 7) p = 22;

    chkBoard[move.toR][move.toC] = p;
}

function chkCarlTurn() {
    if (chkGameOver) return;

    let diff = getDifficulty();
    let allMoves = [];
    for (let r = 0; r < CHK_SIZE; r++) {
        for (let c = 0; c < CHK_SIZE; c++) {
            let p = chkBoard[r][c];
            if (p === 2 || p === 22) {
                let moves = chkGetMovesForPiece(r, c, chkBoard);
                allMoves.push(...moves);
            }
        }
    }

    if (allMoves.length === 0) {
        chkGameOver = true;
        document.getElementById("chk-status").innerText = "Carl Has No Moves! You Win!";
        document.getElementById("chk-status").style.color = "#84cc16";
        return;
    }

    let jumps = allMoves.filter(m => m.isJump);
    let chosenMove = null;

    if (diff === "easy") {
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (diff === "medium") {
        if (jumps.length > 0 && Math.random() < 0.7) {
            chosenMove = jumps[Math.floor(Math.random() * jumps.length)];
        } else {
            chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }
    } else {
        if (jumps.length > 0) {
            chosenMove = jumps[Math.floor(Math.random() * jumps.length)];
        } else {
            let kingingMoves = allMoves.filter(m => m.toR === 7);
            if (kingingMoves.length > 0) {
                chosenMove = kingingMoves[Math.floor(Math.random() * kingingMoves.length)];
            } else {
                chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
            }
        }
    }

    chkExecuteMove(chosenMove);
    chkRenderBoard();

    if (chkCheckWin(2)) {
        chkGameOver = true;
        document.getElementById("chk-status").innerText = "Carl Wins!";
        document.getElementById("chk-status").style.color = "#ef4444";
        return;
    }

    chkPlayerTurn = true;
    document.getElementById("chk-status").innerText = "Your Turn (Red)";
    document.getElementById("chk-status").style.color = "#fff";
}

function chkCheckWin(player) {
    let enemyVal1 = player === 1 ? 2 : 1;
    let enemyVal2 = player === 1 ? 22 : 11;

    for (let r = 0; r < CHK_SIZE; r++) {
        for (let c = 0; c < CHK_SIZE; c++) {
            let p = chkBoard[r][c];
            if (p === enemyVal1 || p === enemyVal2) return false;
        }
    }
    return true;
}

// --- GAME 8: CHESS ---
const CHS_SIZE = 8;
let chsBoard = [];
let chsSelected = null;
let chsValidMoves = [];
let chsPlayerTurn = true;
let chsGameOver = false;

const chsInitialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

const chsIcons = {
    'P': '/static/icons/PawnWhite.png',
    'R': '/static/icons/RookWhite.png',
    'N': '/static/icons/HorseWhite.png',
    'B': '/static/icons/BishopWhite.png',
    'Q': '/static/icons/QueenWhite.png',
    'K': '/static/icons/KingWhite.png',
    'p': '/static/icons/PawnBlack.png',
    'r': '/static/icons/RookBlack.png',
    'n': '/static/icons/HorseBlack.png',
    'b': '/static/icons/BishopBlack.png',
    'q': '/static/icons/QueenBlack.png',
    'k': '/static/icons/KingBlack.png'
};

function initChess() {
    chsBoard = JSON.parse(JSON.stringify(chsInitialBoard));
    chsSelected = null;
    chsValidMoves = [];
    chsPlayerTurn = true;
    chsGameOver = false;

    document.getElementById("chs-status").innerText = "Your Turn (White)";
    document.getElementById("chs-status").style.color = "#fff";

    chsRenderBoard();
}

function chsRenderBoard() {
    const boardDiv = document.getElementById("chs-board");
    if (!boardDiv) return;
    boardDiv.innerHTML = "";

    for (let r = 0; r < CHS_SIZE; r++) {
        for (let c = 0; c < CHS_SIZE; c++) {
            const tile = document.createElement("div");
            let isDark = (r + c) % 2 === 1;
            tile.className = `chs-tile ${isDark ? "dark" : "light"}`;
            
            let p = chsBoard[r][c];
            
            if (chsSelected && chsSelected.r === r && chsSelected.c === c) {
                tile.classList.add("selected");
            }

            let moveObj = chsValidMoves.find(m => m.r === r && m.c === c);
            if (moveObj) {
                if (p !== '') {
                    tile.classList.add("target-capture");
                } else {
                    tile.classList.add("target");
                }
            }

            if (p !== '') {
                const piece = document.createElement("img");
                piece.className = "chs-piece";
                piece.src = chsIcons[p];
                tile.appendChild(piece);
            }

            tile.onclick = () => chsTileClick(r, c);
            boardDiv.appendChild(tile);
        }
    }
}

function chsGetMoves(r, c, board) {
    let p = board[r][c];
    if (p === '') return [];
    
    let isPlayer = /^[A-Z]$/.test(p);
    let piece = p.toLowerCase();
    let moves = [];

    function addMove(nr, nc) {
        if (nr < 0 || nr >= CHS_SIZE || nc < 0 || nc >= CHS_SIZE) return false;
        let target = board[nr][nc];
        if (target === '') {
            moves.push({r: nr, c: nc});
            return true;
        }
        let targetIsPlayer = /^[A-Z]$/.test(target);
        if (isPlayer !== targetIsPlayer) {
            moves.push({r: nr, c: nc});
        }
        return false;
    }

    if (piece === 'p') {
        let dir = isPlayer ? -1 : 1;
        let startRow = isPlayer ? 6 : 1;
        
        if (r+dir >= 0 && r+dir < CHS_SIZE && board[r+dir][c] === '') {
            moves.push({r: r+dir, c: c});
            if (r === startRow && board[r+2*dir][c] === '') {
                moves.push({r: r+2*dir, c: c});
            }
        }
        for (let dc of [-1, 1]) {
            let nc = c + dc;
            let nr = r + dir;
            if (nr >= 0 && nr < CHS_SIZE && nc >= 0 && nc < CHS_SIZE) {
                let target = board[nr][nc];
                if (target !== '' && (/^[A-Z]$/.test(target) !== isPlayer)) {
                    moves.push({r: nr, c: nc});
                }
            }
        }
    } else if (piece === 'r') {
        let dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (let [dr, dc] of dirs) {
            let nr=r, nc=c;
            while(true) { nr+=dr; nc+=dc; if(!addMove(nr,nc)) break; }
        }
    } else if (piece === 'b') {
        let dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        for (let [dr, dc] of dirs) {
            let nr=r, nc=c;
            while(true) { nr+=dr; nc+=dc; if(!addMove(nr,nc)) break; }
        }
    } else if (piece === 'q') {
        let dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
        for (let [dr, dc] of dirs) {
            let nr=r, nc=c;
            while(true) { nr+=dr; nc+=dc; if(!addMove(nr,nc)) break; }
        }
    } else if (piece === 'n') {
        let jumps = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
        for (let [dr, dc] of jumps) addMove(r+dr, c+dc);
    } else if (piece === 'k') {
        let dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
        for (let [dr, dc] of dirs) addMove(r+dr, c+dc);
    }

    return moves;
}

function chsTileClick(r, c) {
    if (!chsPlayerTurn || chsGameOver) return;

    let p = chsBoard[r][c];
    let isPlayerPiece = /^[A-Z]$/.test(p);

    if (isPlayerPiece) {
        chsSelected = { r, c };
        chsValidMoves = chsGetMoves(r, c, chsBoard);
        chsRenderBoard();
        return;
    }

    if (chsSelected) {
        let move = chsValidMoves.find(m => m.r === r && m.c === c);
        if (move) {
            chsExecuteMove(chsSelected.r, chsSelected.c, move.r, move.c);
            
            if (chsGameOver) { chsRenderBoard(); return; }

            chsSelected = null;
            chsValidMoves = [];
            chsRenderBoard();

            chsPlayerTurn = false;
            document.getElementById("chs-status").innerText = "Carl is thinking...";
            document.getElementById("chs-status").style.color = "#9333ea";
            setTimeout(chsCarlTurn, 800);
        } else {
            chsSelected = null;
            chsValidMoves = [];
            chsRenderBoard();
        }
    }
}

function chsExecuteMove(fromR, fromC, toR, toC) {
    let piece = chsBoard[fromR][fromC];
    let target = chsBoard[toR][toC];
    
    if (target === 'k') {
        chsGameOver = true;
        document.getElementById("chs-status").innerText = "Checkmate! You Win!";
        document.getElementById("chs-status").style.color = "#84cc16";
    } else if (target === 'K') {
        chsGameOver = true;
        document.getElementById("chs-status").innerText = "Checkmate! Carl Wins!";
        document.getElementById("chs-status").style.color = "#ef4444";
    }

    if (piece === 'P' && toR === 0) piece = 'Q';
    if (piece === 'p' && toR === 7) piece = 'q';

    chsBoard[toR][toC] = piece;
    chsBoard[fromR][fromC] = '';
}

function chsCarlTurn() {
    if (chsGameOver) return;

    let diff = getDifficulty();
    let allMoves = [];
    const values = {'p':1, 'n':3, 'b':3, 'r':5, 'q':9, 'k':100, 'P':1, 'N':3, 'B':3, 'R':5, 'Q':9, 'K':100};

    for (let r = 0; r < CHS_SIZE; r++) {
        for (let c = 0; c < CHS_SIZE; c++) {
            if (/^[a-z]$/.test(chsBoard[r][c])) {
                let moves = chsGetMoves(r, c, chsBoard);
                for (let m of moves) {
                    let target = chsBoard[m.r][m.c];
                    let score = target === '' ? 0 : values[target];
                    allMoves.push({ fr: r, fc: c, tr: m.r, tc: m.c, score: score });
                }
            }
        }
    }

    if (allMoves.length === 0) {
        chsGameOver = true;
        document.getElementById("chs-status").innerText = "Stalemate!";
        return;
    }

    let chosenMove;
    if (diff === "easy") {
        chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
    } else if (diff === "medium") {
        allMoves.sort((a, b) => b.score - a.score);
        if (Math.random() < 0.6) {
            let bestScore = allMoves[0].score;
            let bestMoves = allMoves.filter(m => m.score === bestScore);
            chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        } else {
            chosenMove = allMoves[Math.floor(Math.random() * allMoves.length)];
        }
    } else {
        allMoves.sort((a, b) => b.score - a.score);
        let bestScore = allMoves[0].score;
        let bestMoves = allMoves.filter(m => m.score === bestScore);
        chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    chsExecuteMove(chosenMove.fr, chosenMove.fc, chosenMove.tr, chosenMove.tc);
    chsRenderBoard();

    if (!chsGameOver) {
        chsPlayerTurn = true;
        document.getElementById("chs-status").innerText = "Your Turn (White)";
        document.getElementById("chs-status").style.color = "#fff";
    }
}