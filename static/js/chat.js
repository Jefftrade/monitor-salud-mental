class ChatBot {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupAutoResize();
        this.setupAccessibility();
        // Load persisted conversation history on start
        this.loadHistory();
        this.setupWelcomeSpeech();
    }

    initializeElements() {
        this.chatMessages    = document.getElementById('chatMessages');
        this.messageInput    = document.getElementById('messageInput');
        this.sendButton      = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.pulseCanvas     = document.getElementById('pulseCanvas');
        this.isTyping        = false;
        this.animationRef    = null;
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        this.messageInput.focus();
    }

    setupAutoResize() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
        });
    }

    // ── Sanitización XSS ─────────────────────────────────────────────────────
    escapeHtml(text) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ENVIAR MENSAJE
    // ══════════════════════════════════════════════════════════════════════════
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isTyping) return;

        // Slide-in del mensaje del usuario
        this.addUserMessage(message, true);
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.showTyping();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });
            const data = await response.json();
            this.hideTyping();

            if (data.status === 'success') {
                // Efecto typewriter para la respuesta de la IA
                this.addBotMessageTypewriter(data.response, data.sentiment, data.risk, data.explanation);
            } else {
                this.showError('Error al procesar el mensaje');
            }
        } catch (error) {
            this.hideTyping();
            this.showError('Error de conexión con el servidor');
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MENSAJES DEL USUARIO (con o sin animación)
    // ══════════════════════════════════════════════════════════════════════════
    addUserMessage(message, animate = false) {
        const div = document.createElement('div');
        div.className = 'message user-message' + (animate ? '' : ' no-animation');

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message;
        div.appendChild(textDiv);

        this.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MENSAJES DEL BOT — Estático (para historial, sin animación)
    // ══════════════════════════════════════════════════════════════════════════
    addBotMessage(message, sentiment, risk, explanation) {
        const div = document.createElement('div');
        div.className = 'message bot-message no-animation';

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = this.escapeHtml(message)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        div.appendChild(textDiv);

        // Add speak button
        this._addSpeakButton(textDiv, message);

        this._appendMetadata(div, sentiment, risk, explanation);

        this.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MENSAJES DEL BOT — Typewriter (para respuestas nuevas en tiempo real)
    // ══════════════════════════════════════════════════════════════════════════
    addBotMessageTypewriter(message, sentiment, risk, explanation) {
        const div = document.createElement('div');
        div.className = 'message bot-message'; // con animación fade-in

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        div.appendChild(textDiv);

        this.chatMessages.appendChild(div);
        this.scrollToBottom();

        // Crear cursor parpadeante
        const cursor = document.createElement('span');
        cursor.className = 'typewriter-cursor';
        textDiv.appendChild(cursor);

        // Dividir en palabras para un efecto de escritura natural
        const words = message.split(' ');
        let wordIndex = 0;

        const typeNextWord = () => {
            if (wordIndex < words.length) {
                const word = words[wordIndex];
                // Insertar la palabra ANTES del cursor
                const wordNode = document.createTextNode(
                    (wordIndex > 0 ? ' ' : '') + word
                );
                textDiv.insertBefore(wordNode, cursor);

                wordIndex++;
                this.scrollToBottom();

                // Velocidad variable: más rápido al principio, más lento con palabras largas
                const baseDelay = 35;
                const extraDelay = Math.min(word.length * 8, 50);
                const randomJitter = Math.random() * 20 - 10;
                const delay = baseDelay + extraDelay + randomJitter;

                setTimeout(typeNextWord, delay);
            } else {
                // Escritura terminada — quitar cursor y aplicar formato final
                cursor.remove();

                // Aplicar formato de **negrita** ahora que el texto está completo
                textDiv.innerHTML = this.escapeHtml(message)
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

                // Add speak button
                this._addSpeakButton(textDiv, message);

                // Mostrar metadata con un fade suave
                this._appendMetadata(div, sentiment, risk, explanation, true);
                this.scrollToBottom();
            }
        };

        // Pequeño delay inicial para que el bubble aparezca primero
        setTimeout(typeNextWord, 300);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // METADATA (sentiment, risk, explanation)
    // ══════════════════════════════════════════════════════════════════════════
    _appendMetadata(div, sentiment, risk, explanation, fadeIn = false) {
        if (!sentiment && !risk) return;

        const meta = document.createElement('div');
        meta.className = 'metadata';
        if (fadeIn) {
            meta.style.opacity = '0';
            meta.style.transition = 'opacity 0.5s ease';
        }

        if (sentiment) {
            const sTag = document.createElement('span');
            sTag.className = `sentiment-tag sentiment-${this.escapeHtml(sentiment)}`;
            sTag.textContent = `Sentimiento: ${sentiment}`;
            meta.appendChild(sTag);
        }

        if (risk) {
            const rTag = document.createElement('span');
            rTag.className = `risk-tag risk-${this.escapeHtml(risk)}`;
            rTag.textContent = `Riesgo: ${risk.toUpperCase()}`;
            meta.appendChild(rTag);
        }

        if (explanation) {
            const expDiv = document.createElement('div');
            expDiv.className = 'explanation-tag';
            expDiv.textContent = `🤖 IA: ${explanation}`;
            meta.appendChild(expDiv);
        }

        div.appendChild(meta);

        if (fadeIn) {
            requestAnimationFrame(() => {
                meta.style.opacity = '1';
            });
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // HISTORIAL — Carga mensajes previos sin animaciones
    // ══════════════════════════════════════════════════════════════════════════
    async loadHistory() {
        try {
            const response = await fetch('/api/history');
            if (!response.ok) throw new Error('Failed to fetch history');
            const history = await response.json();

            if (history.length === 0) return;

            for (const entry of history) {
                const { text, sender, sentiment, risk, explanation } = entry;
                if (sender === 'user') {
                    this.addUserMessage(text, false); // sin animación
                } else if (sender === 'assistant') {
                    this.addBotMessage(text, sentiment, risk, explanation); // sin animación
                }
            }

            // Scroll silencioso al final después de cargar todo
            this.scrollToBottom();
        } catch (e) {
            console.error('Error cargando historial:', e);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TYPING INDICATOR
    // ══════════════════════════════════════════════════════════════════════════
    showTyping() {
        this.isTyping = true;
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
        this.startPulseAnimation();
    }

    startPulseAnimation() {
        if (!this.pulseCanvas) return;
        
        const size = 30;
        const color = '#a1a1aa';
        
        const ctx = this.pulseCanvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        this.pulseCanvas.width = size * dpr;
        this.pulseCanvas.height = size * dpr;
        ctx.scale(dpr, dpr);
        
        const centerX = size / 2;
        const centerY = size / 2;
        let time = 0;
        
        const animate = () => {
            ctx.clearRect(0, 0, size, size);
            
            const numRays = 8;
            for (let i = 0; i < numRays; i++) {
                const angle = (i / numRays) * Math.PI * 2;
                const pulse = Math.sin(time * 0.03 + i * 0.5) * (size * 0.2) + (size * 0.25);
                
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                const x = centerX + Math.cos(angle) * pulse;
                const y = centerY + Math.sin(angle) * pulse;
                ctx.lineTo(x, y);
                
                const opacity = 0.3 + Math.sin(time * 0.03 + i * 0.5) * 0.7;
                const safeOpacity = Math.max(0, Math.min(1, opacity));
                ctx.strokeStyle = `${color}${Math.floor(safeOpacity * 255).toString(16).padStart(2, '0')}`;
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.beginPath();
                ctx.arc(x, y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            }
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            
            time++;
            this.animationRef = requestAnimationFrame(animate);
        };
        
        if (this.animationRef) cancelAnimationFrame(this.animationRef);
        animate();
    }

    hideTyping() {
        this.isTyping = false;
        this.typingIndicator.style.display = 'none';
        if (this.animationRef) {
            cancelAnimationFrame(this.animationRef);
            this.animationRef = null;
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showError(msg) {
        const div = document.createElement('div');
        div.className = 'message system-message error no-animation';
        const strong = document.createElement('strong');
        strong.textContent = `⚠️ ${msg}`;
        div.appendChild(strong);
        this.chatMessages.appendChild(div);
        this.scrollToBottom();
    }

    async clearHistory() {
        if (confirm('¿Estás seguro de que deseas limpiar la conversación?')) {
            await fetch('/api/clear_history', { method: 'POST' });
            const messages = this.chatMessages.querySelectorAll('.message:not(.welcome-message)');
            messages.forEach(m => m.remove());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ACCESIBILIDAD & TEXT-TO-SPEECH
    // ══════════════════════════════════════════════════════════════════════════
    setupAccessibility() {
        const accessibilityBtn = document.getElementById('accessibilityBtn');
        const accessibilityMenu = document.getElementById('accessibilityMenu');
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const dyslexiaToggleBtn = document.getElementById('dyslexiaToggleBtn');
        
        // Toggle dropdown
        accessibilityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accessibilityMenu.classList.toggle('active');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (accessibilityMenu.classList.contains('active') && !accessibilityMenu.contains(e.target) && e.target !== accessibilityBtn) {
                accessibilityMenu.classList.remove('active');
            }
        });
        
        // Theme Toggle
        themeToggleBtn.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            themeToggleBtn.textContent = isLight ? "Activar Tema Oscuro" : "Activar Tema Claro";
            themeToggleBtn.classList.toggle('active', isLight);
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
        });
        
        // Restore theme
        if (localStorage.getItem('theme') === 'light') {
            document.body.classList.add('light-theme');
            themeToggleBtn.textContent = "Activar Tema Oscuro";
            themeToggleBtn.classList.add('active');
        }
        
        // Dyslexia Toggle
        dyslexiaToggleBtn.addEventListener('click', () => {
            const isDyslexic = document.body.classList.toggle('dyslexic-font');
            dyslexiaToggleBtn.classList.toggle('active', isDyslexic);
            localStorage.setItem('dyslexic', isDyslexic ? 'true' : 'false');
        });
        
        // Restore Dyslexia Font
        if (localStorage.getItem('dyslexic') === 'true') {
            document.body.classList.add('dyslexic-font');
            dyslexiaToggleBtn.classList.add('active');
        }
        
        // Font Size controls
        const fsButtons = {
            small: document.getElementById('fsSmallBtn'),
            normal: document.getElementById('fsNormalBtn'),
            large: document.getElementById('fsLargeBtn'),
            xlarge: document.getElementById('fsXlargeBtn')
        };
        
        Object.entries(fsButtons).forEach(([size, btn]) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                // Remove all font-size classes
                document.body.classList.remove('font-small', 'font-normal', 'font-large', 'font-xlarge');
                
                // Add selected font-size class
                document.body.classList.add(`font-${size}`);
                
                // Toggle active button states
                Object.values(fsButtons).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                localStorage.setItem('font-size', size);
            });
        });
        
        // Restore Font Size
        const savedFontSize = localStorage.getItem('font-size');
        if (savedFontSize && fsButtons[savedFontSize]) {
            document.body.classList.add(`font-${savedFontSize}`);
            Object.values(fsButtons).forEach(b => b.classList.remove('active'));
            fsButtons[savedFontSize].classList.add('active');
        }
    }

    setupWelcomeSpeech() {
        const welcomeMsg = document.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.style.position = 'relative';
            const welcomeText = "Hola. Este es un espacio seguro. Escribe lo que sientes o piensas. Nuestra IA analizará tu estado emocional de forma privada para brindarte el mejor apoyo posible.";
            this._addSpeakButton(welcomeMsg, welcomeText);
        }
    }

    _addSpeakButton(container, text) {
        const btn = document.createElement('button');
        btn.className = 'speak-btn';
        btn.title = "Escuchar mensaje";
        btn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speakText(text, btn);
        });
        
        container.appendChild(btn);
    }

    speakText(text, button) {
        if (button.classList.contains('speaking')) {
            window.speechSynthesis.cancel();
            button.classList.remove('speaking');
            return;
        }

        // Cancel other voices and reset speaking button states
        window.speechSynthesis.cancel();
        document.querySelectorAll('.speak-btn.speaking').forEach(b => b.classList.remove('speaking'));

        const cleanText = text.replace(/\*\*/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-ES';

        button.classList.add('speaking');
        
        utterance.onend = () => {
            button.classList.remove('speaking');
        };
        utterance.onerror = () => {
            button.classList.remove('speaking');
        };

        window.speechSynthesis.speak(utterance);
    }
}

document.addEventListener('DOMContentLoaded', () => new ChatBot());
