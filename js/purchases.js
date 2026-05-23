(function () {
  let products = [];
  let purchases = [];

  function qs(id) {
    return document.getElementById(id);
  }

  async function loadPurchaseProducts() {
    const select = qs("purchaseProduct");
    if (!select || !window.db) {
      return;
    }

    const snapshot = await db.collection("products").orderBy("name").get();
    products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    select.innerHTML = '<option value="">Select product...</option>' + products.map((product) =>
      `<option value="${product.id}">${product.name || "Unnamed product"}</option>`
    ).join("");
  }

  function renderPurchases(rows = purchases) {
    const tbody = qs("purchasesTableBody");
    const emptyState = qs("emptyState");
    if (!tbody) {
      return;
    }

    tbody.innerHTML = rows.map((purchase) => {
      const date = purchase.purchaseDate && purchase.purchaseDate.toDate
        ? purchase.purchaseDate.toDate()
        : new Date(purchase.purchaseDate || purchase.createdAt || Date.now());
      return `
        <tr>
          <td>${purchase.productName || "-"}</td>
          <td>${purchase.supplier || "-"}</td>
          <td>${purchase.quantity || 0}</td>
          <td>${formatCurrency(purchase.unitPrice)}</td>
          <td>${formatCurrency(purchase.total)}</td>
          <td>${date.toLocaleDateString()}</td>
        </tr>
      `;
    }).join("");

    if (emptyState) {
      emptyState.style.display = rows.length ? "none" : "block";
    }
  }

  window.loadPurchases = async function () {
    const tbody = qs("purchasesTableBody");
    if (!tbody || !window.db) {
      return;
    }

    try {
      const snapshot = await db.collection("purchases").orderBy("createdAt", "desc").get();
      purchases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderPurchases();
    } catch (error) {
      console.error("Purchase load failed:", error);
      showToast("Could not load purchases", "error");
    }
  };

  function initPurchasesPage() {
    const form = qs("purchaseForm");
    if (!form) {
      return;
    }

    const openBtn = qs("addPurchaseBtn");
    const modal = qs("purchaseModal");
    if (openBtn && modal) {
      openBtn.addEventListener("click", () => {
        form.reset();
        qs("purchaseId").value = "";
        qs("purchaseDate").valueAsDate = new Date();
        modal.style.display = "flex";
        loadPurchaseProducts();
      });
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const productId = qs("purchaseProduct").value;
      const product = products.find((item) => item.id === productId);
      const quantity = Number(qs("purchaseQuantity").value || 0);
      const unitPrice = Number(qs("purchaseUnitPrice").value || 0);
      const total = quantity * unitPrice;

      if (!product) {
        showToast("Please select a product", "error");
        return;
      }

      try {
        const batch = db.batch();
        const purchaseRef = db.collection("purchases").doc();
        const productRef = db.collection("products").doc(productId);

        batch.set(purchaseRef, {
          productId,
          productName: product.name || "",
          supplier: qs("purchaseSupplier").value.trim(),
          quantity,
          unitPrice,
          total,
          purchaseDate: qs("purchaseDate").value || new Date().toISOString().slice(0, 10),
          notes: qs("purchaseNotes").value.trim(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.update(productRef, {
          stock: firebase.firestore.FieldValue.increment(quantity)
        });

        await batch.commit();
        showToast("Purchase saved");
        modal.style.display = "none";
        loadPurchases();
      } catch (error) {
        console.error("Purchase save failed:", error);
        showToast(error.message, "error");
      }
    });

    loadPurchaseProducts();
    loadPurchases();
  }

  document.addEventListener("DOMContentLoaded", initPurchasesPage);
})();
