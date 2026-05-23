(function () {
  function qs(id) {
    return document.getElementById(id);
  }

  window.formatCurrency = function (value) {
    return `₹${Number(value || 0).toFixed(2)}`;
  };

  window.showToast = window.showToast || function (message, type = "success") {
    const container = qs("toastContainer");
    if (!container) {
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  function initAuthGuard() {
    if (!window.auth) {
      return;
    }

    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    auth.onAuthStateChanged((user) => {
      if (currentPage === "login.html") {
        if (user) {
          window.location.href = "index.html";
        }
        return;
      }

      if (!user) {
        window.location.href = "login.html";
      }
    });
  }

  function initShell() {
    const menuToggle = qs("menuToggle");
    const sidebar = qs("sidebar");
    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
    }

    document.querySelectorAll(".nav-item").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.innerWidth < 768 && sidebar) {
          sidebar.classList.remove("open");
        }
      });
    });

    const darkToggle = qs("darkModeToggle");
    if (darkToggle) {
      darkToggle.addEventListener("click", () => {
        const html = document.documentElement;
        const nextTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
        html.setAttribute("data-theme", nextTheme);
        localStorage.setItem("theme", nextTheme);
      });
    }
    document.documentElement.setAttribute("data-theme", localStorage.getItem("theme") || "light");

    const logoutBtn = qs("logoutBtn");
    if (logoutBtn && window.auth) {
      logoutBtn.addEventListener("click", () => {
        auth.signOut().then(() => {
          window.location.href = "login.html";
        });
      });
    }
  }

  async function loadDashboardStats() {
    const statsContainer = qs("statsContainer");
    if (!statsContainer || !window.db) {
      return;
    }

    statsContainer.innerHTML = `
      <div class="stat-card"><div><div class="stat-value" id="totalProducts">--</div><div class="stat-label">Total Products</div></div></div>
      <div class="stat-card"><div><div class="stat-value" id="totalCustomers">--</div><div class="stat-label">Customers</div></div></div>
      <div class="stat-card"><div><div class="stat-value" id="todaySales">--</div><div class="stat-label">Today's Sales</div></div></div>
      <div class="stat-card"><div><div class="stat-value" id="monthRevenue">--</div><div class="stat-label">Monthly Revenue</div></div></div>
    `;

    try {
      const [productsSnap, customersSnap, salesSnap] = await Promise.all([
        db.collection("products").get(),
        db.collection("customers").get(),
        db.collection("sales").get()
      ]);

      const today = new Date();
      const todayKey = today.toDateString();
      const month = today.getMonth();
      const year = today.getFullYear();
      let todaySales = 0;
      let monthRevenue = 0;
      const recentRows = [];

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const created = sale.createdAt && sale.createdAt.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
        const total = Number(sale.total || sale.grandTotal || 0);

        if (created.toDateString() === todayKey) {
          todaySales += total;
        }
        if (created.getMonth() === month && created.getFullYear() === year) {
          monthRevenue += total;
        }

        recentRows.push({ id: doc.id, sale, created, total });
      });

      qs("totalProducts").textContent = productsSnap.size;
      qs("totalCustomers").textContent = customersSnap.size;
      qs("todaySales").textContent = formatCurrency(todaySales);
      qs("monthRevenue").textContent = formatCurrency(monthRevenue);

      const recentBody = document.querySelector("#recentSalesTable tbody");
      if (recentBody) {
        recentBody.innerHTML = recentRows
          .sort((a, b) => b.created - a.created)
          .slice(0, 5)
          .map(({ id, sale, created, total }) => `
            <tr>
              <td>${sale.invoiceNo || id.slice(0, 8)}</td>
              <td>${sale.customerName || "Walk-in"}</td>
              <td>${formatCurrency(total)}</td>
              <td>${created.toLocaleDateString()}</td>
              <td>${sale.paymentStatus || "Paid"}</td>
            </tr>
          `)
          .join("");
      }
    } catch (error) {
      console.error("Dashboard load failed:", error);
      showToast("Could not load dashboard data", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAuthGuard();
    initShell();
    loadDashboardStats();
  });
})();
