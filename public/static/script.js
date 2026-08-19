let pendingAuthCredentials = { email: "", pass: "" };

async function handleLogin(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const email = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !pass) {
        alert("Please enter both an email and a password.");
        return;
    }

    submitBtn.innerText = "Checking Account...";
    submitBtn.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        const overlay = document.getElementById('auth-overlay');
        if (overlay) overlay.style.display = 'none';
        document.getElementById('auth-password').value = "";
    } catch (err) {
        const isCredentialMismatch = [
            'auth/invalid-login-credentials',
            'auth/invalid-credential',
            'auth/wrong-password',
            'auth/user-not-found'
        ].includes(err.code);

        if (isCredentialMismatch) {
            const wantsToRegister = confirm(
                "Sign-in failed: Incorrect password OR account not registered.\n\n" +
                "• Click CANCEL to re-enter your password.\n" +
                "• Click OK to REGISTER a new account with this email."
            );

            if (wantsToRegister) {
                submitBtn.innerText = "Creating Account...";
                try {
                    await auth.createUserWithEmailAndPassword(email, pass);
                    const overlay = document.getElementById('auth-overlay');
                    if (overlay) overlay.style.display = 'none';
                    alert("Account created successfully! Welcome to Carl AI.");
                    document.getElementById('auth-password').value = "";
                } catch (regErr) {
                    if (regErr.code === 'auth/email-already-in-use') {
                        alert("This email is already in use. Please enter the correct password to log in.");
                    } else if (regErr.code === 'auth/weak-password') {
                        alert("Password is too weak. Please use at least 6 characters.");
                    } else {
                        alert("Registration Error: " + regErr.message);
                    }
                }
            }
        } else {
            alert("Login Error: " + err.message);
        }
    } finally {
        if (submitBtn) {
            submitBtn.innerText = "Sign In / Register";
            submitBtn.disabled = false;
        }
    }
}

// --- PASSWORD RESET ---
async function resetPassword() {
    const email = document.getElementById('auth-username').value.trim();
    if (!email) {
        alert("Please enter your email address in the top box first, then click 'Forgot Password?'.");
        return;
    }
    try {
        await auth.sendPasswordResetEmail(email);
        alert(`A password reset link has been sent to ${email}!\n\nCheck your inbox, click the link to create a new password, and then come back here to log in.`);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            alert("No account found with that email address.");
        } else {
            alert("Error: " + error.message);
        }
    }
}

async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    const code = document.getElementById('auth-otp-code').value.trim();
    const verifyBtn = document.getElementById('otp-verify-btn');

    if (code.length !== 5) { alert("Please enter the full 5-digit code."); return; }

    verifyBtn.innerText = "Verifying..."; verifyBtn.disabled = true;

    try {
        const res = await fetch("/api/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: pendingAuthCredentials.email, code: code })
        });
        const data = await res.json();

        if (!res.ok || data.error) {
            alert(data.error || "Incorrect or expired verification code.");
            verifyBtn.innerText = "Verify Code"; verifyBtn.disabled = false;
            return;
        }

        await auth.createUserWithEmailAndPassword(pendingAuthCredentials.email, pendingAuthCredentials.pass);

        document.getElementById("auth-step-otp").style.display = "none";
        document.getElementById("auth-step-credentials").style.display = "block";
        pendingAuthCredentials = { email: "", pass: "" };
        alert("Account verified and registered successfully!");

    } catch (err) {
        alert("Error creating account: " + err.message);
    } finally {
        if(verifyBtn) {
            verifyBtn.innerText = "Verify Code"; verifyBtn.disabled = false;
        }
    }
}

function cancelOtpStep() {
    document.getElementById("auth-step-otp").style.display = "none";
    document.getElementById("auth-step-credentials").style.display = "block";
    pendingAuthCredentials = { email: "", pass: "" };
}

const firebaseConfig = { apiKey: "AIzaSyB6q-h3daznHtyF3tVoQh1W38hNiD7qqGg", authDomain: "carl-ai-loggins.firebaseapp.com", projectId: "carl-ai-loggins", storageBucket: "carl-ai-loggins.firebasestorage.app", messagingSenderId: "372926140822", appId: "1:372926140822:web:4bf13c6dd802cbc047cdb7", measurementId: "G-G4H60BZHT3" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();

let firebaseUserId=null, currentUser=null, currentUserAvatar="/static/icons/default-avatar.png", customApiKey="";
let chatsHistory=[], activeChatId=null, chatHistory=[];  
let selectedGame="Burger Clicker"; const gamesWithDifficulty=["Tic Tac Toe", "Chess", "Hangman", "Connect Four", "Checkers"];
let pendingImageBase64=null, pendingImageMime=null, pendingImageSrc=null, pendingDmImageBase64=null, pendingDmImageMime=null, pendingDmImageSrc=null, currentDmUser=null; 
let pendingGlobalImageBase64=null, pendingGlobalImageMime=null, pendingGlobalImageSrc=null;
let pendingGroupImageBase64=null, pendingGroupImageMime=null, pendingGroupImageSrc=null;
let isDM=false, currentDmUnsubscribe=null;
let globalChatUnsubscribe=null, groupChatUnsubscribe=null, activeGroupId=null, myGroups=[];
let isGuest = false;

// --- BURGER ECONOMY & SHOP INVENTORY ---
let userBurgers=100, clickerBurgers=0, rebirths=0, clickPower=1, autoChefs=0, burgerStands=0, burgerFactories=0;   
let inventory = [];
let userPresets = [];
let claimedCodes = []; 
let userNotes = ""; 
let equipped = {
    persona: "default",
    bubble: "default",
    frame: "default",
    title: "",
    background: "default",
    c4Skin: "default",
    bjFelt: "default",
    goldenSpatula: false
};

function getMultiplier() { 
    let mult = 1 + (rebirths * 1.0);
    if (equipped.goldenSpatula) mult *= 1.5; 
    return mult;
}

// Corrected Math: Base Cost scales by 1.2x. Base Production scales by 1.5x.
function getClickValue() { return Math.floor(1 * Math.pow(1.5, clickPower - 1)) * getMultiplier(); }
function getChefPower() { return autoChefs === 0 ? 0 : Math.floor(1 * Math.pow(1.5, autoChefs - 1)); }
function getStandPower() { return burgerStands === 0 ? 0 : Math.floor(10 * Math.pow(1.5, burgerStands - 1)); }
function getFactoryPower() { return burgerFactories === 0 ? 0 : Math.floor(100 * Math.pow(1.5, burgerFactories - 1)); }

function getBps() { return ((autoChefs * getChefPower()) + (burgerStands * getStandPower()) + (burgerFactories * getFactoryPower())) * getMultiplier(); }

function updateBurgerUI() {
    const hc=document.getElementById("burger-count"); if(hc) hc.innerText = Math.floor(userBurgers).toLocaleString();
    const cc=document.getElementById("clicker-score-text"); if(cc) cc.innerText = Math.floor(clickerBurgers).toLocaleString();
}
setInterval(() => { let bps = getBps(); if (bps > 0) { clickerBurgers += bps; updateBurgerUI(); } }, 1000);

const normalPhrases=["Ready When You Are", "What Time Is It?", "I Need Help With Math", "The Floor Is Yours!"], rarePhrases=["Mmmm Burgers", "I weigh 700 pounds", "67", "The ultimate burger fun fact centers on Don Gorske of Wisconsin, who has eaten more than 34,000 Big Macs over a meticulous 50-year streak that began on May 17, 1972. After buying his first car and eating three Big Macs to celebrate, Gorske decided to make the sandwich his primary daily meal, eventually earning a Guinness World Record by keeping every single receipt and carton in organized binders. While modern health logic and documentaries like Super Size Me suggest a strict fast-food diet would cause severe medical issues, Gorske has baffled doctors for decades with excellent cholesterol and normal blood pressure. His secret to surviving tens of thousands of processed burgers relies on a strict lifestyle quirk: he consistently walks six miles a day, drinks only diet soda, and crucially, always skips the French fries."];
let typingTimeout=null;
function initTypingAnimation() {
    const t=document.getElementById("startup-title"); if(!t) return; if(typingTimeout) clearTimeout(typingTimeout);
    let isDel=false, curTxt="Ask Away!", idx=curTxt.length; t.innerHTML='Ask Away!<span class="typing-cursor"></span>';
    typingTimeout=setTimeout(()=>{isDel=true; typeLoop(t,curTxt,idx,isDel);},2000);
}
function typeLoop(t, curTxt, idx, isDel) {
    let spd=isDel?45:65+Math.random()*40; if(isDel) idx--; else idx++;
    t.innerHTML=curTxt.substring(0,idx)+'<span class="typing-cursor"></span>';
    if(!isDel && idx===curTxt.length) { spd=2400; isDel=true; } 
    else if(isDel && idx===0) { isDel=false; const pool=Math.random()<0.10?rarePhrases:normalPhrases; let n=curTxt; while(n===curTxt) n=pool[Math.floor(Math.random()*pool.length)]; curTxt=n; spd=400; }
    typingTimeout=setTimeout(()=>typeLoop(t,curTxt,idx,isDel),spd);
}
function hideStartupScreen() { const s=document.getElementById("startup-screen"), c=document.getElementById("view-chat"); if(s) s.classList.add("hidden"); if(c) c.classList.remove("startup-active"); if(typingTimeout) clearTimeout(typingTimeout); }
function showStartupScreen() { const s=document.getElementById("startup-screen"), c=document.getElementById("view-chat"); if(s) { s.classList.remove("hidden"); initTypingAnimation(); } if(c) c.classList.add("startup-active"); }
function hasValidApiKey() { return customApiKey && customApiKey.trim().length > 20; }

window.addEventListener("DOMContentLoaded", () => {
    initMobileNavIcons(); initTypingAnimation(); updateUsageUI(); updateBurgerUI();
    const oldNav = document.querySelector('.bottom-nav'); if (oldNav) oldNav.style.display = 'none';
    if (!document.getElementById("mobile-hamburger-btn")) {
        const hb = document.createElement("button"); hb.id = "mobile-hamburger-btn"; hb.className = "mobile-top-header";
        hb.innerHTML = `<div class="hamburger-line"></div><div class="hamburger-line"></div><div class="hamburger-line"></div>`;
        hb.onclick = toggleMobileSidebar; document.body.appendChild(hb);
    }
    if (!document.getElementById("sidebar-overlay")) {
        const ov = document.createElement("div"); ov.id = "sidebar-overlay"; ov.className = "sidebar-overlay"; ov.onclick = toggleMobileSidebar; document.body.appendChild(ov);
    }
    const dmInp = document.getElementById("dm-input"); if(dmInp) dmInp.addEventListener("keypress", (e) => { if(e.key==="Enter") sendDmMessage(); });
    const glInp = document.getElementById("global-input"); if(glInp) glInp.addEventListener("keypress", (e) => { if(e.key==="Enter") sendGlobalMessage(); });
    const grInp = document.getElementById("group-input"); if(grInp) grInp.addEventListener("keypress", (e) => { if(e.key==="Enter") sendGroupMessage(); });
    
    const sBtn = document.getElementById("send-btn"); if(sBtn) sBtn.addEventListener("click", sendMessage);
    const uInp = document.getElementById("user-input"); if(uInp) uInp.addEventListener("keypress", (e) => { if(e.key==="Enter") sendMessage(); });
});

function toggleMobileSidebar() { const sb=document.querySelector('.desktop-sidebar'), ov=document.getElementById('sidebar-overlay'); if(sb) sb.classList.toggle('open'); if(ov) ov.classList.toggle('active'); }

// --- AUTHENTICATION ---
function continueAsGuest() {
    isGuest = true;
    document.getElementById('auth-overlay').style.display = 'none';
    document.body.classList.add('guest-mode');
    currentUser = "Guest";
    currentUserAvatar = "/static/icons/default-avatar.png";
    updateProfileUI();
    startNewChat();
}

auth.onAuthStateChanged(async (user) => {
    const ov = document.getElementById('auth-overlay');
    if (user) {
        isGuest = false;
        document.body.classList.remove('guest-mode');
        firebaseUserId = user.uid; currentUser = user.displayName || user.email.split('@')[0]; currentUserAvatar = user.photoURL || "/static/icons/default-avatar.png";
        if (ov) ov.style.display = 'none'; await loadUserDataFromCloud();
    } else if (!isGuest) { 
        firebaseUserId = null; if (ov) ov.style.display = 'flex'; 
    }
});

function signInWithGoogle() { const p = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(p).catch(e => alert("Google Sign-In Error: " + e.message)); }
function handleSignOut() {
    if (isGuest) {
        window.location.reload();
        return;
    }
    auth.signOut().then(() => {
        currentUser=null; currentUserAvatar="/static/icons/default-avatar.png"; customApiKey="";
        chatsHistory=[]; chatHistory=[]; activeChatId=null; myFriends=[]; myRequests=[]; mySentRequests=[]; currentDmUser=null; myGroups=[];
        userBurgers=100; clickerBurgers=0; autoChefs=0; burgerStands=0; burgerFactories=0; clickPower=1; rebirths=0;
        inventory=[]; userPresets=[]; claimedCodes=[]; equipped={ persona:"default", bubble:"default", frame:"default", title:"", background:"default", c4Skin:"default", bjFelt:"default", goldenSpatula:false };
        
        userNotes = "";
        const editor = document.getElementById("notepad-editor");
        if (editor) editor.innerHTML = "";
        const floatingNotepad = document.getElementById("floating-notepad");
        if (floatingNotepad) floatingNotepad.classList.remove("active");
        
        if (groupsUnsubscribe) { groupsUnsubscribe(); groupsUnsubscribe=null; }
        if (globalChatUnsubscribe) { globalChatUnsubscribe(); globalChatUnsubscribe=null; }
        if (groupChatUnsubscribe) { groupChatUnsubscribe(); groupChatUnsubscribe=null; }

        updateBurgerUI(); updateProfileUI(); applyEquippedCosmetics(); renderChatHistorySidebar(); switchView('view-chat'); showStartupScreen(); updateUsageUI();
    });
}

// --- CLOUD PERSISTENCE ---
let myFriends=[], myRequests=[], mySentRequests=[];
let groupsUnsubscribe = null;
let isAdmin = false;

function listenToMyGroups() {
    if (!firebaseUserId) return;
    if (groupsUnsubscribe) groupsUnsubscribe();
    groupsUnsubscribe = db.collection("groups").where("members", "array-contains", firebaseUserId).onSnapshot(snapshot => {
        myGroups = [];
        snapshot.forEach(doc => myGroups.push({ id: doc.id, ...doc.data() }));
        if (document.getElementById('view-friends').classList.contains('active')) renderFriendsView();
    });
}

async function loadUserDataFromCloud() {
    if (!firebaseUserId) return;
    listenToMyGroups();
    db.collection("users").doc(firebaseUserId).onSnapshot(async (doc) => {
        if (doc.exists) {
            const data = doc.data(); customApiKey = data.apiKey || ""; chatsHistory = data.chats || [];
            if (!isDM && document.getElementById('view-chat').classList.contains('active')) activeChatId = data.activeChatId || null; 
            applyTheme(data.theme || "dark");
            userBurgers = data.burgers !== undefined ? data.burgers : 100; clickerBurgers = data.clickerBurgers || 0; autoChefs = data.autoChefs || 0; burgerStands = data.burgerStands || 0; burgerFactories = data.burgerFactories || 0; clickPower = data.clickPower || 1; rebirths = data.rebirths || 0;
            myFriends = data.friends || []; myRequests = data.friendRequests || []; mySentRequests = data.sentRequests || []; 
            inventory = data.inventory || [];
            userPresets = data.presets || [];
            claimedCodes = data.claimedCodes || [];
            if (data.equipped) equipped = { ...equipped, ...data.equipped };
            updateBurgerUI();
            if (data.avatar) currentUserAvatar = data.avatar; if (data.username) currentUser = data.username;
            
            // Check for Admin
            if (claimedCodes.includes("Admin1234")) {
                isAdmin = true;
                document.getElementById("admin-panel-row").style.display = "flex";
            }

            // LOAD NOTES
            userNotes = data.notes || "";
            const editor = document.getElementById("notepad-editor");
            if (editor) editor.innerHTML = userNotes;

            updateProfileUI(); applyEquippedCosmetics();
            const keyInp = document.getElementById('user-api-key'); if (keyInp) keyInp.value = customApiKey; const usrInp = document.getElementById('settings-username-input'); if (usrInp) usrInp.value = currentUser;
            renderChatHistorySidebar(); updateUsageUI(); 
            if (document.getElementById('view-friends').classList.contains('active')) renderFriendsView();
            if (document.getElementById('view-shop').classList.contains('active')) renderShopView();
            if (document.getElementById('view-inventory').classList.contains('active')) renderInventoryView();
        } else { saveSessionData(); startNewChat(); }
    }, e => console.error("Error:", e));
}
function saveSessionData() {
    if (!firebaseUserId) return; const cur = isDM ? (chatsHistory.length > 0 ? chatsHistory[0].id : null) : activeChatId;
    db.collection("users").doc(firebaseUserId).set({
        apiKey: customApiKey, chats: chatsHistory, activeChatId: cur, theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
        avatar: currentUserAvatar, username: currentUser, burgers: userBurgers, clickerBurgers: clickerBurgers, autoChefs: autoChefs, burgerStands: burgerStands, burgerFactories: burgerFactories, clickPower: clickPower, rebirths: rebirths,
        inventory: inventory, equipped: equipped, presets: userPresets, claimedCodes: claimedCodes,
        notes: userNotes 
    }, { merge: true }).catch(e => console.error("Error saving:", e));
}

// --- PROFILE & COSMETICS UI ---
function applyTheme(theme) { const b=document.body, ts=document.getElementById('theme-toggle-switch'); if(theme==="light"){ b.classList.remove("dark-mode"); b.classList.add("light-mode"); if(ts) ts.checked=true; } else { b.classList.remove("light-mode"); b.classList.add("dark-mode"); if(ts) ts.checked=false; } }
function toggleTheme() { const b=document.body, ts=document.getElementById('theme-toggle-switch'); if(b.classList.contains('dark-mode')){ b.classList.remove('dark-mode'); b.classList.add('light-mode'); if(ts) ts.checked=true; } else { b.classList.remove('light-mode'); b.classList.add('dark-mode'); if(ts) ts.checked=false; } saveSessionData(); }
function updateProfileUI() { 
    const a=document.getElementById("header-user-avatar"), n=document.getElementById("header-user-name"); 
    if(a) a.src=currentUserAvatar; 
    if(n) n.innerText=currentUser||"Guest"; 
}
function applyEquippedCosmetics() {
    const fWrap = document.getElementById("header-avatar-wrapper");
    if (fWrap) {
        fWrap.className = "avatar-frame-wrapper";
        if (equipped.frame && equipped.frame !== "default") fWrap.classList.add(`frame-${equipped.frame}`);
    }
    const bBadge = document.getElementById("header-user-badge");
    if (bBadge) {
        if (equipped.title) { bBadge.innerText = equipped.title; bBadge.style.display = "inline-block"; }
        else { bBadge.style.display = "none"; }
    }
    const glow = document.getElementById("glow-bg");
    const startupText = document.getElementById("startup-title");
    if (glow) {
        if (equipped.background === "gold") {
            glow.style.background = "radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#fcd34d"; startupText.style.textShadow = "0 0 40px rgba(245, 158, 11, 0.6)"; }
        } else if (equipped.background === "cyber") {
            glow.style.background = "radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#f472b6"; startupText.style.textShadow = "0 0 40px rgba(236, 72, 153, 0.6)"; }
        } else if (equipped.background === "ocean") {
            glow.style.background = "radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#7dd3fc"; startupText.style.textShadow = "0 0 40px rgba(14, 165, 233, 0.6)"; }
        } else if (equipped.background === "matrix") {
            glow.style.background = "radial-gradient(circle, rgba(34, 197, 94, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#86efac"; startupText.style.textShadow = "0 0 40px rgba(34, 197, 94, 0.6)"; }
        } else if (equipped.background === "void") {
            glow.style.background = "radial-gradient(circle, rgba(88, 28, 135, 0.1) 0%, transparent 70%)";
            if(startupText) { startupText.style.color = "#a855f7"; startupText.style.textShadow = "0 0 20px rgba(88, 28, 135, 0.3)"; }
        } else if (equipped.background === "inferno") {
            glow.style.background = "radial-gradient(circle, rgba(220, 38, 38, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#f87171"; startupText.style.textShadow = "0 0 40px rgba(220, 38, 38, 0.6)"; }
        } else if (equipped.background === "stars") {
            glow.style.background = "radial-gradient(circle, rgba(253, 224, 71, 0.15) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#fef08a"; startupText.style.textShadow = "0 0 30px rgba(253, 224, 71, 0.5)"; }
        } else if (equipped.background === "nebula") {
            glow.style.background = "radial-gradient(circle, rgba(139, 92, 246, 0.2) 0%, rgba(236, 72, 153, 0.1) 40%, transparent 70%)";
            if(startupText) { startupText.style.color = "#c4b5fd"; startupText.style.textShadow = "0 0 40px rgba(139, 92, 246, 0.6)"; }
        } else if (equipped.background === "bloodmoon") {
            glow.style.background = "radial-gradient(circle, rgba(153, 27, 27, 0.25) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#fca5a5"; startupText.style.textShadow = "0 0 40px rgba(153, 27, 27, 0.6)"; }
        } else {
            glow.style.background = "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 60%)";
            if(startupText) { startupText.style.color = "#d8b4fe"; startupText.style.textShadow = "0 0 40px rgba(168, 85, 247, 0.6)"; }
        }
    }
    const bjArena = document.getElementById("bj-felt-arena");
    if (bjArena) {
        bjArena.className = "bj-arena";
        if (equipped.bjFelt && equipped.bjFelt !== "default") bjArena.classList.add(`felt-${equipped.bjFelt}`);
    }
}
function updateUsernameFromSettings() { const inp=document.getElementById("settings-username-input"); if(!inp||!currentUser) return; const nn=inp.value.trim(); if(nn.length>=3 && nn.length<=20){ currentUser=nn; updateProfileUI(); saveSessionData(); } else { alert("Username must be between 3 and 20 characters!"); inp.value=currentUser||""; } }
function handleAvatarUpload(e) { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(ev){ currentUserAvatar=ev.target.result; updateProfileUI(); saveSessionData(); }; r.readAsDataURL(f); }
function saveSettings() { const ki=document.getElementById('user-api-key'); if(ki) customApiKey=ki.value.trim(); const np=document.getElementById('settings-new-pass').value, cp=document.getElementById('settings-confirm-pass').value; if(np||cp){ if(np===cp){ auth.currentUser.updatePassword(np).then(()=>{ alert("Password updated successfully."); document.getElementById('settings-new-pass').value=""; document.getElementById('settings-confirm-pass').value=""; }).catch(e=>alert(e.message)); } else alert("Passwords do not match!"); } saveSessionData(); updateUsageUI(); }
function toggleApiKeyHelp() { const hb=document.getElementById('api-key-help-box'); if(hb) hb.classList.toggle('hidden'); }
function toggleSidebar() { const sb=document.getElementById('desktop-sidebar'), btn=document.getElementById('sidebar-toggle-btn'); if(!sb) return; if(sb.classList.contains('expanded')){ sb.classList.remove('expanded'); sb.classList.add('collapsed'); if(btn) btn.innerText="❯"; } else { sb.classList.remove('collapsed'); sb.classList.add('expanded'); if(btn) btn.innerText="❮"; } }
function getDifficulty() { const s=document.getElementById("difficulty-select"); return s?s.value:"medium"; }

// --- PROMO CODE REDEMPTION ---
function redeemCode() {
    const inp = document.getElementById("promo-code-input");
    if(!inp) return;
    const code = inp.value.trim();
    if(!code) return;

    if (claimedCodes.includes(code)) {
        alert("You have already claimed this code!");
        inp.value = ""; return;
    }

    let success = false;
    if (code === "Burgers 1000") {
        userBurgers += 1000; updateBurgerUI(); success = true;
        alert("Successfully redeemed 1,000 Burgers!");
    } else if (code === "Admin1234") {
        if (!inventory.includes("title_admin")) inventory.push("title_admin");
        equipShopItem("title_admin", false); 
        success = true;
        isAdmin = true;
        document.getElementById("admin-panel-row").style.display = "flex";
        alert("Admin Title & Developer Panel Unlocked!");
    } else {
        alert("Invalid or expired promo code.");
    }

    if (success) { claimedCodes.push(code); saveSessionData(); }
    inp.value = "";
}

// --- ADMIN PANEL FUNCTIONS ---
function adminGiveBurgers() {
    if(!isAdmin) return;
    let amt = parseInt(document.getElementById("admin-add-burgers").value);
    if(amt) {
        userBurgers += amt;
        updateBurgerUI();
        saveSessionData();
        alert(`Successfully spawned ${amt.toLocaleString()} Real Burgers!`);
        document.getElementById("admin-add-burgers").value = "";
    }
}

function adminGiveClickerBurgers() {
    if(!isAdmin) return;
    let amt = parseInt(document.getElementById("admin-add-clicker").value);
    if(amt) {
        clickerBurgers += amt;
        updateBurgerUI();
        saveSessionData();
        alert(`Successfully spawned ${amt.toLocaleString()} Clicker Burgers!`);
        document.getElementById("admin-add-clicker").value = "";
    }
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); 
    const t=document.getElementById(viewId); if(t) t.classList.add('active');
    const sb=document.querySelector('.desktop-sidebar'), ov=document.getElementById('sidebar-overlay'); if(sb&&sb.classList.contains('open')) sb.classList.remove('open'); if(ov&&ov.classList.contains('active')) ov.classList.remove('active');
    
    // Clear out subscriptions if leaving their views
    if(viewId!=='view-dm'){ isDM=false; if(currentDmUnsubscribe){ currentDmUnsubscribe(); currentDmUnsubscribe=null; } }
    if(viewId!=='view-global-chat'){ if(globalChatUnsubscribe){ globalChatUnsubscribe(); globalChatUnsubscribe=null; } }
    if(viewId!=='view-group-chat'){ if(groupChatUnsubscribe){ groupChatUnsubscribe(); groupChatUnsubscribe=null; } }
    
    if(viewId==='view-games') updateDifficultyPickerVisibility(); 
    else if(viewId==='view-friends') fetchAllUsers(); 
    else if(viewId==='view-burgerclicker') updateUpgradesUI();
    else if(viewId==='view-shop') renderShopView();
    else if(viewId==='view-inventory') renderInventoryView();
}

// =========================================================================
// --- BURGER SHOP & INVENTORY SYSTEM (WITH MYSTERY LOOT BOX) ---
// =========================================================================
const shopCatalog = [
    { id: "persona_pirate", type: "persona", val: "pirate", name: "Pirate Carl", icon: "🏴‍☠️", cost: 1500, desc: "Carl speaks like a swashbuckling pirate matey in chat!" },
    { id: "persona_chef", type: "persona", val: "chef", name: "Gordon Chef Carl", icon: "👨‍🍳", cost: 2000, desc: "Carl reviews your questions like a furious five-star culinary chef." },
    { id: "persona_cyber", type: "persona", val: "cyber", name: "Cyberpunk Hacker", icon: "🤖", cost: 2500, desc: "Carl talks in cool dystopian cyberpunk terminology." },
    { id: "persona_sarcastic", type: "persona", val: "sarcastic", name: "Sarcastic Bot", icon: "😏", cost: 1800, desc: "Carl answers your questions with maximum sarcasm and wit." },
    { id: "persona_yoda", type: "persona", val: "yoda", name: "Master Yoda", icon: "🐸", cost: 2500, desc: "Carl speaks like Yoda. May the force be with you!" },
    { id: "persona_surfer", type: "persona", val: "surfer", name: "Surfer Dude", icon: "🏄", cost: 1200, desc: "Carl is a chill surfer dude. Gnarly!" },
    { id: "persona_dog", type: "persona", val: "dog", name: "Good Boy Carl", icon: "🐶", cost: 1200, desc: "Carl only speaks in enthusiastic barks and tail wags." },
    { id: "persona_alien", type: "persona", val: "alien", name: "Zorp from Mars", icon: "👽", cost: 3500, desc: "Carl transmits extraterrestrial cosmic knowledge." },
    { id: "persona_dracula", type: "persona", val: "dracula", name: "Count Carl", icon: "🦇", cost: 2000, desc: "Carl speaks like a thirsty vampire." },
    { id: "persona_knight", type: "persona", val: "knight", name: "Knight Carl", icon: "⚔️", cost: 2000, desc: "Carl speaks like a valiant medieval knight." },
    { id: "persona_wizard", type: "persona", val: "wizard", name: "Wizard Carl", icon: "🧙‍♂️", cost: 3000, desc: "Carl speaks like a wise, ancient wizard." },
    { id: "persona_ninja", type: "persona", val: "ninja", name: "Ninja Carl", icon: "🥷", cost: 2800, desc: "Carl answers with stealthy, disciplined precision." },
    { id: "persona_cowboy", type: "persona", val: "cowboy", name: "Cowboy Carl", icon: "🤠", cost: 1600, desc: "Carl speaks like a rootin' tootin' wild west cowboy." },
    { id: "persona_detective", type: "persona", val: "detective", name: "Detective Carl", icon: "🕵️‍♂️", cost: 2200, desc: "Carl investigates your prompts like a 1940s noir detective." },
    
    { id: "bubble_neon", type: "bubble", val: "neon", name: "Neon Cyber Bubble", icon: "💬", cost: 2000, desc: "Gives your chat messages a vibrant glowing cyan-blue gradient." },
    { id: "bubble_gold", type: "bubble", val: "gold", name: "Gold Foil Bubble", icon: "✨", cost: 3000, desc: "Wraps your chat messages in shiny luxury gold." },
    { id: "bubble_cyber", type: "bubble", val: "cyber", name: "Synthwave Bubble", icon: "🔮", cost: 2500, desc: "Deep purple-pink retro synthwave gradient." },
    { id: "bubble_lava", type: "bubble", val: "lava", name: "Magma Lava Bubble", icon: "🌋", cost: 2200, desc: "Fiery orange and red molten lava chat bubble." },
    { id: "bubble_forest", type: "bubble", val: "forest", name: "Enchanted Forest", icon: "🌲", cost: 2400, desc: "Mystical green and emerald chat bubble." },
    { id: "bubble_ocean", type: "bubble", val: "ocean", name: "Deep Ocean Bubble", icon: "🌊", cost: 2200, desc: "Cool and calming deep sea blue gradient." },
    { id: "bubble_matrix", type: "bubble", val: "matrix", name: "Hacker Terminal Bubble", icon: "💻", cost: 2500, desc: "Green and black matrix coding chat bubble." },
    { id: "bubble_galaxy", type: "bubble", val: "galaxy", name: "Galaxy Bubble", icon: "🌌", cost: 3500, desc: "Deep space cosmic chat bubble." },
    { id: "bubble_toxic", type: "bubble", val: "toxic", name: "Toxic Slime", icon: "☣️", cost: 2200, desc: "Radioactive neon green chat bubble." },
    { id: "bubble_plasma", type: "bubble", val: "plasma", name: "Plasma Bubble", icon: "🧬", cost: 3200, desc: "A super-heated, pulsating purple plasma bubble." },
    { id: "bubble_ice", type: "bubble", val: "ice", name: "Glacier Bubble", icon: "🧊", cost: 2600, desc: "A frozen, crystal-clear ice chat bubble." },
    { id: "bubble_ghost", type: "bubble", val: "ghost", name: "Phantom Bubble", icon: "👻", cost: 2800, desc: "A spooky, semi-transparent white and grey bubble." },
    { id: "bubble_electric", type: "bubble", val: "electric", name: "High Voltage Bubble", icon: "⚡", cost: 3000, desc: "A shocking yellow and bright cyan chat bubble." },

    { id: "frame_gold", type: "frame", val: "gold", name: "Golden Glow Frame", icon: "👑", cost: 3000, desc: "Surrounds your profile avatar with an aura of pure gold." },
    { id: "frame_neon", type: "frame", val: "neon", name: "Neon Pulse Frame", icon: "⚡", cost: 2800, desc: "Animated pulsing cyber frame around your picture." },
    { id: "frame_fire", type: "frame", val: "fire", name: "Inferno Frame", icon: "🔥", cost: 3500, desc: "Fiery red & orange border around your avatar." },
    { id: "frame_ice", type: "frame", val: "ice", name: "Frozen Frost Frame", icon: "❄️", cost: 2500, desc: "Chilly bright blue frosted border." },
    { id: "frame_lightning", type: "frame", val: "lightning", name: "Static Shock Frame", icon: "🌩️", cost: 3200, desc: "Crackling yellow and blue electrical border." },
    { id: "frame_amethyst", type: "frame", val: "amethyst", name: "Amethyst Crystal Frame", icon: "💎", cost: 3000, desc: "Radiant purple and magenta gem frame." },
    { id: "frame_blood", type: "frame", val: "blood", name: "Blood Moon Frame", icon: "🩸", cost: 4000, desc: "Dark crimson and black vampiric frame." },
    { id: "frame_diamond", type: "frame", val: "diamond", name: "Diamond Frame", icon: "💎", cost: 5000, desc: "Ultra luxury shiny diamond border." },
    { id: "frame_rainbow", type: "frame", val: "rainbow", name: "RGB Rainbow Frame", icon: "🌈", cost: 4500, desc: "Animated gamer RGB border." },
    { id: "frame_magma", type: "frame", val: "magma", name: "Magma Frame", icon: "🌋", cost: 3800, desc: "A molten rock border that burns with heat." },
    { id: "frame_hacker", type: "frame", val: "hacker", name: "Hacker Frame", icon: "💻", cost: 3200, desc: "A digital glitch-art border for your avatar." },
    { id: "frame_void", type: "frame", val: "void", name: "Void Frame", icon: "🕳️", cost: 5000, desc: "A pitch-black, dark matter gravitational frame." },
    { id: "frame_emerald", type: "frame", val: "emerald", name: "Emerald Frame", icon: "🟩", cost: 3000, desc: "A brilliant, glowing green gem frame." },
    { id: "frame_ruby", type: "frame", val: "ruby", name: "Ruby Frame", icon: "🟥", cost: 3000, desc: "A deep, glowing red gem frame." },

    { id: "title_baron", type: "title", val: "Burger Baron", name: "Title: Burger Baron", icon: "🍔", cost: 1500, desc: "Displays the [BURGER BARON] badge next to your name." },
    { id: "title_grandmaster", type: "title", val: "Grandmaster", name: "Title: Grandmaster", icon: "♟️", cost: 2500, desc: "Displays the [GRANDMASTER] badge next to your name." },
    { id: "title_carlgoat", type: "title", val: "Certified GOAT", name: "Title: Certified GOAT", icon: "🐐", cost: 3000, desc: "Displays the [CERTIFIED GOAT] badge for true ballers." },
    { id: "title_flipper", type: "title", val: "Fry Cook", name: "Title: Fry Cook", icon: "🍟", cost: 800, desc: "Displays the [FRY COOK] badge next to your name." },
    { id: "title_chef", type: "title", val: "Executive Chef", name: "Title: Exec Chef", icon: "🔪", cost: 4500, desc: "Displays the [EXECUTIVE CHEF] badge." },
    { id: "title_tycoon", type: "title", val: "Tycoon", name: "Title: Tycoon", icon: "💰", cost: 8000, desc: "Displays the [TYCOON] badge. Flex your wealth." },
    { id: "title_whale", type: "title", val: "The Whale", name: "Title: The Whale", icon: "🐋", cost: 5000, desc: "Displays [THE WHALE] to show off how rich you are." },
    { id: "title_god", type: "title", val: "Burger God", name: "Title: Burger God", icon: "👑", cost: 10000, desc: "The ultimate flex. [BURGER GOD]" },
    { id: "title_emperor", type: "title", val: "Burger Emperor", name: "Title: Emperor", icon: "👑", cost: 15000, desc: "Displays the highly coveted [BURGER EMPEROR] badge." },
    { id: "title_legend", type: "title", val: "The Legend", name: "Title: The Legend", icon: "🏆", cost: 12000, desc: "Displays [THE LEGEND] badge." },
    { id: "title_noob", type: "title", val: "Noob", name: "Title: Noob", icon: "🤡", cost: 500, desc: "Displays the [NOOB] badge. Wear it with pride." },
    { id: "title_codemaster", type: "title", val: "Code Master", name: "Title: Code Master", icon: "⌨️", cost: 5000, desc: "Displays the [CODE MASTER] badge. Show off your Dev skills." },
    { id: "title_unstoppable", type: "title", val: "Unstoppable", name: "Title: Unstoppable", icon: "🚀", cost: 8500, desc: "Displays the [UNSTOPPABLE] badge." },

    { id: "bg_gold", type: "background", val: "gold", name: "Midas Gold Glow", icon: "🌟", cost: 2000, desc: "Changes the startup radial glow to ambient gold." },
    { id: "bg_cyber", type: "background", val: "cyber", name: "Neon Cyber Glow", icon: "🌌", cost: 2000, desc: "Changes the ambient background to magenta & purple." },
    { id: "bg_ocean", type: "background", val: "ocean", name: "Deep Ocean Glow", icon: "🌊", cost: 2000, desc: "Changes the ambient background to calming water blue." },
    { id: "bg_matrix", type: "background", val: "matrix", name: "Matrix Green Glow", icon: "🟩", cost: 2000, desc: "Changes the ambient background to hacker green." },
    { id: "bg_void", type: "background", val: "void", name: "The Void Glow", icon: "🕳️", cost: 2500, desc: "Changes the ambient background to pitch black and deep violet." },
    { id: "bg_inferno", type: "background", val: "inferno", name: "Inferno Glow", icon: "🌋", cost: 2500, desc: "Changes the ambient background to blistering heat." },
    { id: "bg_stars", type: "background", val: "stars", name: "Starlight Glow", icon: "⭐", cost: 3000, desc: "Twinkling starlight background glow." },
    { id: "bg_nebula", type: "background", val: "nebula", name: "Galactic Nebula", icon: "🪐", cost: 3500, desc: "A swirling, multi-colored deep space background." },
    { id: "bg_bloodmoon", type: "background", val: "bloodmoon", name: "Blood Moon Glow", icon: "🩸", cost: 3000, desc: "A dark crimson, eerie background glow." },
    { id: "bg_northernlights", type: "background", val: "northernlights", name: "Northern Lights", icon: "✨", cost: 4000, desc: "A beautiful dancing aurora borealis glow." },
    { id: "bg_sunset", type: "background", val: "sunset", name: "Sunset Glow", icon: "🌅", cost: 2000, desc: "A warm, relaxing orange and pink sunset glow." },

    { id: "skin_burger_c4", type: "c4Skin", val: "burger_fry", name: "Burger vs Fry Connect 4", icon: "🍟", cost: 2000, desc: "Play Connect Four using real Burger & French Fry tokens!" },
    { id: "skin_pizza_c4", type: "c4Skin", val: "pizza_hotdog", name: "Pizza vs Hotdog C4", icon: "🍕", cost: 2500, desc: "Play Connect Four using Pizzas and Hotdogs!" },
    { id: "c4Skin_cookie", type: "c4Skin", val: "cookie", name: "Cookie vs Donut", icon: "🍪", cost: 2500, desc: "Play Connect 4 with cookies and donuts!" },
    { id: "skin_sushi_c4", type: "c4Skin", val: "sushi_taco", name: "Sushi vs Taco C4", icon: "🍣", cost: 3000, desc: "Play Connect Four using Sushi and Tacos!" },
    
    { id: "felt_crimson", type: "bjFelt", val: "crimson", name: "Casino Crimson Felt", icon: "🃏", cost: 1500, desc: "Changes the Blackjack table to rich Velvet Crimson." },
    { id: "felt_emerald", type: "bjFelt", val: "emerald", name: "Monte Carlo Emerald Felt", icon: "🎲", cost: 1500, desc: "Luxury dark emerald green Blackjack felt." },
    { id: "felt_purple", type: "bjFelt", val: "purple", name: "Galactic Purple Felt", icon: "🔮", cost: 1500, desc: "Deep cosmic purple Blackjack felt." },
    { id: "felt_sapphire", type: "bjFelt", val: "sapphire", name: "Sapphire Blue Felt", icon: "💎", cost: 1800, desc: "Rich and elegant Sapphire Blue Blackjack felt." },
    { id: "felt_obsidian", type: "bjFelt", val: "obsidian", name: "Obsidian Black Felt", icon: "⚫", cost: 2000, desc: "Sleek and stealthy Obsidian Black Blackjack felt." },
    { id: "felt_goldleaf", type: "bjFelt", val: "goldleaf", name: "Gold Leaf Felt", icon: "✨", cost: 4000, desc: "The ultimate high-roller gold woven blackjack table." },
    
    { id: "boost_golden_spatula", type: "goldenSpatula", val: true, name: "The Golden Spatula", icon: "🍳", cost: 5000, desc: "Permanent +50% production boost across all Burger Clicker businesses!" },
    { id: "title_admin", type: "title", val: "Admin", name: "Title: Admin", icon: "🛠️", cost: 0, desc: "Exclusive developer badge.", hidden: true }
];

function renderShopView() {
    const container = document.getElementById("shop-items-container");
    if (!container) return;
    container.innerHTML = "";

    const lootBanner = document.createElement("div");
    lootBanner.className = "loot-box-banner";
    lootBanner.innerHTML = `
        <h2>Mystery Burger Crate 🎁</h2>
        <p style="margin-bottom: 15px; font-family: Arial, sans-serif; font-size: 14px;">Win rare badges, themes, or massive burger jackpots!</p>
        <button class="open-crate-btn" onclick="openLootBox()">Open for 250 🍔</button>
    `;
    container.appendChild(lootBanner);

    shopCatalog.forEach(item => {
        if (item.hidden) return; 

        const owned = inventory.includes(item.id);
        let isEq = false;
        if (item.type === "goldenSpatula") isEq = equipped.goldenSpatula;
        else if (item.type === "title") isEq = (equipped.title === item.val);
        else isEq = (equipped[item.type] === item.val);

        const card = document.createElement("div"); card.className = "shop-card";
        let btnHTML = "";
        if (!owned) {
            btnHTML = `<button class="shop-buy-btn buy" onclick="buyShopItem('${item.id}')">Buy (${item.cost.toLocaleString()} 🍔)</button>`;
        } else if (isEq) {
            btnHTML = `<button class="shop-buy-btn equipped">Equipped ✓</button>`;
        } else {
            btnHTML = `<button class="shop-buy-btn equip" onclick="equipShopItem('${item.id}', true)">Equip</button>`;
        }

        card.innerHTML = `
            <div>
                <div class="shop-card-header">
                    <span class="shop-item-title">${item.name}</span>
                    <span class="shop-item-icon">${item.icon}</span>
                </div>
                <div class="shop-item-desc">${item.desc}</div>
            </div>
            <div>
                <div class="shop-item-cost">Price: ${item.cost.toLocaleString()} Burgers</div>
                ${btnHTML}
            </div>
        `;
        container.appendChild(card);
    });
}

async function openLootBox() {
    if (isGuest) {
        if (userBurgers < 250) return alert("Not enough burgers! You need 250 🍔.");
        userBurgers -= 250;
        const roll = Math.random();
        let prizeText = "", emoji = "", payout = 0;
        
        if (roll < 0.03) { prizeText = "LEGENDARY! 5,000 🍔 Jackpot!"; emoji = "👑"; payout = 5000; }
        else if (roll < 0.15) { prizeText = "EPIC! 1,000 🍔 Refund!"; emoji = "🔥"; payout = 1000; }
        else if (roll < 0.45) { 
            const availableItems = shopCatalog.filter(i => !i.hidden);
            const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
            if (inventory.includes(randomItem.id)) {
                prizeText = "Duplicate Item! Refunded 500 🍔."; emoji = "♻️"; payout = 500;
            } else {
                prizeText = "LUCKY DROP! Unlocked: " + randomItem.name + "!"; emoji = randomItem.icon;
                inventory.push(randomItem.id); saveSessionData();
            }
        }
        else if (roll < 0.70) { prizeText = "RARE! 500 🍔 Refund!"; emoji = "✨"; payout = 500; }
        else { prizeText = "Common. Here is 50 🍔 back."; emoji = "🍔"; payout = 50; }
        
        userBurgers += payout;
        updateBurgerUI();
        triggerLootAnimation(prizeText, emoji);
        return;
    }

    if (!firebaseUserId) return alert("You must be logged in to open crates!");
    const cost = 250;
    const userRef = db.collection("users").doc(firebaseUserId);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            if (!doc.exists) throw "User data not found!";
            
            const currentBurgers = doc.data().burgers || 0;
            if (currentBurgers < cost) throw "Not enough burgers! You need 250 🍔.";
            
            const roll = Math.random();
            let prizeText = "", emoji = "", payout = 0, itemWon = null;
            
            if (roll < 0.03) { prizeText = "LEGENDARY! 5,000 🍔 Jackpot!"; emoji = "👑"; payout = 5000; }
            else if (roll < 0.15) { prizeText = "EPIC! 1,000 🍔 Refund!"; emoji = "🔥"; payout = 1000; }
            else if (roll < 0.45) { 
                const availableItems = shopCatalog.filter(i => !i.hidden);
                const randomItem = availableItems[Math.floor(Math.random() * availableItems.length)];
                if (inventory.includes(randomItem.id)) {
                    prizeText = "Duplicate Item! Refunded 500 🍔."; emoji = "♻️"; payout = 500;
                } else {
                    prizeText = "LUCKY DROP! Unlocked: " + randomItem.name + "!";
                    emoji = randomItem.icon;
                    itemWon = randomItem.id;
                }
            }
            else if (roll < 0.70) { prizeText = "RARE! 500 🍔 Refund!"; emoji = "✨"; payout = 500; }
            else { prizeText = "Common. Here is 50 🍔 back."; emoji = "🍔"; payout = 50; }
            
            if (itemWon) {
                transaction.update(userRef, { 
                    burgers: currentBurgers - cost + payout,
                    inventory: firebase.firestore.FieldValue.arrayUnion(itemWon)
                });
                inventory.push(itemWon); 
            } else {
                transaction.update(userRef, { burgers: currentBurgers - cost + payout });
            }
            
            return { prizeText, emoji };
        }).then((result) => {
            triggerLootAnimation(result.prizeText, result.emoji);
        });
    } catch (error) {
        alert(error);
    }
}

function triggerLootAnimation(prizeText, emoji) {
    const modal = document.getElementById("loot-modal");
    const title = document.getElementById("loot-title");
    const icon = document.getElementById("loot-icon");
    const resultDisplay = document.getElementById("loot-result-text");
    const closeBtn = document.getElementById("loot-close-btn");
    
    modal.style.display = "flex";
    title.innerText = "Opening Crate...";
    title.style.animation = "pulse 1s infinite";
    icon.innerText = "📦";
    icon.style.animation = "shake 0.5s infinite";
    resultDisplay.style.display = "none";
    closeBtn.style.display = "none";
    
    setTimeout(() => {
        title.innerText = "You Won!";
        title.style.animation = "none";
        icon.innerText = emoji;
        icon.style.animation = "popIn 0.5s ease forwards";
        resultDisplay.innerText = prizeText;
        resultDisplay.style.display = "block";
        closeBtn.style.display = "block";
    }, 1800);
}

// --- BURGER GIFTING SYSTEM ---
function openGiftModal() {
    if (!currentDmUser || !currentDmUser.id) {
        return alert("Please open a chat with a friend first to send them burgers!");
    }
    document.getElementById("gift-friend-name").innerText = currentDmUser.username || "Friend";
    document.getElementById("gift-amount").value = "";
    document.getElementById("gift-modal").style.display = "flex";
}

function closeGiftModal() {
    document.getElementById("gift-modal").style.display = "none";
}

async function confirmSendBurgers() {
    if (isGuest) return alert("Guests cannot send burgers. Please create an account!");
    if (!firebaseUserId || !currentDmUser || !currentDmUser.id) return;
    
    const amount = parseInt(document.getElementById("gift-amount").value, 10);
    if (!amount || amount <= 0) return alert("Please enter a valid amount greater than 0.");
    if (userBurgers < amount) return alert("You don't have enough burgers!");

    const senderRef = db.collection("users").doc(firebaseUserId);
    const receiverRef = db.collection("users").doc(currentDmUser.id);
    
    try {
        await db.runTransaction(async (transaction) => {
            const senderDoc = await transaction.get(senderRef);
            const receiverDoc = await transaction.get(receiverRef);
            
            if (!senderDoc.exists || !receiverDoc.exists) throw "Database error: User not found.";
            
            const senderBurgers = senderDoc.data().burgers || 0;
            if (senderBurgers < amount) throw "You don't have enough burgers!";
            
            transaction.update(senderRef, { burgers: senderBurgers - amount });
            transaction.update(receiverRef, { burgers: (receiverDoc.data().burgers || 0) + amount });
        });
        
        closeGiftModal();
        alert(`Successfully sent ${amount.toLocaleString()} 🍔 to ${currentDmUser.username}!`);
        
        if (activeChatId && isDM) {
            await db.collection("dms").doc(activeChatId).collection("messages").add({
                text: `🎁 [GIFT] Sent ${amount.toLocaleString()} Burgers!`,
                imageSrc: null,
                senderId: firebaseUserId,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        alert("Transaction failed: " + error);
    }
}

function buyShopItem(itemId) {
    const item = shopCatalog.find(i => i.id === itemId); if (!item) return;
    if (userBurgers < item.cost) { alert("You do not have enough Burgers! Play Burger Clicker to earn more."); return; }
    userBurgers -= item.cost; inventory.push(item.id);
    equipShopItem(itemId, false); updateBurgerUI(); saveSessionData(); renderShopView();
}

function equipShopItem(itemId, isFromShop = false) {
    const item = shopCatalog.find(i => i.id === itemId); if (!item) return;
    if (item.type === "goldenSpatula") equipped.goldenSpatula = true;
    else if (item.type === "title") equipped.title = item.val;
    else equipped[item.type] = item.val;

    applyEquippedCosmetics(); saveSessionData();
    if (document.getElementById('view-shop').classList.contains('active')) renderShopView();
    if (document.getElementById('view-inventory').classList.contains('active')) renderInventoryView();
    if (isFromShop) alert(`Equipped ${item.name}!`);
}

function toggleInventoryItem(itemId) {
    const item = shopCatalog.find(i => i.id === itemId); if(!item) return;
    let isEq = false;
    if (item.type === "goldenSpatula") isEq = equipped.goldenSpatula;
    else if (item.type === "title") isEq = (equipped.title === item.val);
    else isEq = (equipped[item.type] === item.val);

    if (isEq) {
        if (item.type === "goldenSpatula") equipped.goldenSpatula = false;
        else if (item.type === "title") equipped.title = "";
        else equipped[item.type] = "default";
    } else {
        if (item.type === "goldenSpatula") equipped.goldenSpatula = true;
        else if (item.type === "title") equipped.title = item.val;
        else equipped[item.type] = item.val;
    }
    applyEquippedCosmetics(); saveSessionData(); renderInventoryView();
}

function renderInventoryView() {
    const container = document.getElementById("inventory-items-container"); if(!container) return;
    container.innerHTML = "";
    
    if(inventory.length === 0) {
        container.innerHTML = `<div class="inv-empty-text">*owned things can be toggled here</div>`;
        container.style.display = "flex";
    } else {
        container.style.display = "grid";
        inventory.forEach(itemId => {
            const item = shopCatalog.find(i => i.id === itemId); if(!item) return;
            let isEq = false;
            if (item.type === "goldenSpatula") isEq = equipped.goldenSpatula;
            else if (item.type === "title") isEq = (equipped.title === item.val);
            else isEq = (equipped[item.type] === item.val);

            const card = document.createElement("div"); card.className = "shop-card";
            const btnClass = isEq ? "unequip" : "equip";
            const btnText = isEq ? "Unequip" : "Equip";

            card.innerHTML = `
                <div>
                    <div class="shop-card-header"><span class="shop-item-title">${item.name}</span><span class="shop-item-icon">${item.icon}</span></div>
                    <div class="shop-item-desc">${item.desc}</div>
                </div>
                <button class="inv-action-btn ${btnClass}" onclick="toggleInventoryItem('${item.id}')">${btnText}</button>
            `;
            container.appendChild(card);
        });
    }
    renderPresetsList();
}

function addPreset() {
    if(userPresets.length >= 5) { alert("Max 5 presets allowed!"); return; }
    const pName = prompt("Enter a name for this preset:"); if(!pName) return;
    userPresets.push({ name: pName, equipped: JSON.parse(JSON.stringify(equipped)) });
    saveSessionData(); renderPresetsList();
}

function renderPresetsList() {
    const list = document.getElementById("presets-list"); if(!list) return;
    list.innerHTML = "";
    userPresets.forEach((p, idx) => {
        const el = document.createElement("div"); el.className = "preset-item";
        el.innerHTML = `
            <span class="preset-name">${p.name}</span>
            <div>
                <button class="preset-load-btn" onclick="loadPreset(${idx})">Load</button>
                <button class="preset-del-btn" onclick="deletePreset(${idx})">✕</button>
            </div>
        `;
        list.appendChild(el);
    });
}

function loadPreset(idx) {
    const p = userPresets[idx]; if(!p) return;
    equipped = JSON.parse(JSON.stringify(p.equipped));
    applyEquippedCosmetics(); saveSessionData(); renderInventoryView();
}
function deletePreset(idx) {
    if(!confirm("Delete this preset?")) return;
    userPresets.splice(idx, 1); saveSessionData(); renderPresetsList();
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

// --- BURGER CLICKER LOGIC ---
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
        cost = Math.floor(100 * Math.pow(1.2, clickPower - 1));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; clickPower++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'chef') {
        cost = Math.floor(50 * Math.pow(1.2, autoChefs));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; autoChefs++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'stand') {
        cost = Math.floor(500 * Math.pow(1.2, burgerStands));
        if (clickerBurgers >= cost) { clickerBurgers -= cost; burgerStands++; }
        else { alert("Not enough Clicker Burgers!"); return; }
    } else if (type === 'factory') {
        cost = Math.floor(5000 * Math.pow(1.2, burgerFactories));
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
    let e = (id) => document.getElementById(id);
    if(e("click-cost")) e("click-cost").innerText = Math.floor(100 * Math.pow(1.2, clickPower - 1)).toLocaleString();
    if(e("click-power-count")) e("click-power-count").innerText = getClickValue().toLocaleString();
    if(e("chef-cost")) e("chef-cost").innerText = Math.floor(50 * Math.pow(1.2, autoChefs)).toLocaleString();
    if(e("chef-count")) e("chef-count").innerText = autoChefs.toLocaleString();
    if(e("chef-output")) e("chef-output").innerText = (getChefPower() * getMultiplier()).toLocaleString();
    if(e("stand-cost")) e("stand-cost").innerText = Math.floor(500 * Math.pow(1.2, burgerStands)).toLocaleString();
    if(e("stand-count")) e("stand-count").innerText = burgerStands.toLocaleString();
    if(e("stand-output")) e("stand-output").innerText = (getStandPower() * getMultiplier()).toLocaleString();
    if(e("factory-cost")) e("factory-cost").innerText = Math.floor(5000 * Math.pow(1.2, burgerFactories)).toLocaleString();
    if(e("factory-count")) e("factory-count").innerText = burgerFactories.toLocaleString();
    if(e("factory-output")) e("factory-output").innerText = (getFactoryPower() * getMultiplier()).toLocaleString();
    if(e("bps-text")) e("bps-text").innerText = getBps().toLocaleString();
    if(e("rebirth-count")) e("rebirth-count").innerText = rebirths.toLocaleString();
}

// =========================================================================
// --- FRIENDS, GROUPS & MULTIPLAYER ---
// =========================================================================
const avatarColors = ["#ef4444", "#84cc16", "#eab308", "#3b82f6", "#a855f7", "#f97316", "#ec4899"];

function getAvatarColor(str) {
    if (!str) return avatarColors[0];
    let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getAvatarHTML(u) {
    const frameClass = (u.equipped && u.equipped.frame && u.equipped.frame !== 'default') ? `frame-${u.equipped.frame}` : '';
    let inner = '';
    if (!u.avatar || u.avatar.includes('default-avatar.png')) {
        const c = getAvatarColor(u.username), i = u.username ? u.username.charAt(0).toUpperCase() : '?';
        inner = `<div class="text-avatar" style="background-color: ${c};">${i}</div>`;
    } else {
        inner = `<img class="friend-avatar" src="${u.avatar}" draggable="false">`;
    }
    return `<div class="avatar-frame-wrapper ${frameClass}">${inner}</div>`;
}

function getGroupAvatarHTML(membersArray) {
    let membersInfo = [];
    membersArray.forEach(uid => {
        if (uid === firebaseUserId) {
            membersInfo.push({ username: currentUser, avatar: currentUserAvatar });
        } else {
            const u = allUsersCache.find(x => x.id === uid);
            if (u) membersInfo.push(u);
        }
    });
    
    const displayMembers = membersInfo.slice(0, 4);
    let collageClass = `group-avatar-${displayMembers.length}`;
    if (displayMembers.length < 2) collageClass = "group-avatar-2";
    
    let innerHtml = '';
    displayMembers.forEach(m => {
        if (!m.avatar || m.avatar.includes('default-avatar.png')) {
            const c = getAvatarColor(m.username);
            const i = m.username ? m.username.charAt(0).toUpperCase() : '?';
            innerHtml += `<div class="collage-text" style="background-color: ${c};">${i}</div>`;
        } else {
            innerHtml += `<img src="${m.avatar}" class="collage-img" draggable="false">`;
        }
    });
    
    return `<div class="avatar-frame-wrapper"><div class="group-avatar-collage ${collageClass}">${innerHtml}</div></div>`;
}

let allUsersCache = [];
async function fetchAllUsers() {
    const list = document.getElementById("find-people-list"); if(list) list.innerHTML = "<p style='color:var(--text-sub);'>Loading...</p>";
    try {
        if (firebaseUserId && db) {
            const snapshot = await db.collection("users").get(); allUsersCache = [];
            snapshot.forEach(doc => { const data = doc.data(); if (doc.id !== firebaseUserId && data.username) allUsersCache.push({ id: doc.id, username: data.username, avatar: data.avatar || "", equipped: data.equipped || {} }); });
        }
    } catch (err) { console.error("Error fetching real users", err); }
    renderFriendsView();
}

function renderFriendsView() {
    const query = document.getElementById("friend-search-input").value.toLowerCase().trim();
    const findList = document.getElementById("find-people-list"), friendsList = document.getElementById("my-friends-list"), groupsList = document.getElementById("my-groups-list");
    if (!findList || !friendsList || !groupsList) return;
    findList.innerHTML = ""; friendsList.innerHTML = ""; groupsList.innerHTML = "";

    if (myGroups.length === 0) {
        groupsList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px;'>No groups yet.</p>";
    } else {
        myGroups.forEach(group => {
            const item = document.createElement("div"); item.className = "friend-item";
            item.innerHTML = `
                <div class="friend-info">
                    <div style="width: 48px; height: 48px; flex-shrink: 0;">
                        ${getGroupAvatarHTML(group.members)}
                    </div>
                    <span class="friend-name">${group.name}</span>
                </div>
                <button class="friend-msg-btn" onclick="openGroupChat('${group.id}', '${group.name.replace(/'/g, "\\'")}', '${group.members.join(',')}')">Chat</button>
            `;
            groupsList.appendChild(item);
        });
    }

    const activeFriends = allUsersCache.filter(u => myFriends.includes(u.id));
    if (activeFriends.length === 0) {
        friendsList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px;'>No friends yet.</p>";
    } else {
        activeFriends.forEach(user => {
            const item = document.createElement("div"); item.className = "friend-item";
            const titleBadge = user.equipped?.title ? `<span class="user-title-badge" style="display:inline-block;">${user.equipped.title}</span>` : '';
            item.innerHTML = `
                <div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username} ${titleBadge}</span></div>
                <div style="display:flex; gap:8px;">
                    <button class="friend-msg-btn" onclick='openDirectMessage(${JSON.stringify(user)})'>Message</button>
                    <button class="friend-req-btn" style="border-color:#ef4444; color:#ef4444;" onclick="unfriendUser('${user.id}')">Unfriend</button>
                </div>
            `;
            friendsList.appendChild(item);
        });
    }

    let displayList = allUsersCache.filter(u => !myFriends.includes(u.id) && !myRequests.includes(u.id));
    if (query) {
        displayList = displayList.filter(u => u.username.toLowerCase().includes(query));
    }
    
    const incomingReqs = allUsersCache.filter(u => myRequests.includes(u.id));
    incomingReqs.forEach(user => {
        const item = document.createElement("div"); item.className = "friend-item";
        const titleBadge = user.equipped?.title ? `<span class="user-title-badge" style="display:inline-block;">${user.equipped.title}</span>` : '';
        item.innerHTML = `<div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username} ${titleBadge}</span></div><button class="friend-req-btn" onclick="acceptRequest('${user.id}')">Accept Request</button>`;
        findList.appendChild(item);
    });

    if (displayList.length === 0 && incomingReqs.length === 0) {
        findList.innerHTML = "<p style='color: var(--text-sub); margin-top:10px; text-align:center;'>No users found.</p>";
    } else {
        displayList.forEach(user => {
            const item = document.createElement("div"); item.className = "friend-item";
            const isSent = mySentRequests.includes(user.id);
            const titleBadge = user.equipped?.title ? `<span class="user-title-badge" style="display:inline-block;">${user.equipped.title}</span>` : '';
            const btnHTML = isSent ? `<button class="friend-msg-btn" style="opacity: 0.5;" disabled>Sent!</button>` : `<button class="friend-msg-btn" onclick="sendFriendRequest('${user.id}')">Add Friend</button>`;
            item.innerHTML = `<div class="friend-info">${getAvatarHTML(user)}<span class="friend-name">${user.username} ${titleBadge}</span></div>${btnHTML}`;
            findList.appendChild(item);
        });
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

function openCreateGroupModal() {
    if (isGuest) return alert("Guests cannot create groups. Please sign up!");
    const list = document.getElementById("create-group-friends-list");
    list.innerHTML = "";
    
    const activeFriends = allUsersCache.filter(u => myFriends.includes(u.id));
    if(activeFriends.length === 0) {
        alert("You need friends to create a group!");
        return;
    }
    
    activeFriends.forEach(f => {
        list.innerHTML += `
            <label style="display: flex; align-items: center; gap: 10px; color: white; margin-bottom: 10px; cursor: pointer;">
                <input type="checkbox" value="${f.id}" class="group-friend-cb" style="width: 20px; height: 20px; accent-color: #9333ea;">
                ${f.username}
            </label>
        `;
    });
    document.getElementById("group-name-input").value = "";
    document.getElementById("create-group-modal").style.display = "flex";
}

async function confirmCreateGroup() {
    const name = document.getElementById("group-name-input").value.trim();
    if(!name) return alert("Please enter a group name.");
    
    const cbs = document.querySelectorAll(".group-friend-cb:checked");
    const selectedIds = Array.from(cbs).map(cb => cb.value);
    
    if(selectedIds.length === 0) return alert("Please select at least one friend to add.");
    
    const members = [firebaseUserId, ...selectedIds];
    try {
        await db.collection("groups").add({
            name: name,
            members: members,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: firebaseUserId
        });
        document.getElementById("create-group-modal").style.display = "none";
        alert("Group successfully created!");
    } catch(e) { 
        alert("Error creating group: " + e.message); 
    }
}

function renderChatSnapshot(snapshot, logElementId, isGlobal = false) {
    const log = document.getElementById(logElementId); 
    log.innerHTML = "";
    
    const msgs = [];
    snapshot.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
    if (isGlobal) msgs.reverse(); 

    msgs.forEach(data => {
        const isMe = data.senderId === firebaseUserId;
        const msgDiv = document.createElement("div"); msgDiv.className = `dm-message ${isMe ? 'sent' : 'received'}`; msgDiv.dataset.id = data.id;
        const contentDiv = document.createElement("div"); contentDiv.className = "dm-message-content";
        
        if (isMe && equipped.bubble && equipped.bubble !== "default") contentDiv.classList.add(`bubble-${equipped.bubble}`);
        else if (!isMe && data.senderEquipped?.bubble && data.senderEquipped.bubble !== "default") contentDiv.classList.add(`bubble-${data.senderEquipped.bubble}`);
        
        let nameLabel = '';
        if (!isMe && (isGlobal || logElementId === "group-chat-log")) {
            nameLabel = `<div style="font-size: 11px; color: var(--text-sub); margin-bottom: 4px; margin-left: 4px;">${data.senderName || "User"}</div>`;
        }
        
        let textHtml = data.text ? `<span class="dm-message-text">${data.text}</span>` : '';
        let imgHtml = data.imageSrc ? `<img src="${data.imageSrc}" class="chat-image" draggable="false">` : '';
        
        contentDiv.innerHTML = nameLabel + textHtml + imgHtml;
        
        const msgWrapper = document.createElement("div");
        msgWrapper.style.display = "flex"; msgWrapper.style.alignItems = "center"; msgWrapper.style.gap = "8px";

        if (isMe && !isGlobal) { 
            const delBtn = document.createElement("button");
            delBtn.innerHTML = "✕"; delBtn.className = "dm-del-btn"; delBtn.title = "Delete Message";
            delBtn.onclick = () => deleteSharedMessage(data.id, logElementId);
            msgWrapper.appendChild(delBtn); msgWrapper.appendChild(contentDiv);
        } else { 
            msgWrapper.appendChild(contentDiv); 
        }

        let avatarObj;
        if (isMe) {
            avatarObj = { username: currentUser, avatar: currentUserAvatar, equipped: equipped };
        } else if (logElementId === "dm-chat-log" && currentDmUser) {
            avatarObj = currentDmUser; 
        } else {
            avatarObj = { username: data.senderName, avatar: data.senderAvatar, equipped: data.senderEquipped };
        }
        
        const avatarWrapper = document.createElement("div"); avatarWrapper.className = "dm-message-avatar"; 
        avatarWrapper.innerHTML = getAvatarHTML(avatarObj);
        
        msgDiv.appendChild(avatarWrapper); msgDiv.appendChild(msgWrapper); log.appendChild(msgDiv);
    });
    log.scrollTop = log.scrollHeight;
}

async function deleteSharedMessage(msgId, logId) {
    if(!confirm("Delete this message?")) return;
    if (logId === "dm-chat-log") await db.collection("dms").doc(activeChatId).collection("messages").doc(msgId).delete();
    else if (logId === "group-chat-log") await db.collection("groups").doc(activeGroupId).collection("messages").doc(msgId).delete();
}

function openDirectMessage(user) {
    isDM = true; currentDmUser = user; activeChatId = "dm_" + [firebaseUserId, user.id].sort().join('_');
    document.getElementById("dm-header-avatar").innerHTML = getAvatarHTML(user);
    const titleBadge = user.equipped?.title ? `<span class="user-title-badge" style="display:inline-block;">${user.equipped.title}</span>` : '';
    document.getElementById("dm-header-name").innerHTML = `${user.username} ${titleBadge}`;
    document.getElementById("dm-input").placeholder = `Message ${user.username}...`;
    document.getElementById("dm-chat-log").innerHTML = "";
    
    if (currentDmUnsubscribe) currentDmUnsubscribe();
    currentDmUnsubscribe = db.collection("dms").doc(activeChatId).collection("messages").orderBy("timestamp", "asc").onSnapshot(snapshot => {
        renderChatSnapshot(snapshot, "dm-chat-log", false);
    });
    switchView('view-dm');
}

async function sendDmMessage() {
    const input = document.getElementById("dm-input"); if (!input) return;
    const text = input.value.trim();
    if (!text && !pendingDmImageBase64) return;
    if (!activeChatId || !isDM) return;
    
    input.value = ""; const imageSrc = pendingDmImageSrc; clearDmPendingImage();
    await db.collection("dms").doc(activeChatId).collection("messages").add({ 
        text: text, 
        imageSrc: imageSrc || null, 
        senderId: firebaseUserId, 
        senderName: currentUser,
        senderAvatar: currentUserAvatar,
        senderEquipped: equipped,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
}

function openGlobalChat() {
    if (isGuest) return alert("Guests cannot join the public lobby. Please create an account!");
    document.getElementById("global-chat-log").innerHTML = "";
    
    if (globalChatUnsubscribe) globalChatUnsubscribe();
    globalChatUnsubscribe = db.collection("global_chat").orderBy("timestamp", "desc").limit(50).onSnapshot(snapshot => {
        renderChatSnapshot(snapshot, "global-chat-log", true);
    });
    switchView('view-global-chat');
}

async function sendGlobalMessage() {
    const input = document.getElementById("global-input"); if (!input) return;
    const text = input.value.trim();
    if (!text && !pendingGlobalImageBase64) return;
    if (!firebaseUserId) return;
    
    input.value = ""; const imageSrc = pendingGlobalImageSrc; clearGlobalPendingImage();
    await db.collection("global_chat").add({ 
        text: text, 
        imageSrc: imageSrc || null, 
        senderId: firebaseUserId, 
        senderName: currentUser,
        senderAvatar: currentUserAvatar,
        senderEquipped: equipped,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
}

function openGroupChat(groupId, groupName, membersStr) {
    activeGroupId = groupId;
    document.getElementById("group-header-name").innerText = groupName;
    document.getElementById("group-input").placeholder = `Message ${groupName}...`;
    document.getElementById("group-chat-log").innerHTML = "";
    
    const membersArray = membersStr ? membersStr.split(',') : [];
    document.getElementById("group-header-avatar").innerHTML = getGroupAvatarHTML(membersArray);

    if (groupChatUnsubscribe) groupChatUnsubscribe();
    groupChatUnsubscribe = db.collection("groups").doc(activeGroupId).collection("messages").orderBy("timestamp", "asc").onSnapshot(snapshot => {
        renderChatSnapshot(snapshot, "group-chat-log", false);
    });
    switchView('view-group-chat');
}

async function sendGroupMessage() {
    const input = document.getElementById("group-input"); if (!input) return;
    const text = input.value.trim();
    if (!text && !pendingGroupImageBase64) return;
    if (!activeGroupId || !firebaseUserId) return;
    
    input.value = ""; const imageSrc = pendingGroupImageSrc; clearGroupPendingImage();
    await db.collection("groups").doc(activeGroupId).collection("messages").add({ 
        text: text, 
        imageSrc: imageSrc || null, 
        senderId: firebaseUserId, 
        senderName: currentUser,
        senderAvatar: currentUserAvatar,
        senderEquipped: equipped,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
}

function processImageInput(file, type) {
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const src = event.target.result;
            if (type === 'dm') {
                pendingDmImageSrc = src; pendingDmImageMime = src.split(';')[0].split(':')[1]; pendingDmImageBase64 = src.split(',')[1];
                document.getElementById('dm-image-preview-img').src = src; document.getElementById('dm-image-preview-box').classList.add('active');
            } else if (type === 'global') {
                pendingGlobalImageSrc = src; pendingGlobalImageMime = src.split(';')[0].split(':')[1]; pendingGlobalImageBase64 = src.split(',')[1];
                document.getElementById('global-image-preview-img').src = src; document.getElementById('global-image-preview-box').classList.add('active');
            } else if (typeI seem to be encountering an error. Can I try something else for you?
