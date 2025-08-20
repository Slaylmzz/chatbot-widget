class ChatbotWidgetWithProductVerification {
  constructor() {
    this.apiBaseUrl = "http://127.0.0.1:5000/api";
    this.userId = null;
    this.isEmailVerified = false;
    this.isProductVerified = false;
    this.products = [];
    this.userLocation = null;
    this.messageCount = 0;

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

    // Technical service form elements
    this.technicalServicePrompt = document.getElementById(
      "technicalServicePrompt"
    );
    this.showServiceFormBtn = document.getElementById("showServiceFormBtn");
    this.serviceFormScreen = document.getElementById("serviceFormScreen");
    this.serviceFormActions = document.getElementById("serviceFormActions");
    this.technicalServiceForm = document.getElementById("technicalServiceForm");
    this.cancelServiceForm = document.getElementById("cancelServiceForm");
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

    // Technical service form events
    this.showServiceFormBtn.addEventListener("click", () =>
      this.showServiceForm()
    );
    this.cancelServiceForm.addEventListener("click", () =>
      this.hideServiceForm()
    );
    this.technicalServiceForm.addEventListener("submit", (e) =>
      this.submitServiceForm(e)
    );

    // Get user location on initialization
    this.getUserLocation();
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

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      const data = await response.json();
      console.log("Response data:", data);

      if (data.success) {
        this.userId = data.user_id;

        // Otomatik doğrulama kontrolü
        if (data.auto_verified) {
          this.isEmailVerified = true;
          this.showProductVerificationScreen();
        } else {
          this.showEmailStatus(
            "Doğrulama kodu e-posta adresinize gönderildi",
            "success"
          );
          this.emailForm.style.display = "none";
          this.emailCodeForm.style.display = "block";
          this.clearEmailCodeInputs();
          this.emailCodeInputs[0].focus();
        }
      } else {
        this.showEmailStatus(data.message, "error");
      }
    } catch (error) {
      console.error("Register error:", error);
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
        // Ürün bilgilerini sakla
        this.verifiedProductName = productName;
        this.verifiedSerialNumber = serialNumber;
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

  getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
        },
        (error) => {
          console.log("Konum alınamadı:", error);
          // Fallback to IP-based location will be handled on server side
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    }
  }

  showServiceForm() {
    // Hide chat interface and show service form screen
    this.chatMessages.style.display = "none";
    this.chatInputContainer.style.display = "none";
    this.serviceFormScreen.style.display = "flex";
    this.serviceFormActions.style.display = "flex";
    
    // Pre-fill email if available
    const emailInput = document.getElementById("customerEmail");
    if (emailInput && this.emailInput.value) {
      emailInput.value = this.emailInput.value;
    }
    
    // Pre-fill request date (today)
    const requestDate = document.getElementById("requestDate");
    if (requestDate) {
      const today = new Date().toISOString().split('T')[0];
      requestDate.value = today;
    }
    
    // Pre-fill product information if available
    const deviceModel = document.getElementById("deviceModel");
    const serialNumber = document.getElementById("serialNumber");
    
    if (this.verifiedProductName && deviceModel) {
      deviceModel.value = this.verifiedProductName;
    }
    
    if (this.verifiedSerialNumber && serialNumber) {
      serialNumber.value = this.verifiedSerialNumber;
    }
    
    // Set device location to "Açık" by default
    const deviceLocation = document.getElementById("deviceLocation");
    if (deviceLocation) {
      deviceLocation.value = "acik";
    }
  }

  hideServiceForm() {
    // Hide service form and show chat interface
    this.serviceFormScreen.style.display = "none";
    this.serviceFormActions.style.display = "none";
    this.chatMessages.style.display = "block";
    this.chatInputContainer.style.display = "block";
    this.technicalServiceForm.reset();
  }

  async submitServiceForm(event) {
    event.preventDefault();

    // Form validasyonu
    const name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const problem = document.getElementById("problemDescription").value.trim();

    if (!name || !phone || !email || !address || !problem) {
      alert("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    if (!this.userId) {
      alert("Kullanıcı doğrulaması bulunamadı. Lütfen sayfayı yenileyin.");
      return;
    }

    const formData = {
      user_id: this.userId,
      name: name,
      company_name: document.getElementById("companyName").value.trim(),
      phone: phone,
      email: email,
      address: address,
      request_date: document.getElementById("requestDate").value,
      device_model: document.getElementById("deviceModel").value.trim(),
      serial_number: document.getElementById("serialNumber").value.trim(),
      device_location: document.getElementById("deviceLocation").value,
      error_code: document.getElementById("errorCode").value.trim(),
      current_error: document.getElementById("currentError").value.trim(),
      problem_description: problem,
      preferred_date: document.getElementById("preferredDate").value,
      additional_notes: document.getElementById("additionalNotes").value.trim(),
      location: this.userLocation,
      timestamp: new Date().toISOString(),
    };

    const submitBtn = document.getElementById("submitServiceForm");
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="loading"></div> Gönderiliyor...';

    try {
      console.log("Form gönderiliyor:", formData);

      const response = await fetch(`${this.apiBaseUrl}/technical-service`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      console.log("Sunucu yanıtı:", response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Yanıt verisi:", data);

      if (data.success) {
        alert(
          "Teknik servis talebiniz başarıyla gönderildi. En kısa sürede size dönüş yapılacaktır."
        );
        this.hideServiceForm();
        this.addMessage(
          "Teknik servis talebiniz alındı. Teşekkür ederiz!",
          "bot"
        );
      } else {
        alert("Bir hata oluştu: " + data.message);
      }
    } catch (error) {
      console.error("Form gönderme hatası:", error);
      alert("Bağlantı hatası. Lütfen tekrar deneyin. Hata: " + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gönder';
    }
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();

    if (!message) return;

    // Kullanıcı mesajını ekle
    this.addMessage(message, "user");
    this.chatInput.value = "";
    this.messageCount++;

    // Destek talebi kontrolü
    const supportKeywords = ['destek', 'teknik servis', 'servis', 'arıza', 'sorun', 'yardım'];
    const messageWords = message.toLowerCase().split(' ');
    const hasSupport = supportKeywords.some(keyword => 
      messageWords.some(word => word.includes(keyword))
    );

    if (hasSupport) {
      this.addMessage("Teknik servis formu açılıyor...", "bot");
      setTimeout(() => {
        this.showServiceForm();
      }, 1000);
      return;
    }

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

        // Show technical service prompt after 2 messages
        if (this.messageCount >= 2) {
          setTimeout(() => {
            this.technicalServicePrompt.style.display = "block";
          }, 2000);
        }
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

  shouldShowServicePrompt(userMessage, botResponse) {
    // Check if the conversation indicates a technical problem that might need service
    const technicalKeywords = [
      "hata",
      "arıza",
      "çalışmıyor",
      "bozuk",
      "sorun",
      "problem",
      "er",
      "al",
      "alarm",
    ];
    const unsolvedIndicators = [
      "çözüm",
      "yardım",
      "nasıl",
      "ne yapmalı",
      "devam ediyor",
    ];

    const userLower = userMessage.toLowerCase();
    const botLower = botResponse.toLowerCase();

    const hasTechnicalKeyword = technicalKeywords.some(
      (keyword) => userLower.includes(keyword) || botLower.includes(keyword)
    );

    const hasUnsolvedIndicator = unsolvedIndicators.some((indicator) =>
      userLower.includes(indicator)
    );

    return (
      hasTechnicalKeyword && (hasUnsolvedIndicator || this.messageCount >= 3)
    );
  }

  addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}-message`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = `<p>${text.replace(/\n/g, "<br>")}</p>`;

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
