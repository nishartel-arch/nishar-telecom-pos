(function () {
  let sales = [];
  let currentPage = 1;
  const pageSize = 10;

  function qs(id) {
    return document.getElementById(id);
  }

  function saleDate(sale) {
    return sale.createdAt && sale.createdAt.toDate ? sale.createdAt.toDate() : new Date(sale.createdAt || Date.now());
  }

  function filteredSales() {
    const term = (qs("searchInput")?.value || "").toLowerCase();
    const dateFilter = qs("filterDate")?.value;

    return sales.filter((sale) => {
      const haystack = `${sale.invoiceNo || sale.id} ${sale.customerName || "Walk-in"}`.toLowerCase();
      const dateOk = !dateFilter || saleDate(sale).toISOString().slice(0, 10) === dateFilter;
      return haystack.includes(term) && dateOk;
    });
  }

  function renderSales() {
    const tbody = qs("salesTableBody");
    if (!tbody) {
      return;
    }

    const rows = filteredSales();
    const start = (currentPage - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    tbody.innerHTML = pageRows.map((sale) => {
      const date = saleDate(sale);
      return `
        <tr>
          <td>${sale.invoiceNo || sale.id.slice(0, 8)}</td>
          <td>${sale.customerName || "Walk-in"}</td>
          <td>${(sale.items || []).length}</td>
          <td>${formatCurrency(sale.total || sale.grandTotal)}</td>
          <td>${sale.paymentMethod || "-"}</td>
          <td>${date.toLocaleString()}</td>
        </tr>
      `;
    }).join("");

    const showingText = qs("showingText");
    if (showingText) {
      showingText.textContent = `Showing ${pageRows.length} of ${rows.length} sales`;
    }

    const prevBtn = qs("prevPageBtn");
    const nextBtn = qs("nextPageBtn");
    if (prevBtn) {
      prevBtn.disabled = currentPage === 1;
    }
    if (nextBtn) {
      nextBtn.disabled = start + pageSize >= rows.length;
    }
  }

  window.loadSales = async function () {
    const tbody = qs("salesTableBody");
    if (!tbody || !window.db) {
      return;
    }

    try {
      const snapshot = await db.collection("sales").orderBy("createdAt", "desc").get();
      sales = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      currentPage = 1;
      renderSales();
    } catch (error) {
      console.error("Sales load failed:", error);
      showToast("Could not load sales", "error");
    }
  };

  function initSalesPage() {
    if (!qs("salesTableBody")) {
      return;
    }

    qs("searchInput")?.addEventListener("input", () => {
      currentPage = 1;
      renderSales();
    });
    qs("filterDate")?.addEventListener("change", () => {
      currentPage = 1;
      renderSales();
    });
    qs("prevPageBtn")?.addEventListener("click", () => {
      currentPage = Math.max(1, currentPage - 1);
      renderSales();
    });
    qs("nextPageBtn")?.addEventListener("click", () => {
      currentPage += 1;
      renderSales();
    });
    qs("exportBtn")?.addEventListener("click", () => {
      const csv = ["Invoice,Customer,Items,Total,Payment,Date"].concat(filteredSales().map((sale) => {
        const date = saleDate(sale).toLocaleString();
        return `"${sale.invoiceNo || sale.id}","${sale.customerName || "Walk-in"}","${(sale.items || []).length}","${sale.total || sale.grandTotal || 0}","${sale.paymentMethod || ""}","${date}"`;
      })).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "sales.csv";
      link.click();
      URL.revokeObjectURL(link.href);
    });

    loadSales();
  }

  document.addEventListener("DOMContentLoaded", initSalesPage);
})();
