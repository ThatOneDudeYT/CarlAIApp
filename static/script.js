const firebaseConfig = { apiKey: "AIzaSyB6q-h3daznHtyF3tVoQh1W38hNiD7qqGg", authDomain: "carl-ai-loggins.firebaseapp.com", projectId: "carl-ai-loggins", storageBucket: "carl-ai-loggins.firebasestorage.app", messagingSenderId: "372926140822", appId: "1:372926140822:web:4bf13c6dd802cbc047cdb7", measurementId: "G-G4H60BZHT3" };
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();

let firebaseUserId=null, currentUser=null, currentUserAvatar="/static/icons/default-avatar.png", customApiKey="";
let chatsHistory=[], activeChatId=null, chatHistory=[];  
let selectedGame="Burger Clicker"; const gamesWithDifficulty=["Tic Tac Toe", "Chess", "Hangman", "Connect Four", "Checkers"];
let pendingImageBase64=null, pendingImageMime=null, pendingImageSrc=null, pendingDmImageBase64=null, pendingDmImageMime=null, pendingDmImageSrc=null, currentDmUser=null; 
let isDM=false, currentDmUnsubscribe=null;
let userBurgers=100, clickerBurgers=0, rebirths=0, clickPower=1, autoChefs=0, burgerStands=0, burgerFactories=0;   

function getMultiplier() { return 1 + (rebirths * 1.0); }
function getClickValue() { return (clickPower * Math.floor(1 + (clickPower * 0.1))) * getMultiplier(); }
function getChefPower() { return Math.floor(1 + (autoChefs * 0.1)); }
function getStandPower() { return Math.floor(10 + (burgerStands * 0.2)); }
function getFactoryPower() { return Math.floor(100 + (burgerFactories * 1)); }
function getBps() { return ((autoChefs * getChefPower()) + (burgerStands * getStandPower()) + (burgerFactories * getFactoryPower())) * getMultiplier(); }

function updateBurgerUI() {
    const hc=document.getElementById("burger-count"); if(hc) hc.innerText = Math.floor(userBurgers).toLocaleString();
    const cc=document.getElementById("clicker-score-text"); if(cc) cc.innerText = Math.floor(clickerBurgers).toLocaleString();
}
setInterval(() => { let bps = getBps(); if (bps > 0) { clickerBurgers += bps; updateBurgerUI(); } }, 1000);

const normalPhrases=["Ready When You Are", "What Time Is It?", "I Need Help With Math", "The Floor Is Yours!"], rarePhrases=["Mmmm Burgers", "I weigh 700 pounds", "67"];
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
    const sBtn = document.getElementById("send-btn"); if(sBtn) sBtn.addEventListener("click", sendMessage);
    const uInp = document.getElementById("user-input"); if(uInp) uInp.addEventListener("keypress", (e) => { if(e.key==="Enter") sendMessage(); });
});

function toggleMobileSidebar() { const sb=document.querySelector('.desktop-sidebar'), ov=document.getElementById('sidebar-overlay'); if(sb) sb.classList.toggle('open'); if(ov) ov.classList.toggle('active'); }

auth.onAuthStateChanged(async (user) => {
    const ov = document.getElementById('auth-overlay');
    if (user) {
        firebaseUserId = user.uid; currentUser = user.displayName || user.email.split('@')[0]; currentUserAvatar = user.photoURL || "/static/icons/default-avatar.png";
        if (ov) ov.classList.add('hidden'); await loadUserDataFromCloud(); listenForIncomingCalls();
    } else { firebaseUserId = null; if (ov) ov.classList.remove('hidden'); }
});

function signInWithGoogle() { const p = new firebase.auth.GoogleAuthProvider(); auth.signInWithPopup(p).catch(e => alert("Google Sign-In Error: " + e.message)); }
function handleLogin(e) {
    if(e) e.preventDefault(); const email = document.getElementById('auth-username').value.trim(), pass = document.getElementById('auth-password').value;
    auth.signInWithEmailAndPassword(email, pass).then(c => { if (!c.user.emailVerified) alert("Please check your inbox to verify your email address."); })
    .catch(err => {
        if(err.code==='auth/user-not-found'||err.code==='auth/invalid-login-credentials'||err.code==='auth/invalid-credential') {
            auth.createUserWithEmailAndPassword(email,pass).then(c=>{ c.user.sendEmailVerification().then(()=>alert("Account created! Verification link sent to your email.")); }).catch(e=>alert("Sign Up Error: "+e.message));
        } else alert(err.message);
    });
}
function handleSignOut() {
    auth.signOut().then(() => {
        currentUser=null; currentUserAvatar="/static/icons/default-avatar.png"; customApiKey="";
        chatsHistory=[]; chatHistory=[]; activeChatId=null; myFriends=[]; myRequests=[]; mySentRequests=[]; currentDmUser=null;
        userBurgers=100; clickerBurgers=0; autoChefs=0; burgerStands=0; burgerFactories=0; clickPower=1; rebirths=0;
        updateBurgerUI(); updateProfileUI(); renderChatHistorySidebar(); switchView('view-chat'); showStartupScreen(); updateUsageUI();
    });
}

let myFriends=[], myRequests=[], mySentRequests=[];
async function loadUserDataFromCloud() {
    if (!firebaseUserId) return;
    db.collection("users").doc(firebaseUserId).onSnapshot(async (doc) => {
        if (doc.exists) {
            const data = doc.data(); customApiKey = data.apiKey || ""; chatsHistory = data.chats || [];
            if (!isDM) activeChatId = data.activeChatId || null; applyTheme(data.theme || "dark");
            userBurgers = data.burgers !== undefined ? data.burgers : 100; clickerBurgers = data.clickerBurgers || 0; autoChefs = data.autoChefs || 0; burgerStands = data.burgerStands || 0; burgerFactories = data.burgerFactories || 0; clickPower = data.clickPower || 1; rebirths = data.rebirths || 0;
            myFriends = data.friends || []; myRequests = data.friendRequests || []; mySentRequests = data.sentRequests || []; updateBurgerUI();
            if (data.avatar) currentUserAvatar = data.avatar; if (data.username) currentUser = data.username;
            updateProfileUI(); const keyInp = document.getElementById('user-api-key'); if (keyInp) keyInp.value = customApiKey; const usrInp = document.getElementById('settings-username-input'); if (usrInp) usrInp.value = currentUser;
            renderChatHistorySidebar(); updateUsageUI(); if (document.getElementById('view-friends').classList.contains('active')) renderFriendsView();
        } else { saveSessionData(); startNewChat(); }
    }, e => console.error("Error:", e));
}
function saveSessionData() {
    if (!firebaseUserId) return; const cur = isDM ? (chatsHistory.length > 0 ? chatsHistory[0].id : null) : activeChatId;
    db.collection("users").doc(firebaseUserId).set({
        apiKey: customApiKey, chats: chatsHistory, activeChatId: cur, theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
        avatar: currentUserAvatar, username: currentUser, burgers: userBurgers, clickerBurgers: clickerBurgers, autoChefs: autoChefs, burgerStands: burgerStands, burgerFactories: burgerFactories, clickPower: clickPower, rebirths: rebirths
    }, { merge: true }).catch(e => console.error("Error saving:", e));
}
function applyTheme(theme) { const b=document.body, ts=document.getElementById('theme-toggle-switch'); if(theme==="light"){ b.classList.remove("dark-mode"); b.classList.add("light-mode"); if(ts) ts.checked=true; } else { b.classList.remove("light-mode"); b.classList.add("dark-mode"); if(ts) ts.checked=false; } }
function toggleTheme() { const b=document.body, ts=document.getElementById('theme-toggle-switch'); if(b.classList.contains('dark-mode')){ b.classList.remove('dark-mode'); b.classList.add('light-mode'); if(ts) ts.checked=true; } else { b.classList.remove('light-mode'); b.classList.add('dark-mode'); if(ts) ts.checked=false; } saveSessionData(); }
function updateProfileUI() { const a=document.getElementById("header-user-avatar"), n=document.getElementById("header-user-name"); if(a) a.src=currentUserAvatar; if(n) n.innerText=currentUser||"Guest"; }
function updateUsernameFromSettings() { const inp=document.getElementById("settings-username-input"); if(!inp||!currentUser) return; const nn=inp.value.trim(); if(nn.length>=3 && nn.length<=20){ currentUser=nn; updateProfileUI(); saveSessionData(); } else { alert("Username must be between 3 and 20 characters!"); inp.value=currentUser||""; } }
function handleAvatarUpload(e) { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=function(ev){ currentUserAvatar=ev.target.result; updateProfileUI(); saveSessionData(); }; r.readAsDataURL(f); }
function saveSettings() { const ki=document.getElementById('user-api-key'); if(ki) customApiKey=ki.value.trim(); const np=document.getElementById('settings-new-pass').value, cp=document.getElementById('settings-confirm-pass').value; if(np||cp){ if(np===cp){ auth.currentUser.updatePassword(np).then(()=>{ alert("Password updated successfully."); document.getElementById('settings-new-pass').value=""; document.getElementById('settings-confirm-pass').value=""; }).catch(e=>alert(e.message)); } else alert("Passwords do not match!"); } saveSessionData(); updateUsageUI(); }
function toggleApiKeyHelp() { const hb=document.getElementById('api-key-help-box'); if(hb) hb.classList.toggle('hidden'); }
function toggleSidebar() { const sb=document.getElementById('desktop-sidebar'), btn=document.getElementById('sidebar-toggle-btn'); if(!sb) return; if(sb.classList.contains('expanded')){ sb.classList.remove('expanded'); sb.classList.add('collapsed'); if(btn) btn.innerText="❯"; } else { sb.classList.remove('collapsed'); sb.classList.add('expanded'); if(btn) btn.innerText="❮"; } }
function getDifficulty() { const s=document.getElementById("difficulty-select"); return s?s.value:"medium"; }
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active')); const t=document.getElementById(viewId); if(t) t.classList.add('active');
    const sb=document.querySelector('.desktop-sidebar'), ov=document.getElementById('sidebar-overlay'); if(sb&&sb.classList.contains('open')) sb.classList.remove('open'); if(ov&&ov.classList.contains('active')) ov.classList.remove('active');
    if(viewId!=='view-dm'){ isDM=false; if(currentDmUnsubscribe){ currentDmUnsubscribe(); currentDmUnsubscribe=null; } }
    if(viewId==='view-games') updateDifficultyPickerVisibility(); else if(viewId==='view-friends') fetchAllUsers(); else if(viewId==='view-burgerclicker') updateUpgradesUI();
}

function selectGame(element, gameName) { document.querySelectorAll('.game-card-img').forEach(c=>c.classList.remove('selected')); element.classList.add('selected'); selectedGame=gameName; updateDifficultyPickerVisibility(); }
function updateDifficultyPickerVisibility() { const dp=document.getElementById("difficulty-picker"); if(dp) dp.style.display=gamesWithDifficulty.includes(selectedGame)?"flex":"none"; }
function launchGame() {
    if(selectedGame==="Burger Clicker") { switchView("view-burgerclicker"); updateUpgradesUI(); } 
    else if(selectedGame==="Tic Tac Toe") { switchView("view-tictactoe"); if(typeof initTicTacToe==='function') initTicTacToe(); } 
    else if(selectedGame==="Rock Paper Scissors") { switchView("view-rps"); if(typeof initRps==='function') initRps(); } 
    else if(selectedGame==="Blackjack") { switchView("view-blackjack"); if(typeof prepBlackjack==='function') prepBlackjack(); } 
    else if(selectedGame==="Hangman") { switchView("view-hangman"); if(typeof initHangman==='function') initHangman(); } 
    else if(selectedGame==="Connect Four") { switchView("view-connectfour"); if(typeof initConnectFour==='function') initConnectFour(); } 
    else if(selectedGame==="Battleship") { switchView("view-battleship"); if(typeof initBattleship==='function') initBattleship(); } 
    else if(selectedGame==="Checkers") { switchView("view-checkers"); if(typeof initCheckers==='function') initCheckers(); } 
    else if(selectedGame==="Chess") { switchView("view-chess"); if(typeof initChess==='function') initChess(); } 
}

function clickBurger() { let a=getClickValue(); clickerBurgers+=a; updateBurgerUI(); const b=document.getElementById("carl-clicker-btn"), f=document.createElement("div"); f.className="floating-number"; f.innerText="+"+a.toLocaleString(); f.style.left=(Math.random()*80+10)+"%"; f.style.top=(Math.random()*80+10)+"%"; b.appendChild(f); setTimeout(()=>f.remove(),1000); }
function buyUpgrade(type) {
    let cost=0;
    if(type==='click'){ cost=Math.floor(100*Math.pow(1.5,clickPower-1)); if(clickerBurgers>=cost){ clickerBurgers-=cost; clickPower++; } else { alert("Not enough Burgers!"); return; } }
    else if(type==='chef'){ cost=Math.floor(50*Math.pow(1.15,autoChefs)); if(clickerBurgers>=cost){ clickerBurgers-=cost; autoChefs++; } else { alert("Not enough Burgers!"); return; } }
    else if(type==='stand'){ cost=Math.floor(500*Math.pow(1.15,burgerStands)); if(clickerBurgers>=cost){ clickerBurgers-=cost; burgerStands++; } else { alert("Not enough Burgers!"); return; } }
    else if(type==='factory'){ cost=Math.floor(5000*Math.pow(1.15,burgerFactories)); if(clickerBurgers>=cost){ clickerBurgers-=cost; burgerFactories++; } else { alert("Not enough Burgers!"); return; } }
    updateBurgerUI(); updateUpgradesUI(); saveSessionData();
}
function exchangeBurgers() { if(clickerBurgers>=10000){ clickerBurgers-=10000; userBurgers+=1; updateBurgerUI(); saveSessionData(); } else alert("You need 10,000 Clicker Burgers!"); }
function rebirth() { if(clickerBurgers>=1000000000000){ clickerBurgers=0; autoChefs=0; burgerStands=0; burgerFactories=0; clickPower=1; rebirths++; alert("REBIRTHED! +100% Boost!"); updateBurgerUI(); updateUpgradesUI(); saveSessionData(); } else alert("You need 1 Trillion Burgers!"); }
function updateUpgradesUI() {
    let e = (id) => document.getElementById(id);
    if(e("click-cost")) e("click-cost").innerText=Math.floor(100*Math.pow(1.5,clickPower-1)).toLocaleString();
    if(e("click-power-count")) e("click-power-count").innerText=getClickValue().toLocaleString();
    if(e("chef-cost")) e("chef-cost").innerText=Math.floor(50*Math.pow(1.15,autoChefs)).toLocaleString();
    if(e("chef-count")) e("chef-count").innerText=autoChefs.toLocaleString();
    if(e("chef-output")) e("chef-output").innerText=(getChefPower()*getMultiplier()).toLocaleString();
    if(e("stand-cost")) e("stand-cost").innerText=Math.floor(500*Math.pow(1.15,burgerStands)).toLocaleString();
    if(e("stand-count")) e("stand-count").innerText=burgerStands.toLocaleString();
    if(e("stand-output")) e("stand-output").innerText=(getStandPower()*getMultiplier()).toLocaleString();
    if(e("factory-cost")) e("factory-cost").innerText=Math.floor(5000*Math.pow(1.15,burgerFactories)).toLocaleString();
    if(e("factory-count")) e("factory-count").innerText=burgerFactories.toLocaleString();
    if(e("factory-output")) e("factory-output").innerText=(getFactoryPower()*getMultiplier()).toLocaleString();
    if(e("bps-text")) e("bps-text").innerText=getBps().toLocaleString();
    if(e("rebirth-count")) e("rebirth-count").innerText=rebirths.toLocaleString();
}

const avatarColors=["#ef4444","#84cc16","#eab308","#3b82f6","#a855f7","#f97316","#ec4899"];
function getAvatarColor(str) { let h=0; for(let i=0;i<str.length;i++) h=str.charCodeAt(i)+((h<<5)-h); return avatarColors[Math.abs(h)%avatarColors.length]; }
function getAvatarHTML(u) { if(!u.avatar||u.avatar.includes('default-avatar.png')) { const c=getAvatarColor(u.username), i=u.username.charAt(0).toUpperCase(); return `<div class="text-avatar" style="background-color: ${c};">${i}</div>`; } return `<img class="friend-avatar" src="${u.avatar}" draggable="false">`; }

let allUsersCache = [];
async function fetchAllUsers() {
    const list = document.getElementById("find-people-list"); if(list) list.innerHTML = "<p style='color:var(--text-sub);'>Loading...</p>";
    try {
        if (firebaseUserId && db) { const sn = await db.collection("users").get(); allUsersCache=[]; sn.forEach(d=>{ const dt=d.data(); if(d.id!==firebaseUserId && dt.username) allUsersCache.push({ id:d.id, username:dt.username, avatar:dt.avatar||"" }); }); }
    } catch(e) { console.error(e); }
    renderFriendsView();
}
function renderFriendsView() {
    const q=document.getElementById("friend-search-input").value.toLowerCase().trim(), fList=document.getElementById("find-people-list"), mList=document.getElementById("my-friends-list");
    if(!fList||!mList) return; fList.innerHTML=""; mList.innerHTML="";
    const actF=allUsersCache.filter(u=>myFriends.includes(u.id));
    if(actF.length===0) mList.innerHTML="<p style='color: var(--text-sub); margin-top:10px;'>No friends yet.</p>";
    else { actF.forEach(u=>{ const i=document.createElement("div"); i.className="friend-item"; i.innerHTML=`<div class="friend-info">${getAvatarHTML(u)}<span class="friend-name">${u.username}</span></div><div style="display:flex; gap:8px;"><button class="friend-msg-btn" onclick='openDirectMessage(${JSON.stringify(u)})'>Message</button><button class="friend-req-btn" style="border-color:#ef4444; color:#ef4444;" onclick="unfriendUser('${u.id}')">Unfriend</button></div>`; mList.appendChild(i); }); }
    const inReq=allUsersCache.filter(u=>myRequests.includes(u.id));
    inReq.forEach(u=>{ const i=document.createElement("div"); i.className="friend-item"; i.innerHTML=`<div class="friend-info">${getAvatarHTML(u)}<span class="friend-name">${u.username}</span></div><button class="friend-req-btn" onclick="acceptRequest('${u.id}')">Accept Request</button>`; fList.appendChild(i); });
    if(q) {
        let sr=allUsersCache.filter(u=>u.username.toLowerCase().includes(q) && !myFriends.includes(u.id) && !myRequests.includes(u.id));
        if(sr.length===0 && inReq.length===0) fList.innerHTML="<p style='color: var(--text-sub); margin-top:10px;'>No users found.</p>";
        else sr.forEach(u=>{ const i=document.createElement("div"); i.className="friend-item"; const snt=mySentRequests.includes(u.id), btn=snt?`<button class="friend-msg-btn" style="opacity:0.5;" disabled>Sent!</button>`:`<button class="friend-msg-btn" onclick="sendFriendRequest('${u.id}')">Add Friend</button>`; i.innerHTML=`<div class="friend-info">${getAvatarHTML(u)}<span class="friend-name">${u.username}</span></div>${btn}`; fList.appendChild(i); });
    } else if(inReq.length===0) fList.innerHTML="<p style='color: var(--text-sub); margin-top:10px; text-align:center;'>Search for a username above!</p>";
}
async function sendFriendRequest(tId) { if(!firebaseUserId) return; mySentRequests.push(tId); renderFriendsView(); await db.collection("users").doc(tId).update({ friendRequests: firebase.firestore.FieldValue.arrayUnion(firebaseUserId) }); await db.collection("users").doc(firebaseUserId).update({ sentRequests: firebase.firestore.FieldValue.arrayUnion(tId) }); }
async function acceptRequest(rId) { if(!firebaseUserId) return; myRequests=myRequests.filter(id=>id!==rId); myFriends.push(rId); renderFriendsView(); await db.collection("users").doc(firebaseUserId).update({ friendRequests: firebase.firestore.FieldValue.arrayRemove(rId), friends: firebase.firestore.FieldValue.arrayUnion(rId) }); await db.collection("users").doc(rId).update({ sentRequests: firebase.firestore.FieldValue.arrayRemove(firebaseUserId), friends: firebase.firestore.FieldValue.arrayUnion(firebaseUserId) }); }
async function unfriendUser(tId) { if(!confirm("Are you sure you want to unfriend this user?")) return; myFriends=myFriends.filter(id=>id!==tId); renderFriendsView(); await db.collection("users").doc(firebaseUserId).update({ friends: firebase.firestore.FieldValue.arrayRemove(tId) }); await db.collection("users").doc(tId).update({ friends: firebase.firestore.FieldValue.arrayRemove(firebaseUserId) }); }

function openDirectMessage(u) {
    isDM=true; currentDmUser=u; activeChatId="dm_"+[firebaseUserId,u.id].sort().join('_');
    document.getElementById("dm-header-avatar").innerHTML=getAvatarHTML(u); document.getElementById("dm-header-name").innerText=u.username; document.getElementById("dm-input").placeholder=`Message ${u.username}...`; document.getElementById("dm-chat-log").innerHTML="";
    if(currentDmUnsubscribe) currentDmUnsubscribe();
    currentDmUnsubscribe=db.collection("dms").doc(activeChatId).collection("messages").orderBy("timestamp","asc").onSnapshot(sn=>{
        const l=document.getElementById("dm-chat-log"); l.innerHTML="";
        sn.forEach(doc=>{
            const d=doc.data(), isMe=d.senderId===firebaseUserId, mDiv=document.createElement("div"); mDiv.className=`dm-message ${isMe?'sent':'received'}`; mDiv.dataset.id=doc.id;
            const cDiv=document.createElement("div"); cDiv.className="dm-message-content";
            if(d.text){ const tSpn=document.createElement("span"); tSpn.className="dm-message-text"; tSpn.innerText=d.text; cDiv.appendChild(tSpn); }
            if(d.imageSrc){ const img=document.createElement("img"); img.src=d.imageSrc; img.className="chat-image"; img.draggable=false; cDiv.appendChild(img); }
            const w=document.createElement("div"); w.style.display="flex"; w.style.alignItems="center"; w.style.gap="8px";
            if(isMe){ const del=document.createElement("button"); del.innerHTML="✕"; del.className="dm-del-btn"; del.title="Delete Message"; del.onclick=()=>deleteDmMessage(doc.id); w.appendChild(del); w.appendChild(cDiv); } else { w.appendChild(cDiv); }
            const aObj=isMe?{username:currentUser, avatar:currentUserAvatar}:currentDmUser, aW=document.createElement("div"); aW.className="dm-message-avatar"; aW.innerHTML=getAvatarHTML(aObj);
            mDiv.appendChild(aW); mDiv.appendChild(w); l.appendChild(mDiv);
        });
        l.scrollTop=l.scrollHeight;
    });
    switchView('view-dm');
}
async function deleteDmMessage(mId) { if(confirm("Delete this message?")) await db.collection("dms").doc(activeChatId).collection("messages").doc(mId).delete(); }

function processDmFile(file) { if(file.type.startsWith('image/')) { const r=new FileReader(); r.onload=function(e){ pendingDmImageSrc=e.target.result; pendingDmImageMime=pendingDmImageSrc.split(';')[0].split(':')[1]; pendingDmImageBase64=pendingDmImageSrc.split(',')[1]; const imgEl=document.getElementById('dm-image-preview-img'), boxEl=document.getElementById('dm-image-preview-box'); if(imgEl&&boxEl){ imgEl.src=pendingDmImageSrc; boxEl.classList.add('active'); } }; r.readAsDataURL(file); } }
const dmFP = document.getElementById('dm-native-file-picker'); if(dmFP) dmFP.addEventListener('change', function(e){ const f=e.target.files[0]; if(!f) return; processDmFile(f); dmFP.value=""; });
function clearDmPendingImage() { pendingDmImageBase64=null; pendingDmImageMime=null; pendingDmImageSrc=null; const bx=document.getElementById('dm-image-preview-box'); if(bx) bx.classList.remove('active'); }
async function sendDmMessage() { const inp=document.getElementById("dm-input"); if(!inp) return; const t=inp.value.trim(); if(!t&&!pendingDmImageBase64) return; if(!activeChatId||!isDM) return; inp.value=""; const iS=pendingDmImageSrc; clearDmPendingImage(); await db.collection("dms").doc(activeChatId).collection("messages").add({ text:t, imageSrc:iS||null, senderId:firebaseUserId, timestamp:firebase.firestore.FieldValue.serverTimestamp() }); }

// =========================================================================
// --- CLEANUP MEDIA FUNCTION ---
// =========================================================================
function stopAllMedia() {
    if(localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
    if(window.localVideoTrack) { window.localVideoTrack.stop(); window.localVideoTrack=null; }
    if(peerConnection) { peerConnection.close(); peerConnection=null; }
    if(recognition) { try{recognition.stop();}catch(e){} recognition=null; }
    if(callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval=null; }
    if(ringInterval) { clearInterval(ringInterval); ringInterval=null; }
    if(ringTimeout) { clearTimeout(ringTimeout); ringTimeout=null; }
    if(window.speechSynthesis) window.speechSynthesis.cancel();
    if(callAbortController) callAbortController.abort();
    
    isFcVideoActive = false;
    const localVid = document.getElementById("fc-local-video"), remoteVid = document.getElementById("fc-remote-video");
    if(localVid) localVid.style.display = "none"; if(remoteVid) remoteVid.style.display = "none";
    const btn = document.getElementById("fc-facetime-btn"); if(btn) btn.style.opacity = "0.4";
}

// --- WEBRTC CALLING SYSTEM ---
const rtcServers = { iceServers: [ { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] } ], iceCandidatePoolSize: 10 };
function listenForIncomingCalls() {
    if(!firebaseUserId) return;
    db.collection("calls").where("receiverId","==",firebaseUserId).where("status","==","calling").onSnapshot(sn=>{ sn.docChanges().forEach(c=>{ if(c.type==="added"){ const d=c.doc.data(); showIncomingCallUI(c.doc.id, d); } }); });
}

function getDummyVideoTrack() {
    const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
    const stream = canvas.captureStream(); const track = stream.getVideoTracks()[0]; track.enabled = false; return track;
}

async function startFriendCall() {
    if(!currentDmUser||!firebaseUserId) return;
    stopAllMedia();
    try {
        localStream=await navigator.mediaDevices.getUserMedia({audio:true, video:false});
        peerConnection=new RTCPeerConnection(rtcServers);
        
        localStream.getTracks().forEach(t=>peerConnection.addTrack(t, localStream));
        peerConnection.addTrack(getDummyVideoTrack(), localStream); 
        
        peerConnection.ontrack=(e)=>{ 
            if(e.track.kind === 'video') { const rv = document.getElementById("fc-remote-video"); if (rv.srcObject !== e.streams[0]) rv.srcObject=e.streams[0]; rv.style.display = "block"; } 
            else { const ra = document.getElementById("remote-audio"); if (ra.srcObject !== e.streams[0]) ra.srcObject=e.streams[0]; ra.play().catch(console.error); }
        };
        
        const cd=db.collection("calls").doc(); activeCallDocId=cd.id;
        const oc=cd.collection("offerCandidates"), ac=cd.collection("answerCandidates");
        peerConnection.onicecandidate=(e)=>{ if(e.candidate) oc.add(e.candidate.toJSON()); };
        const oDesc=await peerConnection.createOffer(); await peerConnection.setLocalDescription(oDesc);
        await cd.set({ callerId:firebaseUserId, callerName:currentUser, callerAvatar:currentUserAvatar, receiverId:currentDmUser.id, status:"calling", offer:{ type:oDesc.type, sdp:oDesc.sdp } });
        
        document.getElementById("fc-title").innerText=currentDmUser.username; document.getElementById("fc-status").innerText="Calling..."; document.getElementById("fc-status").style.display="block"; document.getElementById("fc-timer").innerText="00:00";
        callSeconds = 0; switchView('view-friend-call');
        
        callListenerUnsubscribe=cd.onSnapshot(sn=>{ 
            const d=sn.data(); 
            if(d?.answer && !peerConnection.currentRemoteDescription){ 
                const aDesc=new RTCSessionDescription(d.answer); peerConnection.setRemoteDescription(aDesc); 
                document.getElementById("fc-status").style.display="none"; 
                if (callTimerInterval) clearInterval(callTimerInterval);
                callTimerInterval = setInterval(() => { callSeconds++; const m = String(Math.floor(callSeconds / 60)).padStart(2, '0'); const s = String(Math.floor(callSeconds % 60)).padStart(2, '0'); document.getElementById("fc-timer").innerText = `${m}:${s}`; }, 1000);
            } 
            if(d?.status==="ended") endFriendCall(false); 
        });
        ac.onSnapshot(sn=>{ sn.docChanges().forEach(c=>{ if(c.type==="added"){ const cnd=new RTCIceCandidate(c.doc.data()); peerConnection.addIceCandidate(cnd); } }); });
    } catch(e) { alert("Mic required for calling. Please ensure your microphone is plugged in and allowed."); stopAllMedia(); switchView('view-dm'); }
}

function showIncomingCallUI(cId, d) { activeCallDocId=cId; document.getElementById("friend-call-name").innerText=d.callerName; document.getElementById("friend-call-status").innerText="Incoming Voice Call..."; document.getElementById("friend-call-avatar").innerHTML=getAvatarHTML({username:d.callerName, avatar:d.callerAvatar}); document.getElementById("accept-call-btn").style.display="inline-block"; document.getElementById("friend-call-modal").classList.remove("hidden"); }

async function answerFriendCall() {
    stopAllMedia();
    try {
        localStream=await navigator.mediaDevices.getUserMedia({audio:true, video:false});
        peerConnection=new RTCPeerConnection(rtcServers);
        
        localStream.getTracks().forEach(t=>peerConnection.addTrack(t, localStream));
        peerConnection.addTrack(getDummyVideoTrack(), localStream); 
        
        peerConnection.ontrack=(e)=>{ 
            if(e.track.kind === 'video') { const rv = document.getElementById("fc-remote-video"); if (rv.srcObject !== e.streams[0]) rv.srcObject=e.streams[0]; rv.style.display = "block"; } 
            else { const ra = document.getElementById("remote-audio"); if (ra.srcObject !== e.streams[0]) ra.srcObject=e.streams[0]; ra.play().catch(console.error); }
        };
        
        const cd=db.collection("calls").doc(activeCallDocId), ac=cd.collection("answerCandidates"), oc=cd.collection("offerCandidates");
        peerConnection.onicecandidate=(e)=>{ if(e.candidate) ac.add(e.candidate.toJSON()); };
        const cSn=await cd.get(), cD=cSn.data(); await peerConnection.setRemoteDescription(new RTCSessionDescription(cD.offer));
        const aDesc=await peerConnection.createAnswer(); await peerConnection.setLocalDescription(aDesc);
        await cd.update({ status:"connected", answer:{ type:aDesc.type, sdp:aDesc.sdp } });
        
        document.getElementById("friend-call-modal").classList.add("hidden");
        document.getElementById("fc-title").innerText=cD.callerName; document.getElementById("fc-status").style.display="none"; document.getElementById("fc-timer").innerText="00:00";
        callSeconds = 0; switchView('view-friend-call');
        
        if (callTimerInterval) clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => { callSeconds++; const m = String(Math.floor(callSeconds / 60)).padStart(2, '0'); const s = String(Math.floor(callSeconds % 60)).padStart(2, '0'); document.getElementById("fc-timer").innerText = `${m}:${s}`; }, 1000);
        
        oc.onSnapshot(sn=>{ sn.docChanges().forEach(c=>{ if(c.type==="added"){ const cnd=new RTCIceCandidate(c.doc.data()); peerConnection.addIceCandidate(cnd); } }); });
        callListenerUnsubscribe=cd.onSnapshot(sn=>{ const d=sn.data(); if(d?.status==="ended") endFriendCall(false); });
    } catch(e) { alert("Mic required. Please check your browser permissions."); stopAllMedia(); document.getElementById("friend-call-modal").classList.add("hidden"); }
}

async function endFriendCall(notify=true) {
    if(notify&&activeCallDocId) await db.collection("calls").doc(activeCallDocId).update({status:"ended"}).catch(()=>{});
    stopAllMedia(); activeCallDocId=null; document.getElementById("friend-call-modal").classList.add("hidden"); switchView('view-dm');
}
function declineFriendCall() { if(activeCallDocId) db.collection("calls").doc(activeCallDocId).update({status:"ended"}).catch(()=>{}); activeCallDocId=null; document.getElementById("friend-call-modal").classList.add("hidden"); }

async function toggleFcVideo() {
    const btn = document.getElementById("fc-facetime-btn"), localVid = document.getElementById("fc-local-video");
    if (!isFcVideoActive) {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            window.localVideoTrack = videoStream.getVideoTracks()[0];
            localVid.srcObject = new MediaStream([window.localVideoTrack]); localVid.style.display = "block";
            if (peerConnection) {
                const videoSender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (videoSender) videoSender.replaceTrack(window.localVideoTrack);
            }
            isFcVideoActive = true; if (btn) btn.style.opacity = "1";
        } catch (e) { alert("Camera access denied."); }
    } else {
        if (window.localVideoTrack) { window.localVideoTrack.stop(); window.localVideoTrack = null; }
        if (peerConnection) { 
            const videoSender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
            if (videoSender) videoSender.replaceTrack(getDummyVideoTrack()); 
        }
        localVid.style.display = "none"; isFcVideoActive = false; if (btn) btn.style.opacity = "0.4";
    }
}

function toggleFcMute() { isFcMuted = !isFcMuted; const btn = document.getElementById("fc-mute-btn"); if (localStream) localStream.getAudioTracks().forEach(t => t.enabled = !isFcMuted); if (btn) btn.style.opacity = isFcMuted ? "0.4" : "1"; }
function toggleFcSpeaker() { isFcSpeakerOn = !isFcSpeakerOn; const remoteVid = document.getElementById("fc-remote-video"), remoteAud = document.getElementById("remote-audio"); if (remoteVid) remoteVid.muted = !isFcSpeakerOn; if (remoteAud) remoteAud.muted = !isFcSpeakerOn; const btn = document.getElementById("fc-speaker-btn"); if (btn) btn.style.opacity = isFcSpeakerOn ? "1" : "0.4"; }

// --- CHAT LOGIC ---
function checkDailyMessageLimit() {
    const today=new Date().toISOString().split('T')[0]; let lastDate=localStorage.getItem("carl_last_msg_date"), count=parseInt(localStorage.getItem("carl_msg_count")||"0",10);
    if(lastDate!==today) { lastDate=today; count=0; localStorage.setItem("carl_last_msg_date",today); localStorage.setItem("carl_msg_count","0"); }
    if(count>=10 && !hasValidApiKey()) { alert("Daily limit reached! Enter an API key."); switchView('view-settings'); return false; } return true;
}
function startNewChat() { isDM=false; if(currentDmUnsubscribe){ currentDmUnsubscribe(); currentDmUnsubscribe=null; } archiveActiveChat(); activeChatId="chat_"+Date.now(); chatHistory=[]; const log=document.getElementById("chat-log"); if(log) log.innerHTML=''; const input=document.getElementById("user-input"); if(input) input.value=""; clearPendingImage(); document.getElementById("startup-title").innerHTML='Ask Away!<span class="typing-cursor"></span>'; showStartupScreen(); saveSessionData(); switchView('view-chat'); }
function loadChat(chatId) { isDM=false; if(currentDmUnsubscribe){ currentDmUnsubscribe(); currentDmUnsubscribe=null; } archiveActiveChat(); const target=chatsHistory.find(c=>c.id===chatId); if(target) { activeChatId=target.id; const log=document.getElementById("chat-log"); if(log) log.innerHTML=target.html; chatHistory=[...target.apiHistory]; if(chatHistory.length>0) hideStartupScreen(); else { document.getElementById("startup-title").innerHTML='Ask Away!<span class="typing-cursor"></span>'; showStartupScreen(); } saveSessionData(); switchView('view-chat'); } }

async function sendMessage() {
    const input=document.getElementById("user-input"); if(!input) return; const text=input.value.trim(); if(!text&&!pendingImageBase64) return;
    if(text.toLowerCase().trim()==="/whomadeyou") { hideStartupScreen(); appendMessage(text,"user",pendingImageSrc); appendMessage("Emmett Breen","carl"); input.value=""; clearPendingImage(); return; }
    if(!checkDailyMessageLimit()) return; hideStartupScreen(); appendMessage(text,"user",pendingImageSrc);
    const uLT=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',hour12:true}), uTZ=Intl.DateTimeFormat().resolvedOptions().timeZone;
    const payload={ message:text||"Look at this image.", history:chatHistory, image_b64:pendingImageBase64, image_mime:pendingImageMime, api_key:customApiKey, user_time:uLT, user_timezone:uTZ, client_time:`${uLT} (${uTZ})` };
    input.value=""; clearPendingImage(); const log=document.getElementById("chat-log"), cB=document.createElement("div"); cB.className="chat-bubble carl"; const tN=document.createElement("div"); cB.appendChild(tN); log.appendChild(cB); log.scrollTop=log.scrollHeight;
    try {
        const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
        if(!res.ok) { if(res.status===401||res.status===403) { tN.innerText="Error: Invalid API Key provided. Reverting key settings."; alert("The API key provided is invalid! Please check your key in Settings."); customApiKey=""; const kI=document.getElementById('user-api-key'); if(kI) kI.value=""; saveSessionData(); return; } tN.innerText="Error reaching Carl."; return; }
        if(!hasValidApiKey()) { const d=new Date().toISOString().split('T')[0]; let c=parseInt(localStorage.getItem("carl_msg_count")||"0",10)+1; localStorage.setItem("carl_last_msg_date",d); localStorage.setItem("carl_msg_count",c.toString()); updateUsageUI(); }
        const rdr=res.body.getReader(), dcd=new TextDecoder(); let fRes="", dBuf="", sFin=false, iTyp=false;
        function renderTypewriter() { if(dBuf.length<fRes.length) { let diff=fRes.length-dBuf.length, add=diff>20?4:(diff>5?2:1); dBuf+=fRes.substring(dBuf.length,dBuf.length+add); tN.innerHTML=formatMessage(dBuf)+'<span class="typing-cursor"></span>'; log.scrollTop=log.scrollHeight; setTimeout(renderTypewriter,15); } else if(!sFin) setTimeout(renderTypewriter,15); else { tN.innerHTML=formatMessage(fRes); log.scrollTop=log.scrollHeight; iTyp=false; } }
        while(true) { const {done,value}=await rdr.read(); if(done) { sFin=true; break; } const chk=dcd.decode(value,{stream:true}); fRes+=chk; for(let bp of ["Carl:","carl:","Carl - ","Assistant:"]) { if(fRes.startsWith(bp)) { fRes=fRes.substring(bp.length).trimStart(); dBuf=""; } } if(!iTyp) { iTyp=true; renderTypewriter(); } }
        chatHistory.push({role:"user",content:text||"Look at this image."}); chatHistory.push({role:"assistant",content:fRes}); saveSessionData();
    } catch(err) { tN.innerText="Network error."; }
}

function searchChats() {
    let oM=document.getElementById("search-modal"); if(oM) oM.remove();
    const md=document.createElement("div"); md.id="search-modal"; md.className="auth-overlay"; md.style.zIndex="10000";
    const bx=document.createElement("div"); bx.className="auth-card"; bx.style.textAlign="left";
    const tl=document.createElement("h2"); tl.innerText="Search Chats"; tl.style.marginBottom="16px";
    const inpt=document.createElement("input"); inpt.type="text"; inpt.placeholder="Search messages..."; inpt.style.width="100%"; inpt.style.padding="12px"; inpt.style.borderRadius="12px"; inpt.style.background="var(--bg-input)"; inpt.style.color="var(--text-main)"; inpt.style.border="1px solid var(--border-color)"; inpt.style.marginBottom="16px";
    const res=document.createElement("div"); res.style.maxHeight="250px"; res.style.overflowY="auto"; res.style.display="flex"; res.style.flexDirection="column"; res.style.gap="8px";
    const cB=document.createElement("button"); cB.innerText="Close"; cB.className="call-btn decline"; cB.style.width="100%"; cB.style.marginTop="16px"; cB.onclick=()=>md.remove();
    inpt.oninput=(e)=>{ res.innerHTML=""; const q=e.target.value.toLowerCase().trim(); if(!q) return; const m=chatsHistory.filter(c=>c.title.toLowerCase().includes(q)||c.apiHistory.some(m=>m.content.toLowerCase().includes(q))); if(m.length===0) res.innerHTML="<div style='color:var(--text-sub);text-align:center;'>No results.</div>"; m.forEach(ch=>{ const i=document.createElement("div"); i.innerText=ch.title; i.style.padding="14px"; i.style.background="var(--bg-input)"; i.style.borderRadius="12px"; i.style.cursor="pointer"; i.style.transition="background-color 0.2s"; i.onmouseover=()=>i.style.backgroundColor="#9333ea"; i.onmouseleave=()=>i.style.backgroundColor="var(--bg-input)"; i.onclick=()=>{ loadChat(ch.id); md.remove(); }; res.appendChild(i); }); };
    bx.appendChild(tl); bx.appendChild(inpt); bx.appendChild(res); bx.appendChild(cB); md.appendChild(bx); document.body.appendChild(md); setTimeout(()=>inpt.focus(),100);
}

function initMobileNavIcons() {
    const mc=document.getElementById("mobile-nav-chat"), ml=document.getElementById("mobile-nav-call"), mg=document.getElementById("mobile-nav-games"), ms=document.getElementById("mobile-nav-settings");
    if(mc) mc.onclick=()=>startNewChat(); if(ml) ml.onclick=()=>startCall(); if(mg) mg.onclick=()=>switchView('view-games'); if(ms) ms.onclick=()=>switchView('view-settings');
}

function archiveActiveChat() {
    const l=document.getElementById("chat-log"); if(!l) return; const b=l.querySelectorAll('.chat-bubble');
    if(b.length>0 && activeChatId && !isDM) {
        let ex=chatsHistory.find(c=>c.id===activeChatId); if(ex) { ex.html=l.innerHTML; ex.apiHistory=[...chatHistory]; }
        else { const t=b[0].innerText||"Chat Session", nT=t.length>20?t.substring(0,20)+"...":t; chatsHistory.unshift({id:activeChatId,title:nT,html:l.innerHTML,apiHistory:[...chatHistory],pinned:false}); }
    } saveSessionData(); renderChatHistorySidebar();
}

function clearPendingImage() { pendingImageBase64=null; pendingImageMime=null; pendingImageSrc=null; const fp=document.getElementById('native-file-picker'); if(fp) fp.value=""; const b=document.getElementById('image-preview-box'); if(b) b.classList.remove('active'); }

function renderChatHistorySidebar() {
    const ct=document.getElementById("saved-chats-list"); if(!ct) return; ct.innerHTML="";
    const sc=[...chatsHistory].sort((a,b)=>{ if(a.pinned&&!b.pinned) return -1; if(!a.pinned&&b.pinned) return 1; return 0; });
    sc.forEach(ch=>{
        const it=document.createElement("div"); it.className="saved-chat-item";
        const tc=document.createElement("div"); tc.className="chat-title-text";
        if(ch.pinned){ const pi=document.createElement("img"); pi.className="pinned-icon-img"; pi.src="/static/icons/PinIcon.png"; pi.draggable=false; tc.appendChild(pi); }
        const tt=document.createElement("span"); tt.innerText=ch.title; tc.appendChild(tt); tc.onclick=()=>loadChat(ch.id);
        const ob=document.createElement("button"); ob.className="chat-options-btn"; ob.innerText="⋮";
        const dd=document.createElement("div"); dd.className="chat-dropdown-menu";
        const eb=document.createElement("button"); eb.className="chat-dropdown-item"; eb.innerText="Edit Name"; eb.onclick=(e)=>{e.stopPropagation(); editChatTitle(ch.id); dd.classList.remove('active');};
        const pb=document.createElement("button"); pb.className="chat-dropdown-item"; pb.innerText=ch.pinned?"Unpin Chat":"Pin Chat"; pb.onclick=(e)=>{e.stopPropagation(); togglePinChat(ch.id); dd.classList.remove('active');};
        const db=document.createElement("button"); db.className="chat-dropdown-item delete"; db.innerText="Delete"; db.onclick=(e)=>{e.stopPropagation(); deleteChat(ch.id); dd.classList.remove('active');};
        dd.appendChild(eb); dd.appendChild(pb); dd.appendChild(db);
        ob.onclick=(e)=>{ e.stopPropagation(); document.querySelectorAll('.chat-dropdown-menu.active').forEach(m=>{if(m!==dd)m.classList.remove('active');}); dd.classList.toggle('active'); };
        it.appendChild(tc); it.appendChild(ob); it.appendChild(dd); ct.appendChild(it);
    });
}

document.addEventListener("click", () => document.querySelectorAll('.chat-dropdown-menu.active').forEach(m => m.classList.remove('active')));
function editChatTitle(id) { const c=chatsHistory.find(x=>x.id===id); if(!c) return; const n=prompt("New name:",c.title); if(n&&n.trim()!=="") { c.title=n.trim(); saveSessionData(); renderChatHistorySidebar(); } }
function togglePinChat(id) { const c=chatsHistory.find(x=>x.id===id); if(!c) return; c.pinned=!c.pinned; saveSessionData(); renderChatHistorySidebar(); }
function deleteChat(id) { if(confirm("Are you sure you want to delete this chat forever?")) { chatsHistory=chatsHistory.filter(x=>x.id!==id); if(activeChatId===id) startNewChat(); else { saveSessionData(); renderChatHistorySidebar(); } } }

function updateUsageUI() {
    const f=document.getElementById("usage-fill"), t=document.getElementById("usage-text"); if(!f||!t) return;
    if(hasValidApiKey()) { f.style.width="100%"; t.innerText="Unlimited"; } else {
        const td=new Date().toISOString().split('T')[0]; let ld=localStorage.getItem("carl_last_msg_date"), ct=parseInt(localStorage.getItem("carl_msg_count")||"0",10);
        if(ld!==td) { ld=td; ct=0; localStorage.setItem("carl_last_msg_date",td); localStorage.setItem("carl_msg_count","0"); }
        let p=(ct/10)*100; if(p>100) p=100; f.style.width=`${p}%`; t.innerText=`${ct}/10`;
    }
}

function processFile(f) {
    if(f.type.startsWith('image/')) { const r=new FileReader(); r.onload=function(e){ pendingImageSrc=e.target.result; pendingImageMime=pendingImageSrc.split(';')[0].split(':')[1]; pendingImageBase64=pendingImageSrc.split(',')[1]; const i=document.getElementById('image-preview-img'), b=document.getElementById('image-preview-box'); if(i&&b){ i.src=pendingImageSrc; b.classList.add('active'); } }; r.readAsDataURL(f); }
    else { const r=new FileReader(); r.onload=function(e){ const t=e.target.result, i=document.getElementById("user-input"); if(i) i.value+=`\n\`\`\`${f.name.split('.').pop()||''}\n${t}\n\`\`\`\n`; }; r.readAsText(f); }
}
const nfp=document.getElementById('native-file-picker'); if(nfp) nfp.addEventListener('change', e=>{ const f=e.target.files[0]; if(!f) return; processFile(f); nfp.value=""; });

let dc=0; const dro=document.getElementById('drag-drop-overlay'), dcv=document.getElementById('view-chat');
if(dcv&&dro) {
    ['dragenter','dragover','dragleave','drop'].forEach(en=>window.addEventListener(en,e=>{e.preventDefault(); e.stopPropagation();},false));
    window.addEventListener('dragenter',e=>{if(dcv.classList.contains('active')){dc++; dro.classList.add('active');}});
    window.addEventListener('dragleave',e=>{if(dcv.classList.contains('active')){dc--; if(dc<=0){dc=0; dro.classList.remove('active');}}});
    window.addEventListener('drop',e=>{dc=0; dro.classList.remove('active'); if(dcv.classList.contains('active')&&e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);});
}

window.copyCode=function(b){ const c=decodeURIComponent(b.getAttribute("data-code")); navigator.clipboard.writeText(c).then(()=>showCopyToast()).catch(e=>console.error(e)); };
function showCopyToast() {
    let t=document.getElementById('copy-toast'); if(!t){ t=document.createElement('div'); t.id='copy-toast'; t.className='copy-toast'; t.innerHTML=`<img src="/static/icons/CopyIcon.png" alt="Copy"><span>Text Copied</span>`; document.body.appendChild(t); }
    t.classList.add('show'); if(window.copyToastTimeout) clearTimeout(window.copyToastTimeout); window.copyToastTimeout=setTimeout(()=>t.classList.remove('show'),2500);
}

function formatMessage(txt) {
    let s=txt.replace(/</g,"&lt;").replace(/>/g,"&gt;"); const cb=/```(\w*)\n([\s\S]*?)(```|$)/g;
    s=s.replace(cb, (m,l,c)=>{ const dl=(l||"CODE").toUpperCase(), ec=encodeURIComponent(c); let sc=c.replace(/(["'])(.*?)\1/g,'<span style="color: #4ade80;">"$2"</span>'); return `<div class="code-block-wrapper"><div class="code-block-header"><span class="code-language">${dl}</span><button class="copy-code-btn" data-code="${ec}" onclick="copyCode(this)"><img src="/static/icons/CopyIcon.png"></button></div><div class="code-block-body">${sc.trim()}</div></div>`; });
    s=s.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'); s=s.replace(/`([^`]+)`/g,'<span class="inline-code">$1</span>'); return s;
}

function appendMessage(m, s, i=null) {
    const l=document.getElementById("chat-log"); if(!l) return; const b=document.createElement("div"); b.className=`chat-bubble ${s}`;
    if(m) { const tn=document.createElement("div"); tn.innerText=m; b.appendChild(tn); } if(i) { const im=document.createElement("img"); im.src=i; im.className="chat-image"; im.draggable=false; b.appendChild(im); }
    l.appendChild(b); l.scrollTop=l.scrollHeight;
}

// --- CALL FEATURE (Carl AI) ---
function loadCarlVoice() { if(!('speechSynthesis' in window)) return; const v=window.speechSynthesis.getVoices(); if(v.length===0) return; carlVoice=v.find(x=>x.lang.includes('en')&&(x.name.includes('Google US English')||x.name.includes('Aaron')||x.name.includes('Guy')||x.name.includes('Male')))||v.find(x=>x.lang.startsWith('en'))||v[0]; }
if('speechSynthesis' in window) { window.speechSynthesis.onvoiceschanged=loadCarlVoice; loadCarlVoice(); }
function getAudioContext() { if(!audioCtx) { const AC=window.AudioContext||window.webkitAudioContext; audioCtx=new AC(); } if(audioCtx.state==='suspended') audioCtx.resume(); return audioCtx; }
function playToneBurst(f1, f2, d) { try{ const cx=getAudioContext(), o1=cx.createOscillator(), o2=cx.createOscillator(), g=cx.createGain(); o1.frequency.value=f1; o2.frequency.value=f2; g.gain.setValueAtTime(0.15,cx.currentTime); g.gain.setValueAtTime(0.15,cx.currentTime+d-0.05); g.gain.linearRampToValueAtTime(0.001,cx.currentTime+d); o1.connect(g); o2.connect(g); g.connect(cx.destination); o1.start(cx.currentTime); o2.start(cx.currentTime); o1.stop(cx.currentTime+d); o2.stop(cx.currentTime+d); }catch(e){} }
function startRingingSound() { playToneBurst(440,480,2.0); ringInterval=setInterval(()=>{if(!isCallActive||isCallConnected){clearInterval(ringInterval);return;}playToneBurst(440,480,2.0);},4000); }
function stopRingingSound() { if(ringInterval){clearInterval(ringInterval); ringInterval=null;} }
function playPickupClick() { try{ const cx=getAudioContext(), o=cx.createOscillator(), g=cx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(800,cx.currentTime); o.frequency.exponentialRampToValueAtTime(150,cx.currentTime+0.08); g.gain.setValueAtTime(0.3,cx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,cx.currentTime+0.08); o.connect(g); g.connect(cx.destination); o.start(); o.stop(cx.currentTime+0.08); }catch(e){} }

function startCall() { 
    if(!hasValidApiKey()) { alert("Requires valid API Key."); switchView('view-settings'); return; } 
    stopAllMedia(); switchView('view-call'); isCallActive=true; isCallConnected=false; isMuted=false; callSeconds=0; getAudioContext(); 
    if('speechSynthesis' in window) { let w=new SpeechSynthesisUtterance(''); w.volume=0; window.speechSynthesis.speak(w); } 
    document.getElementById("call-status").innerText="Calling Carl..."; document.getElementById("call-status").style.display="block"; document.getElementById("call-timer").innerText="00:00"; 
    document.getElementById("mute-btn").style.opacity="1"; document.getElementById("speaker-btn").style.opacity=isSpeakerOn?"1":"0.4"; 
    startRingingSound(); const d=Math.floor(Math.random()*4000)+1500; 
    ringTimeout=setTimeout(()=>{ 
        if(!isCallActive) return; stopRingingSound(); playPickupClick(); isCallConnected=true; document.getElementById("call-status").style.display="none"; 
        callTimerInterval=setInterval(()=>{ callSeconds++; const m=String(Math.floor(callSeconds/60)).padStart(2,'0'), s=String(Math.floor(callSeconds%60)).padStart(2,'0'); document.getElementById("call-timer").innerText=`${m}:${s}`; },1000); 
        initSpeechRecognition(); speakCarl("Hey! Carl here. What's on your mind?"); 
    }, d); 
}

function endCall() { 
    stopAllMedia(); isCallActive=false; isCallConnected=false; 
    document.getElementById("call-timer").innerText="00:00"; document.getElementById("call-status").style.display="none"; 
    switchView('view-chat'); 
}

function toggleMute() { isMuted=!isMuted; const b=document.getElementById("mute-btn"); if(isMuted) { b.style.opacity="0.4"; if(recognition) try{recognition.stop();}catch(e){} } else { b.style.opacity="1"; if(recognition&&isCallActive&&isCallConnected) try{recognition.start();}catch(e){} } }
function toggleSpeaker() { isSpeakerOn=!isSpeakerOn; document.getElementById("speaker-btn").style.opacity=isSpeakerOn?"1":"0.4"; }
function speakCarl(txt) { if(!('speechSynthesis' in window)||!isCallActive) return; let ct=txt.replace(/```[\s\S]*?```/g,'').replace(/`[^`]*`/g,'').replace(/[*_#~]/g,'').trim(); if(!ct) return; const u=new SpeechSynthesisUtterance(ct); if(!carlVoice) loadCarlVoice(); if(carlVoice) u.voice=carlVoice; u.rate=1.05; u.volume=isSpeakerOn?1.0:0.15; window.speechSynthesis.speak(u); }
function initSpeechRecognition() { const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR) { document.getElementById("call-status").innerText="Browser doesn't support mic!"; document.getElementById("call-status").style.display="block"; return; } if (recognition) { try{recognition.stop();}catch(e){} } recognition=new SR(); recognition.continuous=true; recognition.interimResults=true; recognition.lang='en-US'; recognition.onresult=async(e)=>{ if(isMuted||!isCallActive||!isCallConnected) return; let iT='', fT=''; for(let i=e.resultIndex; i<e.results.length; ++i) { if(e.results[i].isFinal) fT+=e.results[i][0].transcript; else iT+=e.results[i][0].transcript; } let cb=fT+iT; if(cb.trim().length>3 && window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); if(callAbortController) callAbortController.abort(); } if(fT.trim().length>0) { const uq=fT.trim(); window.speechSynthesis.cancel(); if(callAbortController) callAbortController.abort(); document.getElementById("call-status").innerText="Carl is thinking..."; document.getElementById("call-status").style.display="block"; await processCallUserMessage(uq); } }; recognition.onerror=(e)=>{ if(e.error==='not-allowed') { document.getElementById("call-status").innerText="Mic Permission Denied"; document.getElementById("call-status").style.display="block"; } }; recognition.onend=()=>{ if(isCallActive&&isCallConnected&&!isMuted) try{recognition.start();}catch(e){} }; try{recognition.start();}catch(e){} }
async function processCallUserMessage(t) { if(!isCallActive) return; callAbortController=new AbortController(); chatHistory.push({role:"user",content:t}); const uLT=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit',hour12:true}), uTZ=Intl.DateTimeFormat().resolvedOptions().timeZone; const p={ message:t, history:chatHistory, image_b64:null, image_mime:null, api_key:customApiKey, user_time:uLT, user_timezone:uTZ, client_time:`${uLT} (${uTZ})` }; try{ const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p),signal:callAbortController.signal}); if(!res.ok) return; const rdr=res.body.getReader(), dcd=new TextDecoder(); let fR="", sB=""; document.getElementById("call-status").style.display="none"; while(true) { const {done,value}=await rdr.read(); if(done) break; const chk=dcd.decode(value,{stream:true}); fR+=chk; sB+=chk; let m; while((m=sB.match(/([^.!?]+[.!?])/))) { let s=m[0].trim(); sB=sB.substring(m[0].length); for(let px of ["Carl:","carl:","Carl - "]) if(s.startsWith(px)) s=s.replace(px,"").trim(); if(s) speakCarl(s); } } if(sB.trim()) { let lo=sB.trim(); for(let px of ["Carl:","carl:","Carl - "]) if(lo.startsWith(px)) lo=lo.replace(px,"").trim(); speakCarl(lo); } chatHistory.push({role:"assistant",content:fR}); } catch(e){} }
