import os
import random
import time
import requests
from flask import Flask, request, jsonify, send_from_directory, Response
import google.generativeai as genai

app = Flask(__name__, static_folder='public/static', template_folder='public')

otp_store = {}

# --- SERVE WEBSITE ---
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('public', path)

# --- OTP EMAIL ROUTES (USING BREVO HTTP API) ---
@app.route('/api/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Generate random 5-digit code
    code = str(random.randint(10000, 99999))
    otp_store[email] = {
        "code": code,
        "expires": time.time() + 600  # 10 minutes
    }

    try:
        # Pull API key from Render Environment
        api_key = os.environ.get("BREVO_API_KEY")
        if not api_key:
            return jsonify({"error": "Brevo API key is missing from Render"}), 500

        # Brevo's API endpoint
        url = "https://api.brevo.com/v3/smtp/email"
        
        # We pass the API key in the request headers for authentication
        headers = {
            "accept": "application/json",
            "api-key": api_key,
            "content-type": "application/json"
        }
        
        payload = {
            "sender": {
                "name": "Carl AI Support",
                "email": "carlaisupport@gmail.com" # This MUST be verified in Brevo
            },
            "to": [{"email": email}],
            "subject": "Your Carl AI Verification Code",
            "textContent": f"Here is your one time use Carl AI code:\n\n{code}\n\nThis code will expire in 10 minutes."
        }

        # Send the data over standard HTTPS (bypassing Render's SMTP block)
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code in [200, 201, 202]:
            return jsonify({"success": True, "message": "Code sent successfully"})
        else:
            return jsonify({"error": f"API Error: {response.text}"}), 500

    except Exception as e:
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500


@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    code = str(data.get('code', '')).strip()

    record = otp_store.get(email)
    if not record:
        return jsonify({"error": "No verification code requested for this email"}), 400

    if time.time() > record['expires']:
        del otp_store[email]
        return jsonify({"error": "Verification code expired. Please request a new one."}), 400

    if record['code'] != code:
        return jsonify({"error": "Incorrect code. Please try again."}), 400

    del otp_store[email]
    return jsonify({"success": True, "message": "Verified successfully"})

# --- CARL AI CHAT ROUTE ---
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    user_message = data.get('message', '')
    history = data.get('history', [])
    api_key = data.get('api_key') or os.environ.get('GEMINI_API_KEY')
    client_time = data.get('client_time', 'Unknown')

    if not api_key:
        return jsonify({"error": "No API key configured"}), 401

    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=f"You are Carl AI. Client Time: {client_time}."
        )

        formatted_history = []
        for h in history:
            role = "user" if h.get("role") == "user" else "model"
            formatted_history.append({"role": role, "parts": [h.get("content", "")]})

        chat_session = model.start_chat(history=formatted_history)

        def generate():
            response = chat_session.send_message(user_message, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text

        return Response(generate(), mimetype='text/plain')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
