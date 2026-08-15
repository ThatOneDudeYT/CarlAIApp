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

let selectedGame = "Burger Clicker";
const gamesWithDifficulty = ["Tic Tac Toe", "Chess", "Hangman", "Connect Four", "Checkers"];

let pendingImageBase64 = null, pendingImageMime = null, pendingImageSrc = null;
let pendingDmImageBase64 = null, pendingDmImageMime = null, pendingDmImageSrc = null, currentDmUser = null; 
let isDM = false, currentDmUnsubscribe = null;

// --- BURGER ECONOMY STATE ---
let userBurgers = 100, clickerBurgers = 0, rebirths = 0, clickPower = 1, autoChefs = 0, burgerStands = 0, burgerFactories = 0;   

function getMultiplier() { return 1 + (rebirths * 1.0); }
function getClickValue() { return (clickPower * Math.floor(1 + (clickPower * 0.1))) * getMultiplier(); }
function getChefPower() { return Math.floor(1 + (autoChefs * 0.1)); }
function getStandPower() { return Math.floor(10 + (burgerStands * 0.2)); }
function getFactoryPower() { return Math.floor(100 + (burgerFactories * 1)); }
function getBps() { return ((autoChefs * getChefPower()) + (burgerStands * getStandPower()) + (burgerFactories * getFactoryPower())) * getMultiplier(); }

function updateBurgerUI() {
    const headerCount = document.getElementById("burger-count");
    if(headerCount) headerCount.innerText = Math.floor(userBurgers).toLocaleString();
    const clickerCount = document.getElementById("clicker-score-text");
    if(clickerCount) clickerCount.innerText = Math.floor(clickerBurgers).toLocaleString();
}

setInterval(() => {
    let bps = getBps();
    if (bps > 0) { clickerBurgers += bps; updateBurgerUI(); }
}, 1000);

// =========================================================================
// --- START-UP SCREEN TYPING ANIMATION ---
// =========================================================================

const normalPhrases = ["Ready When You Are", "What Time Is It?", "I Need Help With Math", "The Floor Is Yours!"];
const rarePhrases = ["Mmmm Burgers", "I weigh 700 pounds", "67"];
let typingTimeout = null;

function initTypingAnimation() {
    const titleEl = document.getElementById("startup-title");
    if (!titleEl) return;
    if (typingTimeout) clearTimeout(typingTimeout);
    let isDeleting = false, currentText = "Ask Away!", charIndex = currentText.length; 
    titleEl.innerHTML = 'Ask Away!<span class="typing-cursor"></span>';
    typingTimeout = setTimeout(() => { isDeleting = true; typeLoop(titleEl, currentText, charIndex, isDeleting); }, 2000);
}

function typeLoop(titleEl, currentText, charIndex, isDeleting) {
    let typingSpeed = isDeleting ? 45 : 65 + Math.random() * 40; 
    if (isDeleting) charIndex--; else charIndex++;
    titleEl.innerHTML = currentText.substring(0, charIndex) + '<span class="typing-cursor"></span>';
    
    if (!isDeleting && charIndex === currentText.length) {
        typingSpeed = 2400; isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        const pool = Math.random() < 0.10 ? rarePhrases : normalPhrases;
        let newPhrase = currentText;
        while (newPhrase === currentText) newPhrase = pool[Math.floor(Math.random() * pool.length)];
        currentText = newPhrase; typingSpeed = 400;
    }
    typingTimeout = setTimeout(() => typeLoop(titleEl, currentText, charIndex, isDeleting), typingSpeed);
}

function hideStartupScreen() {
    const startupScreen = document.getElementById("startup-screen");
    const viewChat = document.getElementById("view-chat");
    if (startupScreen) startupScreen.classList.add("hidden");
    if (viewChat) viewChat.classList.remove("startup-active");
    if (typingTimeout) clearTimeout(typingTimeout);
}

function showStartupScreen() {
    const startupScreen = document.getElementById("startup-screen");
    const viewChat = document.getElementById("view-chat");
    if (startupScreen) { startupScreen.classList.remove("hidden"); initTypingAnimation(); }
    if (viewChat) viewChat.classList.add("startup-active");
}

function hasValidApiKey() { return customApiKey && customApiKey.trim().length > 20; }

window.addEventListener("DOMContentLoaded", () => {
    initMobileNavIcons();
    initTypingAnimation();
    updateUsageUI();
    updateBurgerUI();
    
    const oldNav = document.querySelector('.bottom-nav');
    if (oldNav) oldNav.style.display = 'none';

    if (!document.getElementById("mobile-hamburger-btn")) {
        const hamburgerBtn = document.createElement("button");
        hamburgerBtn.id = "mobile-hamburger-btn";
        hamburgerBtn.className = "mobile-top-header";
        hamburgerBtn.innerHTML = `<div class="hamburger-line"></div><div class="hamburger-line"></div><div class="hamburger-line"></div>`;
        hamburgerBtn.onclick = toggleMobileSidebar; 
        document.body.appendChild(hamburgerBtn);
    }

    if (!document.getElementById("sidebar-overlay")) {
        const overlay = document.createElement("div");
        overlay.id = "sidebar-overlay"; overlay.className = "sidebar-overlay";
        overlay.onclick = toggleMobileSidebar;
        document.body.appendChild(overlay);
    }
    
    const dmInput = document.getElementById("dm-input");
    if (dmInput) dmInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendDmMessage(); });

    const sendBtn = document.getElementById("send-btn");
    if (sendBtn) sendBtn.addEventListener("click", sendMessage);
    const userInput = document.getElementById("user-input");
    if (userInput) userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
});

function toggleMobileSidebar() {
    const sidebar = document.querySelector('.desktop-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

// --- AUTHENTICATION ---
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
    auth.signInWithPopup(provider).catch(error => alert("Google Sign-In Error: " + error.message));
}

function handleLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value;
    
    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => { if (!userCredential.user.emailVerified) alert("Please check your inbox to verify your email address."); })
        .catch(error => {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/invalid-credential') {
                auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
                    userCredential.user.sendEmailVerification().then(() => alert("Account created! Verification link sent to your email."));
                }).catch(err => alert("Sign Up Error: " + err.message));
            } else alert(error.message);
        });
}

function handleSignOut() {
    auth.signOut().then(() => {
        currentUser = null; currentUserAvatar = "/static/icons/default-avatar.png"; customApiKey = "";
        chatsHistory = []; chatHistory = []; activeChatId = null; myFriends = []; myRequests = []; mySentRequests = []; currentDmUser = null;
        userBurgers = 100; clickerBurgers = 0; autoChefs = 0; burgerStands = 0; burgerFactories = 0; clickPower = 1; rebirths = 0;
        updateBurgerUI(); updateProfileUI(); renderChatHistorySidebar(); switchView('view-chat'); showStartupScreen(); updateUsageUI();
    });
}

// --- CLOUD DATABASE ---
let myFriends = [];
let myRequests = [];
let mySentRequests = [];

async function loadUserDataFromCloud() {
    if (!firebaseUserId) return;
    db.collection("users").doc(firebaseUserId).onSnapshot(async (doc) => {
        if (doc.exists) {
            const data = doc.data();
            customApiKey = data.apiKey || ""; chatsHistory = data.chats || [];
            if (!isDM) activeChatId = data.activeChatId || null;
            applyTheme(data.theme || "dark");
            
            userBurgers = data.burgers !== undefined ? data.burgers : 100; clickerBurgers = data.clickerBurgers || 0;
            autoChefs = data.autoChefs || 0; burgerStands = data.burgerStands || 0; burgerFactories = data.burgerFactories || 0;
            clickPower = data.clickPower || 1; rebirths = data.rebirths || 0;
            myFriends = data.friends || []; myRequests = data.friendRequests || []; mySentRequests = data.sentRequests || [];
            
            updateBurgerUI();
            
            if (data.avatar) currentUserAvatar = data.avatar;
            if (data.username) currentUser = data.username;
            updateProfileUI();
            
            const keyInput = document.getElementById('user-api-key'); if (keyInput) keyInput.value = customApiKey;
            const usernameInput = document.getElementById('settings-username-input'); if (usernameInput) usernameInput.value = currentUser;
            
            renderChatHistorySidebar(); updateUsageUI();
            if (document.getElementById('view-friends').classList.contains('active')) renderFriendsView();
        } else {
            saveSessionData(); startNewChat();
        }
    }, (error) => console.error("Error listening to user data:", error));
}

function saveSessionData() {
    if (!firebaseUserId) return;
    const currentActive = isDM ? (chatsHistory.length > 0 ? chatsHistory[0].id : null) : activeChatId;
    db.collection("users").doc(firebaseUserId).set({
        apiKey: customApiKey, chats: chatsHistory, activeChatId: currentActive, theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
        avatar: currentUserAvatar, username: currentUser, burgers: userBurgers, clickerBurgers: clickerBurgers,
        autoChefs: autoChefs, burgerStands: burgerStands, burgerFactories: burgerFactories, clickPower: clickPower, rebirths: rebirths
    }, { merge: true }).catch(e => console.error("Error saving data:", e));
}

// --- USER PROFILE & SETTINGS ---
function applyTheme(theme) {
    const body = document.body, themeSwitch = document.getElementById('theme-toggle-switch');
    if (theme === "light") { body.classList.remove("dark-mode"); body.classList.add("light-mode"); if (themeSwitch) themeSwitch.checked = true; } 
    else { body.classList.remove("light-mode"); body.classList.add("dark-mode"); if (themeSwitch) themeSwitch.checked = false; }
}

function toggleTheme() {
    const body = document.body, themeSwitch = document.getElementById('theme-toggle-switch');
    if (body.classList.contains('dark-mode')) { body.classList.remove('dark-mode'); body.classList.add('light-mode'); if (themeSwitch) themeSwitch.checked = true; } 
    else { body.classList.remove('light-mode'); body.classList.add('dark-mode'); if (themeSwitch) themeSwitch.checked = false; }
    saveSessionData();
}

function updateProfileUI() {
    const avatarEl = document.getElementById("header-user-avatar"), nameEl = document.getElementById("header-user-name");
    if (avatarEl) avatarEl.src = currentUserAvatar; if (nameEl) nameEl.innerText = currentUser || "Guest";
}

function updateUsernameFromSettings() {
    const input = document.getElementById("settings-username-input");
    if (!input || !currentUser) return;
    const newName = input.value.trim();
    if (newName.length >= 3 && newName.length <= 20) { currentUser = newName; updateProfileUI(); saveSessionData(); } 
    else { alert("Username must be between 3 and 20 characters!"); input.value = currentUser || ""; }
}

function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { currentUserAvatar = e.target.result; updateProfileUI(); saveSessionData(); };
    reader.readAsDataURL(file);
}

function saveSettings() {
    const keyInput = document.getElementById('user-api-key'); if (keyInput) customApiKey = keyInput.value.trim();
    const newPass = document.getElementById('settings-new-pass').value, confirmPass = document.getElementById('settings-confirm-pass').value;
    if (newPass || confirmPass) {
        if (newPass === confirmPass) { auth.currentUser.updatePassword(newPass).then(() => { alert("Password updated successfully."); document.getElementById('settings-new-pass').value = ""; document.getElementById('settings-confirm-pass').value = ""; }).catch(error => alert(error.message)); } 
        else alert("Passwords do not match!");
    }
    saveSessionData(); updateUsageUI();
}

function toggleApiKeyHelp() { const helpBox = document.getElementById('api-key-help-box'); if (helpBox) helpBox.classList.toggle('hidden'); }

function toggleSidebar() {
    const sidebar = document.getElementById('desktop-sidebar'), btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar) return;
    if (sidebar.classList.contains('expanded')) { sidebar.classList.remove('expanded'); sidebar.classList.add('collapsed'); if (btn) btn.innerText = "❯"; } 
    else { sidebar.classList.remove('collapsed'); sidebar.classList.add('expanded'); if (btn) btn.innerText = "❮"; }
}

function getDifficulty() { const select = document.getElementById("difficulty-select"); return select ? select.value : "medium"; }

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    const sidebar = document.querySelector('.desktop-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active');
    
    if (viewId !== 'view-dm') {
        isDM = false;
        if(currentDmUnsubscribe) { currentDmUnsubscribe(); currentDmUnsubscribe = null; }
    }

    if (viewId === 'view-games') updateDifficultyPickerVisibility();
    else if (viewId === 'view-friends') fetchAllUsers();
    else if (viewId === 'view-burgerclicker') updateUpgradesUI();
}

// =========================================================================
// --- GAMES LAUNCHER SYSTEM ---
// =========================================================================

function selectGame(element, gameName) {
    document.querySelectorAll('.game-card-img').forEach(card => card.classList.remove('selected'));
    element.classList.add('selected');
    selectedGame = gameName;
    updateDifficultyPickerVisibility();
}

function updateDifficultyPickerVisibility() {
    const diffPicker = document.getElementById("difficulty-picker");
    if (diffPicker) {
        if (gamesWithDifficulty.includes(selectedGame)) { diffPicker.style.display = "flex"; } 
        else { diffPicker.style.display = "none"; }
    }
}

function launchGame() {
    if (selectedGame === "Burger Clicker") { switchView("view-burgerclicker"); updateUpgradesUI(); } 
    else if (selectedGame === "Tic Tac Toe") { switchView("view-tictactoe"); if(typeof initTicTacToe === 'function') initTicTacToe(); } 
    else if (selectedGame === "Rock Paper Scissors") { switchView("view-rps"); if(typeof initRps === 'function') initRps(); } 
    else if (selectedGame === "Blackjack") { switchView("view-blackjack"); if(typeof prepBlackjack === 'function') prepBlackjack(); } 
    else if (selectedGame === "Hangman") { switchView("view-hangman"); if(typeof initHangman === 'function') initHangman(); } 
    else if (selectedGame === "Connect Four") { switchView("view-connectfour"); if(typeof initConnectFour === 'function') initConnectFour(); } 
    else if (selectedGame === "Battleship") { switchView("view-battleship"); if(typeof initBattleship === 'function') initBattleship(); } 
    else if (selectedGame === "Checkers") { switchView("view-checkers"); if(typeof initCheckers === 'function') initCheckers(); } 
    else if (selectedGame === "Chess") { switchView("view-chess"); if(typeof initChess === 'function') initChess(); } 
}

// --- GAME 0: BURGER CLICKER LOGIC ---
function clickBurger() {
    let amount = getClickValue();
    clickerBurgers += amount;
    updateBurgerUI();
    
    const btn = document.getElementById("carl-clicker-btn");
    const floater = document.createElement("div");
    floater.className = "floating-number";
    floater.innerText = "+" + amount.toLocaleString();
    floater.style.left = (Math.random() * 80 + 10) + "%";
    floater.style.top = (Math.random() * 80 + 10) + "%";
    btn.appendChild(floater);
    setTimeout(() => floater.remove(), 1000);
}

function buyUpgrade(type) {
    let cost = 0;
    if (type === 'click') {
        cost = Math.floor(100 * Math.pow(1.5, clickPower - 1));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; clickPower++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'chef') {
        cost = Math.floor(50 * Math.pow(1.15, autoChefs));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; autoChefs++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'stand') {
        cost = Math.floor(500 * Math.pow(1.15, burgerStands));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; burgerStands++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'factory') {
        cost = Math.floor(5000 * Math.pow(1.15, burgerFactories));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; burgerFactories++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    }
    updateBurgerUI(); updateUpgradesUI(); saveSessionData();
}

function exchangeBurgers() {
    if (clickerBurgers >= 10000) { clickerBurgers -= 10000; userBurgers += 1; updateBurgerUI(); saveSessionData(); } 
    else { alert("You need 10,000 Clicker Burgers to make a trade!"); }
}

function rebirth() {
    if (clickerBurgers >= 1000000000000) {
        clickerBurgers = 0; autoChefs = 0; burgerStands = 0; burgerFactories = 0; clickPower = 1; rebirths++;
        alert("You have REBIRTHED! All your progress is reset, but you now earn +100% more burgers permanently!");
        updateBurgerUI(); updateUpgradesUI(); saveSessionData();
    } else { alert("You need 1 Trillion Clicker Burgers to Rebirth!"); }
}

function updateUpgradesUI() {
    if(document.getElementById("click-cost")) document.getElementById("click-cost").innerText = Math.floor(100 * Math.pow(1.5, clickPower - 1)).toLocaleString();
    if(document.getElementById("click-power-count")) document.getElementById("click-power-count").innerText = getClickValue().toLocaleString();
    
    if(document.getElementById("chef-cost")) document.getElementById("chef-cost").innerText = Math.floor(50 * Math.pow(1.15, autoChefs)).toLocaleString();
    if(document.getElementById("chef-count")) document.getElementById("chef-count").innerText = autoChefs.toLocaleString();
    if(document.getElementById("chef-output")) document.getElementById("chef-output").innerText = (getChefPower() * getMultiplier()).toLocaleString();
    
    if(document.getElementById("stand-cost")) document.getElementById("stand-cost").innerText = Math.floor(500 * Math.pow(1.15, burgerStands)).toLocaleString();
    if(document.getElementById("stand-count")) document.getElementById("stand-count").innerText = burgerStands.toLocaleString();
    if(document.getElementById("stand-output")) document.getElementById("stand-output").innerText = (getStandPower() * getMultiplier()).toLocaleString();
    
    if(document.getElementById("factory-cost")) document.getElementById("factory-cost").innerText = Math.floor(5000 * Math.pow(1.15, burgerFactories)).toLocaleString();
    if(document.getElementById("factory-count")) document.getElementById("factory-count").innerText = burgerFactories.toLocaleString();
    if(document.getElementById("factory-output")) document.getElementById("factory-output").innerText = (getFactoryPower() * getMultiplier()).toLocaleString();

    let bps = getBps();
    let bpsText = document.getElementById("bps-text");
    if(bpsText) bpsText.innerText = bps.toLocaleString();
    
    let rebirthsText = document.getElementById("rebirth-count");
    if(rebirthsText) rebirthsText.innerText = rebirths.toLocaleString();
}

// =========================================================================
// --- FRIENDS & CONTACTS SYSTEM ---
// =========================================================================
const avatarColors = ["#ef4444", "#84cc16", "#eab308", "#3b82f6", "#a855f7", "#f97316", "#ec4899"];

function getAvatarColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getAvatarHTML(user) {
    if (!user.avatar || user.avatar.includes('default-avatar.png')) {
        const color = getAvatarColor(user.username);
        const initial = user.username.charAt(0).toUpperCase();
        return `<div class="text-avatar" style="background-color: ${color};">${initial}</div>`;
    }
    return `<img class="friend-avatar" src="${user.avatar}" draggable="false">`;
}

let allUsersCache = [];
async function fetchAllUsers() {
    const list = document.getElementById("find-people-list");
    if(list) list.innerHTML = "<p style='color:var(--text-sub);'>Loading...</p>";

    try {
        if (firebaseUserId && db) {
            const snapshot = await db.collection("users").get();
            allUsersCache = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id !== firebaseUserId && data.username) {
                    allUsersCache.push({ id: doc.id, username: data.username, avatar: data.avatar || "" });
                }
            });
        }
    } catch (err) { console.error("Error fetching real users", err); }
    renderFriendsView();
}

function renderFriendsView() {
    const query = document.getElementById("friend-search-input").value.toLowerCase().trim();
    const findList = document.getElementById("find-people-list");
    const friendsList = document.getElementById("my-friends-list");
    if (!findList || !friendsList) return;
    
    findList.innerHTML = ""; friendsList.innerHTML = "";

    const activeFriends = allUsersCache.filter(u => myFriends.includes(u.id));
    if (activeFriends.length === 0) {
        friendsList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px;'>No friends yet.</p>";
    } else {
        activeFriends.forEach(user => {
            const item = document.createElement("div"); item.className = "friend-item";
            item.innerHTML = `
                <div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username}</span></div>
                <div style="display:flex; gap:8px;">
                    <button class="friend-msg-btn" onclick='openDirectMessage(${JSON.stringify(user)})'>Message</button>
                    <button class="friend-req-btn" style="border-color:#ef4444; color:#ef4444;" onclick="unfriendUser('${user.id}')">Unfriend</button>
                </div>
            `;
            friendsList.appendChild(item);
        });
    }

    let searchResults = [];
    const incomingReqs = allUsersCache.filter(u => myRequests.includes(u.id));
    
    incomingReqs.forEach(user => {
        const item = document.createElement("div"); item.className = "friend-item";
        item.innerHTML = `<div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username}</span></div><button class="friend-req-btn" onclick="acceptRequest('${user.id}')">Accept Request</button>`;
        findList.appendChild(item);
    });

    if (query) {
        searchResults = allUsersCache.filter(u => u.username.toLowerCase().includes(query) && !myFriends.includes(u.id) && !myRequests.includes(u.id));
        if (searchResults.length === 0 && incomingReqs.length === 0) {
            findList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px;'>No users found.</p>";
        } else {
            searchResults.forEach(user => {
                const item = document.createElement("div"); item.className = "friend-item";
                const isSent = mySentRequests.includes(user.id);
                const btnHTML = isSent ? `<button class="friend-msg-btn" style="opacity: 0.5;" disabled>Sent!</button>` : `<button class="friend-msg-btn" onclick="sendFriendRequest('${user.id}')">Add Friend</button>`;
                item.innerHTML = `<div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username}</span></div>${btnHTML}`;
                findList.appendChild(item);
            });
        }
    } else if (incomingReqs.length === 0) {
        findList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px; text-align:center;'>Search for a username above!</p>";
    }
}

async function sendFriendRequest(targetId) {
    if (!firebaseUserId) return;
    mySentRequests.push(targetId); renderFriendsView();
    await db.collection("users").doc(targetId).update({ friendRequests: firebase.firestore.FieldValue.arrayUnion(firebaseUserId) });
    await db.collection("users").doc(firebaseUserId).update({ sentRequests: firebase.firestore.FieldValue.arrayUnion(targetId) });
}

async function acceptRequest(requesterId) {
    if (!firebaseUserId) return;
    myRequests = myRequests.filter(id => id !== requesterId); myFriends.push(requesterId); renderFriendsView();
    await db.collection("users").doc(firebaseUserId).update({ friendRequests: firebase.firestore.FieldValue.arrayRemove(requesterId), friends: firebase.firestore.FieldValue.arrayUnion(requesterId) });
    await db.collection("users").doc(requesterId).update({ sentRequests: firebase.firestore.FieldValue.arrayRemove(firebaseUserId), friends: firebase.firestore.FieldValue.arrayUnion(firebaseUserId) });
}

async function unfriendUser(targetId) {
    if (!confirm("Are you sure you want to unfriend this user?")) return;
    myFriends = myFriends.filter(id => id !== targetId); renderFriendsView();
    await db.collection("users").doc(firebaseUserId).update({ friends: firebase.firestore.FieldValue.arrayRemove(targetId) });
    await db.collection("users").doc(targetId).update({ friends: firebase.firestore.FieldValue.arrayRemove(firebaseUserId) });
}

function openDirectMessage(user) {
    isDM = true; currentDmUser = user; activeChatId = "dm_" + [firebaseUserId, user.id].sort().join('_');
    document.getElementById("dm-header-avatar").innerHTML = getAvatarHTML(user);
    document.getElementById("dm-header-name").innerText = user.username;
    document.getElementById("dm-input").placeholder = `Message ${user.username}...`;
    document.getElementById("dm-chat-log").innerHTML = "";
    
    if (currentDmUnsubscribe) currentDmUnsubscribe();
    currentDmUnsubscribe = db.collection("dms").doc(activeChatId).collection("messages").orderBy("timestamp", "asc").onSnapshot(snapshot => {
        const log = document.getElementById("dm-chat-log"); log.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data(), isMe = data.senderId === firebaseUserId;
            const msgDiv = document.createElement("div"); msgDiv.className = `dm-message ${isMe ? 'sent' : 'received'}`; msgDiv.dataset.id = doc.id;
            const contentDiv = document.createElement("div"); contentDiv.className = "dm-message-content";
            
            if (data.text) { const textSpan = document.createElement("span"); textSpan.className = "dm-message-text"; textSpan.innerText = data.text; contentDiv.appendChild(textSpan); }
            if (data.imageSrc) { const img = document.createElement("img"); img.src = data.imageSrc; img.className = "chat-image"; img.draggable = false; contentDiv.appendChild(img); }
            
            const msgWrapper = document.createElement("div");
            msgWrapper.style.display = "flex"; msgWrapper.style.alignItems = "center"; msgWrapper.style.gap = "8px";

            if (isMe) {
                const delBtn = document.createElement("button");
                delBtn.innerHTML = "✕"; delBtn.className = "dm-del-btn"; delBtn.title = "Delete Message";
                delBtn.onclick = () => deleteDmMessage(doc.id);
                msgWrapper.appendChild(delBtn); msgWrapper.appendChild(contentDiv);
            } else { msgWrapper.appendChild(contentDiv); }

            const avatarObj = isMe ? { username: currentUser, avatar: currentUserAvatar } : currentDmUser;
            const avatarWrapper = document.createElement("div"); avatarWrapper.className = "dm-message-avatar"; avatarWrapper.innerHTML = getAvatarHTML(avatarObj);
            
            msgDiv.appendChild(avatarWrapper); msgDiv.appendChild(msgWrapper); log.appendChild(msgDiv);
        });
        log.scrollTop = log.scrollHeight;
    });
    switchView('view-dm');
}

async function deleteDmMessage(msgId) {
    if(confirm("Delete this message?")) await db.collection("dms").doc(activeChatId).collection("messages").doc(msgId).delete();
}

function processDmFile(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            pendingDmImageSrc = event.target.result; pendingDmImageMime = pendingDmImageSrc.split(';')[0].split(':')[1]; pendingDmImageBase64 = pendingDmImageSrc.split(',')[1];
            const imgEl = document.getElementById('dm-image-preview-img'), boxEl = document.getElementById('dm-image-preview-box');
            if (imgEl && boxEl) { imgEl.src = pendingDmImageSrc; boxEl.classList.add('active'); }
        };
        reader.readAsDataURL(file);
    }
}

const dmFilePicker = document.getElementById('dm-native-file-picker');
if (dmFilePicker) dmFilePicker.addEventListener('change', function(e) { const file = e.target.files[0]; if (!file) return; processDmFile(file); dmFilePicker.value = ""; });

function clearDmPendingImage() {
    pendingDmImageBase64 = null; pendingDmImageMime = null; pendingDmImageSrc = null;
    const box = document.getElementById('dm-image-preview-box'); if (box) box.classList.remove('active');
}

async function sendDmMessage() {
    const input = document.getElementById("dm-input"); if (!input) return;
    const text = input.value.trim();
    if (!text && !pendingDmImageBase64) return;
    if (!activeChatId || !isDM) return;
    
    input.value = ""; const imageSrc = pendingDmImageSrc; clearDmPendingImage();
    await db.collection("dms").doc(activeChatId).collection("messages").add({ text: text, imageSrc: imageSrc || null, senderId: firebaseUserId, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
}

// =========================================================================
// --- GENERAL APP LOGIC & CHAT ---
// =========================================================================

function checkDailyMessageLimit() {
    const today = new Date().toISOString().split('T')[0];
    let lastDate = localStorage.getItem("carl_last_msg_date");
    let count = parseInt(localStorage.getItem("carl_msg_count") || "0", 10);
    if (lastDate !== today) { lastDate = today; count = 0; localStorage.setItem("carl_last_msg_date", today); localStorage.setItem("carl_msg_count", "0"); }
    
    if (count >= 10 && !hasValidApiKey()) {
        alert("Daily limit reached! Free users are capped at 10 messages per day. Enter a valid Gemini API key in Settings to unlock unlimited chats!");
        switchView('view-settings'); return false;
    }
    return true;
}

function startNewChat() {
    isDM = false;
    if (currentDmUnsubscribe) { currentDmUnsubscribe(); currentDmUnsubscribe = null; }
    archiveActiveChat(); activeChatId = "chat_" + Date.now(); chatHistory = [];
    const log = document.getElementById("chat-log"); if (log) log.innerHTML = '';
    const input = document.getElementById("user-input"); if (input) input.value = "";
    
    clearPendingImage();
    document.getElementById("startup-title").innerHTML = 'Ask Away!<span class="typing-cursor"></span>';
    showStartupScreen(); saveSessionData(); switchView('view-chat');
}

function loadChat(chatId) {
    isDM = false;
    if (currentDmUnsubscribe) { currentDmUnsubscribe(); currentDmUnsubscribe = null; }
    archiveActiveChat(); const target = chatsHistory.find(c => c.id === chatId);
    if (target) {
        activeChatId = target.id; const log = document.getElementById("chat-log"); if (log) log.innerHTML = target.html;
        chatHistory = [...target.apiHistory];
        
        if (chatHistory.length > 0) hideStartupScreen();
        else { document.getElementById("startup-title").innerHTML = 'Ask Away!<span class="typing-cursor"></span>'; showStartupScreen(); }
        saveSessionData(); switchView('view-chat');
    }
}

async function sendMessage() {
    const input = document.getElementById("user-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text && !pendingImageBase64) return;

    if (text.toLowerCase().trim() === "/whomadeyou") {
        hideStartupScreen();
        appendMessage(text, "user", pendingImageSrc);
        appendMessage("Emmett Breen", "carl");
        input.value = ""; clearPendingImage();
        return;
    }

    if (!checkDailyMessageLimit()) return;
    hideStartupScreen(); appendMessage(text, "user", pendingImageSrc);
    
    const userLocalTime = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }), userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload = { 
        message: text || "Look at this image.", history: chatHistory, image_b64: pendingImageBase64, image_mime: pendingImageMime, 
        api_key: customApiKey, user_time: userLocalTime, user_timezone: userTimezone, client_time: `${userLocalTime} (${userTimezone})`
    };

    input.value = ""; clearPendingImage();
    const log = document.getElementById("chat-log"), carlBubble = document.createElement("div");
    carlBubble.className = "chat-bubble carl"; const textNode = document.createElement("div");
    carlBubble.appendChild(textNode); log.appendChild(carlBubble); log.scrollTop = log.scrollHeight;

    try {
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                textNode.innerText = "Error: Invalid API Key provided. Reverting key settings."; alert("The API key provided is invalid! Please check your key in Settings.");
                customApiKey = ""; const keyInput = document.getElementById('user-api-key'); if (keyInput) keyInput.value = ""; saveSessionData(); return;
            }
            textNode.innerText = "Error reaching Carl."; return;
        }

        if (!hasValidApiKey()) {
            const today = new Date().toISOString().split('T')[0];
            let count = parseInt(localStorage.getItem("carl_msg_count") || "0", 10) + 1;
            localStorage.setItem("carl_last_msg_date", today); localStorage.setItem("carl_msg_count", count.toString()); updateUsageUI();
        }

        const reader = response.body.getReader(), decoder = new TextDecoder();
        let fullResponse = "", displayBuffer = "", streamFinished = false, isTypingStream = false;

        function renderTypewriter() {
            if (displayBuffer.length < fullResponse.length) {
                let diff = fullResponse.length - displayBuffer.length, charsToAdd = diff > 20 ? 4 : (diff > 5 ? 2 : 1);
                displayBuffer += fullResponse.substring(displayBuffer.length, displayBuffer.length + charsToAdd);
                textNode.innerHTML = formatMessage(displayBuffer) + '<span class="typing-cursor"></span>'; log.scrollTop = log.scrollHeight;
                setTimeout(renderTypewriter, 15); 
            } else if (!streamFinished) setTimeout(renderTypewriter, 15);
            else { textNode.innerHTML = formatMessage(fullResponse); log.scrollTop = log.scrollHeight; isTypingStream = false; }
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) { streamFinished = true; break; }
            const chunk = decoder.decode(value, { stream: true }); fullResponse += chunk;
            for (let bad_prefix of ["Carl:", "carl:", "Carl - ", "Assistant:"]) { if (fullResponse.startsWith(bad_prefix)) { fullResponse = fullResponse.substring(bad_prefix.length).trimStart(); displayBuffer = ""; } }
            if (!isTypingStream) { isTypingStream = true; renderTypewriter(); }
        }

        chatHistory.push({ role: "user", content: text || "Look at this image." }); chatHistory.push({ role: "assistant", content: fullResponse }); saveSessionData();
    } catch (err) { textNode.innerText = "Network error."; }
}

function searchChats() {
    let oldModal = document.getElementById("search-modal"); if (oldModal) oldModal.remove();
    const modal = document.createElement("div"); modal.id = "search-modal"; modal.style.position = "fixed"; modal.style.top = "0"; modal.style.left = "0"; modal.style.width = "100vw"; modal.style.height = "100vh"; modal.style.backgroundColor = "rgba(0,0,0,0.85)"; modal.style.backdropFilter = "blur(5px)"; modal.style.zIndex = "10000"; modal.style.display = "flex"; modal.style.justifyContent = "center"; modal.style.alignItems = "center";
    const box = document.createElement("div"); box.style.backgroundColor = "var(--bg-card)"; box.style.padding = "24px"; box.style.borderRadius = "20px"; box.style.width = "90%"; box.style.maxWidth = "420px"; box.style.border = "1px solid var(--border-color)"; box.style.boxShadow = "0 10px 30px rgba(0,0,0,0.5)";
    const title = document.createElement("h2"); title.innerText = "Search Chats"; title.style.marginBottom = "16px"; title.style.fontSize = "28px";
    const input = document.createElement("input"); input.type = "text"; input.placeholder = "Search messages or titles..."; input.style.width = "100%"; input.style.padding = "14px"; input.style.borderRadius = "12px"; input.style.border = "1px solid var(--border-color)"; input.style.backgroundColor = "var(--bg-input)"; input.style.color = "var(--text-main)"; input.style.outline = "none"; input.style.fontSize = "16px"; input.style.marginBottom = "16px";
    const results = document.createElement("div"); results.style.maxHeight = "250px"; results.style.overflowY = "auto"; results.style.display = "flex"; results.style.flexDirection = "column"; results.style.gap = "8px";
    const closeBtn = document.createElement("button"); closeBtn.innerText = "Close"; closeBtn.style.padding = "12px"; closeBtn.style.width = "100%"; closeBtn.style.marginTop = "16px"; closeBtn.style.borderRadius = "12px"; closeBtn.style.border = "none"; closeBtn.style.backgroundColor = "#ef4444"; closeBtn.style.color = "#fff"; closeBtn.style.fontSize = "18px"; closeBtn.style.cursor = "pointer"; closeBtn.onclick = () => modal.remove();
    input.oninput = (e) => {
        results.innerHTML = ""; const q = e.target.value.toLowerCase().trim(); if (!q) return;
        const matched = chatsHistory.filter(c => c.title.toLowerCase().includes(q) || c.apiHistory.some(m => m.content.toLowerCase().includes(q)));
        if (matched.length === 0) results.innerHTML = "<div style='color:var(--text-sub); font-size:15px; text-align:center; padding: 10px;'>No results found.</div>";
        matched.forEach(chat => {
            const item = document.createElement("div"); item.innerText = chat.title; item.style.padding = "14px"; item.style.backgroundColor = "var(--bg-input)"; item.style.border = "1px solid var(--border-color)"; item.style.borderRadius = "12px"; item.style.cursor = "pointer"; item.style.transition = "background-color 0.2s";
            item.onmouseover = () => item.style.backgroundColor = "#9333ea"; item.onmouseleave = () => item.style.backgroundColor = "var(--bg-input)";
            item.onclick = () => { loadChat(chat.id); modal.remove(); }; results.appendChild(item);
        });
    };
    box.appendChild(title); box.appendChild(input); box.appendChild(results); box.appendChild(closeBtn); modal.appendChild(box); document.body.appendChild(modal);
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

function archiveActiveChat() {
    const log = document.getElementById("chat-log"); if (!log) return;
    const bubbles = log.querySelectorAll('.chat-bubble');
    if (bubbles.length > 0 && activeChatId && !isDM) {
        let existing = chatsHistory.find(c => c.id === activeChatId);
        if (existing) { existing.html = log.innerHTML; existing.apiHistory = [...chatHistory]; } 
        else {
            const firstMsgText = bubbles[0].innerText || "Chat Session";
            const newTitle = firstMsgText.length > 20 ? firstMsgText.substring(0, 20) + "..." : firstMsgText;
            chatsHistory.unshift({ id: activeChatId, title: newTitle, html: log.innerHTML, apiHistory: [...chatHistory], pinned: false });
        }
    }
    saveSessionData(); renderChatHistorySidebar();
}

function clearPendingImage() {
    pendingImageBase64 = null; pendingImageMime = null; pendingImageSrc = null;
    const filePicker = document.getElementById('native-file-picker'); if (filePicker) filePicker.value = "";
    const box = document.getElementById('image-preview-box'); if (box) box.classList.remove('active');
}

function renderChatHistorySidebar() {
    const container = document.getElementById("saved-chats-list"); if (!container) return; container.innerHTML = "";
    const sortedChats = [...chatsHistory].sort((a, b) => { if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return 0; });
    sortedChats.forEach(chat => {
        const item = document.createElement("div"); item.className = "saved-chat-item";
        const titleContainer = document.createElement("div"); titleContainer.className = "chat-title-text";
        if (chat.pinned) {
            const pinIcon = document.createElement("img"); pinIcon.className = "pinned-icon-img";
            pinIcon.src = "/static/icons/PinIcon.png"; pinIcon.alt = "Pinned"; pinIcon.draggable = false;
            titleContainer.appendChild(pinIcon);
        }
        const titleText = document.createElement("span"); titleText.innerText = chat.title;
        titleContainer.appendChild(titleText); titleContainer.onclick = () => loadChat(chat.id);
        const optionsBtn = document.createElement("button"); optionsBtn.className = "chat-options-btn"; optionsBtn.innerText = "⋮";
        const dropdown = document.createElement("div"); dropdown.className = "chat-dropdown-menu";
        const editBtn = document.createElement("button"); editBtn.className = "chat-dropdown-item"; editBtn.innerText = "Edit Name";
        editBtn.onclick = (e) => { e.stopPropagation(); editChatTitle(chat.id); dropdown.classList.remove('active'); };
        const pinBtn = document.createElement("button"); pinBtn.className = "chat-dropdown-item"; pinBtn.innerText = chat.pinned ? "Unpin Chat" : "Pin Chat";
        pinBtn.onclick = (e) => { e.stopPropagation(); togglePinChat(chat.id); dropdown.classList.remove('active'); };
        const deleteBtn = document.createElement("button"); deleteBtn.className = "chat-dropdown-item delete"; deleteBtn.innerText = "Delete";
        deleteBtn.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); dropdown.classList.remove('active'); };
        dropdown.appendChild(editBtn); dropdown.appendChild(pinBtn); dropdown.appendChild(deleteBtn);
        optionsBtn.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.chat-dropdown-menu.active').forEach(menu => { if (menu !== dropdown) menu.classList.remove('active'); }); dropdown.classList.toggle('active'); };
        item.appendChild(titleContainer); item.appendChild(optionsBtn); item.appendChild(dropdown); container.appendChild(item);
    });
}

document.addEventListener("click", () => { document.querySelectorAll('.chat-dropdown-menu.active').forEach(menu => menu.classList.remove('active')); });
function editChatTitle(chatId) { const chat = chatsHistory.find(c => c.id === chatId); if (!chat) return; const newTitle = prompt("Enter a new name for this chat:", chat.title); if (newTitle && newTitle.trim() !== "") { chat.title = newTitle.trim(); saveSessionData(); renderChatHistorySidebar(); } }
function togglePinChat(chatId) { const chat = chatsHistory.find(c => c.id === chatId); if (!chat) return; chat.pinned = !chat.pinned; saveSessionData(); renderChatHistorySidebar(); }
function deleteChat(chatId) { if (confirm("Are you sure you want to delete this chat forever?")) { chatsHistory = chatsHistory.filter(c => c.id !== chatId); if (activeChatId === chatId) startNewChat(); else { saveSessionData(); renderChatHistorySidebar(); } } }

function updateUsageUI() {
    const fillEl = document.getElementById("usage-fill"), textEl = document.getElementById("usage-text"); if (!fillEl || !textEl) return;
    if (hasValidApiKey()) { fillEl.style.width = "100%"; textEl.innerText = "Unlimited"; } else {
        const today = new Date().toISOString().split('T')[0]; let lastDate = localStorage.getItem("carl_last_msg_date"); let count = parseInt(localStorage.getItem("carl_msg_count") || "0", 10);
        if (lastDate !== today) { lastDate = today; count = 0; localStorage.setItem("carl_last_msg_date", today); localStorage.setItem("carl_msg_count", "0"); }
        let percent = (count / 10) * 100; if (percent > 100) percent = 100; fillEl.style.width = `${percent}%`; textEl.innerText = `${count}/10`;
    }
}

function processFile(file) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            pendingImageSrc = event.target.result; pendingImageMime = pendingImageSrc.split(';')[0].split(':')[1]; pendingImageBase64 = pendingImageSrc.split(',')[1];
            const imgEl = document.getElementById('image-preview-img'), boxEl = document.getElementById('image-preview-box');
            if (imgEl && boxEl) { imgEl.src = pendingImageSrc; boxEl.classList.add('active'); }
        };
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = function(event) {
            const text = event.target.result, input = document.getElementById("user-input");
            if (input) input.value += `\n\`\`\`${file.name.split('.').pop() || ''}\n${text}\n\`\`\`\n`;
        };
        reader.readAsText(file);
    }
}

const filePicker = document.getElementById('native-file-picker');
if (filePicker) { filePicker.addEventListener('change', function(e) { const file = e.target.files[0]; if (!file) return; processFile(file); filePicker.value = ""; }); }

let dragCounter = 0; const dragOverlay = document.getElementById('drag-drop-overlay'), dragChatView = document.getElementById('view-chat');
if (dragChatView && dragOverlay) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => window.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }, false));
    window.addEventListener('dragenter', (e) => { if (dragChatView.classList.contains('active')) { dragCounter++; dragOverlay.classList.add('active'); } });
    window.addEventListener('dragleave', (e) => { if (dragChatView.classList.contains('active')) { dragCounter--; if (dragCounter <= 0) { dragCounter = 0; dragOverlay.classList.remove('active'); } } });
    window.addEventListener('drop', (e) => { dragCounter = 0; dragOverlay.classList.remove('active'); if (dragChatView.classList.contains('active') && e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
}

window.copyCode = function(button) { const code = decodeURIComponent(button.getAttribute("data-code")); navigator.clipboard.writeText(code).then(() => showCopyToast()).catch(err => console.error("Copy failed", err)); };

function showCopyToast() {
    let toast = document.getElementById('copy-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'copy-toast'; toast.className = 'copy-toast'; toast.innerHTML = `<img src="/static/icons/CopyIcon.png" alt="Copy"><span>Text Copied</span>`; document.body.appendChild(toast); }
    toast.classList.add('show'); if (window.copyToastTimeout) clearTimeout(window.copyToastTimeout); window.copyToastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatMessage(text) {
    let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)(```|$)/g;
    safeText = safeText.replace(codeBlockRegex, (match, lang, code) => {
        const displayLang = (lang || "CODE").toUpperCase(), encodedCode = encodeURIComponent(code);
        let styledCode = code.replace(/(["'])(.*?)\1/g, '<span style="color: #4ade80;">"$2"</span>');
        return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-language">${displayLang}</span><button class="copy-code-btn" data-code="${encodedCode}" onclick="copyCode(this)"><img src="/static/icons/CopyIcon.png" alt="Copy"></button></div><div class="code-block-body">${styledCode.trim()}</div></div>`;
    });
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safeText = safeText.replace(/`([^`]+)`/g, '<span class="inline-code">$1</span>');
    return safeText;
}

function appendMessage(msg, sender, imgSrc = null) {
    const log = document.getElementById("chat-log"); if (!log) return;
    const bubble = document.createElement("div"); bubble.className = `chat-bubble ${sender}`;
    if (msg) { const textNode = document.createElement("div"); textNode.innerText = msg; bubble.appendChild(textNode); }
    if (imgSrc) { const img = document.createElement("img"); img.src = imgSrc; img.className = "chat-image"; img.draggable = false; bubble.appendChild(img); }
    log.appendChild(bubble); log.scrollTop = log.scrollHeight;
}

// =========================================================================
// --- CALL FEATURE (Carl AI) ---
// =========================================================================
let isCallActive = false, isCallConnected = false, isMuted = false, isSpeakerOn = true;
let callTimerInterval = null, callSeconds = 0, ringTimeout = null, ringInterval = null;
let audioCtx = null, recognition = null, callAbortController = null, carlVoice = null;

function loadCarlVoice() { 
    if (!('speechSynthesis' in window)) return; 
    const voices = window.speechSynthesis.getVoices(); 
    if (voices.length === 0) return;
    carlVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Google US English') || v.name.includes('Aaron') || v.name.includes('Guy') || v.name.includes('Male'))) || voices.find(v => v.lang.startsWith('en')) || voices[0]; 
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

function playToneBurst(f1, f2, d) { 
    try { 
        const cx = getAudioContext(), o1 = cx.createOscillator(), o2 = cx.createOscillator(), g = cx.createGain(); 
        o1.frequency.value = f1; o2.frequency.value = f2; 
        g.gain.setValueAtTime(0.15, cx.currentTime); 
        g.gain.setValueAtTime(0.15, cx.currentTime + d - 0.05); 
        g.gain.linearRampToValueAtTime(0.001, cx.currentTime + d); 
        o1.connect(g); o2.connect(g); g.connect(cx.destination); 
        o1.start(cx.currentTime); o2.start(cx.currentTime); 
        o1.stop(cx.currentTime + d); o2.stop(cx.currentTime + d); 
    } catch (e) {} 
}

function startRingingSound() { 
    playToneBurst(440, 480, 2.0); 
    ringInterval = setInterval(() => { 
        if (!isCallActive || isCallConnected) { clearInterval(ringInterval); return; } 
        playToneBurst(440, 480, 2.0); 
    }, 4000); 
}

function stopRingingSound() { 
    if (ringInterval) { clearInterval(ringInterval); ringInterval = null; } 
}

function playPickupClick() { 
    try { 
        const cx = getAudioContext(), o = cx.createOscillator(), g = cx.createGain(); 
        o.type = 'triangle'; o.frequency.setValueAtTime(800, cx.currentTime); 
        o.frequency.exponentialRampToValueAtTime(150, cx.currentTime + 0.08); 
        g.gain.setValueAtTime(0.3, cx.currentTime); 
        g.gain.exponentialRampToValueAtTime(0.01, cx.currentTime + 0.08); 
        o.connect(g); g.connect(cx.destination); o.start(); o.stop(cx.currentTime + 0.08); 
    } catch (e) {} 
}

function startCall() { 
    if (!hasValidApiKey()) { 
        alert("Calling Carl requires a custom Gemini API Key in Settings!"); 
        switchView('view-settings'); 
        return; 
    } 
    switchView('view-call'); 
    isCallActive = true; isCallConnected = false; isMuted = false; callSeconds = 0; 
    getAudioContext(); 
    if ('speechSynthesis' in window) { 
        let w = new SpeechSynthesisUtterance(''); w.volume = 0; window.speechSynthesis.speak(w); 
    } 
    document.getElementById("call-status").innerText = "Calling Carl..."; 
    document.getElementById("call-status").style.display = "block"; 
    document.getElementById("call-timer").innerText = "00:00"; 
    document.getElementById("mute-btn").style.opacity = "1"; 
    document.getElementById("speaker-btn").style.opacity = isSpeakerOn ? "1" : "0.4"; 
    
    startRingingSound(); 
    const d = Math.floor(Math.random() * 4000) + 1500; 
    ringTimeout = setTimeout(() => { 
        if (!isCallActive) return; 
        stopRingingSound(); playPickupClick(); isCallConnected = true; 
        document.getElementById("call-status").style.display = "none"; 
        callTimerInterval = setInterval(() => { 
            callSeconds++; 
            const m = String(Math.floor(callSeconds / 60)).padStart(2, '0'), 
                  s = String(Math.floor(callSeconds % 60)).padStart(2, '0'); 
            document.getElementById("call-timer").innerText = `${m}:${s}`; 
        }, 1000); 
        initSpeechRecognition(); 
        speakCarl("Hey! Carl here. What's on your mind?"); 
    }, d); 
}

function endCall() { 
    isCallActive = false; isCallConnected = false; 
    if (ringTimeout) clearTimeout(ringTimeout); 
    stopRingingSound(); 
    if (callTimerInterval) clearInterval(callTimerInterval); 
    if ('speechSynthesis' in window) window.speechSynthesis.cancel(); 
    if (callAbortController) callAbortController.abort(); 
    if (recognition) { try { recognition.stop(); } catch (e) {} recognition = null; } 
    document.getElementById("call-timer").innerText = "00:00"; 
    document.getElementById("call-status").style.display = "none"; 
    switchView('view-chat'); 
}

function toggleMute() { 
    isMuted = !isMuted; 
    const b = document.getElementById("mute-btn"); 
    if (isMuted) { 
        b.style.opacity = "0.4"; 
        if (recognition) try { recognition.stop(); } catch (e) {} 
    } else { 
        b.style.opacity = "1"; 
        if (recognition && isCallActive && isCallConnected) try { recognition.start(); } catch (e) {} 
    } 
}

function toggleSpeaker() { 
    isSpeakerOn = !isSpeakerOn; 
    document.getElementById("speaker-btn").style.opacity = isSpeakerOn ? "1" : "0.4"; 
}

function speakCarl(txt) { 
    if (!('speechSynthesis' in window) || !isCallActive) return; 
    let ct = txt.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/[*_#~]/g, '').trim(); 
    if (!ct) return; 
    const u = new SpeechSynthesisUtterance(ct); 
    if (!carlVoice) loadCarlVoice(); 
    if (carlVoice) u.voice = carlVoice; 
    u.rate = 1.05; u.volume = isSpeakerOn ? 1.0 : 0.15; 
    window.speechSynthesis.speak(u); 
}

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { 
        document.getElementById("call-status").innerText = "Browser doesn't support mic!"; 
        document.getElementById("call-status").style.display = "block"; 
        return; 
    }
    recognition = new SpeechRecognition(); 
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = 'en-US';
    recognition.onresult = async (event) => {
        if (isMuted || !isCallActive || !isCallConnected) return;
        let interimTranscript = '', finalTranscript = '';
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
            document.getElementById("call-status").style.display = "block";
            await processCallUserMessage(userQuery);
        }
    };
    recognition.onerror = (e) => { 
        if (e.error === 'not-allowed') { 
            document.getElementById("call-status").innerText = "Mic Permission Denied"; 
            document.getElementById("call-status").style.display = "block"; 
        } 
    };
    recognition.onend = () => { 
        if (isCallActive && isCallConnected && !isMuted) try { recognition.start(); } catch (e) {} 
    };
    try { recognition.start(); } catch (e) {}
}

async function processCallUserMessage(t) {
    if (!isCallActive) return;
    callAbortController = new AbortController(); 
    chatHistory.push({ role: "user", content: t });
    const uLT = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }), 
          uTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const p = { 
        message: t, history: chatHistory, image_b64: null, image_mime: null, 
        api_key: customApiKey, user_time: uLT, user_timezone: uTZ, client_time: `${uLT} (${uTZ})` 
    };
    try {
        const res = await fetch("/api/chat", { 
            method: "POST", headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(p), signal: callAbortController.signal 
        });
        if (!res.ok) return;
        const rdr = res.body.getReader(), dcd = new TextDecoder(); 
        let fR = "", sB = "";
        document.getElementById("call-status").style.display = "none";
        while (true) {
            const { done, value } = await rdr.read(); if (done) break;
            const chk = dcd.decode(value, { stream: true }); fR += chk; sB += chk;
            let m;
            while ((m = sB.match(/([^.!?]+[.!?])/))) {
                let s = m[0].trim(); sB = sB.substring(m[0].length);
                for (let px of ["Carl:", "carl:", "Carl - "]) if (s.startsWith(px)) s = s.replace(px, "").trim();
                if (s) speakCarl(s);
            }
        }
        if (sB.trim()) { 
            let lo = sB.trim(); 
            for (let px of ["Carl:", "carl:", "Carl - "]) if (lo.startsWith(px)) lo = lo.replace(px, "").trim(); 
            speakCarl(lo); 
        }
        chatHistory.push({ role: "assistant", content: fR });
    } catch (e) {}
}
