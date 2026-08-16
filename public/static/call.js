// --- CARL AI VOICE CALL HANDLER ---

// 1. Create the Call Modal UI
const callModal = document.createElement("div");
callModal.id = "carl-call-modal";
callModal.innerHTML = `
    <div style="text-align: center;">
        <img src="https://carlai.app/static/icons/CarlAILogo.png" style="width: 100px; height: 100px; border-radius: 50%; margin-bottom: 20px; animation: pulse 2s infinite;">
        <h2 style="color: white; font-family: sans-serif; margin: 0 0 10px 0;">Carl AI</h2>
        <p id="carl-call-status" style="color: #aaaaaa; font-family: sans-serif; margin-bottom: 30px;">Connecting...</p>
        <button id="carl-end-call" style="background-color: #ef4444; color: white; border: none; padding: 15px 30px; border-radius: 30px; font-size: 16px; cursor: pointer; font-weight: bold; transition: transform 0.1s;">End Call</button>
    </div>
    <style>
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0.7); }
            70% { box-shadow: 0 0 0 20px rgba(147, 51, 234, 0); }
            100% { box-shadow: 0 0 0 0 rgba(147, 51, 234, 0); }
        }
    </style>
`;
// Style the full-screen modal
Object.assign(callModal.style, {
    position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
    backgroundColor: "rgba(17, 17, 17, 0.95)", zIndex: "999999",
    display: "none", flexDirection: "column", justifyContent: "center", alignItems: "center"
});
document.body.appendChild(callModal);

// 2. Setup Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const synth = window.speechSynthesis;
let recognition = null;
let isCallActive = false;
let callHistory = [];

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop listening when user stops talking
    recognition.interimResults = false;
    
    // When you finish talking...
    recognition.onresult = (event) => {
        if (!isCallActive) return;
        const userSaid = event.results[0][0].transcript;
        document.getElementById("carl-call-status").innerText = "Carl is thinking...";
        sendVoiceToCarl(userSaid);
    };

    // When Carl finishes speaking, automatically start listening again
    recognition.onend = () => {
        if (isCallActive && !synth.speaking) {
            document.getElementById("carl-call-status").innerText = "Listening...";
            try { recognition.start(); } catch (e) {}
        }
    };
}

// 3. Connect to your Render Backend
function sendVoiceToCarl(text) {
    callHistory.push({ role: 'user', text: text });

    // Use default server API key by passing an empty string
    const payload = {
        message: text,
        history: callHistory.map(h => ({ role: h.role, content: h.text })),
        api_key: "" 
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
        
        // Clean up text so TTS doesn't read out weird symbols
        const cleanResponse = fullText.replace(/Carl:|carl:|Assistant:/g, "").replace(/\\*/g, "").trimStart();
        callHistory.push({ role: 'model', text: cleanResponse });
        
        speakCarlsResponse(cleanResponse);
    })
    .catch(() => {
        speakCarlsResponse("Sorry, I had trouble connecting to the server.");
    });
}

// 4. Handle Carl Speaking
function speakCarlsResponse(text) {
    if (!isCallActive) return;
    document.getElementById("carl-call-status").innerText = "Carl is speaking...";
    
    const utterance = new SpeechSynthesisUtterance(text);
    // Find a decent english voice
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.lang === "en-US");
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.pitch = 1.0;
    utterance.rate = 1.0;

    utterance.onend = () => {
        if (isCallActive) {
            document.getElementById("carl-call-status").innerText = "Listening...";
            try { recognition.start(); } catch (e) {}
        }
    };

    synth.speak(utterance);
}

// 5. Start and End Call Triggers
window.startCarlCall = function() {
    if (!recognition) {
        alert("Your browser does not support voice calls. Try Google Chrome!");
        return;
    }
    isCallActive = true;
    callHistory = [];
    callModal.style.display = "flex";
    document.getElementById("carl-call-status").innerText = "Connecting...";
    
    // Greet the user to start the loop
    setTimeout(() => { speakCarlsResponse("Hey! Carl here. What's on your mind?"); }, 500);
};

document.getElementById("carl-end-call").addEventListener("click", () => {
    isCallActive = false;
    callModal.style.display = "none";
    synth.cancel(); // Stop Carl from talking instantly
    try { recognition.stop(); } catch(e) {}
});