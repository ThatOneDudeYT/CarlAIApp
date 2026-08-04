let chatHistory = [];
let selectedGame = "Tic Tac Toe";
let pendingImageBase64 = null;
let pendingImageMime = null;
let pendingImageSrc = null;

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function startNewChat() {
    chatHistory = [];
    const log = document.getElementById("chat-log");
    log.innerHTML = '<div class="system-msg">Started a fresh session.</div>';
    document.getElementById("user-input").value = "";
    pendingImageBase64 = null;
    pendingImageMime = null;
    pendingImageSrc = null;
    switchView('view-chat');
}

function getDifficulty() {
    const select = document.getElementById("difficulty-select");
    return select ? select.value : "medium";
}

// 1. Listen for the user picking an image
document.getElementById('native-file-picker').addEventListener('change', function(e) {
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

// 2. Handle sending text AND images with real-time stream reading
async function sendMessage() {
    const input = document.getElementById("user-input");
    const text = input.value.trim();
    
    if (!text && !pendingImageBase64) return;

    appendMessage(text, "user", pendingImageSrc);
    
    const payload = { 
        message: text || "Look at this image.", 
        history: chatHistory,
        image_b64: pendingImageBase64,
        image_mime: pendingImageMime
    };

    input.value = "";
    pendingImageBase64 = null;
    pendingImageMime = null;
    pendingImageSrc = null;
    document.getElementById('native-file-picker').value = "";

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

    } catch (err) {
        textNode.innerText = "Network error.";
    }
}

function appendMessage(msg, sender, imgSrc = null) {
    const log = document.getElementById("chat-log");
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

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

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
    } else if (selectedGame === "BlackJack") {
        switchView("view-blackjack");
        initBlackJack();
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

// --- GAME: BLACKJACK ---
let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjGameOver = false;

const bjSuits = ['♥', '♦', '♣', '♠'];
const bjValues = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function bjCreateDeck() {
    bjDeck = [];
    for (let suit of bjSuits) {
        for (let val of bjValues) {
            bjDeck.push({ value: val, suit: suit });
        }
    }
    bjDeck.sort(() => Math.random() - 0.5);
}

function bjGetCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    if (card.value === 'A') return 11;
    return parseInt(card.value);
}

function bjCalculateScore(hand) {
    let score = 0;
    let aces = 0;
    for (let card of hand) {
        let val = bjGetCardValue(card);
        score += val;
        if (card.value === 'A') aces++;
    }
    while (score > 21 && aces > 0) {
        score -= 10;
        aces--;
    }
    return score;
}

function initBlackJack() {
    bjCreateDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    bjGameOver = false;

    document.getElementById("bj-hit-btn").disabled = false;
    document.getElementById("bj-stand-btn").disabled = false;
    document.getElementById("bj-status").innerText = "Your Turn - Hit or Stand?";
    document.getElementById("bj-status").style.color = "#fff";

    bjRenderTable();
}

function bjRenderTable() {
    const dealerCardsDiv = document.getElementById("bj-dealer-cards");
    const playerCardsDiv = document.getElementById("bj-dealer-cards");
    
    dealerCardsDiv.innerHTML = "";
    document.getElementById("bj-player-cards").innerHTML = "";

    bjPlayerHand.forEach(card => {
        const isRed = card.suit === '♥' || card.suit === '♦';
        const el = document.createElement("div");
        el.className = `bj-card ${isRed ? "red" : ""}`;
        el.innerText = `${card.value}${card.suit}`;
        document.getElementById("bj-player-cards").appendChild(el);
    });

    bjDealerHand.forEach((card, i) => {
        const isRed = card.suit === '♥' || card.suit === '♦';
        const el = document.createElement("div");
        if (i === 1 && !bjGameOver) {
            el.className = "bj-card hidden";
            el.innerText = "?";
        } else {
            el.className = `bj-card ${isRed ? "red" : ""}`;
            el.innerText = `${card.value}${card.suit}`;
        }
        dealerCardsDiv.appendChild(el);
    });

    document.getElementById("bj-player-score").innerText = bjCalculateScore(bjPlayerHand);
    document.getElementById("bj-dealer-score").innerText = bjGameOver 
        ? bjCalculateScore(bjDealerHand) 
        : bjGetCardValue(bjDealerHand[0]);
}

function bjHit() {
    if (bjGameOver) return;
    bjPlayerHand.push(bjDeck.pop());
    const score = bjCalculateScore(bjPlayerHand);
    bjRenderTable();

    if (score > 21) {
        bjGameOver = true;
        document.getElementById("bj-status").innerText = "Bust! Carl Wins!";
        document.getElementById("bj-status").style.color = "#ef4444";
        document.getElementById("bj-hit-btn").disabled = true;
        document.getElementById("bj-stand-btn").disabled = true;
        bjRenderTable();
    }
}

function bjStand() {
    if (bjGameOver) return;
    bjGameOver = true;
    document.getElementById("bj-hit-btn").disabled = true;
    document.getElementById("bj-stand-btn").disabled = true;

    let dealerScore = bjCalculateScore(bjDealerHand);
    while (dealerScore < 17) {
        bjDealerHand.push(bjDeck.pop());
        dealerScore = bjCalculateScore(bjDealerHand);
    }

    const playerScore = bjCalculateScore(bjPlayerHand);
    bjRenderTable();

    if (dealerScore > 21 || playerScore > dealerScore) {
        document.getElementById("bj-status").innerText = "You Win!";
        document.getElementById("bj-status").style.color = "#84cc16";
    } else if (playerScore === dealerScore) {
        document.getElementById("bj-status").innerText = "Push! (Tie)";
        document.getElementById("bj-status").style.color = "#fff";
    } else {
        document.getElementById("bj-status").innerText = "Carl Wins!";
        document.getElementById("bj-status").style.color = "#ef4444";
    }
}

// --- GAME: ROCK PAPER SCISSORS ---
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

// --- GAME: TIC TAC TOE ---
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
    cell.innerText = player;
    cell.classList.add(player.toLowerCase());
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

// --- GAME: HANGMAN ---
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
    
    for(let i=1; i<=6; i++) document.getElementById(`hm-part-${i}`).style.display = "none";
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
        document.getElementById(`hm-part-${hmMistakes}`).style.display = "block";
        
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

// --- GAME: CONNECT FOUR ---
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
            let val = c4Board[r][c];
            if (val === 1) cell.className = "c4-cell red";
            else if (val === 2) cell.className = "c4-cell yellow";
            else cell.className = "c4-cell";
        }
    }
}

// --- GAME: BATTLESHIP ---
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

// --- GAME: CHECKERS ---
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

// --- GAME: CHESS ---
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