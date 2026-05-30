(function () {
    const STORAGE_KEY = 'studyhub_cart';

    function readCart() {
        try {
            const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
        } catch {
            return [];
        }
    }

    function writeCart(ids) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(ids)]));
        updateCartBadge();
    }

    function updateCartBadge() {
        const badge = document.getElementById('cart-count');
        if (badge) badge.textContent = readCart().length;
    }

    window.getCartMaterialIds = readCart;
    window.setCartMaterialIds = writeCart;
    window.addMaterialToCart = function (materialId) {
        const ids = readCart();
        const id = Number(materialId);

        if (!Number.isInteger(id)) return;
        if (!ids.includes(id)) {
            ids.push(id);
            writeCart(ids);
        }

        if (typeof showCustomNotification === 'function') {
            showCustomNotification('Gradivo je dodano v kosarico.', 'success');
        }
    };

    document.addEventListener('DOMContentLoaded', updateCartBadge);
    window.addEventListener('storage', updateCartBadge);
})();
