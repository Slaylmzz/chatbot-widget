// Chatbot Widget JavaScript
class ChatbotWidget {
  constructor() {
    this.isOpen = false;
    this.isTyping = false;
    this.messages = [];
    this.initializeElements();
    this.bindEvents();
    this.loadInitialMessage();
  }

  initializeElements() {
    this.widget = document.getElementById("chatbotWidget");
    this.toggle = document.getElementById("chatbotToggle");
    this.container = document.getElementById("chatbotContainer");
    this.messagesContainer = document.getElementById("chatMessages");
    this.input = document.getElementById("chatInput");
    this.sendBtn = document.getElementById("sendMessage");
    this.closeBtn = document.getElementById("closeChatbot");
    this.notificationBadge = document.getElementById("notificationBadge");
    this.quickReplies = document.getElementById("quickReplies");
  }

  bindEvents() {
    // Toggle chatbot
    this.toggle.addEventListener("click", () => this.toggleChatbot());

    // Close chatbot
    this.closeBtn.addEventListener("click", () => this.closeChatbot());

    // Send message
    this.sendBtn.addEventListener("click", () => this.sendMessage());

    // Enter key to send
    this.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Quick replies
    this.quickReplies.addEventListener("click", (e) => {
      if (e.target.classList.contains("quick-reply")) {
        const message = e.target.dataset.message;
        this.input.value = message;
        this.sendMessage();
      }
    });

    // Auto-hide notification badge when opened
    this.container.addEventListener("animationend", () => {
      if (this.isOpen) {
        this.hideNotification();
      }
    });
  }

  toggleChatbot() {
    if (this.isOpen) {
      this.closeChatbot();
    } else {
      this.openChatbot();
    }
  }

  openChatbot() {
    this.isOpen = true;
    this.container.classList.add("active");
    this.input.focus();
    this.hideNotification();
  }

  closeChatbot() {
    this.isOpen = false;
    this.container.classList.remove("active");
    this.input.blur();
  }

  sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.isTyping) return;

    // Add user message
    this.addMessage(message, "user");
    this.input.value = "";

    // Show typing indicator
    this.showTypingIndicator();

    // Simulate bot response
    setTimeout(() => {
      this.hideTypingIndicator();
      this.generateBotResponse(message);
    }, 1000 + Math.random() * 2000);
  }

  addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const time = this.getCurrentTime();

    messageDiv.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
            </div>
            <div class="message-time">${time}</div>
        `;

    this.messagesContainer.appendChild(messageDiv);
    this.scrollToBottom();

    // Store message
    this.messages.push({ text, sender, time });
  }

  showTypingIndicator() {
    this.isTyping = true;
    const typingDiv = document.createElement("div");
    typingDiv.className = "message bot-message typing-indicator";
    typingDiv.id = "typingIndicator";

    typingDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

    this.messagesContainer.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingIndicator = document.getElementById("typingIndicator");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  generateBotResponse(userMessage) {
    const responses = this.getResponses();
    let response = "";

    // Simple keyword-based responses
    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes("merhaba") || lowerMessage.includes("selam")) {
      response = "Merhaba! Size nasıl yardımcı olabilirim? 😊";
    } else if (
      lowerMessage.includes("ürün") ||
      lowerMessage.includes("hizmet")
    ) {
      response =
        "Ürünlerimiz hakkında detaylı bilgi almak için web sitemizi ziyaret edebilir veya bizimle iletişime geçebilirsiniz. Hangi ürün hakkında bilgi almak istiyorsunuz?";
    } else if (
      lowerMessage.includes("fiyat") ||
      lowerMessage.includes("ücret")
    ) {
      response =
        "Fiyat bilgileri için lütfen bizimle iletişime geçin. Size en uygun fiyat teklifini sunmaktan memnuniyet duyarız. 📞";
    } else if (
      lowerMessage.includes("iletişim") ||
      lowerMessage.includes("telefon") ||
      lowerMessage.includes("email")
    ) {
      response =
        "Bizimle iletişime geçmek için:\n📞 Telefon: +90 555 123 45 67\n📧 Email: info@sirketiniz.com\n📍 Adres: İstanbul, Türkiye";
    } else if (
      lowerMessage.includes("teşekkür") ||
      lowerMessage.includes("sağol")
    ) {
      response =
        "Rica ederim! Başka bir konuda yardıma ihtiyacınız olursa çekinmeden sorabilirsiniz. 😊";
    } else if (
      lowerMessage.includes("görüşürüz") ||
      lowerMessage.includes("hoşça kal")
    ) {
      response = "Görüşmek üzere! İyi günler dilerim. 👋";
    } else {
      // Random response for unknown messages
      response = responses[Math.floor(Math.random() * responses.length)];
    }

    this.addMessage(response, "bot");
  }

  getResponses() {
    return [
      "Anlıyorum, size daha iyi yardımcı olabilmem için biraz daha detay verebilir misiniz?",
      "Bu konuda size yardımcı olmaktan memnuniyet duyarım. Hangi konuda bilgi almak istiyorsunuz?",
      "Harika bir soru! Bu konuda uzman ekibimizle görüşmenizi öneririm.",
      "Size en iyi hizmeti sunmak için buradayız. Başka bir konuda yardıma ihtiyacınız var mı?",
      "Bu konuda size detaylı bilgi verebilirim. Hangi özellik hakkında daha fazla bilgi almak istiyorsunuz?",
    ];
  }

  loadInitialMessage() {
    // Show notification badge after 3 seconds
    setTimeout(() => {
      this.showNotification();
    }, 3000);
  }

  showNotification() {
    if (!this.isOpen) {
      this.notificationBadge.style.display = "flex";
    }
  }

  hideNotification() {
    this.notificationBadge.style.display = "none";
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 100);
  }

  getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize chatbot when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const chatbot = new ChatbotWidget();

  // Make chatbot globally accessible for debugging
  window.chatbot = chatbot;
});

// Additional utility functions
function addCustomResponse(trigger, response) {
  if (window.chatbot) {
    // Add custom response logic here
    console.log("Custom response added:", trigger, response);
  }
}

// Example usage for external integration
function openChatbot() {
  if (window.chatbot) {
    window.chatbot.openChatbot();
  }
}

function closeChatbot() {
  if (window.chatbot) {
    window.chatbot.closeChatbot();
  }
}

// Auto-open chatbot after 10 seconds (optional)
setTimeout(() => {
  if (window.chatbot && !window.chatbot.isOpen) {
    // Uncomment the line below to auto-open chatbot
    // window.chatbot.openChatbot();
  }
}, 10000);
