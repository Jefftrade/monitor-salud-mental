from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime
from dotenv import load_dotenv

# Cargar variables de entorno desde .env
load_dotenv()
from nlp_engine import NLPEngine
from privacy import session_hash

app = Flask(__name__)
CORS(app)

# SECRET_KEY con valor por defecto para desarrollo
app.secret_key = os.getenv('SECRET_KEY', 'sentiaguard-dev-secret-2026')

# Inicializar motor NLP
nlp = NLPEngine()

CONV_FILE = 'conversaciones.json'


# ── Gestión de memoria ────────────────────────────────────────────────────────
def agregar_a_memoria(session_id, mensaje_usuario, respuesta_asistente, sentiment, risk):
    """Guarda un par (usuario → asistente) en el archivo de conversaciones."""
    try:
        try:
            with open(CONV_FILE, 'r', encoding='utf-8') as f:
                conversaciones = json.load(f)
        except Exception:
            conversaciones = {}

        sid_hash = session_hash(session_id)
        if sid_hash not in conversaciones:
            conversaciones[sid_hash] = {'inicio': datetime.now().isoformat(), 'mensajes': []}

        # Guardar el mensaje completo del usuario Y la respuesta del asistente.
        # Ya NO truncamos el mensaje del usuario para que la IA lo recuerde completo.
        entry = {
            "usuario": mensaje_usuario,
            "asistente": respuesta_asistente,
            "sentiment": sentiment,
            "risk": risk,
            "timestamp": datetime.now().isoformat(),
        }
        conversaciones[sid_hash]['mensajes'].append(entry)

        # Mantener hasta 30 intercambios por sesión (60 mensajes de contexto)
        MAX_HISTORY = 30
        if len(conversaciones[sid_hash]['mensajes']) > MAX_HISTORY:
            conversaciones[sid_hash]['mensajes'] = conversaciones[sid_hash]['mensajes'][-MAX_HISTORY:]

        with open(CONV_FILE, 'w', encoding='utf-8') as f:
            json.dump(conversaciones, f, indent=2, ensure_ascii=False)

    except Exception as e:
        print(f"Error guardando memoria: {e}")


def obtener_historial_para_ia(session_id):
    """
    Devuelve el historial en formato [{sender, text}] para inyectar en los prompts de la IA.
    Incluye el texto COMPLETO del usuario para que la IA tenga contexto.
    """
    try:
        if not os.path.exists(CONV_FILE):
            return []
        with open(CONV_FILE, 'r', encoding='utf-8') as f:
            conversaciones = json.load(f)

        sid_hash = session_hash(session_id)
        if sid_hash not in conversaciones:
            return []

        historial = []
        for msg in conversaciones[sid_hash]['mensajes']:
            historial.append({'text': msg['usuario'], 'sender': 'user'})
            historial.append({'text': msg['asistente'], 'sender': 'assistant'})
        return historial
    except Exception as e:
        print(f"Error obteniendo historial para IA: {e}")
        return []


def obtener_historial_para_frontend(session_id):
    """
    Devuelve el historial en formato [{text, sender, sentiment, risk}] para que
    el frontend lo renderice al cargar la página.
    """
    try:
        if not os.path.exists(CONV_FILE):
            return []
        with open(CONV_FILE, 'r', encoding='utf-8') as f:
            conversaciones = json.load(f)

        sid_hash = session_hash(session_id)
        if sid_hash not in conversaciones:
            return []

        historial = []
        for msg in conversaciones[sid_hash]['mensajes']:
            historial.append({
                'text': msg['usuario'],
                'sender': 'user',
                'timestamp': msg.get('timestamp'),
            })
            historial.append({
                'text': msg['asistente'],
                'sender': 'assistant',
                'timestamp': msg.get('timestamp'),
                'sentiment': msg.get('sentiment'),
                'risk': msg.get('risk'),
            })
        return historial
    except Exception as e:
        print(f"Error obteniendo historial frontend: {e}")
        return []


# ── Rutas ─────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    if '_id' not in session:
        session['_id'] = str(uuid.uuid4())
    return render_template('index.html')


@app.route('/api/chat', methods=['POST'])
def api_chat():
    if '_id' not in session:
        session['_id'] = str(uuid.uuid4())

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    mensaje = data.get('message', '').strip()
    if not mensaje:
        return jsonify({'error': 'Mensaje vacío'}), 400
    if len(mensaje) > 2000:
        return jsonify({'error': 'Mensaje demasiado largo'}), 400

    try:
        # ── CLAVE: Obtener historial previo y pasarlo a la IA ──
        historial = obtener_historial_para_ia(session['_id'])
        result = nlp.analyze_full(mensaje, conversation_history=historial)

        agregar_a_memoria(
            session['_id'], mensaje,
            result['response'], result['sentiment'], result['risk']
        )
        return jsonify({
            'response':    result['response'],
            'sentiment':   result['sentiment'],
            'risk':        result['risk'],
            'explanation': result.get('explanation', ''),
            'status':      'success'
        })
    except Exception as e:
        print(f"❌ ERROR en chat: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


@app.route('/api/history', methods=['GET'])
def api_history():
    if '_id' not in session:
        return jsonify([])
    return jsonify(obtener_historial_para_frontend(session['_id']))


@app.route('/api/clear_history', methods=['POST'])
def clear_history():
    if '_id' not in session:
        return jsonify({'error': 'No active session'}), 400
    try:
        sid_hash = session_hash(session['_id'])
        if os.path.exists(CONV_FILE):
            with open(CONV_FILE, 'r', encoding='utf-8') as f:
                conversaciones = json.load(f)
            if sid_hash in conversaciones:
                del conversaciones[sid_hash]
                with open(CONV_FILE, 'w', encoding='utf-8') as f:
                    json.dump(conversaciones, f, indent=2, ensure_ascii=False)
        return jsonify({'message': 'Historial limpiado correctamente'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
