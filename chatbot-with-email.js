// Chatbot Widget with Email Verification
class ChatbotWidgetWithEmail {
  constructor() {
    this.isOpen = false;
    this.isTyping = false;
    this.messages = [];
    this.userId = null;
    this.isVerified = false;
    this.apiBaseUrl = "http://localhost:5000/api";

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

    // Verification elements
    this.verificationScreen = document.getElementById("verificationScreen");
    this.emailForm = document.getElementById("emailForm");
    this.codeForm = document.getElementById("codeForm");
    this.emailInput = document.getElementById("emailInput");
    this.sendCodeBtn = document.getElementById("sendCodeBtn");
    this.verifyCodeBtn = document.getElementById("verifyCodeBtn");
    this.resendCodeBtn = document.getElementById("resendCodeBtn");
    this.verificationStatus = document.getElementById("verificationStatus");
    this.chatInputContainer = document.getElementById("chatInputContainer");
    this.codeInputs = document.querySelectorAll(".code-input");
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

    // Email verification events
    this.sendCodeBtn.addEventListener("click", () =>
      this.sendVerificationCode()
    );
    this.verifyCodeBtn.addEventListener("click", () => this.verifyCode());
    this.resendCodeBtn.addEventListener("click", () => this.resendCode());

    // Code input events
    this.codeInputs.forEach((input, index) => {
      input.addEventListener("input", (e) => this.handleCodeInput(e, index));
      input.addEventListener("keydown", (e) =>
        this.handleCodeKeydown(e, index)
      );
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
    this.hideNotification();

    // Show verification screen if not verified
    if (!this.isVerified) {
      this.showVerificationScreen();
    }
  }

  closeChatbot() {
    this.isOpen = false;
    this.container.classList.remove("active");
    this.input.blur();
  }

  showVerificationScreen() {
    this.verificationScreen.style.display = "flex";
    this.messagesContainer.style.display = "none";
    this.chatInputContainer.style.display = "none";
    this.emailForm.style.display = "block";
    this.codeForm.style.display = "none";
    this.emailInput.focus();
  }

  showChatInterface() {
    this.verificationScreen.style.display = "none";
    this.messagesContainer.style.display = "block";
    this.chatInputContainer.style.display = "block";
    this.input.focus();
  }

  async sendVerificationCode() {
    const email = this.emailInput.value.trim();

    if (!email) {
      this.showStatus("Lütfen e-posta adresinizi girin", "error");
      return;
    }

    if (!this.validateEmail(email)) {
      this.showStatus("Geçersiz e-posta formatı", "error");
      return;
    }

    this.sendCodeBtn.disabled = true;
    this.sendCodeBtn.innerHTML = '<div class="loading"></div> Gönderiliyor...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        this.userId = data.user_id;
        this.showStatus(
          "Doğrulama kodu e-posta adresinize gönderildi",
          "success"
        );
        this.emailForm.style.display = "none";
        this.codeForm.style.display = "block";
        this.codeInputs[0].focus();
      } else {
        this.showStatus(data.message, "error");
      }
    } catch (error) {
      this.showStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.sendCodeBtn.disabled = false;
      this.sendCodeBtn.innerHTML =
        '<i class="fas fa-paper-plane"></i> Kod Gönder';
    }
  }

  async verifyCode() {
    const code = Array.from(this.codeInputs)
      .map((input) => input.value)
      .join("");

    if (code.length !== 6) {
      this.showStatus("Lütfen 6 haneli kodu girin", "error");
      return;
    }

    this.verifyCodeBtn.disabled = true;
    this.verifyCodeBtn.innerHTML =
      '<div class="loading"></div> Doğrulanıyor...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: this.userId,
          code: code,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.isVerified = true;
        this.showStatus("E-posta başarıyla doğrulandı!", "success");
        setTimeout(() => {
          this.showChatInterface();
        }, 1500);
      } else {
        this.showStatus(data.message, "error");
        this.clearCodeInputs();
      }
    } catch (error) {
      this.showStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.verifyCodeBtn.disabled = false;
      this.verifyCodeBtn.innerHTML = '<i class="fas fa-check"></i> Doğrula';
    }
  }

  async resendCode() {
    this.resendCodeBtn.disabled = true;
    this.resendCodeBtn.innerHTML =
      '<div class="loading"></div> Gönderiliyor...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: this.emailInput.value.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        this.userId = data.user_id;
        this.showStatus("Yeni doğrulama kodu gönderildi", "success");
        this.clearCodeInputs();
      } else {
        this.showStatus(data.message, "error");
      }
    } catch (error) {
      this.showStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.resendCodeBtn.disabled = false;
      this.resendCodeBtn.innerHTML =
        '<i class="fas fa-redo"></i> Kodu Tekrar Gönder';
    }
  }

  handleCodeInput(event, index) {
    const input = event.target;
    const value = input.value;

    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      input.value = "";
      return;
    }

    // Move to next input if current is filled
    if (value && index < this.codeInputs.length - 1) {
      this.codeInputs[index + 1].focus();
    }

    // Auto-verify if all inputs are filled
    if (index === this.codeInputs.length - 1 && value) {
      setTimeout(() => this.verifyCode(), 100);
    }
  }

  handleCodeKeydown(event, index) {
    // Move to previous input on backspace
    if (event.key === "Backspace" && !event.target.value && index > 0) {
      this.codeInputs[index - 1].focus();
    }
  }

  clearCodeInputs() {
    this.codeInputs.forEach((input) => {
      input.value = "";
    });
    this.codeInputs[0].focus();
  }

  async sendMessage() {
    if (!this.isVerified) {
      this.showStatus("Önce e-posta adresinizi doğrulayın", "error");
      return;
    }

    const message = this.input.value.trim();
    if (!message || this.isTyping) return;

    // Add user message
    this.addMessage(message, "user");
    this.input.value = "";

    // Show typing indicator
    this.showTypingIndicator();

    try {
      const response = await fetch(`${this.apiBaseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: this.userId,
          message: message,
        }),
      });

      const data = await response.json();

      this.hideTypingIndicator();

      if (data.success) {
        this.addMessage(data.response, "bot");
      } else {
        this.addMessage(
          "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
          "bot"
        );
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage("Bağlantı hatası. Lütfen tekrar deneyin.", "bot");
    }
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

  showStatus(message, type) {
    this.verificationStatus.textContent = message;
    this.verificationStatus.className = `verification-status ${type}`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.verificationStatus.style.display = "none";
    }, 5000);
  }

  validateEmail(email) {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
  }

  loadInitialMessage() {
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
  const chatbot = new ChatbotWidgetWithEmail();

  // Make chatbot globally accessible for debugging
  window.chatbot = chatbot;
});

// Additional utility functions
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
