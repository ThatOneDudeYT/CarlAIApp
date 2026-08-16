// --- CARL AI NATIVE VOICE CALL HANDLER ---

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
let recognition = null;
let isCallActive = false;
let callHistory = [];
let isMuted = false;
let callTimerInterval = null;
let callSeconds = 0;

// Grab UI elements
const callStatusText = document.getElementById("call-status");
const muteBtnImg = document.getElementById("mute-btn");
const callTimerText = document.getElementById("call-timer");

// Handle the call timer UI
function updateTimer() {
    callSeconds++;
    const mins = String(Math.floor(callSeconds / 60)).padStart(2, '0');
    const secs = String(callSeconds % 60).padStart(2, '0');
    if (callTimerText) callTimerText.innerText = mins + ":" + secs;
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // When you finish talking...
    recognition.onresult = (event) => {
        if (!isCallActive) return;
        const userSaid = event.results[0][0].transcript;
        
        if (callStatusText) {
            callStatusText.style.display = ""; // Leave empty to let your CSS handle the layout safely
            callStatusText.innerText = "Carl is thinking...";
        }
        
        sendVoiceToCarl(userSaid);
    };

    // When Carl finishes speaking, automatically start listening again
    recognition.onend = () => {
        if (isCallActive && !synth.speaking && !isMuted) {
            if (callStatusText) callStatusText.innerText = "Listening...";
            try { recognition.start(); } catch (e) {}
        }
    };
}

// Connect to Backend
function sendVoiceToCarl(text) {
    callHistory.push({ role: 'user', text: text });

    // Using a relative path fixes all CORS/Domain connection errors!
    fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: text,
            history: callHistory.map(h => ({ role: h.role, content: h.text }))
        })
    })
    .then(async (response) => {
        if (!response.ok) throw new Error("Server connection failed");
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullText += decoder.decode(value, { stream: true });
        }
        
        // Clean up text so TTS doesn't read out weird formatting symbols
        const cleanResponse = fullText.replace(/Carl:|carl:|Assistant:/g, "").replace(/\*/g, "").trimStart();
        callHistory.push({ role: 'model', text: cleanResponse });
        
        speakCarlsResponse(cleanResponse);
    })
    .catch((err) => {
        console.error("Voice Error:", err);
        speakCarlsResponse("Sorry, I had trouble connecting to the server.");
    });
}

// Handle Carl Speaking
function speakCarlsResponse(text) {
    if (!isCallActive) return;
    if (callStatusText) callStatusText.innerText = "Carl is speaking...";
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Find a decent English voice
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.lang === "en-US");
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.pitch = 1.0;
    utterance.rate = 1.0;

    utterance.onend = () => {
        if (isCallActive && !isMuted) {
            if (callStatusText) callStatusText.innerText = "Listening...";
            try { recognition.start(); } catch (e) {}
        }
    };

    synth.speak(utterance);
}

// --- HOOK INTO YOUR EXISTING BUTTONS ---

window.startCall = function() {
    if (!recognition) {
        alert("Your browser does not support voice calls. Try using Google Chrome!");
        return;
    }
    
    // Switch to your native Call View
    if (typeof switchView === "function") switchView('view-call');
    
    // Close the sidebar if it's open (keeps UI clean on smaller screens)
    const sidebar = document.getElementById("desktop-sidebar");
    if (sidebar && sidebar.classList.contains("expanded") && window.innerWidth <= 768) {
        sidebar.classList.remove("expanded");
    }
    
    isCallActive = true;
    isMuted = false;
    callHistory = [];
    callSeconds = 0;
    
    // Start Timer
    if (callTimerText) callTimerText.innerText = "00:00";
    clearInterval(callTimerInterval);
    callTimerInterval = setInterval(updateTimer, 1000);
    
    if (callStatusText) {
        callStatusText.style.display = "";
        callStatusText.innerText = "Connecting...";
    }
    
    if (muteBtnImg) muteBtnImg.style.opacity = "1.0";

    // Greet the user to start the loop
    setTimeout(() => { 
        speakCarlsResponse("Hey! Carl here. What's on your mind?"); 
    }, 500);
};

window.endCall = function() {
    isCallActive = false;
    clearInterval(callTimerInterval);
    synth.cancel(); // Stop Carl from talking instantly
    try { recognition.stop(); } catch(e) {}
    
    // Send user back to chat screen
    if (typeof switchView === "function") switchView('view-chat');
};

window.toggleMute = function() {
    if (!isCallActive) return;
    
    isMuted = !isMuted;
    if (isMuted) {
        try { recognition.stop(); } catch(e) {}
        if (callStatusText) callStatusText.innerText = "Muted";
        if (muteBtnImg) muteBtnImg.style.opacity = "0.5";
    } else {
        if (callStatusText) callStatusText.innerText = "Listening...";
        if (muteBtnImg) muteBtnImg.style.opacity = "1.0";
        try { recognition.start(); } catch(e) {}
    }
};
