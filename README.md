# Monitor de Bienestar Emocional (Refactorizado)

Este proyecto es una evolución del chatbot original, transformado en un sistema de análisis de sentimiento y detección de riesgo emocional para redes sociales y entornos digitales.

## 🎯 Objetivo
Detectar proactivamente estados emocionales negativos o situaciones de riesgo en los textos de los usuarios y proporcionar respuestas de apoyo adecuadas al nivel de riesgo detectado.

## ⚙️ Cambios Realizados (Refactorización)
1.  **Nuevo Módulo NLP (`nlp_engine.py`):** Se implementó una lógica de procesamiento de lenguaje natural basada en reglas y palabras clave para clasificar sentimientos y niveles de riesgo.
2.  **Backend Flask (`app.py`):** Se simplificó el backend eliminando la dependencia de Ollama/RAG para asegurar un MVP funcional inmediato, manteniendo la estructura de rutas y gestión de sesiones.
3.  **Interfaz de Usuario (`index.html`, `chat.js`, `styles.css`):** 
    *   Se adaptó el diseño para un entorno de salud mental.
    *   Se agregaron etiquetas visuales dinámicas para mostrar el **Sentimiento** y el **Nivel de Riesgo**.
    *   Se implementaron animaciones de alerta para casos de riesgo alto.
4.  **Privacidad:** Se eliminó cualquier almacenamiento persistente de datos personales, cumpliendo con el requisito de no usar bases de datos.

## 🏗️ Estructura del Proyecto
```text
/
├── app.py              # Servidor Flask (Rutas y lógica principal)
├── nlp_engine.py       # Motor de análisis de sentimiento y riesgo
├── static/
│   ├── js/chat.js      # Lógica del cliente (Frontend)
│   └── styles.css      # Estilos actualizados
├── templates/
│   └── index.html      # Interfaz de usuario
└── test_mental_health.py # Pruebas unitarias del sistema
```

## 🚀 Instrucciones de Ejecución
1.  Asegúrate de tener Python instalado.
2.  Instala las dependencias necesarias:
    ```bash
    pip install flask flask-cors
    ```
3.  Ejecuta la aplicación:
    ```bash
    python app.py
    ```
4.  Abre tu navegador en `http://localhost:5000`.

## 🧪 Ejemplos de Prueba
*   **Riesgo Bajo:** "Hoy me siento un poco triste por el trabajo."
*   **Riesgo Medio:** "No puedo más con esta situación, necesito ayuda urgente."
*   **Riesgo Alto:** "Ya no quiero vivir, estoy pensando en acabar con todo."
