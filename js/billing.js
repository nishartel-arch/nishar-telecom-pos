(function () {
  window.loadBillingProducts = window.loadBillingProducts || async function () {
    if (!window.db) {
      return [];
    }

    const snapshot = await db.collection("products").orderBy("name").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  };
})();
