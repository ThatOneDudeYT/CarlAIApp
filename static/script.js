// =========================================================================
// --- FIREBASE CLOUD PERSISTENCE & GLOBAL STATE ---
// =========================================================================

const firebaseConfig = {
    apiKey: "AIzaSyB6q-h3daznHtyF3tVoQh1W38hNiD7qqGg",
    authDomain: "carl-ai-loggins.firebaseapp.com",
    projectId: "carl-ai-loggins",
    storageBucket: "carl-ai-loggins.firebasestorage.app",
    messagingSenderId: "372926140822",
    appId: "1:372926140822:web:4bf13c6dd802cbc047cdb7",
    measurementId: "G-G4H60BZHT3"
};

// Initialize Firebase Compat
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let firebaseUserId = null;
let currentUser = null;
let currentUserAvatar = "/static/icons/default-avatar.png";
let customApiKey = "";

let chatsHistory = []; 
let activeChatId = null;
let chatHistory = [];  

let selectedGame = "Tic Tac Toe";
let pendingImageBase64 = null;
let pendingImageMime = null;
let pendingImageSrc = null;

let drawzeeBestTime = parseFloat(localStorage.getItem("drawzee_best_time") || "999999");

function hasValidApiKey() {
    return customApiKey && customApiKey.trim().length > 20;
}

window.addEventListener("DOMContentLoaded", () => {
    initMobileNavIcons();
    updateDrawzeeBestDisplay();

    if (!document.getElementById("mobile-hamburger-btn")) {
        const hamburgerBtn = document.createElement("button");
        hamburgerBtn.id = "mobile-hamburger-btn";
        hamburgerBtn.className = "mobile-top-header";
        hamburgerBtn.innerHTML = `
            <div class="hamburger-line"></div>
            <div class="hamburger-line"></div>
            <div class="hamburger-line"></div>
        `;
        hamburgerBtn.onclick = toggleMobileSidebar; 
        document.body.appendChild(hamburgerBtn);
    }

    if (!document.getElementById("sidebar-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "sidebar-overlay";
        overlay.className = "sidebar-overlay";
        overlay.onclick = toggleMobileSidebar;
        document.body.appendChild(overlay);
    }
});

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.desktop-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

// --- AUTHENTICATION LISTENER ---
auth.onAuthStateChanged(async (user) => {
    const overlay = document.getElementById('auth-overlay');
    if (user) {
        firebaseUserId = user.uid;
        currentUser = user.displayName || user.email.split('@')[0];
        currentUserAvatar = user.photoURL || "/static/icons/default-avatar.png";
        
        if (overlay) overlay.classList.add('hidden');
        await loadUserDataFromCloud();
    } else {
        firebaseUserId = null;
        if (overlay) overlay.classList.remove('hidden');
    }
});

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        alert("Google Sign-In Error: " + error.message);
    });
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value;
    
    auth.signInWithEmailAndPassword(email, pass).catch(error => {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
            auth.createUserWithEmailAndPassword(email, pass).catch(err => {
                alert("Sign In / Sign Up Error: " + err.message);
            });
        } else {
            alert(error.message);
        }
    });
}

function handleSignOut() {
    auth.signOut().then(() => {
        currentUser = null;
        currentUserAvatar = "/static/icons/default-avatar.png";
        customApiKey = "";
        chatsHistory = [];
        chatHistory = [];
        activeChatId = null;
        
        updateProfileUI();
        renderChatHistorySidebar();
        switchView('view-chat');
    });
}

// --- CLOUD DATABASE FUNCTIONS ---
async function loadUserDataFromCloud() {
    if (!firebaseUserId) return;
    
    try {
        const docRef = db.collection("users").doc(firebaseUserId);
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            customApiKey = data.apiKey || "";
            chatsHistory = data.chats || [];
            activeChatId = data.activeChatId || null;
            applyTheme(data.theme || "dark");
            if (data.avatar) currentUserAvatar = data.avatar;
            if (data.username) currentUser = data.username;
            if (data.drawzeeBestTime && data.drawzeeBestTime < drawzeeBestTime) {
                drawzeeBestTime = data.drawzeeBestTime;
                localStorage.setItem("drawzee_best_time", drawzeeBestTime.toString());
                updateDrawzeeBestDisplay();
            }
        } else {
            startNewChat();
        }
        
        updateProfileUI();
        const keyInput = document.getElementById('user-api-key');
        if (keyInput) keyInput.value = customApiKey;
        const usernameInput = document.getElementById('settings-username-input');
        if (usernameInput) usernameInput.value = currentUser;
        
        renderChatHistorySidebar();
        
        if (activeChatId && chatsHistory.some(c => c.id === activeChatId)) {
            loadChat(activeChatId);
        } else if (chatsHistory.length === 0) {
            startNewChat();
        }
    } catch (e) {
        console.error("Error loading cloud data:", e);
    }
}

function saveSessionData() {
    if (!firebaseUserId) return;
    
    db.collection("users").doc(firebaseUserId).set({
        apiKey: customApiKey,
        chats: chatsHistory,
        activeChatId: activeChatId,
        theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
        avatar: currentUserAvatar,
        username: currentUser,
        drawzeeBestTime: drawzeeBestTime < 999999 ? drawzeeBestTime : null
    }, { merge: true }).catch(e => console.error("Error saving data:", e));
}

// =========================================================================
// --- USER PROFILE & SETTINGS TAB CONTROLS ---
// =========================================================================

function applyTheme(theme) {
    const body = document.body;
    const themeSwitch = document.getElementById('theme-toggle-switch');
    if (theme === "light") {
        body.classList.remove("dark-mode");
        body.classList.add("light-mode");
        if (themeSwitch) themeSwitch.checked = true;
    } else {
        body.classList.remove("light-mode");
        body.classList.add("dark-mode");
        if (themeSwitch) themeSwitch.checked = false;
    }
}

function toggleTheme() {
    const body = document.body;
    const themeSwitch = document.getElementById('theme-toggle-switch');
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        if (themeSwitch) themeSwitch.checked = true;
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        if (themeSwitch) themeSwitch.checked = false;
    }
    saveSessionData();
}

function updateProfileUI() {
    const avatarEl = document.getElementById("header-user-avatar");
    const nameEl = document.getElementById("header-user-name");

    if (avatarEl) avatarEl.src = currentUserAvatar;
    if (nameEl) nameEl.innerText = currentUser || "Guest";
}

function updateUsernameFromSettings() {
    const input = document.getElementById("settings-username-input");
    if (!input || !currentUser) return;
    
    const newName = input.value.trim();
    if (newName.length >= 3 && newName.length <= 20) {
        currentUser = newName;
        updateProfileUI();
        saveSessionData();
    } else {
        alert("Username must be between 3 and 20 characters!");
        input.value = currentUser || "";
    }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        currentUserAvatar = e.target.result;
        updateProfileUI();
        saveSessionData();
    };
    reader.readAsDataURL(file);
}

function saveSettings() {
    const keyInput = document.getElementById('user-api-key');
    customApiKey = keyInput ? keyInput.value.trim() : "";
    
    const newPass = document.getElementById('settings-new-pass').value;
    const confirmPass = document.getElementById('settings-confirm-pass').value;
    
    if (newPass || confirmPass) {
        if (newPass === confirmPass) {
            auth.currentUser.updatePassword(newPass).then(() => {
                alert("Password updated successfully.");
                document.getElementById('settings-new-pass').value = "";
                document.getElementById('settings-confirm-pass').value = "";
            }).catch(error => alert(error.message));
        } else {
            alert("Passwords do not match!");
        }
    }
    
    saveSessionData();
}

function toggleApiKeyHelp() {
    const helpBox = document.getElementById('api-key-help-box');
    if (helpBox) {
        helpBox.classList.toggle('hidden');
    }
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

function getDifficulty() {
    const select = document.getElementById("difficulty-select");
    return select ? select.value : "medium";
}

function switchView(viewId) {
    if (viewId !== "view-drawzee" && typeof dzStopGame === "function") {
        dzStopGame();
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    const sidebar = document.querySelector('.desktop-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
    if (overlay && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
    }
}

function searchChats() {
    let oldModal = document.getElementById("search-modal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "search-modal";
    modal.style.position = "fixed";
    modal.style.top = "0"; modal.style.left = "0";
    modal.style.width = "100vw"; modal.style.height = "100vh";
    modal.style.backgroundColor = "rgba(0,0,0,0.85)";
    modal.style.backdropFilter = "blur(5px)";
    modal.style.zIndex = "10000";
    modal.style.display = "flex";
    modal.style.justifyContent = "center";
    modal.style.alignItems = "center";

    const box = document.createElement("div");
    box.style.backgroundColor = "var(--bg-card)";
    box.style.padding = "24px";
    box.style.borderRadius = "20px";
    box.style.width = "90%";
    box.style.maxWidth = "420px";
    box.style.border = "1px solid var(--border-color)";
    box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";

    const title = document.createElement("h2");
    title.innerText = "Search Chats";
    title.style.marginBottom = "16px";
    title.style.fontSize = "28px";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Search messages or titles...";
    input.style.width = "100%";
    input.style.padding = "14px";
    input.style.borderRadius = "12px";
    input.style.border = "1px solid var(--border-color)";
    input.style.backgroundColor = "var(--bg-input)";
    input.style.color = "var(--text-main)";
    input.style.outline = "none";
    input.style.fontSize = "16px";
    input.style.marginBottom = "16px";

    const results = document.createElement("div");
    results.style.maxHeight = "250px";
    results.style.overflowY = "auto";
    results.style.display = "flex";
    results.style.flexDirection = "column";
    results.style.gap = "8px";

    const closeBtn = document.createElement("button");
    closeBtn.innerText = "Close";
    closeBtn.style.padding = "12px";
    closeBtn.style.width = "100%";
    closeBtn.style.marginTop = "16px";
    closeBtn.style.borderRadius = "12px";
    closeBtn.style.border = "none";
    closeBtn.style.backgroundColor = "#ef4444";
    closeBtn.style.color = "#fff";
    closeBtn.style.fontSize = "18px";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => modal.remove();

    input.oninput = (e) => {
        results.innerHTML = "";
        const q = e.target.value.toLowerCase().trim();
        if (!q) return;

        const matched = chatsHistory.filter(c => 
            c.title.toLowerCase().includes(q) || 
            c.apiHistory.some(m => m.content.toLowerCase().includes(q))
        );
        
        if (matched.length === 0) {
            results.innerHTML = "<div style='color:var(--text-sub); font-size:15px; text-align:center; padding: 10px;'>No results found.</div>";
        }

        matched.forEach(chat => {
            const item = document.createElement("div");
            item.innerText = chat.title;
            item.style.padding = "14px";
            item.style.backgroundColor = "var(--bg-input)";
            item.style.border = "1px solid var(--border-color)";
            item.style.borderRadius = "12px";
            item.style.cursor = "pointer";
            item.style.transition = "background-color 0.2s";
            
            item.onmouseover = () => item.style.backgroundColor = "#9333ea";
            item.onmouseleave = () => item.style.backgroundColor = "var(--bg-input)";
            
            item.onclick = () => {
                loadChat(chat.id);
                modal.remove();
            };
            results.appendChild(item);
        });
    };

    box.appendChild(title);
    box.appendChild(input);
    box.appendChild(results);
    box.appendChild(closeBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);

    setTimeout(() => input.focus(), 100);
}

function initMobileNavIcons() {
    const mobileChatBtn = document.getElementById("mobile-nav-chat");
    const mobileCallBtn = document.getElementById("mobile-nav-call");
    const mobileGamesBtn = document.getElementById("mobile-nav-games");
    const mobileSettingsBtn = document.getElementById("mobile-nav-settings");

    if (mobileChatBtn) mobileChatBtn.onclick = () => startNewChat();
    if (mobileCallBtn) mobileCallBtn.onclick = () => startCall();
    if (mobileGamesBtn) mobileGamesBtn.onclick = () => switchView('view-games');
    if (mobileSettingsBtn) mobileSettingsBtn.onclick = () => switchView('view-settings');
}

// =========================================================================
// --- CHAT SESSION ARCHIVING & REAL API KEY LIMIT CHECK ---
// =========================================================================

function checkDailyMessageLimit() {
    const today = new Date().toISOString().split('T')[0];
    let lastDate = localStorage.getItem("carl_last_msg_date");
    let count = parseInt(localStorage.getItem("carl_msg_count") || "0", 10);

    if (lastDate !== today) {
        lastDate = today;
        count = 0;
        localStorage.setItem("carl_last_msg_date", today);
        localStorage.setItem("carl_msg_count", "0");
    }

    if (count >= 10 && !hasValidApiKey()) {
        alert("Daily limit reached! Free users are capped at 10 messages per day. Enter a valid Gemini API key in Settings to unlock unlimited chats!");
        switchView('view-settings');
        return false;
    }

    return true;
}

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
                apiHistory: [...chatHistory],
                pinned: false
            });
        }
    }
    saveSessionData();
    renderChatHistorySidebar();
}

function clearPendingImage() {
    pendingImageBase64 = null;
    pendingImageMime = null;
    pendingImageSrc = null;
    
    const filePicker = document.getElementById('native-file-picker');
    if (filePicker) filePicker.value = "";

    const box = document.getElementById('image-preview-box');
    if (box) box.classList.remove('active');
}

function startNewChat() {
    archiveActiveChat();
    activeChatId = "chat_" + Date.now();
    chatHistory = [];
    
    const log = document.getElementById("chat-log");
    if (log) log.innerHTML = '<div class="system-msg">Started a fresh session.</div>';
    
    const input = document.getElementById("user-input");
    if (input) input.value = "";
    
    clearPendingImage();
    
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
    
    const sortedChats = [...chatsHistory].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
    });
    
    sortedChats.forEach(chat => {
        const item = document.createElement("div");
        item.className = "saved-chat-item";
        
        const titleContainer = document.createElement("div");
        titleContainer.className = "chat-title-text";
        
        if (chat.pinned) {
            const pinIcon = document.createElement("img");
            pinIcon.className = "pinned-icon-img";
            pinIcon.src = "/static/icons/PinIcon.png"; 
            pinIcon.alt = "Pinned";
            titleContainer.appendChild(pinIcon);
        }
        
        const titleText = document.createElement("span");
        titleText.innerText = chat.title;
        titleContainer.appendChild(titleText);
        
        titleContainer.onclick = () => loadChat(chat.id);

        const optionsBtn = document.createElement("button");
        optionsBtn.className = "chat-options-btn";
        optionsBtn.innerText = "⋮";
        
        const dropdown = document.createElement("div");
        dropdown.className = "chat-dropdown-menu";
        
        const editBtn = document.createElement("button");
        editBtn.className = "chat-dropdown-item";
        editBtn.innerText = "Edit Name";
        editBtn.onclick = (e) => {
            e.stopPropagation();
            editChatTitle(chat.id);
            dropdown.classList.remove('active');
        };
        
        const pinBtn = document.createElement("button");
        pinBtn.className = "chat-dropdown-item";
        pinBtn.innerText = chat.pinned ? "Unpin Chat" : "Pin Chat";
        pinBtn.onclick = (e) => {
            e.stopPropagation();
            togglePinChat(chat.id);
            dropdown.classList.remove('active');
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "chat-dropdown-item delete";
        deleteBtn.innerText = "Delete";
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(chat.id);
            dropdown.classList.remove('active');
        };
        
        dropdown.appendChild(editBtn);
        dropdown.appendChild(pinBtn);
        dropdown.appendChild(deleteBtn);
        
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.chat-dropdown-menu.active').forEach(menu => {
                if (menu !== dropdown) menu.classList.remove('active');
            });
            dropdown.classList.toggle('active');
        };

        item.appendChild(titleContainer);
        item.appendChild(optionsBtn);
        item.appendChild(dropdown);
        container.appendChild(item);
    });
}

document.addEventListener("click", () => {
    document.querySelectorAll('.chat-dropdown-menu.active').forEach(menu => {
        menu.classList.remove('active');
    });
});

function editChatTitle(chatId) {
    const chat = chatsHistory.find(c => c.id === chatId);
    if (!chat) return;
    const newTitle = prompt("Enter a new name for this chat:", chat.title);
    if (newTitle && newTitle.trim() !== "") {
        chat.title = newTitle.trim();
        saveSessionData();
        renderChatHistorySidebar();
    }
}

function togglePinChat(chatId) {
    const chat = chatsHistory.find(c => c.id === chatId);
    if (!chat) return;
    chat.pinned = !chat.pinned;
    saveSessionData();
    renderChatHistorySidebar();
}

function deleteChat(chatId) {
    if (confirm("Are you sure you want to delete this chat forever?")) {
        chatsHistory = chatsHistory.filter(c => c.id !== chatId);
        
        if (activeChatId === chatId) {
            startNewChat();
        } else {
            saveSessionData();
            renderChatHistorySidebar();
        }
    }
}

// =========================================================================
// --- FILE HANDLING & DRAG AND DROP SYSTEM ---
// =========================================================================

function processFile(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            pendingImageSrc = event.target.result;
            pendingImageMime = pendingImageSrc.split(';')[0].split(':')[1];
            pendingImageBase64 = pendingImageSrc.split(',')[1];
            
            const imgEl = document.getElementById('image-preview-img');
            const boxEl = document.getElementById('image-preview-box');
            if (imgEl && boxEl) {
                imgEl.src = pendingImageSrc;
                boxEl.classList.add('active');
            }
        };
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = function(event) {
            const text = event.target.result;
            const input = document.getElementById("user-input");
            if (input) {
                const ext = file.name.split('.').pop() || '';
                input.value += `\n\`\`\`${ext}\n${text}\n\`\`\`\n`;
            }
        };
        reader.readAsText(file);
    }
}

const filePicker = document.getElementById('native-file-picker');
if (filePicker) {
    filePicker.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        processFile(file);
        filePicker.value = ""; 
    });
}

let dragCounter = 0;
const dragOverlay = document.getElementById('drag-drop-overlay');
const dragChatView = document.getElementById('view-chat');

if (dragChatView && dragOverlay) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        window.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    window.addEventListener('dragenter', (e) => {
        if (dragChatView.classList.contains('active')) {
            dragCounter++;
            dragOverlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', (e) => {
        if (dragChatView.classList.contains('active')) {
            dragCounter--;
            if (dragCounter <= 0) {
                dragCounter = 0;
                dragOverlay.classList.remove('active');
            }
        }
    });

    window.addEventListener('drop', (e) => {
        dragCounter = 0;
        dragOverlay.classList.remove('active');
        
        if (dragChatView.classList.contains('active')) {
            const dt = e.dataTransfer;
            const file = dt.files[0];
            if (file) {
                processFile(file);
            }
        }
    });
}

// =========================================================================
// --- CHAT FORMATTING & CODE BLOCK COPY SYSTEM ---
// =========================================================================

window.copyCode = function(button) {
    const code = decodeURIComponent(button.getAttribute("data-code"));
    navigator.clipboard.writeText(code).then(() => {
        showCopyToast();
    }).catch(err => console.error("Copy failed", err));
};

function showCopyToast() {
    let toast = document.getElementById('copy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'copy-toast';
        toast.className = 'copy-toast';
        toast.innerHTML = `
            <img src="/static/icons/CopyIcon.png" alt="Copy">
            <span>Text Copied</span>
        `;
        document.body.appendChild(toast);
    }

    toast.classList.add('show');
    if (window.copyToastTimeout) clearTimeout(window.copyToastTimeout);
    window.copyToastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatMessage(text) {
    let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)(```|$)/g;
    safeText = safeText.replace(codeBlockRegex, (match, lang, code) => {
        const displayLang = (lang || "CODE").toUpperCase();
        const encodedCode = encodeURIComponent(code);
        let styledCode = code.replace(/(["'])(.*?)\1/g, '<span style="color: #4ade80;">"$2"</span>');
        
        return `
        <div class="code-block-wrapper">
            <div class="code-block-header">
                <span class="code-language">${displayLang}</span>
                <button class="copy-code-btn" data-code="${encodedCode}" onclick="copyCode(this)">
                    <img src="/static/icons/CopyIcon.png" alt="Copy">
                </button>
            </div>
            <div class="code-block-body">${styledCode.trim()}</div>
        </div>`;
    });

    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');

    return safeText;
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    if (!input) return;
    const text = input.value.trim();
    
    if (!text && !pendingImageBase64) return;
    if (!checkDailyMessageLimit()) return;

    appendMessage(text, "user", pendingImageSrc);
    
    const userLocalTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const payload = { 
        message: text || "Look at this image.", 
        history: chatHistory,
        image_b64: pendingImageBase64,
        image_mime: pendingImageMime,
        api_key: customApiKey,
        user_time: userLocalTime,
        user_timezone: userTimezone,
        client_time: `${userLocalTime} (${userTimezone})`
    };

    input.value = "";
    clearPendingImage();

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
            if (response.status === 401 || response.status === 403) {
                textNode.innerText = "Error: Invalid API Key provided. Reverting key settings.";
                alert("The API key provided is invalid! Please check your key in Settings.");
                customApiKey = "";
                const keyInput = document.getElementById('user-api-key');
                if (keyInput) keyInput.value = "";
                saveSessionData();
                return;
            }
            textNode.innerText = "Error reaching Carl.";
            return;
        }

        if (!hasValidApiKey()) {
            const today = new Date().toISOString().split('T')[0];
            let count = parseInt(localStorage.getItem("carl_msg_count") || "0", 10) + 1;
            localStorage.setItem("carl_last_msg_date", today);
            localStorage.setItem("carl_msg_count", count.toString());
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

            textNode.innerHTML = formatMessage(cleanedResponse);
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
// --- CALL FEATURE & FACETIME CAMERA SYSTEM ---
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
let isFacetimeActive = false;
let facetimeStream = null;

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
    if (audioCtx.state === 'suspended') audioCtx.resume();
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
    } catch (e) {}
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

async function toggleFacetime() {
    const btn = document.getElementById("facetime-btn");
    
    if (!isFacetimeActive) {
        try {
            facetimeStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, 
                audio: false 
            });

            let vid = document.getElementById("facetime-video");
            if (!vid) {
                vid = document.createElement("video");
                vid.id = "facetime-video";
                vid.autoplay = true;
                vid.playsInline = true;
                vid.muted = true;
                vid.style.position = "absolute";
                vid.style.top = "0"; vid.style.left = "0";
                vid.style.width = "100%"; vid.style.height = "100%";
                vid.style.objectFit = "cover";
                vid.style.zIndex = "0";
                vid.style.borderRadius = "20px";
                
                const callView = document.getElementById("view-call");
                if (callView) callView.insertBefore(vid, callView.firstChild);
            }
            vid.srcObject = facetimeStream;
            vid.style.display = "block";

            isFacetimeActive = true;
            if (btn) btn.style.opacity = "1";
        } catch (err) {
            alert("Unable to access camera for FaceTime mode: " + err.message);
        }
    } else {
        stopFacetime();
    }
}

function stopFacetime() {
    isFacetimeActive = false;
    if (facetimeStream) {
        facetimeStream.getTracks().forEach(track => track.stop());
        facetimeStream = null;
    }
    const vid = document.getElementById("facetime-video");
    if (vid) vid.style.display = "none";

    const btn = document.getElementById("facetime-btn");
    if (btn) btn.style.opacity = "0.4";
}

function captureFacetimeFrame() {
    if (!isFacetimeActive) return null;
    const vid = document.getElementById("facetime-video");
    if (!vid || vid.readyState < 2) return null;

    const canvas = document.createElement("canvas");
    canvas.width = vid.videoWidth || 320;
    canvas.height = vid.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    return {
        base64: dataUrl.split(",")[1],
        mime: "image/jpeg"
    };
}

function startCall() {
    if (!hasValidApiKey()) {
        alert("Calling Carl requires a valid custom Gemini API Key! Please enter your key in Settings to unlock voice calls.");
        switchView('view-settings');
        return;
    }

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
    
    const ftBtn = document.getElementById("facetime-btn");
    if (ftBtn) ftBtn.style.opacity = "0.4";

    startRingingSound();
    const delay = Math.floor(Math.random() * 4000) + 1500;

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
        stopFacetime();

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

    let cleanText = text
        .replace(/```[\s\S]*?```/g, '') 
        .replace(/`[^`]*`/g, '') 
        .replace(/[*_#~]/g, '') 
        .trim();

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
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            else interimTranscript += event.results[i][0].transcript;
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

    const userLocalTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ftFrame = captureFacetimeFrame();

    const payload = {
        message: userText,
        history: chatHistory,
        image_b64: ftFrame ? ftFrame.base64 : null,
        image_mime: ftFrame ? ftFrame.mime : null,
        api_key: customApiKey,
        user_time: userLocalTime,
        user_timezone: userTimezone,
        client_time: `${userLocalTime} (${userTimezone})`
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

                if (sentence) speakCarl(sentence);
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
    if (selectedGame === "Drawzee") {
        switchView("view-drawzee");
        initDrawzee();
    } else if (selectedGame === "Tic Tac Toe") {
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

// =========================================================================
// --- UPGRADED DRAWZEE SYSTEM (REAL-TIME LIVE GUESSING + SPEED RECORD) ---
// =========================================================================

const dzWords = [
    "APPLE", "HOUSE", "TREE", "CAR", "CAT", "DOG", "SUN", "SWORD", 
    "GUITAR", "SNAKE", "ROBOT", "CLOUD", "MOUNTAIN", "FISH", "AIRPLANE", 
    "PIZZA", "BICYCLE", "FLOWER", "SMILE", "BOAT", "STAR", "CUP", "HEART"
];

let dzWord = "";
let dzCanvas, dzCtx;
let dzIsDrawing = false;
let dzColor = "#000000";
let dzSize = 7;
let dzEventsBound = false;

let dzTimerInterval = null;
let dzGuessInterval = null;
let dzStartTime = 0;
let dzElapsedTime = 0;
let dzStrokesMade = 0;
let dzIsGuessing = false;
let dzGameOver = false;

function updateDrawzeeBestDisplay() {
    const el = document.getElementById("drawzee-best-time");
    if (el) {
        el.innerText = drawzeeBestTime < 999999 ? `${drawzeeBestTime.toFixed(1)}s` : "--.-s";
    }
}

function initDrawzee() {
    dzStopGame();
    
    dzWord = dzWords[Math.floor(Math.random() * dzWords.length)];
    dzGameOver = false;
    dzStrokesMade = 0;
    dzElapsedTime = 0;
    dzIsGuessing = false;
    
    document.getElementById("drawzee-prompt-word").innerText = dzWord;
    document.getElementById("drawzee-timer").innerText = "00:00.0";
    
    const bubbleText = document.getElementById("drawzee-live-guess");
    if (bubbleText) {
        bubbleText.innerText = `"Start drawing, and I'll start guessing..."`;
        bubbleText.style.color = "#ffffff";
    }
    
    updateDrawzeeBestDisplay();

    dzCanvas = document.getElementById("drawzee-canvas");
    dzCanvas.width = 400;
    dzCanvas.height = 400;
    dzCtx = dzCanvas.getContext("2d");
    dzCtx.lineCap = "round";
    dzCtx.lineJoin = "round";
    
    clearDrawzeeCanvas();
    
    if (!dzEventsBound) {
        dzCanvas.addEventListener("mousedown", dzStart);
        dzCanvas.addEventListener("mousemove", dzDraw);
        dzCanvas.addEventListener("mouseup", dzStop);
        dzCanvas.addEventListener("mouseleave", dzStop);
        
        dzCanvas.addEventListener("touchstart", dzStart, { passive: false });
        dzCanvas.addEventListener("touchmove", dzDraw, { passive: false });
        dzCanvas.addEventListener("touchend", dzStop);
        dzEventsBound = true;
    }

    // Independent background auto-guessing interval (polls every 2 seconds)
    dzGuessInterval = setInterval(() => {
        if (!dzGameOver && dzStrokesMade > 2 && !dzIsGuessing) {
            dzPerformGuess();
        }
    }, 2000);
}

function dzStopGame() {
    if (dzTimerInterval) { clearInterval(dzTimerInterval); dzTimerInterval = null; }
    if (dzGuessInterval) { clearInterval(dzGuessInterval); dzGuessInterval = null; }
}

function dzGetPos(e) {
    const rect = dzCanvas.getBoundingClientRect();
    let clientX, clientY;
    
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    const scaleX = dzCanvas.width / rect.width;
    const scaleY = dzCanvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function dzStart(e) {
    e.preventDefault();
    if (dzGameOver) return;
    
    // Start stopwatch upon first stroke
    if (!dzTimerInterval && dzStrokesMade === 0) {
        dzStartTime = Date.now();
        dzTimerInterval = setInterval(() => {
            dzElapsedTime = (Date.now() - dzStartTime) / 1000;
            const mins = String(Math.floor(dzElapsedTime / 60)).padStart(2, '0');
            const secs = String(Math.floor(dzElapsedTime % 60)).padStart(2, '0');
            const tenths = Math.floor((dzElapsedTime % 1) * 10);
            document.getElementById("drawzee-timer").innerText = `${mins}:${secs}.${tenths}`;
        }, 100);
    }
    
    dzIsDrawing = true;
    dzStrokesMade++;
    const pos = dzGetPos(e);
    dzCtx.beginPath();
    dzCtx.moveTo(pos.x, pos.y);
}

function dzDraw(e) {
    if (!dzIsDrawing || dzGameOver) return;
    e.preventDefault();
    const pos = dzGetPos(e);
    dzCtx.lineTo(pos.x, pos.y);
    dzCtx.strokeStyle = dzColor;
    dzCtx.lineWidth = dzSize;
    dzCtx.stroke();
}

function dzStop(e) {
    if (dzIsDrawing) {
        dzIsDrawing = false;
        dzCtx.closePath();
    }
}

function setDrawzeeColor(color, btn) {
    dzColor = color;
    document.querySelectorAll(".drawzee-color-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

function setDrawzeeSize(size, btn) {
    dzSize = size;
    document.querySelectorAll(".drawzee-size-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
}

function clearDrawzeeCanvas() {
    dzCtx.fillStyle = "#ffffff";
    dzCtx.fillRect(0, 0, dzCanvas.width, dzCanvas.height);
}

async function dzPerformGuess() {
    if (dzIsGuessing || dzGameOver || dzStrokesMade === 0) return;
    dzIsGuessing = true;
    
    const bubbleText = document.getElementById("drawzee-live-guess");

    const dataUrl = dzCanvas.toDataURL("image/jpeg", 0.7);
    const b64 = dataUrl.split(",")[1];

    const payload = {
        message: `Look at this user's drawing sketch. What single object or concept is being drawn? YOU MUST OUTPUT EXACTLY ONE WORD. NO PUNCTUATION. NO CONVERSATION. JUST THE RAW NOUN.`,
        history: [],
        image_b64: b64,
        image_mime: "image/jpeg",
        api_key: customApiKey,
        user_time: new Date().toLocaleTimeString(),
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        client_time: "Drawzee Live"
    };

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            if (bubbleText) {
                bubbleText.innerText = `"Enter a valid API key in Settings!"`;
                bubbleText.style.color = "#ef4444";
            }
            dzIsGuessing = false;
            return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullResponse += decoder.decode(value, { stream: true });
        }

        if (!dzGameOver) {
            let rawUpper = fullResponse.toUpperCase();
            let words = rawUpper.replace(/[^A-Z\s]/g, '').trim().split(/\s+/);
            let displayGuess = words[0] || "...";

            if (bubbleText) {
                bubbleText.innerText = `"${displayGuess}"`;
            }

            // Win condition checks extracted word array
            if (words.includes(dzWord) || displayGuess === dzWord) {
                dzGameOver = true;
                dzStopGame();

                const finalTime = dzElapsedTime;
                if (bubbleText) {
                    bubbleText.innerText = `"${dzWord}" - BINGO! Solved in ${finalTime.toFixed(1)}s! 🎉`;
                    bubbleText.style.color = "#84cc16";
                }

                if (finalTime < drawzeeBestTime) {
                    drawzeeBestTime = finalTime;
                    localStorage.setItem("drawzee_best_time", drawzeeBestTime.toString());
                    updateDrawzeeBestDisplay();
                    saveSessionData();
                }
            } else {
                if (bubbleText) bubbleText.style.color = "#ffffff";
            }
        }

    } catch (err) {
        if (bubbleText && !dzGameOver) {
            bubbleText.innerText = `"..."`;
            bubbleText.style.color = "#aaaaaa";
        }
    } finally {
        dzIsGuessing = false;
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
    if (btn) btn.innerText = `Rotate: ${bsIsHorizontal ? "Horizontal" : "Vertical"}`;

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
    for (let i = 0; i < size; i++) {
        let nr = bsIsHorizontal ? r : r + i;
        let nc = bsIsHorizontal ? c + i : c;
        if (nr >= BS_SIZE || nc >= BS_SIZE) return [];
        coords.push({r: nr, c: nc});
    }

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
            if (chkSelected && chkSelected.r === r && chkSelected.c === c) tile.classList.add("selected");

            let moveObj = chkValidMoves.find(m => m.toR === r && m.toC === c);
            if (moveObj) tile.classList.add("target");

            let isJumped = chkValidMoves.some(m => m.isJump && m.jumpedR === r && m.jumpedC === c);
            if (isJumped) tile.classList.add("jump-capture");

            if (pieceVal !== 0) {
                const piece = document.createElement("div");
                let isRed = pieceVal === 1 || pieceVal === 11;
                let isKing = pieceVal === 11 || pieceVal === 22;
                piece.className = `chk-piece ${isRed ? "red" : "black"}`;
                if (isKing) piece.classList.add("king");
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
    if (move.isJump) chkBoard[move.jumpedR][move.jumpedC] = 0;
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
            if (chsSelected && chsSelected.r === r && chsSelected.c === c) tile.classList.add("selected");

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