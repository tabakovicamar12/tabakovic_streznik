const API_URL = '/api/v1/cart-payments';
const MATERIALS_URL = '/api/v1/materials';
const token = localStorage.getItem('token');
let materials = [];
let pendingSessionId = null;

const itemsElement = document.getElementById('cart-items');
const countElement = document.getElementById('summary-count');
const totalElement = document.getElementById('summary-total');
const checkoutButton = document.getElementById('checkout-button');
const demoBox = document.getElementById('demo-confirmation');
const demoButton = document.getElementById('confirm-demo-button');
const messageElement = document.getElementById('cart-message');

function formatPrice(value) {
    return new Intl.NumberFormat('sl-SI', {
        style: 'currency',
        currency: 'EUR'
    }).format(Number(value) || 0);
}

function showMessage(message, isError = false) {
    messageElement.hidden = false;
    messageElement.classList.toggle('error', isError);
    messageElement.textContent = message;
}

function removeMaterialsFromCart(materialIds = []) {
    if (materialIds.length === 0) return;

    const removeIds = new Set(materialIds.map(Number));
    materials = materials.filter(material => !removeIds.has(material.id));
    setCartMaterialIds(materials.map(material => material.id));
    renderCart();
}

function renderCart() {
    itemsElement.innerHTML = '';

    if (materials.length === 0) {
        itemsElement.innerHTML = '<div class="empty-state">Košarica je prazna. Izberi gradivo in ga dodaj v košarico.</div>';
    } else {
        for (const material of materials) {
            const item = document.createElement('article');
            item.className = 'cart-item';
            item.innerHTML = `
                <div>
                    <h3>${material.naziv}</h3>
                    <p>${material.predmet || 'Gradivo'}</p>
                </div>
                <div class="item-actions">
                    <strong>${formatPrice(material.cena)}</strong>
                    <button class="remove-button" data-remove-id="${material.id}" title="Odstrani iz košarice">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            itemsElement.appendChild(item);
        }
    }

    countElement.textContent = materials.length;
    totalElement.textContent = formatPrice(materials.reduce((sum, material) => sum + Number(material.cena), 0));
    checkoutButton.disabled = materials.length === 0;
}

async function loadCart() {
    const ids = getCartMaterialIds();
    const responses = await Promise.all(ids.map(id => fetch(`${MATERIALS_URL}/${id}`)));
    const payloads = await Promise.all(responses.filter(response => response.ok).map(response => response.json()));
    materials = payloads.map(payload => payload.gradivo).filter(Boolean);
    setCartMaterialIds(materials.map(material => material.id));
    renderCart();
}

itemsElement.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-id]');
    if (!button) return;

    const id = Number(button.dataset.removeId);
    materials = materials.filter(material => material.id !== id);
    setCartMaterialIds(materials.map(material => material.id));
    renderCart();
});

checkoutButton.addEventListener('click', async () => {
    if (!token) {
        showMessage('Za plačilo se najprej prijavi v aplikacijo.', true);
        return;
    }

    checkoutButton.disabled = true;
    try {
        const response = await fetch(`${API_URL}/checkout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ materialIds: materials.map(material => material.id) })
        });
        const data = await response.json();
        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
        removeMaterialsFromCart(data.odstraniIzKosarice);
        if (!response.ok) throw new Error(data.napaka || 'Plačila ni bilo mogoče pripraviti.');

        if (data.demo) {
            pendingSessionId = data.narocilo.sessionId;
            demoBox.hidden = false;
            showMessage('Demo plačilo je pripravljeno. Potrdi ga v povzetku.');
            return;
        }

        window.location.href = data.checkoutUrl;
    } catch (error) {
        showMessage(error.message, true);
        checkoutButton.disabled = false;
    }
});

demoButton.addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_URL}/verify-manual`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId: pendingSessionId })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.napaka || 'Plačila ni bilo mogoče potrditi.');

        setCartMaterialIds([]);
        materials = [];
        demoBox.hidden = true;
        showMessage('Plačilo je potrjeno. Kupljena gradiva so zdaj tvoja.');
        renderCart();
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function confirmStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'cancelled') {
        showMessage('Plačilo je bilo preklicano.', true);
        return;
    }

    const sessionId = params.get('session_id');
    if (params.get('payment') !== 'success' || !sessionId || !token) return;

    try {
        const response = await fetch(`${API_URL}/confirmation/${encodeURIComponent(sessionId)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.napaka || 'Plačila ni bilo mogoče potrditi.');

        setCartMaterialIds([]);
        materials = [];
        showMessage('Plačilo je uspešno potrjeno. Kupljena gradiva so zdaj tvoja.');
        window.history.replaceState({}, '', '/cart.html');
    } catch (error) {
        showMessage(error.message, true);
    }
}

(async function init() {
    await confirmStripeReturn();
    await loadCart();
})();
