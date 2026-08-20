// Initialize Firebase
const firebaseConfig = { 
    apiKey: "AIzaSyB6q-h3daznHtyF3tVoQh1W38hNiD7qqGg", 
    authDomain: "carl-ai-loggins.firebaseapp.com", 
    projectId: "carl-ai-loggins", 
    storageBucket: "carl-ai-loggins.firebasestorage.app", 
    messagingSenderId: "372926140822", 
    appId: "1:372926140822:web:4bf13c6dd802cbc047cdb7", 
    measurementId: "G-G4H60BZHT3" 
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Global Auth Variables shared with script.js
let firebaseUserId = null;
let currentUser = null;
let currentUserAvatar = "/static/icons/default-avatar.png";
let isGuest = false;
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

function continueAsGuest() {
    isGuest = true;
    document.getElementById('auth-overlay').style.display = 'none';
    document.body.classList.add('guest-mode');
    currentUser = "Guest";
    currentUserAvatar = "/static/icons/default-avatar.png";
    if (typeof updateProfileUI === "function") updateProfileUI();
    if (typeof startNewChat === "function") startNewChat();
}

function signInWithGoogle() { 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithPopup(provider).catch(e => alert("Google Sign-In Error: " + e.message)); 
}

function handleSignOut() {
    if (isGuest) {
        window.location.reload();
        return;
    }
    auth.signOut().then(() => {
        window.location.reload(); // Hard reload purges all data safely
    });
}

auth.onAuthStateChanged(async (user) => {
    const overlay = document.getElementById('auth-overlay');
    if (user) {
        isGuest = false;
        document.body.classList.remove('guest-mode');
        firebaseUserId = user.uid; 
        
        // Anti-Bug: Never inherit "Guest" name if they log in
        let fallbackName = user.displayName || user.email.split('@')[0];
        if (currentUser === "Guest" || !currentUser) {
            currentUser = fallbackName;
        }
        
        currentUserAvatar = user.photoURL || "/static/icons/default-avatar.png";
        
        if (overlay) overlay.style.display = 'none'; 
        
        if (typeof loadUserDataFromCloud === "function") {
            await loadUserDataFromCloud();
        }
    } else if (!isGuest) { 
        firebaseUserId = null; 
        if (overlay) overlay.style.display = 'flex'; 
    }
});