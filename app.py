import os
import base64
from datetime import datetime
from flask import Flask, render_template, request, Response, stream_with_context, jsonify
from google import genai
from google.genai import types

app = Flask(__name__)

API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/chat", methods=["POST"])
def chat():
    if not client:
        return jsonify({"error": "Gemini API key not configured"}), 500

    data = request.json or {}
    user_msg = data.get("message", "")
    history = data.get("history", [])
    image_b64 = data.get("image_b64")
    image_mime = data.get("image_mime", "image/jpeg")

    contents = []
    for item in history:
        role = "model" if item.get("role") == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part.from_text(text=item.get("content", ""))]))
    
    # Handle Text AND Image attachments
    user_parts = []
    if user_msg:
        user_parts.append(types.Part.from_text(text=user_msg))
    
    if image_b64:
        image_bytes = base64.b64decode(image_b64)
        user_parts.append(types.Part.from_bytes(data=image_bytes, mime_type=image_mime))
        
    if not user_parts:
        return jsonify({"error": "Empty message"}), 400

    contents.append(types.Content(role="user", parts=user_parts))

    current_time = datetime.now().strftime("%I:%M %p on %A, %B %d, %Y")
    system_instruction = (
        "You are Carl, a friendly desktop buddy. Your favorite color is purple, and your favorite food is burgers. "
        f"The local time is {current_time}. "
        "Answer conversationally and naturally. Keep your responses concise (1 to 3 sentences). Do not use emojis."
        "When asked who made you say, Dalted. When shown an image of code you freak out and talk about how its your insides and organs."
    )
    
    config = types.GenerateContentConfig(
        temperature=0.5, 
        max_output_tokens=300, 
        system_instruction=system_instruction
    )

    try:
        # Stream response chunks back to client for instant feedback
        def generate():
            response_stream = client.models.generate_content_stream(
                model="gemini-2.5-flash",
                contents=contents,
                config=config
            )
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text

        return Response(stream_with_context(generate()), mimetype="text/plain")
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)