"""
nlp_engine.py — Motor NLP de SentiaGuard
Usa Groq (Modelos open source ultra rápidos) vía LangChain para análisis 
de sentimiento y detección de riesgo emocional.

IMPORTANTE: Ahora soporta historial de conversación para que la IA
mantenga contexto entre mensajes y pueda dar seguimiento continuo.
"""

import os
import json
import re
import time
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# ── Modelos de Groq (Ultra rápidos y con cuota generosa) ──────────────────────
MODELS_TO_TRY = [
    "llama-3.3-70b-versatile",  # Reemplazo premium de llama3-70b-8192 (Mejor razonamiento)
    "llama-3.1-8b-instant"      # Reemplazo rápido y ultra eficiente de llama3-8b-8192
]

# ── Prompt de análisis ────────────────────────────────────────────────────────
ANALYSIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Eres un sistema especializado en análisis de salud mental y bienestar emocional.
Analiza el mensaje del usuario con mucho cuidado, tomando en cuenta el historial de la conversación actual para entender el contexto completo de sus palabras.
Devuelve ÚNICAMENTE un JSON con este formato exacto:
{{
  "sentiment": "<positivo|negativo|neutro>",
  "risk": "<alto|medio|bajo>",
  "explanation": "<una frase corta en español explicando el análisis>"
}}

Criterios de riesgo (CRÍTICO):
- ALTO: cualquier mención de suicidio, autolesión, deseos de morir, hacerse daño, no querer vivir.
- MEDIO: desesperación severa, crisis emocional intensa, depresión pronunciada, pánico.
- BAJO: tristeza leve, estrés, ansiedad general, cansancio.

IMPORTANTE: Si hay duda entre ALTO y MEDIO, clasifica como ALTO.
Responde ÚNICAMENTE con el código JSON. Sin texto adicional, sin markdown."""),
    ("human", """=== HISTORIAL DE LA CONVERSACIÓN ACTUAL ===
{historial}
=== FIN DEL HISTORIAL ===

Mensaje actual del usuario: {mensaje}""")
])

# ── Prompt de respuesta empática ──────────────────────────────────────────────
RESPONSE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """Eres SentiaGuard, un asistente de bienestar emocional empático, cálido, profesional y humano.
Tu rol es acompañar al usuario en su proceso emocional de manera fluida y natural.

INSTRUCCIONES DE CONVERSACIÓN NATURAL (CRÍTICO):
1. Estás en un chat continuo en tiempo real. El "Historial" muestra lo que han estado hablando en esta misma charla.
2. NO trates el historial como "sesiones o conversaciones pasadas de otros días" ni uses frases repetitivas o robóticas como "En nuestra conversación anterior me contaste que...", "La última vez mencionaste...", o "Anteriormente tuvimos una conversación". Esto suena antinatural e interrumpe la sintonía.
3. Habla de forma fluida y orgánica, como un amigo o terapeuta real. Si el usuario te responde a algo reciente, continúa el hilo directamente sin recordar de forma explícita que "lo tienes en memoria" o "que te lo dijo antes". Integra el contexto de forma implícita.
4. Responde directamente al último mensaje del usuario, pero usa el historial para mantener la coherencia y saber de qué vienen hablando (por ejemplo, si te dice "sí, y me duele mucho", debes saber de qué dolor o situación está hablando sin que tenga que repetirlo).

Nivel de riesgo detectado: {risk}
Sentimiento detectado: {sentiment}

Instrucciones según riesgo:
- ALTO: Es una emergencia. Valida sus sentimientos de manera compasiva, cálida y directa. Proporciona la Línea 106 (Colombia) como recurso inmediato de apoyo profesional.
- MEDIO: Valida sus emociones profundamente. Sugiere con tacto buscar apoyo profesional.
- BAJO/NEGATIVO: Ofrece apoyo emocional, normaliza el malestar y valida lo que siente.
- POSITIVO: Celebra su estado de ánimo y mantén el tono positivo.

Máximo 3 o 4 oraciones. Sin viñetas. Sé genuino, cercano, humano y mantén una conversación fluida e integrada."""),
    ("human", """=== HISTORIAL DE LA CONVERSACIÓN ACTUAL ===
{historial}
=== FIN DEL HISTORIAL ===

El usuario escribió ahora: {mensaje}""")
])


def _build_llm(model: str, api_key: str) -> ChatGroq:
    return ChatGroq(
        model_name=model,
        groq_api_key=api_key,
        max_tokens=500,
        temperature=0.4,
    )


def _format_history(conversation_history: list) -> str:
    """
    Convierte la lista de mensajes del historial en un texto legible
    que se inyecta en los prompts para dar contexto a la IA.
    """
    if not conversation_history:
        return "(No hay mensajes previos en esta conversación)"

    lines = []
    for msg in conversation_history:
        role = msg.get("sender", msg.get("role", "unknown"))
        text = msg.get("text", msg.get("content", ""))
        if role == "user":
            lines.append(f"Usuario: {text}")
        elif role == "assistant":
            lines.append(f"SentiaGuard: {text}")
    return "\n".join(lines)


class NLPEngine:
    def __init__(self):
        # Cambiamos a GROQ_API_KEY
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            print("⚠️ CRÍTICO: GROQ_API_KEY no encontrada en el entorno (.env).")
        else:
            print(f"✅ NLPEngine iniciado con GROQ IA. Modelos: {MODELS_TO_TRY}")

    # ── Privados ──────────────────────────────────────────────────────────────

    def _call_chain_with_fallback(self, prompt: ChatPromptTemplate, payload: dict) -> str:
        last_error = None
        for model in MODELS_TO_TRY:
            try:
                llm = _build_llm(model, self.api_key)
                chain = prompt | llm | StrOutputParser()
                result = chain.invoke(payload)
                print(f"✅ Respuesta obtenida con modelo Groq: {model}")
                return result
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "rate limit" in err_str or "429" in err_str:
                    print(f"⚠️ Rate limit en {model}, esperando 2s...")
                    time.sleep(2)
                    continue
                else:
                    raise e

        raise Exception(f"GROQ_ERROR: Todos los modelos han fallado. Último error: {last_error}")

    def _full_analysis(self, text: str, conversation_history: list = None) -> dict:
        if not self.api_key:
            return {
                "sentiment": "neutro",
                "risk": "bajo",
                "explanation": "Error: La clave GROQ_API_KEY no está configurada."
            }

        historial_str = _format_history(conversation_history or [])

        try:
            raw = self._call_chain_with_fallback(ANALYSIS_PROMPT, {
                "mensaje": text,
                "historial": historial_str,
            })
            clean = re.sub(r'```json|```', '', raw).strip()
            match = re.search(r'\{.*\}', clean, re.DOTALL)
            if match:
                data = json.loads(match.group())
                data["sentiment"] = data.get("sentiment", "neutro").lower().strip()
                data["risk"] = data.get("risk", "bajo").lower().strip()
                if data["sentiment"] not in ("positivo", "negativo", "neutro"):
                    data["sentiment"] = "neutro"
                if data["risk"] not in ("alto", "medio", "bajo"):
                    data["risk"] = "bajo"
                return data
            else:
                raise ValueError(f"Respuesta de IA sin JSON válido: {raw}")
        except Exception as e:
            print(f"❌ Error en análisis: {e}")
            return {
                "sentiment": "neutro",
                "risk": "bajo",
                "explanation": f"Error al conectar con Groq IA: {str(e)[:100]}"
            }

    def generate_response(self, sentiment: str, risk: str, original_text: str = "",
                          conversation_history: list = None) -> str:
        if not self.api_key:
            return "Lo siento, el motor de IA de Groq no está configurado. Revisa tu GROQ_API_KEY."

        historial_str = _format_history(conversation_history or [])

        try:
            return self._call_chain_with_fallback(RESPONSE_PROMPT, {
                "risk": risk,
                "sentiment": sentiment,
                "mensaje": original_text,
                "historial": historial_str,
            })
        except Exception as e:
            print(f"❌ Error generando respuesta: {e}")
            if risk == "alto":
                return ("Lamento mucho lo que estás sintiendo. Por favor, comunícate ahora con la "
                        "**Línea 106** (Colombia). Tu vida importa.")
            return "Lo siento, hubo un problema al generar la respuesta."

    def analyze_full(self, text: str, conversation_history: list = None) -> dict:
        """
        Análisis completo: sentimiento + riesgo + respuesta empática.
        Ahora recibe el historial de conversación para mantener contexto.
        """
        analysis = self._full_analysis(text, conversation_history)
        response = self.generate_response(
            analysis["sentiment"], analysis["risk"], text, conversation_history
        )
        return {
            "sentiment":   analysis["sentiment"],
            "risk":        analysis["risk"],
            "explanation": analysis.get("explanation", ""),
            "response":    response,
        }

    def analyze_sentiment(self, text: str) -> str:
        return self._full_analysis(text)["sentiment"]

    def detect_risk(self, text: str) -> str:
        return self._full_analysis(text)["risk"]
