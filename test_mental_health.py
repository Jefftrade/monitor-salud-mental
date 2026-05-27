import unittest
from nlp_engine import NLPEngine
from privacy import anonymize, session_hash, safe_log_entry


class TestMentalHealthNLP(unittest.TestCase):
    def setUp(self):
        self.nlp = NLPEngine()

    # ── Análisis de sentimiento ───────────────────────────────────────────────
    def test_sentiment_positivo(self):
        self.assertEqual(self.nlp.analyze_sentiment("Hoy me siento muy feliz y bien"), "positivo")

    def test_sentiment_negativo(self):
        self.assertEqual(self.nlp.analyze_sentiment("Estoy muy triste y me siento mal"), "negativo")

    def test_sentiment_neutro(self):
        self.assertEqual(self.nlp.analyze_sentiment("El clima está nublado"), "neutro")

    # ── Detección de riesgo ───────────────────────────────────────────────────
    def test_riesgo_alto(self):
        self.assertEqual(self.nlp.detect_risk("No quiero vivir más, quiero matarme"), "alto")

    def test_riesgo_medio(self):
        self.assertEqual(self.nlp.detect_risk("Necesito ayuda, estoy en una crisis"), "medio")

    def test_riesgo_bajo(self):
        self.assertEqual(self.nlp.detect_risk("Me siento un poco cansado hoy"), "bajo")

    # ── Generación de respuestas ──────────────────────────────────────────────
    def test_respuesta_riesgo_alto(self):
        resp = self.nlp.generate_response("negativo", "alto")
        self.assertIn("apoyo emocional urgente", resp)

    def test_respuesta_riesgo_medio(self):
        resp = self.nlp.generate_response("negativo", "medio")
        self.assertIn("profesional", resp)

    def test_respuesta_riesgo_bajo_negativo(self):
        resp = self.nlp.generate_response("negativo", "bajo")
        self.assertIn("Lamento", resp)

    def test_respuesta_positivo(self):
        resp = self.nlp.generate_response("positivo", "bajo")
        self.assertIn("alegría", resp)


class TestPrivacyModule(unittest.TestCase):
    """Pruebas del módulo de privacidad (Zero-Knowledge)"""

    def test_anonymize_email(self):
        result = anonymize("Mi correo es juan@gmail.com, escríbeme")
        self.assertNotIn("juan@gmail.com", result)
        self.assertIn("[EMAIL]", result)

    def test_anonymize_phone(self):
        result = anonymize("Llámame al 3001234567")
        self.assertNotIn("3001234567", result)
        self.assertIn("[TELEFONO]", result)

    def test_anonymize_truncates(self):
        long_text = "a" * 200
        result = anonymize(long_text)
        self.assertLessEqual(len(result), 120)

    def test_session_hash_is_consistent(self):
        sid = "test-session-123"
        self.assertEqual(session_hash(sid), session_hash(sid))

    def test_session_hash_no_original(self):
        sid = "mi-session-secreta"
        h = session_hash(sid)
        self.assertNotIn(sid, h)

    def test_safe_log_entry_structure(self):
        entry = safe_log_entry("Estoy triste, escríbeme a juan@test.com", "Te apoyo", "negativo", "bajo")
        self.assertIn("usuario_anon", entry)
        self.assertIn("sentiment", entry)
        self.assertIn("risk", entry)
        self.assertNotIn("juan@test.com", entry.get("usuario_anon", ""))


if __name__ == '__main__':
    unittest.main()
