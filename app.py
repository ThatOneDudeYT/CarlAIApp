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
        
        # Initialize model with system instruction
        generation_config = {"temperature": 0.7}
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            generation_config=generation_config,
            system_instruction=f"You are Carl AI. Client Time: {client_time}."
        )

        # Format history properly for google-generativeai SDK
        formatted_history = []
        for h in history:
            role = "user" if h.get("role") == "user" else "model"
            content = h.get("content", "")
            if content:
                formatted_history.append({"role": role, "parts": [content]})

        chat_session = model.start_chat(history=formatted_history)

        def generate():
            try:
                response_stream = chat_session.send_message(user_message, stream=True)
                for chunk in response_stream:
                    if hasattr(chunk, 'text') and chunk.text:
                        yield chunk.text
            except Exception as stream_err:
                yield f"\n[Stream Error: {str(stream_err)}]"

        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        print(f"Chat setup error: {str(e)}")
        return jsonify({"error": str(e)}), 500
