class ChatbotWidgetWithProductVerification {
  constructor() {
    this.apiBaseUrl = "http://localhost:5000/api";
    this.userId = null;
    this.isEmailVerified = false;
    this.isProductVerified = false;
    this.products = [];

    this.initializeElements();
    this.bindEvents();
  }

  initializeElements() {
    // Ana elementler
    this.toggle = document.getElementById("chatbotToggle");
    this.container = document.getElementById("chatbotContainer");
    this.closeBtn = document.getElementById("closeChatbot");
    this.notificationBadge = document.getElementById("notificationBadge");

    // E-posta doğrulama elementleri
    this.emailVerificationScreen = document.getElementById(
      "emailVerificationScreen"
    );
    this.emailForm = document.getElementById("emailForm");
    this.emailInput = document.getElementById("emailInput");
    this.sendCodeBtn = document.getElementById("sendCodeBtn");
    this.emailCodeForm = document.getElementById("emailCodeForm");
    this.emailCodeInputs = document.querySelectorAll(".email-code-input");
    this.verifyEmailCodeBtn = document.getElementById("verifyEmailCodeBtn");
    this.resendEmailCodeBtn = document.getElementById("resendEmailCodeBtn");
    this.emailVerificationStatus = document.getElementById(
      "emailVerificationStatus"
    );

    // Ürün doğrulama elementleri
    this.productVerificationScreen = document.getElementById(
      "productVerificationScreen"
    );
    this.productForm = document.getElementById("productForm");
    this.productNameInput = document.getElementById("productNameInput");
    this.serialNumberInput = document.getElementById("serialNumberInput");
    this.verifyProductBtn = document.getElementById("verifyProductBtn");
    this.productVerificationStatus = document.getElementById(
      "productVerificationStatus"
    );
    this.productList = document.getElementById("productList");

    // Chat elementleri
    this.chatMessages = document.getElementById("chatMessages");
    this.chatInputContainer = document.getElementById("chatInputContainer");
    this.chatInput = document.getElementById("chatInput");
    this.sendMessageBtn = document.getElementById("sendMessage");
    this.quickReplies = document.querySelectorAll(".quick-reply");
  }

  bindEvents() {
    // Toggle events
    this.toggle.addEventListener("click", () => this.toggleChatbot());
    this.closeBtn.addEventListener("click", () => this.toggleChatbot());

    // E-posta doğrulama events
    this.sendCodeBtn.addEventListener("click", () =>
      this.sendVerificationCode()
    );
    this.verifyEmailCodeBtn.addEventListener("click", () =>
      this.verifyEmailCode()
    );
    this.resendEmailCodeBtn.addEventListener("click", () =>
      this.resendEmailCode()
    );

    // E-posta kod input events
    this.emailCodeInputs.forEach((input, index) => {
      input.addEventListener("input", (e) =>
        this.handleEmailCodeInput(e, index)
      );
      input.addEventListener("keydown", (e) =>
        this.handleEmailCodeKeydown(e, index)
      );
    });

    // Ürün doğrulama events
    this.verifyProductBtn.addEventListener("click", () => this.verifyProduct());

    // Chat events
    this.sendMessageBtn.addEventListener("click", () => this.sendMessage());
    this.chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.sendMessage();
    });

    // Quick replies
    this.quickReplies.forEach((button) => {
      button.addEventListener("click", () => {
        const message = button.getAttribute("data-message");
        this.chatInput.value = message;
        this.sendMessage();
      });
    });
  }

  async loadProducts() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/products`);
      const data = await response.json();

      if (data.success) {
        this.products = data.products;
        this.updateProductList();
      }
    } catch (error) {
      console.error("Ürünler yüklenemedi:", error);
    }
  }

  updateProductList() {
    if (this.productList && this.products.length > 0) {
      this.productList.innerHTML = this.products
        .slice(0, 5) // İlk 5 ürünü göster
        .map((product) => `<li>${product.name} - ${product.serial}</li>`)
        .join("");
    }
  }

  toggleChatbot() {
    this.container.classList.toggle("active");
    this.notificationBadge.style.display = "none";
  }

  async sendVerificationCode() {
    const email = this.emailInput.value.trim();

    if (!email) {
      this.showEmailStatus("Lütfen e-posta adresinizi girin", "error");
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
        this.showEmailStatus(
          "Doğrulama kodu e-posta adresinize gönderildi",
          "success"
        );
        this.emailForm.style.display = "none";
        this.emailCodeForm.style.display = "block";
        this.clearEmailCodeInputs();
        this.emailCodeInputs[0].focus();
      } else {
        this.showEmailStatus(data.message, "error");
      }
    } catch (error) {
      this.showEmailStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.sendCodeBtn.disabled = false;
      this.sendCodeBtn.innerHTML =
        '<i class="fas fa-paper-plane"></i> Kod Gönder';
    }
  }

  async verifyEmailCode() {
    const code = Array.from(this.emailCodeInputs)
      .map((input) => input.value)
      .join("");

    if (code.length !== 6) {
      this.showEmailStatus("Lütfen 6 haneli kodu girin", "error");
      return;
    }

    this.verifyEmailCodeBtn.disabled = true;
    this.verifyEmailCodeBtn.innerHTML =
      '<div class="loading"></div> Doğrulanıyor...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: this.userId, code }),
      });

      const data = await response.json();

      if (data.success) {
        this.isEmailVerified = true;
        this.showEmailStatus("E-posta başarıyla doğrulandı!", "success");
        setTimeout(() => {
          this.showProductVerificationScreen();
        }, 1500);
      } else {
        this.showEmailStatus(data.message, "error");
        this.clearEmailCodeInputs();
      }
    } catch (error) {
      this.showEmailStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.verifyEmailCodeBtn.disabled = false;
      this.verifyEmailCodeBtn.innerHTML =
        '<i class="fas fa-check"></i> Doğrula';
    }
  }

  async resendEmailCode() {
    this.resendEmailCodeBtn.disabled = true;
    this.resendEmailCodeBtn.innerHTML =
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
        this.showEmailStatus("Yeni doğrulama kodu gönderildi", "success");
        this.clearEmailCodeInputs();
        this.emailCodeInputs[0].focus();
      } else {
        this.showEmailStatus(data.message, "error");
      }
    } catch (error) {
      this.showEmailStatus("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      this.resendEmailCodeBtn.disabled = false;
      this.resendEmailCodeBtn.innerHTML =
        '<i class="fas fa-redo"></i> Kodu Tekrar Gönder';
    }
  }

  handleEmailCodeInput(event, index) {
    const input = event.target;
    const value = input.value;

    // Sadece rakam kabul et
    if (!/^\d*$/.test(value)) {
      input.value = "";
      return;
    }

    // Sonraki input'a geç
    if (value && index < this.emailCodeInputs.length - 1) {
      this.emailCodeInputs[index + 1].focus();
    }

    // Otomatik doğrulama
    if (index === this.emailCodeInputs.length - 1 && value) {
      setTimeout(() => this.verifyEmailCode(), 500);
    }
  }

  handleEmailCodeKeydown(event, index) {
    // Backspace ile önceki input'a geç
    if (event.key === "Backspace" && !event.target.value && index > 0) {
      this.emailCodeInputs[index - 1].focus();
    }
  }

  clearEmailCodeInputs() {
    this.emailCodeInputs.forEach((input) => {
      input.value = "";
    });
  }

  showEmailStatus(message, type) {
    this.emailVerificationStatus.textContent = message;
    this.emailVerificationStatus.className = `verification-status ${type}`;
  }

  showProductVerificationScreen() {
    this.emailVerificationScreen.style.display = "none";
    this.productVerificationScreen.style.display = "flex";
  }

  async verifyProduct() {
    const productName = this.productNameInput.value.trim();
    const serialNumber = this.serialNumberInput.value.trim();

    if (!productName || !serialNumber) {
      this.showProductStatus(
        "Lütfen ürün adı ve seri numarasını girin",
        "error"
      );
      return;
    }

    this.verifyProductBtn.disabled = true;
    this.verifyProductBtn.innerHTML =
      '<div class="loading"></div> Doğrulanıyor...';

    try {
      const response = await fetch(`${this.apiBaseUrl}/verify-product`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: this.userId,
          product_name: productName,
          serial_number: serialNumber,
        }),
      });

      const data = await response.json();

      if (data.success) {
        this.isProductVerified = true;
        this.showProductStatus("Ürün doğrulaması başarılı!", "success");
        setTimeout(() => {
          this.showChatInterface();
        }, 1500);
      } else {
        this.showProductStatus(data.message, "error");
      }
    } catch (error) {
      this.showProductStatus(
        "Bağlantı hatası. Lütfen tekrar deneyin.",
        "error"
      );
    } finally {
      this.verifyProductBtn.disabled = false;
      this.verifyProductBtn.innerHTML =
        '<i class="fas fa-check"></i> Ürünü Doğrula';
    }
  }

  showProductStatus(message, type) {
    this.productVerificationStatus.textContent = message;
    this.productVerificationStatus.className = `verification-status ${type}`;
  }

  showChatInterface() {
    this.productVerificationScreen.style.display = "none";
    this.chatMessages.style.display = "block";
    this.chatInputContainer.style.display = "block";
    this.chatInput.focus();
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();

    if (!message) return;

    // Kullanıcı mesajını ekle
    this.addMessage(message, "user");
    this.chatInput.value = "";

    // Bot yanıtını al
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

      if (data.success) {
        this.addMessage(data.response, "bot");
      } else {
        this.addMessage(
          "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.",
          "bot"
        );
      }
    } catch (error) {
      this.addMessage("Bağlantı hatası. Lütfen tekrar deneyin.", "bot");
    }
  }

  addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = `<p>${text}</p>`;

    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = "Şimdi";

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);

    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }
}

// Chatbot'u başlat
document.addEventListener("DOMContentLoaded", () => {
  const chatbot = new ChatbotWidgetWithProductVerification();
  window.chatbot = chatbot;
});
