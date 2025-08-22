class ChatbotWidgetWithProductVerification {
  constructor() {
    this.apiBaseUrl = "http://127.0.0.1:5000/api";
    this.userId = null;
    this.isEmailVerified = false;
    this.isProductVerified = false;
    this.products = [];
    this.userLocation = null;
    this.faqData = null;
    this.resetData = null;
    this.errorData = null;
    this.messageCount = 0;

    this.initializeElements();
    this.bindEvents();
    this.loadFAQData();
    this.loadResetData();
    this.loadErrorData();
  }

  initializeElements() {
    console.log('Initializing elements...');
    
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
    
    console.log('Elements initialized:', {
      chatMessages: this.chatMessages,
      chatInput: this.chatInput,
      sendMessageBtn: this.sendMessageBtn
    });
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

    // Get user location after user interaction
    // this.getUserLocation(); // Moved to toggleChatbot method
  }

  async loadFAQData() {
    try {
      const response = await fetch("chiller_faq.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.faqData = await response.json();
      console.log("✅ FAQ verileri yüklendi:", this.faqData);
    } catch (error) {
      console.error("❌ FAQ verileri yüklenemedi:", error);
      this.faqData = null;
    }
  }

  async loadResetData() {
    try {
      const response = await fetch("reset_instructions.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.resetData = await response.json();
      console.log("✅ Reset talimatları yüklendi:", this.resetData);
    } catch (error) {
      console.error("❌ Reset verileri yüklenemedi:", error);
      this.resetData = null;
    }
  }

  async loadErrorData() {
    try {
      const response = await fetch("urun_hatalari.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      this.errorData = await response.json();
      console.log("✅ Hata kodları yüklendi:", this.errorData);
    } catch (error) {
      console.error("❌ Hata kodları yüklenemedi:", error);
      this.errorData = null;
    }
  }

  findFAQAnswer(userMessage) {
    if (!this.faqData || !this.faqData.faq) {
      return null;
    }

    const messageLower = userMessage.toLowerCase();
    let bestMatch = null;
    let maxScore = 0;

    for (const faq of this.faqData.faq) {
      let score = 0;
      const questionLower = faq.question.toLowerCase();

      // Soru metninde geçen anahtar kelimeleri kontrol et
      const questionWords = questionLower.split(" ");
      const messageWords = messageLower.split(" ");

      // Ortak kelime sayısını hesapla
      for (const messageWord of messageWords) {
        if (messageWord.length > 2) {
          // 2 karakterden uzun kelimeler
          for (const questionWord of questionWords) {
            if (
              questionWord.includes(messageWord) ||
              messageWord.includes(questionWord)
            ) {
              score += 1;
            }
          }
        }
      }

      // Özel anahtar kelimeler için ek puan
      const specialKeywords = {
        antifriz: ["antifriz", "donma", "koruma"],
        bypass: ["bypass", "by-pass", "debi"],
        gaz: ["gaz", "soğutma", "değişim"],
        bakım: ["bakım", "periyodik", "servis"],
        konumlandırma: ["konum", "yerleştirme", "montaj"],
        sundurma: ["sundurma", "koruma", "güneş"],
        filtre: ["filtre", "pislik", "temizlik"],
        elektrik: ["elektrik", "kablo", "beslem"],
        zemin: ["zemin", "taban", "titreşim"],
        garanti: ["garanti", "arıza", "kapsam"],
        destek: ["destek", "yardım", "teknik"],
        chiller: ["chiller", "soğutma", "sistem"],
      };

      for (const [key, keywords] of Object.entries(specialKeywords)) {
        if (questionLower.includes(key)) {
          for (const keyword of keywords) {
            if (messageLower.includes(keyword)) {
              score += 2; // Özel anahtar kelimeler için daha yüksek puan
            }
          }
        }
      }

      // En yüksek skoru alan FAQ'i seç
      if (score > maxScore && score >= 2) {
        // Minimum 2 puan gerekli
        maxScore = score;
        bestMatch = faq;
      }
    }

    return bestMatch;
  }

  findMachineType(userMessage) {
    if (!this.errorData) return null;

    const messageLower = userMessage.toLowerCase();

    // Hata koduna göre makine tipi tespiti
    for (const error of this.errorData) {
      // ST542 kodu kontrolü
      if (error.st542_kodu && error.st542_kodu.trim() !== "") {
        const st542Codes = error.st542_kodu.split("/");
        for (const code of st542Codes) {
          const cleanCode = code.trim().toLowerCase();
          if (messageLower.includes(cleanCode)) {
            return "st542";
          }
        }
      }

      // Carel kodu kontrolü
      if (error.carel_kodu && error.carel_kodu.trim() !== "") {
        const carelCode = error.carel_kodu.trim().toLowerCase();
        if (messageLower.includes(carelCode)) {
          return "carel";
        }
      }
    }

    // Hata kodu bulunamazsa anahtar kelime kontrolü yap
    const st542Keywords = this.resetData.reset_instructions.st542.keywords;
    for (const keyword of st542Keywords) {
      if (messageLower.includes(keyword)) {
        return 'st542';
      }
    }

    const carelKeywords = this.resetData.reset_instructions.carel.keywords;
    for (const keyword of carelKeywords) {
      if (messageLower.includes(keyword)) {
        return 'carel';
      }
    }

    return null;
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
    
    // Konum iznini chatbot açıldığında iste
    if (this.container.classList.contains("active") && !this.userLocation) {
      this.getUserLocation();
    }
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
    // Konum iznini sadece kullanıcı etkileşimi sonrası iste
    setTimeout(() => {
      if (navigator.geolocation) {
        console.log('Konum izni isteniyor...');
        navigator.geolocation.getCurrentPosition(
          (position) => {
            this.userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            console.log('Konum alındı:', this.userLocation);
          },
          (error) => {
            console.log("Konum alınamadı:", error.message);
            if (error.code === 1) {
              console.log('Konum izni reddedildi. Tarayıcı ayarlarından konum iznini açabilirsiniz.');
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000,
          }
        );
      } else {
        console.log('Tarayıcı konum desteği yok');
      }
    }, 1000);
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
      const today = new Date().toISOString().split("T")[0];
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

  hideServiceFormAfterSubmission() {
    // Form gönderildikten sonra formu tamamen gizle
    this.serviceFormScreen.style.display = "none";
    this.serviceFormActions.style.display = "none";
    this.chatMessages.style.display = "block";
    this.chatInputContainer.style.display = "block";
    this.technicalServiceForm.reset();

    // Teknik servis prompt'unu gizle
    this.technicalServicePrompt.style.display = "none";
  }

  addReopenFormOption() {
    // Teknik destek formunu tekrar açma seçeneği ekle
    const reopenDiv = document.createElement("div");
    reopenDiv.className = "message bot-message";
    reopenDiv.innerHTML = `
      <div class="message-content">
        <p>Başka bir teknik destek talebi oluşturmak isterseniz:</p>
        <button class="reopen-form-btn" onclick="window.chatbot.reopenServiceForm()" style="
          background: linear-gradient(45deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 20px;
          cursor: pointer;
          margin-top: 10px;
          font-size: 14px;
          transition: transform 0.3s ease;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          <i class="fas fa-tools"></i> Yeni Teknik Servis Formu
        </button>
      </div>
      <div class="message-time">Şimdi</div>
    `;

    this.chatMessages.appendChild(reopenDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  reopenServiceForm() {
    // Formu tekrar aç
    this.showServiceForm();

    // 3 saniye sonra chatbot'u kapat
    setTimeout(() => {
      this.closeChatbot();
    }, 3000);

    // Kullanıcıya bilgi ver
    const infoDiv = document.createElement("div");
    infoDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      z-index: 10000;
      font-size: 14px;
      text-align: center;
    `;
    infoDiv.innerHTML = "Form açıldı. Sayfa 3 saniye sonra kapanacak...";
    document.body.appendChild(infoDiv);

    setTimeout(() => {
      document.body.removeChild(infoDiv);
    }, 2500);
  }

  closeChatbot() {
    this.container.classList.remove("active");
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

        // Form gönderildikten sonra formu gizle ve chat arayüzüne dön
        this.hideServiceFormAfterSubmission();

        this.addMessage(
          "Teknik servis talebiniz alındı. Teşekkür ederiz!",
          "bot"
        );

        // Teknik destek formunu tekrar açma seçeneği sun
        setTimeout(() => {
          this.addMessage(
            "Merhaba! Size nasıl yardımcı olabilirim? 😊\n\n" +
            "🔧 **Hata kodları:** ER21, AL003, ER01 gibi kodları yazın\n" +
            "❓ **Genel sorular:** antifriz, bypass, bakım konularını sorun\n" +
            "🛠️ **Reset talimatları:** 'reset' yazın\n" +
            "🆘 **Teknik destek:** 'yardım' veya 'servis' yazın",
            "bot"
          );
        }, 800);
      } else {
        alert("Bir hata oluştu: " + data.message);
      }
    } catch (error) {
      console.error("Form gönderme hatası:", error);
      setTimeout(() => {
        this.addMessage("Bağlantı hatası. Lütfen tekrar deneyin.", "bot");
      }, 800);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gönder';
    }
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message) return;

    this.addMessage(message, "user");
    this.chatInput.value = "";
    this.messageCount++;

    console.log("🔍 Mesaj analiz ediliyor:", message);
    console.log("📊 Veri durumu:", {
      faqData: !!this.faqData,
      resetData: !!this.resetData,
      errorData: !!this.errorData
    });

    // Hata kodu kontrolü (en öncelikli)
    const machineType = this.detectMachineType(message);
    console.log("🔧 Tespit edilen makine tipi:", machineType);
    
    if (machineType) {
      const errorInfo = this.getErrorCodeInfo(message);
      const isResetRequested = message.toLowerCase().includes('reset') || 
                              message.toLowerCase().includes('resetle') ||
                              message.toLowerCase().includes('sıfırla');
      
      if (isResetRequested) {
        // Reset isteniyorsa reset talimatı ver
        const resetInstructions = this.generateResetInstructions(machineType);
        setTimeout(() => {
          this.addMessage(resetInstructions, "bot");
        }, 500);
      } else {
        // Reset istenmiyorsa hata bilgisi ver
        setTimeout(() => {
          this.addMessage(errorInfo, "bot");
        }, 500);
      }
      return;
    }

    // Reset isteği kontrolü - sadece "reset" kelimesi varsa ve hata kodu yoksa
    const isResetRequest = message.toLowerCase().includes('reset') && !machineType;
    if (isResetRequest) {
      setTimeout(() => {
        this.addMessage(
          "Reset işlemi için cihazınızın modelini belirtir misiniz?\n\n" +
          "🔹 **ST 542** modeli için 'ST 542' yazın\n" +
          "🔹 **Carel** modeli için 'Carel' yazın\n\n" +
          "Alternatif olarak cihazınızda görünen hata kodunu paylaşabilirsiniz.",
          "bot"
        );
      }, 800);
      return;
    }

    // FAQ kontrolü
    console.log("❓ FAQ aranıyor...");
    const faqAnswer = this.findFAQAnswer(message);
    console.log("💡 Bulunan FAQ:", faqAnswer);
    
    if (faqAnswer) {
      setTimeout(() => {
        this.addMessage(
          `**${faqAnswer.question}**\n\n${faqAnswer.answer}`,
          "bot"
        );
        if (this.messageCount >= 2) {
          setTimeout(() => {
            this.technicalServicePrompt.style.display = "block";
          }, 2000);
        }
      }, 800);
      return;
    }

    // Destek talebi kontrolü
    const supportKeywords = [
      "destek",
      "teknik servis", 
      "servis",
      "arıza",
      "sorun",
      "yardım",
    ];
    const messageWords = message.toLowerCase().split(" ");
    const hasSupport = supportKeywords.some((keyword) =>
      messageWords.some((word) => word.includes(keyword))
    );

    if (hasSupport) {
      setTimeout(() => {
        this.addMessage("Teknik servis formu açılıyor...", "bot");
        setTimeout(() => {
          this.showServiceForm();
        }, 1000);
      }, 500);
      return;
    }

    // Genel bot yanıtı - her zaman çalışsın
    setTimeout(() => {
      this.addMessage(
        "Merhaba! Size nasıl yardımcı olabilirim? 😊\n\n" +
        "🔧 **Hata kodları:** ER21, AL003, ER01 gibi kodları yazın\n" +
        "❓ **Genel sorular:** antifriz, bypass, bakım konularını sorun\n" +
        "🛠️ **Reset talimatları:** 'reset' yazın\n" +
        "🆘 **Teknik destek:** 'yardım' veya 'servis' yazın\n\n" +
        "💡 Daha detaylı yardım için e-posta ve ürün doğrulaması yapabilirsiniz.",
        "bot"
      );
      
      // Show technical service prompt after 2 messages
      if (this.messageCount >= 2) {
        setTimeout(() => {
          this.technicalServicePrompt.style.display = "block";
        }, 2000);
      }
    }, 500);
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

  addMessage(message, sender) {
    console.log('addMessage called:', { message, sender, chatMessages: this.chatMessages });
    
    if (!this.chatMessages) {
      console.error('chatMessages element not found!');
      return;
    }

    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);

    // Markdown-like formatting
    let formattedMessage = message
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
      .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic
      .replace(/🔧/g, "<span style='color: #667eea; font-size: 1.1em;'>🔧</span>")
      .replace(/❓/g, "<span style='color: #f093fb; font-size: 1.1em;'>❓</span>")
      .replace(/🛠️/g, "<span style='color: #4facfe; font-size: 1.1em;'>🛠️</span>")
      .replace(/🔹/g, "<span style='color: #43e97b; font-size: 1.1em;'>🔹</span>")
      .replace(/⚠️/g, "<span style='color: #f5576c; font-size: 1.1em;'>⚠️</span>")
      .replace(/💡/g, "<span style='color: #ffd700; font-size: 1.1em;'>💡</span>")
      .replace(/🆘/g, "<span style='color: #ff6b6b; font-size: 1.1em;'>🆘</span>")
      .replace(/😊/g, "<span style='color: #4ecdc4; font-size: 1.1em;'>😊</span>")
      .replace(/\n/g, "<br>"); // Line breaks

    // Image support - convert image references to actual images
    formattedMessage = formattedMessage.replace(
      /📷 \[Görsel: ([^\]]+)\]/g,
      '<br><div style="margin: 15px 0; text-align: center;"><img src="$1" alt="Reset Talimatı Görseli" style="max-width: 100%; max-height: 300px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border: 2px solid #f0f0f0;" onerror="this.style.display=\'none\'><br><small style="color: #666; font-style: italic;">Reset Talimatı Görseli</small></div>'
    );

    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="message-text" style="line-height: 1.6; padding: 12px 16px; border-radius: 18px; ${sender === 'user' ? 'background: linear-gradient(135deg, #667eea, #764ba2); color: white; margin-left: 20px;' : 'background: #f8f9fa; color: #333; margin-right: 20px; border: 1px solid #e9ecef;'}">${formattedMessage}</div>
        <div class="message-time" style="font-size: 0.75rem; color: #999; margin-top: 5px; ${sender === 'user' ? 'text-align: right;' : 'text-align: left;'}">${new Date().toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })}</div>
      </div>
    `;

    console.log('Appending message to chatMessages:', messageDiv);
    this.chatMessages.appendChild(messageDiv);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    
    // Smooth scroll animation
    messageDiv.style.opacity = '0';
    messageDiv.style.transform = 'translateY(20px)';
    setTimeout(() => {
      messageDiv.style.transition = 'all 0.3s ease';
      messageDiv.style.opacity = '1';
      messageDiv.style.transform = 'translateY(0)';
    }, 50);
    
    console.log('Message added successfully');
  }

  detectMachineType(userMessage) {
    if (!this.errorData || !this.resetData) return null;
    
    const messageLower = userMessage.toLowerCase();
    
    // Hata kodlarından tespit et
    if (this.errorData) {
      for (const error of this.errorData) {
        // ST542 kodları
        if (error.st542_kodu && error.st542_kodu.trim() !== '') {
          const st542Codes = error.st542_kodu.split('/');
          for (const code of st542Codes) {
            if (messageLower.includes(code.trim().toLowerCase())) {
              return 'st542';
            }
          }
        }
        
        // Carel kodları
        if (error.carel_kodu && error.carel_kodu.trim() !== '') {
          if (messageLower.includes(error.carel_kodu.trim().toLowerCase())) {
            return 'carel';
          }
        }
      }
    }
    
    // Reset talimatlarından anahtar kelimeler
    if (this.resetData && this.resetData.reset_instructions) {
      const st542Keywords = this.resetData.reset_instructions.st542?.keywords || [];
      for (const keyword of st542Keywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          return 'st542';
        }
      }
      
      const carelKeywords = this.resetData.reset_instructions.carel?.keywords || [];
      for (const keyword of carelKeywords) {
        if (messageLower.includes(keyword.toLowerCase())) {
          return 'carel';
        }
      }
    }
    
    // Genel anahtar kelimeler
    if (messageLower.includes('st542') || messageLower.includes('st 542') || messageLower.includes('eliwell')) {
      return 'st542';
    }
    
    if (messageLower.includes('carel') || messageLower.includes('dokunmatik') || messageLower.includes('touchscreen')) {
      return 'carel';
    }
    
    return null;
  }

  getErrorCodeInfo(userMessage) {
    if (!this.errorData) return 'Hata bilgileri yüklenemedi.';
    
    const messageLower = userMessage.toLowerCase();
    let foundError = null;
    
    // Hata kodunu bul
    for (const error of this.errorData) {
      // ST542 kodları kontrol et
      if (error.st542_kodu && error.st542_kodu.trim() !== '') {
        const st542Codes = error.st542_kodu.split('/');
        for (const code of st542Codes) {
          if (messageLower.includes(code.trim().toLowerCase())) {
            foundError = error;
            break;
          }
        }
      }
      
      // Carel kodları kontrol et
      if (!foundError && error.carel_kodu && error.carel_kodu.trim() !== '') {
        if (messageLower.includes(error.carel_kodu.trim().toLowerCase())) {
          foundError = error;
        }
      }
      
      if (foundError) break;
    }
    
    if (!foundError) {
      return 'Bu hata kodu hakkında bilgi bulunamadı. Lütfen hata kodunu kontrol edin.';
    }
    
    let response = `🔧 **Hata Kodu Bilgisi**\n\n`;
    
    if (foundError.st542_kodu && foundError.st542_kodu.trim() !== '') {
      response += `**ST542 Kodu:** ${foundError.st542_kodu}\n`;
    }
    if (foundError.carel_kodu && foundError.carel_kodu.trim() !== '') {
      response += `**Carel Kodu:** ${foundError.carel_kodu}\n`;
    }
    
    response += `**Açıklama:** ${foundError.aciklama}\n`;
    response += `**Sebep:** ${foundError.sebep}\n`;
    
    if (foundError.yorum && foundError.yorum.trim() !== '') {
      response += `**Not:** ${foundError.yorum}\n`;
    }
    
    response += `\n💡 **Reset için:** "${foundError.st542_kodu || foundError.carel_kodu} reset" yazın`;
    
    return response;
  }

  generateResetInstructions(machineType) {
    if (!this.resetData) return 'Reset talimatları yüklenemedi.';
    
    const instructions = this.resetData.reset_instructions[machineType];
    if (!instructions) return 'Bu model için reset talimatı bulunamadı.';
    
    let response = `**${instructions.model_name} Reset Talimatları**\n\n`;
    
    instructions.reset_steps.forEach((step, index) => {
      response += `**Adım ${step.step}: ${step.title}**\n`;
      response += `${step.description}\n`;
      if (step.note) {
        response += `💡 *${step.note}*\n`;
      }
      response += '\n';
    });
    
    response += '⚠️ **Önemli:** Reset işlemi sonrası cihazınızın normal çalıştığını kontrol edin.';
    return response;
  }
}

// Chatbot'u başlat
document.addEventListener("DOMContentLoaded", () => {
  const chatbot = new ChatbotWidgetWithProductVerification();
  window.chatbot = chatbot;
});
