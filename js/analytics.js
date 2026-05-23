(function () {
  let salesTrendChart = null;
  let categoryChart = null;

  function qs(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = qs(id);
    if (el) {
      el.textContent = value;
    }
  }

  function readSaleDate(sale) {
    if (sale.createdAt && sale.createdAt.toDate) {
      return sale.createdAt.toDate();
    }
    return new Date(sale.createdAt || Date.now());
  }

  function chartColors() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      grid: dark ? "#334155" : "#e2e8f0",
      text: dark ? "#cbd5e1" : "#64748b",
      line: dark ? "#60a5fa" : "#2563eb"
    };
  }

  function destroyCharts() {
    if (salesTrendChart) {
      salesTrendChart.destroy();
      salesTrendChart = null;
    }
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
  }

  window.loadAnalytics = async function () {
    if (!qs("analyticsStats") || !window.db) {
      return;
    }

    try {
      const [salesSnap, productsSnap, customersSnap] = await Promise.all([
        db.collection("sales").get(),
        db.collection("products").get(),
        db.collection("customers").get()
      ]);

      let revenue = 0;
      const productCount = {};
      const customerCount = {};
      const trend = {};

      salesSnap.forEach((doc) => {
        const sale = doc.data();
        const total = Number(sale.total || sale.grandTotal || 0);
        const day = readSaleDate(sale).toLocaleDateString();
        revenue += total;
        trend[day] = (trend[day] || 0) + total;

        (sale.items || []).forEach((item) => {
          const name = item.name || item.productName || "Unknown";
          productCount[name] = (productCount[name] || 0) + Number(item.quantity || item.qty || 1);
        });

        const customer = sale.customerName || "Walk-in";
        customerCount[customer] = (customerCount[customer] || 0) + 1;
      });

      const topProduct = Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      const topCustomer = Object.entries(customerCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

      setText("totalSales", salesSnap.size);
      setText("totalRevenue", formatCurrency(revenue));
      setText("topProduct", topProduct);
      setText("topCustomer", topCustomer);
      setText("totalCustomers", customersSnap.size);

      const lowStockBody = qs("lowStockTableBody");
      if (lowStockBody) {
        const lowStockRows = productsSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((product) => Number(product.stock || 0) <= 5);
        lowStockBody.innerHTML = lowStockRows.map((product) => `
          <tr>
            <td>${product.name || "-"}</td>
            <td>${product.category || "-"}</td>
            <td>${product.stock || 0}</td>
            <td><span class="badge badge-warning">Low Stock</span></td>
          </tr>
        `).join("");
      }

      destroyCharts();

      if (window.Chart && qs("salesTrendChart")) {
        const colors = chartColors();
        const labels = Object.keys(trend).slice(-12);
        const values = labels.map((label) => trend[label]);
        salesTrendChart = new Chart(qs("salesTrendChart"), {
          type: "bar",
          data: {
            labels,
            datasets: [{
              label: "Revenue",
              data: values,
              backgroundColor: colors.line,
              borderRadius: 6,
              maxBarThickness: 42
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (context) => `Revenue: ${formatCurrency(context.raw)}`
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: colors.text },
                grid: { color: colors.grid }
              },
              x: {
                ticks: { color: colors.text, maxRotation: 0, autoSkip: true },
                grid: { display: false }
              }
            }
          }
        });
      }

      if (window.Chart && qs("categoryChart")) {
        const categoryCount = {};
        productsSnap.forEach((doc) => {
          const category = doc.data().category || "Other";
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        categoryChart = new Chart(qs("categoryChart"), {
          type: "doughnut",
          data: {
            labels: Object.keys(categoryCount),
            datasets: [{
              data: Object.values(categoryCount),
              backgroundColor: ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2"]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom" }
            }
          }
        });
      }
    } catch (error) {
      console.error("Analytics load failed:", error);
      showToast("Could not load analytics", "error");
    }
  };

  document.addEventListener("DOMContentLoaded", loadAnalytics);
})();
