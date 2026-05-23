(function () {
  function qs(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = qs(id);
    if (el) {
      el.textContent = value;
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
        const created = sale.createdAt && sale.createdAt.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
        const day = created.toLocaleDateString();
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
            <td>${formatCurrency(product.price)}</td>
          </tr>
        `).join("");
      }

      if (window.Chart && qs("salesTrendChart")) {
        new Chart(qs("salesTrendChart"), {
          type: "line",
          data: {
            labels: Object.keys(trend),
            datasets: [{ label: "Revenue", data: Object.values(trend), borderColor: "#2563eb", tension: 0.3 }]
          }
        });
      }

      if (window.Chart && qs("categoryChart")) {
        const categoryCount = {};
        productsSnap.forEach((doc) => {
          const category = doc.data().category || "Other";
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        new Chart(qs("categoryChart"), {
          type: "doughnut",
          data: {
            labels: Object.keys(categoryCount),
            datasets: [{ data: Object.values(categoryCount) }]
          }
        });
      }

      setText("totalCustomers", customersSnap.size);
    } catch (error) {
      console.error("Analytics load failed:", error);
      showToast("Could not load analytics", "error");
    }
  };

  document.addEventListener("DOMContentLoaded", loadAnalytics);
})();
