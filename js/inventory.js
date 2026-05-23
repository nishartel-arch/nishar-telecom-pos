(function () {
  let products = [];

  function qs(id) {
    return document.getElementById(id);
  }

  function productFromForm() {
    return {
      name: qs("productName").value.trim(),
      category: qs("productCategory").value,
      brand: qs("productBrand").value.trim(),
      model: qs("productModel").value.trim(),
      price: Number(qs("productPrice").value || 0),
      stock: Number(qs("productStock").value || 0),
      description: qs("productDescription").value.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
  }

  function renderProducts(rows = products) {
    const tbody = qs("productsTableBody");
    const emptyState = qs("emptyState");
    if (!tbody) {
      return;
    }

    tbody.innerHTML = rows.map((product) => `
      <tr>
        <td>${product.name || "-"}</td>
        <td>${product.category || "-"}</td>
        <td>${product.brand || "-"}</td>
        <td>${formatCurrency(product.price)}</td>
        <td>${product.stock || 0}</td>
        <td>
          <button class="btn btn-secondary" onclick="editProduct('${product.id}')">Edit</button>
          <button class="btn btn-ghost" onclick="deleteProduct('${product.id}')">Delete</button>
        </td>
      </tr>
    `).join("");

    if (emptyState) {
      emptyState.style.display = rows.length ? "none" : "block";
    }
  }

  window.loadProducts = async function () {
    const tbody = qs("productsTableBody");
    if (!tbody || !window.db) {
      return;
    }

    try {
      const snapshot = await db.collection("products").orderBy("name").get();
      products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderProducts();
    } catch (error) {
      console.error("Product load failed:", error);
      showToast("Could not load products", "error");
    }
  };

  window.editProduct = function (id) {
    const product = products.find((item) => item.id === id);
    if (!product) {
      return;
    }

    qs("modalTitle").textContent = "Edit Product";
    qs("productId").value = product.id;
    qs("productName").value = product.name || "";
    qs("productCategory").value = product.category || "Mobile Phones";
    qs("productBrand").value = product.brand || "";
    qs("productModel").value = product.model || "";
    qs("productPrice").value = product.price || 0;
    qs("productStock").value = product.stock || 0;
    qs("productDescription").value = product.description || "";
    qs("productModal").style.display = "flex";
  };

  window.deleteProduct = async function (id) {
    if (!confirm("Delete this product?")) {
      return;
    }

    try {
      await db.collection("products").doc(id).delete();
      showToast("Product deleted");
      loadProducts();
    } catch (error) {
      console.error("Product delete failed:", error);
      showToast("Could not delete product", "error");
    }
  };

  function initInventoryPage() {
    const form = qs("productForm");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const product = productFromForm();
      const id = qs("productId").value;

      try {
        if (id) {
          await db.collection("products").doc(id).update(product);
          showToast("Product updated");
        } else {
          await db.collection("products").add({
            ...product,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("Product added");
        }

        form.reset();
        qs("productId").value = "";
        qs("productModal").style.display = "none";
        loadProducts();
      } catch (error) {
        console.error("Product save failed:", error);
        showToast(error.message, "error");
      }
    });

    const searchInput = qs("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.toLowerCase();
        renderProducts(products.filter((product) =>
          `${product.name || ""} ${product.brand || ""} ${product.model || ""}`.toLowerCase().includes(term)
        ));
      });
    }

    loadProducts();
  }

  document.addEventListener("DOMContentLoaded", initInventoryPage);
})();
