"""
privacy.py — Módulo de Privacidad de SentiaGuard
Anonimiza mensajes antes de almacenarlos: elimina PII (nombres,
emails, teléfonos, cédulas) y trunca el texto para no guardar
el mensaje completo. Principio de minimización de datos.
"""

import re
import hashlib


# Patrones de PII a eliminar
_PATTERNS = [
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),
    (r'\b(\+57|0057)?[\s\-]?3\d{2}[\s\-]?\d{3}[\s\-]?\d{4}\b', '[TELEFONO]'),  # celular CO
    (r'\b\d{7,11}\b', '[ID]'),           # cédulas / números largos
    (r'\b[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+\b', '[NOMBRE]'),  # Nombre Apellido
]


def anonymize(text: str) -> str:
    """
    Elimina PII del texto y lo trunca a 120 caracteres.
    El mensaje original NUNCA se almacena; solo esta versión anonimizada.
    """
    result = text
    for pattern, replacement in _PATTERNS:
        result = re.sub(pattern, replacement, result)
    # Truncar para minimizar datos almacenados
    if len(result) > 120:
        result = result[:117] + "..."
    return result


def session_hash(session_id: str) -> str:
    """
    Genera un hash SHA-256 del session_id para no almacenar
    el identificador real del usuario en el JSON de conversaciones.
    """
    return hashlib.sha256(session_id.encode()).hexdigest()[:16]


def safe_log_entry(usuario: str, asistente: str, sentiment: str, risk: str) -> dict:
    """
    Construye una entrada de log segura: guarda solo datos anonimizados
    y metadatos de análisis, nunca el mensaje original completo.
    """
    return {
        "usuario_anon": anonymize(usuario),
        "sentiment":    sentiment,
        "risk":         risk,
        # Solo guardamos la respuesta del asistente (no contiene datos del usuario)
        "asistente":    asistente,
    }
