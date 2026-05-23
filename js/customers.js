(function () {
  let customers = [];

  function qs(id) {
    return document.getElementById(id);
  }

  function renderCustomers(rows = customers) {
    const tbody = qs("customersTableBody");
    const emptyState = qs("emptyState");
    if (!tbody) {
      return;
    }

    tbody.innerHTML = rows.map((customer) => `
      <tr>
        <td>${customer.name || "-"}</td>
        <td>${customer.phone || "-"}</td>
        <td>${customer.email || "-"}</td>
        <td>${customer.address || "-"}</td>
        <td>
          <button class="btn btn-secondary" onclick="editCustomer('${customer.id}')">Edit</button>
          <button class="btn btn-ghost" onclick="deleteCustomer('${customer.id}')">Delete</button>
        </td>
      </tr>
    `).join("");

    if (emptyState) {
      emptyState.style.display = rows.length ? "none" : "block";
    }
  }

  window.loadCustomers = async function () {
    const tbody = qs("customersTableBody");
    if (!tbody || !window.db) {
      return;
    }

    try {
      const snapshot = await db.collection("customers").orderBy("name").get();
      customers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      renderCustomers();
    } catch (error) {
      console.error("Customer load failed:", error);
      showToast("Could not load customers", "error");
    }
  };

  window.editCustomer = function (id) {
    const customer = customers.find((item) => item.id === id);
    if (!customer) {
      return;
    }

    qs("modalTitle").textContent = "Edit Customer";
    qs("customerId").value = customer.id;
    qs("customerName").value = customer.name || "";
    qs("customerPhone").value = customer.phone || "";
    qs("customerEmail").value = customer.email || "";
    qs("customerAddress").value = customer.address || "";
    qs("customerNotes").value = customer.notes || "";
    qs("customerModal").style.display = "flex";
  };

  window.deleteCustomer = async function (id) {
    if (!confirm("Delete this customer?")) {
      return;
    }

    try {
      await db.collection("customers").doc(id).delete();
      showToast("Customer deleted");
      loadCustomers();
    } catch (error) {
      console.error("Customer delete failed:", error);
      showToast("Could not delete customer", "error");
    }
  };

  function initCustomersPage() {
    const form = qs("customerForm");
    if (!form) {
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = qs("customerId").value;
      const customer = {
        name: qs("customerName").value.trim(),
        phone: qs("customerPhone").value.trim(),
        email: qs("customerEmail").value.trim(),
        address: qs("customerAddress").value.trim(),
        notes: qs("customerNotes").value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        if (id) {
          await db.collection("customers").doc(id).update(customer);
          showToast("Customer updated");
        } else {
          await db.collection("customers").add({
            ...customer,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("Customer added");
        }

        form.reset();
        qs("customerId").value = "";
        qs("customerModal").style.display = "none";
        loadCustomers();
      } catch (error) {
        console.error("Customer save failed:", error);
        showToast(error.message, "error");
      }
    });

    const searchInput = qs("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.toLowerCase();
        renderCustomers(customers.filter((customer) =>
          `${customer.name || ""} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase().includes(term)
        ));
      });
    }

    loadCustomers();
  }

  document.addEventListener("DOMContentLoaded", initCustomersPage);
})();
