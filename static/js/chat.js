class ChatBot {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupAutoResize();
        this.setupAccessibility();
        // Load persisted conversation history on start
        this.loadHistory();
        this.setupWelcomeSpeech();
        this.initializeDashboard();
    }

    initializeElements() {
        this.chatMessages    = document.getElementById('chatMessages');
        this.messageInput    = document.getElementById('messageInput');
        this.sendButton      = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.pulseCanvas     = document.getElementById('pulseCanvas');
        this.dashboardToggleBtn = document.getElementById('dashboardToggleBtn');
        this.closeDashboardBtn  = document.getElementById('closeDashboardBtn');
        this.dashboardSidebar  = document.getElementById('dashboardSidebar');
        this.chatBodyWrapper   = document.querySelector('.chat-body-wrapper');
        this.messagesHistory = []; // Tracks parsed assistant messages for stats
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

        // Push to statistics tracking and update dashboard
        if (sentiment || risk) {
            this.messagesHistory.push({
                text: message,
                sentiment: sentiment || 'neutro',
                risk: risk || 'bajo'
            });
            this.updateDashboard();
        }
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

                // Push to statistics tracking and update dashboard
                if (sentiment || risk) {
                    this.messagesHistory.push({
                        text: message,
                        sentiment: sentiment || 'neutro',
                        risk: risk || 'bajo'
                    });
                    this.updateDashboard();
                }
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
            
            // Clear tracking metrics and reset dashboard
            this.messagesHistory = [];
            this.updateDashboard();
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

    // ══════════════════════════════════════════════════════════════════════════
    // DETECCIÓN INTERACTIVA & MÉTODOS DEL DASHBOARD
    // ══════════════════════════════════════════════════════════════════════════

    initializeDashboard() {
        if (!this.dashboardToggleBtn) return;

        // Toggle sidebar open/close
        this.dashboardToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = this.dashboardSidebar.classList.toggle('active');
            this.dashboardToggleBtn.classList.toggle('active', isOpen);
            this.chatBodyWrapper.classList.toggle('sidebar-open', isOpen);
        });

        // Close button in sidebar
        this.closeDashboardBtn.addEventListener('click', () => {
            this.dashboardSidebar.classList.remove('active');
            this.dashboardToggleBtn.classList.remove('active');
            this.chatBodyWrapper.classList.remove('sidebar-open');
        });

        // Close sidebar when clicking outside on smaller screens
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024) {
                if (this.dashboardSidebar.classList.contains('active') &&
                    !this.dashboardSidebar.contains(e.target) &&
                    !this.dashboardToggleBtn.contains(e.target)) {
                    this.dashboardSidebar.classList.remove('active');
                    this.dashboardToggleBtn.classList.remove('active');
                    this.chatBodyWrapper.classList.remove('sidebar-open');
                }
            }
        });
        
        // Initial dashboard rendering with starting values
        this.updateDashboard();
    }

    updateDashboard() {
        const ring = document.getElementById('riskRing');
        const label = document.getElementById('riskLevelLabel');
        const explanation = document.getElementById('riskExplanationText');
        const posP = document.getElementById('posPercent');
        const neuP = document.getElementById('neuPercent');
        const negP = document.getElementById('negPercent');
        const posB = document.getElementById('posBar');
        const neuB = document.getElementById('neuBar');
        const negB = document.getElementById('negBar');
        const spEmpty = document.getElementById('sparklineEmpty');
        const spSvg = document.getElementById('sparklineSvg');
        const spPath = document.getElementById('sparklinePath');
        const spPathBg = document.getElementById('sparklinePathBg');
        const spPoints = document.getElementById('sparklinePoints');
        const spTooltip = document.getElementById('sparklineTooltip');
        const guidance = document.getElementById('widgetGuidance');
        const guidanceContent = document.getElementById('guidanceContent');

        if (!ring) return; // Verify element exists in DOM

        // 1. Calculate Sentiment Stats
        let posCount = 0;
        let neuCount = 0;
        let negCount = 0;
        const total = this.messagesHistory.length;

        this.messagesHistory.forEach(m => {
            if (m.sentiment === 'positivo') posCount++;
            else if (m.sentiment === 'negativo') negCount++;
            else neuCount++;
        });

        const posPct = total > 0 ? Math.round((posCount / total) * 100) : 0;
        const neuPct = total > 0 ? Math.round((neuCount / total) * 100) : 0;
        const negPct = total > 0 ? Math.round((negCount / total) * 100) : 0;

        posP.textContent = `${posPct}%`;
        neuP.textContent = `${neuPct}%`;
        negP.textContent = `${negPct}%`;

        posB.style.width = `${posPct}%`;
        neuB.style.width = `${neuPct}%`;
        negB.style.width = `${negPct}%`;

        // 2. Determine Current Risk Level (using last message or default)
        const currentRisk = total > 0 ? this.messagesHistory[total - 1].risk : 'bajo';
        
        ring.className = `risk-glow-ring risk-${currentRisk}`;
        label.textContent = currentRisk === 'bajo' ? 'Bajo' : currentRisk === 'medio' ? 'Medio' : 'Alto';
        
        if (currentRisk === 'alto') {
            explanation.textContent = '¡ALERTA! Se han detectado patrones de riesgo emocional alto en tus mensajes. Por favor, busca apoyo.';
        } else if (currentRisk === 'medio') {
            explanation.textContent = 'Se detectan niveles de angustia o estrés moderado. Considera tomar un respiro o hablar con alguien.';
        } else {
            explanation.textContent = 'No se detectan alertas activas en tu conversación.';
        }

        // 3. Render Dynamic Sparkline SVG
        if (total === 0) {
            spEmpty.style.display = 'block';
            spSvg.style.display = 'none';
        } else {
            spEmpty.style.display = 'none';
            spSvg.style.display = 'block';

            // Set up SVG gradients if not exist
            if (!spSvg.querySelector('defs')) {
                const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
                defs.innerHTML = `
                    <linearGradient id="sparklineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#06b6d4" />
                        <stop offset="100%" stop-color="#22d3ee" />
                    </linearGradient>
                    <linearGradient id="sparklineAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3" />
                        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.0" />
                    </linearGradient>
                `;
                spSvg.insertBefore(defs, spSvg.firstChild);
            }

            // Map sentiments to Y values: positive=25 (top), neutral=50 (middle), negative=75 (bottom)
            const points = this.messagesHistory.map((m, idx) => {
                const startX = 20;
                const endX = 240;
                let x = 130; // Center if only 1 item
                if (total > 1) {
                    x = startX + (idx * (endX - startX)) / (total - 1);
                }
                
                let y = 50;
                if (m.sentiment === 'positivo') y = 25;
                else if (m.sentiment === 'negativo') y = 75;

                return { x, y, sentiment: m.sentiment, text: m.text, index: idx };
            });

            // Draw line path
            let d = `M ${points[0].x} ${points[0].y}`;
            if (total === 1) {
                // Draw a beautiful horizontal bar if only 1 data point is present
                d = `M 20 ${points[0].y} L 240 ${points[0].y}`;
                spPath.setAttribute('d', d);
                spPathBg.setAttribute('d', `M 20 ${points[0].y} L 240 ${points[0].y} L 240 100 L 20 100 Z`);
            } else {
                // Construction of clean smooth Bezier spline
                for (let i = 1; i < points.length; i++) {
                    const p0 = points[i - 1];
                    const p1 = points[i];
                    const cpX1 = p0.x + (p1.x - p0.x) / 2;
                    const cpY1 = p0.y;
                    const cpX2 = p0.x + (p1.x - p0.x) / 2;
                    const cpY2 = p1.y;
                    d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
                }
                spPath.setAttribute('d', d);
                
                // Area background gradient fill
                const bgPath = `${d} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
                spPathBg.setAttribute('d', bgPath);
            }

            // Draw interactive point circles
            spPoints.innerHTML = '';
            points.forEach(p => {
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("cx", p.x);
                circle.setAttribute("cy", p.y);
                circle.setAttribute("class", `sparkline-point ${p.sentiment}`);
                
                // Hover interactive tooltips
                circle.addEventListener('mouseover', (e) => {
                    const rect = spSvg.getBoundingClientRect();
                    const tooltipX = p.x * (rect.width / 260);
                    const tooltipY = p.y * (rect.height / 100);
                    
                    spTooltip.style.left = `${tooltipX}px`;
                    spTooltip.style.top = `${tooltipY}px`;
                    const previewText = this.escapeHtml(p.text.length > 40 ? p.text.substring(0, 40) + '…' : p.text);
                    const sentimentColor = p.sentiment === 'positivo' ? '#34d399' : p.sentiment === 'negativo' ? '#f87171' : '#a1a1aa';
                    spTooltip.innerHTML = `
                        <div style="font-weight: 700; margin-bottom: 2px;">Mensaje #${p.index + 1}</div>
                        <div style="color: var(--text-secondary); margin-bottom: 4px;">"${previewText}"</div>
                        <div style="font-weight: 600; color: ${sentimentColor}">
                            Ánimo: ${this.escapeHtml(p.sentiment.toUpperCase())}
                        </div>
                    `;
                    spTooltip.style.opacity = '1';
                    spTooltip.style.transform = 'translate(-50%, -110%) scale(1)';
                });
                
                circle.addEventListener('mouseout', () => {
                    spTooltip.style.opacity = '0';
                    spTooltip.style.transform = 'translate(-50%, -110%) scale(0.95)';
                });

                spPoints.appendChild(circle);
            });
        }

        // 4. Clinical Recommendations Block
        guidance.className = `dashboard-widget widget-guidance risk-${currentRisk}`;
        if (currentRisk === 'alto') {
            guidanceContent.innerHTML = `
                <p><strong>¡Alerta Crítica!</strong> Se ha identificado un nivel de riesgo emocional alto en la conversación. Por favor, no cargues con esto a solas. Comunícate de inmediato con la línea de ayuda profesional gratuita para recibir apoyo humano y calificado.</p>
                <a href="tel:106" class="guidance-call-btn">
                    <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    Llamar Línea de Apoyo (106)
                </a>
            `;
        } else if (currentRisk === 'medio') {
            guidanceContent.innerHTML = `
                <p><strong>Atención Recomendada:</strong> Se han detectado emociones intensas de tristeza, estrés o desespero. Te sugerimos tomar una pequeña pausa del entorno digital, respirar profundamente e intentar hablar de esto con un amigo, familiar o un orientador cercano.</p>
            `;
        } else {
            guidanceContent.innerHTML = `
                <p><strong>Todo marcha estable.</strong> Sigue expresando tus pensamientos de manera segura. SentiaGuard vela por tu privacidad y tu bienestar en cada mensaje. Recuerda que siempre es un buen momento para autocuidarte.</p>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new ChatBot());
