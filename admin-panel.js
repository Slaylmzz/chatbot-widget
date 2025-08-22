class AdminPanel {
  constructor() {
    this.apiBaseUrl = "http://127.0.0.1:5000/api";
    this.currentSection = "dashboard";
    this.refreshInterval = null;
    this.charts = {};
    this.isAuthenticated = false;

    this.initializeLogin();
  }

  initializeLogin() {
    const loginForm = document.getElementById("loginForm");
    const loginError = document.getElementById("loginError");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch("/admin-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (data.success) {
          this.isAuthenticated = true;
          localStorage.setItem("admin_token", data.token);
          this.showAdminPanel();
        } else {
          loginError.textContent = data.message;
          loginError.style.display = "block";
        }
      } catch (error) {
        loginError.textContent = "Bağlantı hatası. Lütfen tekrar deneyin.";
        loginError.style.display = "block";
      }
    });

    // Check if already authenticated
    const token = localStorage.getItem("admin_token");
    if (token === "admin_authenticated") {
      this.isAuthenticated = true;
      this.showAdminPanel();
    }
  }

  showAdminPanel() {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("adminPanel").style.display = "flex";

    this.initializeElements();
    this.bindEvents();
    this.loadDashboard();
    this.startAutoRefresh();
  }

  initializeElements() {
    this.navItems = document.querySelectorAll(".nav-item");
    this.contentSections = document.querySelectorAll(".content-section");
    this.pageTitle = document.getElementById("page-title");
    this.searchInput = document.getElementById("search-input");

    // Dashboard elements
    this.totalUsersEl = document.getElementById("total-users");
    this.totalMessagesEl = document.getElementById("total-messages");
    this.serviceRequestsCountEl = document.getElementById(
      "service-requests-count"
    );
    this.todayUsersEl = document.getElementById("today-users");

    // Table elements
    this.usersTableBody = document.getElementById("users-table-body");
    this.chatList = document.getElementById("chat-list");
    this.serviceRequestsGrid = document.getElementById("service-requests-grid");

    // Filter elements
    this.userFilter = document.getElementById("user-filter");
    this.chatFilter = document.getElementById("chat-filter");
    this.dateFilter = document.getElementById("date-filter");
    this.statusFilter = document.getElementById("status-filter");

    // Settings
    this.autoRefreshCheckbox = document.getElementById("auto-refresh");
    this.refreshIntervalInput = document.getElementById("refresh-interval");
  }

  bindEvents() {
    // Navigation
    this.navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.switchSection(section);
      });
    });

    // Filters
    if (this.userFilter) {
      this.userFilter.addEventListener("change", () => this.loadUsers());
    }

    if (this.chatFilter) {
      this.chatFilter.addEventListener("change", () => this.loadChats());
    }

    if (this.dateFilter) {
      this.dateFilter.addEventListener("change", () => this.loadChats());
    }

    if (this.statusFilter) {
      this.statusFilter.addEventListener("change", () =>
        this.loadServiceRequests()
      );
    }

    // Settings
    if (this.autoRefreshCheckbox) {
      this.autoRefreshCheckbox.addEventListener("change", () => {
        if (this.autoRefreshCheckbox.checked) {
          this.startAutoRefresh();
        } else {
          this.stopAutoRefresh();
        }
      });
    }

    if (this.refreshIntervalInput) {
      this.refreshIntervalInput.addEventListener("change", () => {
        if (this.autoRefreshCheckbox.checked) {
          this.startAutoRefresh();
        }
      });
    }

    // Search
    if (this.searchInput) {
      this.searchInput.addEventListener("input", (e) => {
        this.handleSearch(e.target.value);
      });
    }
  }

  switchSection(section) {
    // Update navigation
    this.navItems.forEach((item) => item.classList.remove("active"));
    document
      .querySelector(`[data-section="${section}"]`)
      .classList.add("active");

    // Update content
    this.contentSections.forEach((section) =>
      section.classList.remove("active")
    );
    document.getElementById(section).classList.add("active");

    // Update page title
    const titles = {
      dashboard: "Dashboard",
      users: "Kullanıcı Yönetimi",
      chats: "Sohbet Geçmişi",
      analytics: "Analitik",
      "service-requests": "Teknik Servis Talepleri",
      settings: "Ayarlar",
    };
    this.pageTitle.textContent = titles[section] || "Dashboard";

    this.currentSection = section;

    // Load section data
    switch (section) {
      case "dashboard":
        this.loadDashboard();
        break;
      case "users":
        this.loadUsers();
        break;
      case "chats":
        this.loadChats();
        break;
      case "analytics":
        this.loadAnalytics();
        break;
      case "service-requests":
        this.loadServiceRequests();
        break;
    }
  }

  async loadDashboard() {
    try {
      const [stats, activity] = await Promise.all([
        this.fetchStats(),
        this.fetchRecentActivity(),
      ]);

      this.updateStats(stats);
      this.updateRecentActivity(activity);
      this.createDashboardCharts(stats);
    } catch (error) {
      console.error("Dashboard yükleme hatası:", error);
    }
  }

  async fetchStats() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/stats`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("İstatistik yükleme hatası:", error);
    }

    // Fallback mock data
    return {
      totalUsers: 0,
      totalMessages: 0,
      serviceRequests: 0,
      todayUsers: 0,
      dailyActivity: [],
      topTopics: [],
    };
  }

  async fetchRecentActivity() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/recent-activity`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Son aktivite yükleme hatası:", error);
    }

    return [];
  }

  updateStats(stats) {
    if (this.totalUsersEl)
      this.totalUsersEl.textContent = stats.totalUsers || 0;
    if (this.totalMessagesEl)
      this.totalMessagesEl.textContent = stats.totalMessages || 0;
    if (this.serviceRequestsCountEl)
      this.serviceRequestsCountEl.textContent = stats.serviceRequests || 0;
    if (this.todayUsersEl)
      this.todayUsersEl.textContent = stats.todayUsers || 0;
  }

  updateRecentActivity(activities) {
    const activityList = document.getElementById("recent-activity-list");
    if (!activityList) return;

    if (!activities || activities.length === 0) {
      activityList.innerHTML =
        '<p style="text-align: center; color: #666; padding: 20px;">Henüz aktivite bulunmuyor.</p>';
      return;
    }

    activityList.innerHTML = activities
      .map(
        (activity) => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-info">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                </div>
                <div class="activity-time">${this.formatTime(
                  activity.timestamp
                )}</div>
            </div>
        `
      )
      .join("");
  }

  getActivityIcon(type) {
    const icons = {
      user_register: "fa-user-plus",
      chat_message: "fa-comment",
      service_request: "fa-tools",
      product_verify: "fa-check-circle",
    };
    return icons[type] || "fa-info-circle";
  }

  createDashboardCharts(stats) {
    // Daily Activity Chart
    const dailyCtx = document.getElementById("daily-activity-chart");
    if (dailyCtx && !this.charts.dailyActivity) {
      this.charts.dailyActivity = new Chart(dailyCtx, {
        type: "line",
        data: {
          labels: stats.dailyActivity?.map((d) => d.date) || [],
          datasets: [
            {
              label: "Aktif Kullanıcılar",
              data: stats.dailyActivity?.map((d) => d.users) || [],
              borderColor: "#667eea",
              backgroundColor: "rgba(102, 126, 234, 0.1)",
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }

    // Topics Chart
    const topicsCtx = document.getElementById("topics-chart");
    if (topicsCtx && !this.charts.topics) {
      this.charts.topics = new Chart(topicsCtx, {
        type: "doughnut",
        data: {
          labels: stats.topTopics?.map((t) => t.topic) || ["Henüz veri yok"],
          datasets: [
            {
              data: stats.topTopics?.map((t) => t.count) || [1],
              backgroundColor: [
                "#667eea",
                "#f093fb",
                "#4facfe",
                "#43e97b",
                "#f5576c",
              ],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
        },
      });
    }
  }

  async loadUsers() {
    try {
      const filter = this.userFilter?.value || "all";
      const response = await fetch(
        `${this.apiBaseUrl}/admin/users?filter=${filter}`
      );

      if (response.ok) {
        const users = await response.json();
        this.updateUsersTable(users);
      } else {
        this.updateUsersTable([]);
      }
    } catch (error) {
      console.error("Kullanıcı yükleme hatası:", error);
      this.updateUsersTable([]);
    }
  }

  updateUsersTable(users) {
    if (!this.usersTableBody) return;

    if (!users || users.length === 0) {
      this.usersTableBody.innerHTML =
        '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #666;">Henüz kullanıcı bulunmuyor.</td></tr>';
      return;
    }

    this.usersTableBody.innerHTML = users
      .map(
        (user) => `
            <tr>
                <td>${user.id.substring(0, 8)}...</td>
                <td>${user.email}</td>
                <td><span class="status-badge ${
                  user.email_verified ? "status-verified" : "status-unverified"
                }">${
          user.email_verified ? "Doğrulandı" : "Beklemede"
        }</span></td>
                <td><span class="status-badge ${
                  user.product_verified
                    ? "status-verified"
                    : "status-unverified"
                }">${
          user.product_verified ? "Doğrulandı" : "Beklemede"
        }</span></td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>${
                  user.last_activity
                    ? this.formatDate(user.last_activity)
                    : "Hiç"
                }</td>
                <td>${user.location || "Bilinmiyor"}</td>
            </tr>
        `
      )
      .join("");
  }

  async loadChats() {
    try {
      const filter = this.chatFilter?.value || "all";
      const date = this.dateFilter?.value || "";
      const response = await fetch(
        `${this.apiBaseUrl}/admin/chats?filter=${filter}&date=${date}`
      );

      if (response.ok) {
        const chats = await response.json();
        this.updateChatList(chats);
      } else {
        this.updateChatList([]);
      }
    } catch (error) {
      console.error("Sohbet yükleme hatası:", error);
      this.updateChatList([]);
    }
  }

  updateChatList(chats) {
    if (!this.chatList) return;

    if (!chats || chats.length === 0) {
      this.chatList.innerHTML =
        '<p style="text-align: center; color: #666; padding: 20px;">Henüz sohbet bulunmuyor.</p>';
      return;
    }

    this.chatList.innerHTML = chats
      .map(
        (chat) => `
            <div class="chat-item">
                <div class="chat-header">
                    <div class="chat-user">${chat.user_email}</div>
                    <div class="chat-time">${this.formatDate(
                      chat.last_message_time
                    )}</div>
                </div>
                <div class="chat-messages">
                    ${chat.messages
                      .map(
                        (msg) => `
                        <div class="chat-message ${msg.sender}">
                            ${msg.message}
                        </div>
                    `
                      )
                      .join("")}
                </div>
            </div>
        `
      )
      .join("");
  }

  async loadAnalytics() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/admin/analytics`);

      if (response.ok) {
        const analytics = await response.json();
        this.updateAnalytics(analytics);
      }
    } catch (error) {
      console.error("Analitik yükleme hatası:", error);
    }
  }

  updateAnalytics(analytics) {
    // Update locations
    const locationList = document.getElementById("location-list");
    if (locationList && analytics.locations) {
      locationList.innerHTML = analytics.locations
        .map(
          (loc) => `
                <div class="location-item">
                    <div class="location-name">${loc.location}</div>
                    <div class="location-count">${loc.count}</div>
                </div>
            `
        )
        .join("");
    }

    // Update questions
    const questionStats = document.getElementById("question-stats");
    if (questionStats && analytics.questions) {
      questionStats.innerHTML = analytics.questions
        .map(
          (q) => `
                <div class="question-item">
                    <div class="question-text">${q.question}</div>
                    <div class="question-count">${q.count}</div>
                </div>
            `
        )
        .join("");
    }

    // Error codes chart
    const errorCodesCtx = document.getElementById("error-codes-chart");
    if (errorCodesCtx && analytics.errorCodes && !this.charts.errorCodes) {
      this.charts.errorCodes = new Chart(errorCodesCtx, {
        type: "bar",
        data: {
          labels: analytics.errorCodes.map((e) => e.code),
          datasets: [
            {
              label: "Hata Kodu Sıklığı",
              data: analytics.errorCodes.map((e) => e.count),
              backgroundColor: "#4facfe",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
        },
      });
    }
  }

  async loadServiceRequests() {
    try {
      const status = this.statusFilter?.value || "all";
      const response = await fetch(
        `${this.apiBaseUrl}/admin/service-requests?status=${status}`
      );

      if (response.ok) {
        const requests = await response.json();
        this.updateServiceRequests(requests);
      } else {
        this.updateServiceRequests([]);
      }
    } catch (error) {
      console.error("Servis talepleri yükleme hatası:", error);
      this.updateServiceRequests([]);
    }
  }

  updateServiceRequests(requests) {
    if (!this.serviceRequestsGrid) return;

    if (!requests || requests.length === 0) {
      this.serviceRequestsGrid.innerHTML =
        '<p style="text-align: center; color: #666; padding: 20px;">Henüz servis talebi bulunmuyor.</p>';
      return;
    }

    this.serviceRequestsGrid.innerHTML = requests
      .map(
        (request) => `
            <div class="service-request-card">
                <div class="service-header">
                    <div class="service-title">${request.name}</div>
                    <div class="service-date">${this.formatDate(
                      request.created_at
                    )}</div>
                </div>
                <div class="service-info">
                    <div class="info-item">
                        <div class="info-label">Telefon</div>
                        <div class="info-value">${request.phone}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">E-posta</div>
                        <div class="info-value">${request.email}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Ürün</div>
                        <div class="info-value">${
                          request.product_name || "Belirtilmemiş"
                        }</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Konum</div>
                        <div class="info-value">${
                          request.location_address || "Bilinmiyor"
                        }</div>
                    </div>
                </div>
                <div class="service-description">
                    <h4>Sorun Açıklaması</h4>
                    <p>${request.problem_description}</p>
                </div>
            </div>
        `
      )
      .join("");
  }

  handleSearch(query) {
    // Implement search functionality based on current section
    console.log("Arama:", query);
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    const interval = (this.refreshIntervalInput?.value || 30) * 1000;

    this.refreshInterval = setInterval(() => {
      switch (this.currentSection) {
        case "dashboard":
          this.loadDashboard();
          break;
        case "users":
          this.loadUsers();
          break;
        case "chats":
          this.loadChats();
          break;
        case "analytics":
          this.loadAnalytics();
          break;
        case "service-requests":
          this.loadServiceRequests();
          break;
      }
    }, interval);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  formatDate(dateString) {
    if (!dateString) return "Bilinmiyor";

    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  formatTime(dateString) {
    if (!dateString) return "Bilinmiyor";

    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Az önce";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;

    return date.toLocaleDateString("tr-TR");
  }
}

// Initialize admin panel when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AdminPanel();
});
