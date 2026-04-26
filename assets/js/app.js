let products = [];
let cart = {};
let currentOrderText = "";
const LIMIT_HOME_PRODUCTS = window.innerWidth >= 768 ? 8 : 3;

async function loadProducts() {
    try {
        const response = await fetch(AppConfig.sheetUrl);
        const data = await response.text();
        const rows = data.split('\n').slice(1);

        const container = document.getElementById('product-list');
        container.innerHTML = '';

        // 1. Elabora tutti i dati e popola l'array products
        rows.forEach((row, index) => {
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols.length < 3) return;

            const p = {
                id: index,
                name: (cols[0] || "").replace(/"/g, '').trim(),
                price: parseFloat(cols[2]),
                unit: (cols[3] || "").trim(),
                available: (cols[4] || "").trim().toUpperCase() === 'SÌ',
                img: cols[5] ? cols[5].trim() : 'https://via.placeholder.com/150?text=Verdura'
            };

            if (p.available) products.push(p);
        });

        // 2. Renderizza solo il primo blocco di prodotti
        const initialProducts = products.slice(0, LIMIT_HOME_PRODUCTS);
        container.innerHTML = initialProducts.map(p => renderProductCard(p)).join('');

        // Mostra il pulsante "Mostra tutti" se ci sono più prodotti del limite
        if (products.length > LIMIT_HOME_PRODUCTS) {
            document.getElementById('btn-show-all').style.display = 'block';
        }

    } catch (error) {
        console.error("Errore caricamento:", error);
        document.getElementById('product-list').innerHTML = "Errore nel caricamento dei prodotti. Riprova più tardi.";
    }
}

function renderProductCard(p) {
    // Nota: loading="lazy" ottimizza il caricamento delle immagini
    return `
        <div class="card">
            <img src="${p.img}" alt="${p.name}" loading="lazy">
            <h3>${p.name}</h3>
            <div class="price">${p.price.toFixed(2)}€ / ${p.unit}</div>
            <div class="controls">
                <button class="btn-qty" onclick="changeQty(${p.id}, -1)">-</button>
                <span id="qty-${p.id}">0</span>
                <button class="btn-qty" onclick="changeQty(${p.id}, 1)">+</button>
            </div>
        </div>
    `;
}

function showAllProducts() {
    const container = document.getElementById('product-list');
    const remainingProducts = products.slice(LIMIT_HOME_PRODUCTS);
    
    // Aggiunge al DOM solo i prodotti mancanti
    container.insertAdjacentHTML('beforeend', remainingProducts.map(p => renderProductCard(p)).join(''));
    
    document.getElementById('btn-show-all').style.display = 'none';
}

function changeQty(id, delta) {
    if (!cart[id]) cart[id] = 0;
    cart[id] += delta;
    if (cart[id] < 0) cart[id] = 0;
    
    document.getElementById(`qty-${id}`).innerText = cart[id];
    updateTotal();
}

function updateTotal() {
    let total = 0;
    products.forEach(p => {
        if (cart[p.id]) total += p.price * cart[p.id];
    });
    document.getElementById('total-display').innerText = `Totale: ${total.toFixed(2)} €`;
}

function initModal() {
    const modalHtml = `
        <div id="order-modal" class="modal-overlay">
            <div class="modal-content">
                <h2>Riepilogo Ordine</h2>
                <div id="summary-step">
                    <div id="modal-order-details" class="order-summary-box"></div>
                    <div style="font-size: 1.3rem; font-weight: bold; margin-bottom: 20px; text-align: center; color: var(--primary);">
                        Totale: <span id="modal-order-total"></span>
                    </div>
                </div>
                <div id="address-step" style="display: none; margin-bottom: 15px;">
                    <label class="address-label" for="delivery-address">Inserisci l'indirizzo di consegna:</label>
                    <textarea id="delivery-address" class="address-input" rows="3" placeholder="Via, numero civico, città..."></textarea>
                    <p style="font-size: 0.8rem; color: #666; margin-top: 5px; text-align: left; line-height: 1.2;">
                        💡 L'indirizzo verrà salvato solo sul tuo browser per velocizzare i prossimi ordini.
                    </p>
                </div>
                <div class="modal-actions">
                    <div class="modal-row">
                        <button class="btn-cancel" onclick="resetCart()">Annulla</button>
                        <button id="btn-modify" class="btn-cancel" onclick="closeModal()">Modifica</button>
                    </div>
                    <button id="btn-proceed" class="btn-send" onclick="showAddressStep()" style="display: block; width: 100%;">Prosegui</button>
                    <a id="wa-send-btn" class="btn-send" target="_blank" rel="noopener noreferrer" style="display: none; text-align: center;" onclick="prepareWAMessage(event)">Invia su WhatsApp</a>
                </div>
            </div>
        </div>
        <div id="confirm-modal" class="modal-overlay">
            <div class="modal-content">
                <div style="text-align: center; font-size: 1.1rem; padding: 20px 0; color: #444; line-height: 1.5;">
                    Sei sicuro di voler annullare?<br><strong>Il carrello verrà svuotato.</strong>
                </div>
                <div class="modal-actions">
                    <div class="modal-row">
                        <button class="btn-cancel" onclick="closeConfirmModal()">No, rimani</button>
                        <button class="btn-send" style="background-color: #d62828;" onclick="executeResetCart()">Sì, svuota</button>
                    </div>
                </div>
            </div>
        </div>
        <div id="warning-modal" class="modal-overlay">
            <div class="modal-content">
                <div id="warning-message" style="text-align: center; font-size: 1.1rem; padding: 20px 0; color: #444; line-height: 1.5;"></div>
                <div class="modal-actions">
                    <button class="btn-send" style="background-color: var(--primary);" onclick="closeWarningModal()">OK</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function resetCart() {
    document.getElementById('confirm-modal').style.display = 'flex';
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').style.display = 'none';
}

function executeResetCart() {
    cart = {};
    products.forEach(p => {
        const qtyElement = document.getElementById(`qty-${p.id}`);
        if (qtyElement) qtyElement.innerText = '0';
    });
    document.getElementById('delivery-address').value = '';
    updateTotal();
    closeConfirmModal();
    closeModal();
}

function confirmAndSend() {
    let orderList = "";
    let total = 0;
    let hasItems = false;

    products.forEach(p => {
        if (cart[p.id] > 0) {
            const subtotal = p.price * cart[p.id];
            orderList += `- ${p.name}: ${cart[p.id]} ${p.unit} (${subtotal.toFixed(2)}€)\n`;
            total += subtotal;
            hasItems = true;
        }
    });

    if (!hasItems) {
        showWarning("<span style='display: block; font-weight: bold; font-size: 1.3rem; margin-bottom: 10px; color: var(--dark);'>Il tuo carrello è vuoto!</span>Seleziona almeno un prodotto prima di procedere con la prenotazione.");
        return;
    }

    currentOrderText = `Ciao! Vorrei prenotare questi prodotti:\n\n${orderList}\n*TOTALE: ${total.toFixed(2)}€*`;
    
    document.getElementById('modal-order-details').innerText = orderList;
    document.getElementById('modal-order-total').innerText = `${total.toFixed(2)}€`;
    
    // Reset vista modale allo step 1
    document.getElementById('summary-step').style.display = 'block';
    document.getElementById('address-step').style.display = 'none';
    document.getElementById('btn-proceed').style.display = 'block';
    document.getElementById('btn-modify').style.display = 'block';
    document.getElementById('wa-send-btn').style.display = 'none';

    document.getElementById('order-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Blocca lo scroll dello sfondo
}

function showAddressStep() {
    document.getElementById('summary-step').style.display = 'none';
    document.getElementById('address-step').style.display = 'block';
    document.getElementById('btn-proceed').style.display = 'none';
    document.getElementById('btn-modify').style.display = 'none';
    document.getElementById('wa-send-btn').style.display = 'block';

    const savedAddress = localStorage.getItem('deliveryAddress');
    const addressInput = document.getElementById('delivery-address');
    if (!addressInput.value && savedAddress) {
        addressInput.value = savedAddress;
    }

    addressInput.focus();
}

function prepareWAMessage(event) {
    const address = document.getElementById('delivery-address').value.trim();
    if (!address) {
        event.preventDefault();
        showWarning("<span style='display: block; font-weight: bold; font-size: 1.3rem; margin-bottom: 10px; color: var(--dark);'>Indirizzo mancante</span>Inserisci l'indirizzo di consegna per procedere. Lo ricorderemo per i tuoi prossimi ordini!");
        return;
    }

    // Salva l'indirizzo localmente per i prossimi ordini
    localStorage.setItem('deliveryAddress', address);

    const finalMessage = `${currentOrderText}\n\n📍 *Indirizzo di consegna:*\n${address}`;
    const waLink = `https://wa.me/${AppConfig.phoneNumber}?text=${encodeURIComponent(finalMessage)}`;
    document.getElementById('wa-send-btn').href = waLink;
}

function closeModal() {
    document.getElementById('order-modal').style.display = 'none';
    document.body.style.overflow = ''; // Ripristina lo scroll
}

function showWarning(message) {
    document.getElementById('warning-message').innerHTML = message;
    document.getElementById('warning-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeWarningModal() {
    document.getElementById('warning-modal').style.display = 'none';
    document.body.style.overflow = '';
}

// Inizializza l'app caricando i prodotti
document.addEventListener("DOMContentLoaded", () => {
    initModal();
    loadProducts();
});