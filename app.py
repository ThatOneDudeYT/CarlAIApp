import os
import base64
from datetime import datetime
from flask import Flask, render_template, request, Response, stream_with_context, jsonify, session
from google import genai
from google.genai import types

app = Flask(__name__)
# A secret key is required to use Flask sessions to track user limits securely
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))

@app.route("/")
def index():
    return render_template("index.html")

# New endpoint to feed data to your frontend progress bar
@app.route("/api/usage", methods=["POST"])
def get_usage():
    data = request.json or {}
    user_api_key = data.get("api_key")
    
    if user_api_key:
        # Custom API Tracker: Assumes a 100 max limit to calculate percentages 
        custom_usage = session.get('custom_usage', 0)
        return jsonify({
            "is_custom": True,
            "used": custom_usage,
            "total": 100,
            "percentage": (custom_usage / 100) * 100
        })
    else:
        # Free Tier Tracker (10 prompts)
        free_usage = session.get('free_usage', 0)
        return jsonify({
            "is_custom": False,
            "used": free_usage,
            "total": 10,
            "percentage": (free_usage / 10) * 100
        })

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json or {}
    
    user_api_key = data.get("api_key")
    api_key = user_api_key if user_api_key else os.environ.get("GEMINI_API_KEY")

    if not api_key:
        return jsonify({"error": "No API key provided. Please set your Gemini API key in Settings."}), 400

    client = genai.Client(api_key=api_key)

    user_msg = data.get("message", "")
    history = data.get("history", [])
    image_b64 = data.get("image_b64")
    image_mime = data.get("image_mime", "image/jpeg")

    contents = []
    for item in history:
        role = "model" if item.get("role") == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=item.get("content"))]))
        
    user_parts = []
    if user_msg:
        user_parts.append(types.Part.from_text(text=user_msg))
    
    if image_b64:
        image_bytes = base64.b64decode(image_b64)
        user_parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
        
    if not user_parts:
        return jsonify({"error": "Empty message"}), 400

    # Usage Tracker Logic: Updates after verifying the message is valid
    if user_api_key:
        session['custom_usage'] = session.get('custom_usage', 0) + 1
    else:
        free_usage = session.get('free_usage', 0)
        if free_usage >= 10:
            return jsonify({"error": "Usage limit reached. Please insert a custom API key in Settings."}), 429
        session['free_usage'] = free_usage + 1

    contents.append(types.Content(role="user", parts=user_parts))

    current_time = datetime.now().strftime("%I:%M %p on %A, %B %d, %Y")
    system_instruction = (
        "You are Carl, a friendly desktop buddy. Your favorite food is burgers."
        f"The local time is {current_time}. "
        "Answer conversationally and naturally. Keep your responses concise (1 to 3 sentences). Do not use emojis."
        "Never act like a robot, act natural."
    )
    
    config = types.GenerateContentConfig(
        temperature=0.5, 
        max_output_tokens=300, 
        system_instruction=system_instruction
    )

    def generate():
        try:
            response_stream = client.models.generate_content_stream(
                model="gemini-3.5-flash-lite",
                contents=contents,
                config=config
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"Error: {str(e)}"
    
    return Response(stream_with_context(generate()), mimetype="text/plain")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
