// --- CARL AI NATIVE VOICE CALL HANDLER ---

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
let recognition = null;
let isCallActive = false;
let callHistory = [];
let isMuted = false;

// Grab existing UI elements from your native index.html
const callStatusText = document.getElementById("call-status");
const muteBtnImg = document.getElementById("mute-btn");

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    // When you finish talking...
    recognition.onresult = (event) => {
        if (!isCallActive) return;
        const userSaid = event.results[0][0].transcript;
        
        if (callStatusText) {
            callStatusText.style.display = "block";
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

// Connect to your Render Backend
function sendVoiceToCarl(text) {
    callHistory.push({ role: 'user', text: text });

    const payload = {
        message: text,
        history: callHistory.map(h => ({ role: h.role, content: h.text })),
        api_key: "" // Uses your default server API key
    };

    fetch("https://carlai.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(async (response) => {
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
    .catch(() => {
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

// Overrides the startCall function tied to your sidebar button
window.startCall = function() {
    if (!recognition) {
        alert("Your browser does not support voice calls. Try using Google Chrome!");
        return;
    }
    
    // Switch to your native Call View
    if (typeof switchView === "function") switchView('view-call');
    
    isCallActive = true;
    isMuted = false;
    callHistory = [];
    
    if (callStatusText) {
        callStatusText.style.display = "block";
        callStatusText.innerText = "Connecting...";
    }
    
    if (muteBtnImg) muteBtnImg.style.opacity = "1.0";

    // Greet the user to start the loop
    setTimeout(() => { 
        speakCarlsResponse("Hey! Carl here. What's on your mind?"); 
    }, 500);
};

// Overrides the endCall function tied to your red End button
window.endCall = function() {
    isCallActive = false;
    synth.cancel(); // Stop Carl from talking instantly
    try { recognition.stop(); } catch(e) {}
    
    // Send user back to chat screen
    if (typeof switchView === "function") switchView('view-chat');
};

// Overrides the toggleMute function tied to your Mute button
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
