let products = [];
let cart = {};
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
        alert("Il carrello è vuoto! Seleziona almeno un prodotto.");
        return;
    }

    const summary = `RIEPILOGO ORDINE:\n\n${orderList}\nTOTALE: ${total.toFixed(2)}€\n\nVuoi confermare e inviare l'ordine su WhatsApp?`;

    if (confirm(summary)) {
        const orderText = `Ciao! Vorrei prenotare questi prodotti:\n\n${orderList}\n*TOTALE: ${total.toFixed(2)}€*`;
        // Usiamo AppConfig.phoneNumber passata da Jekyll
        const waLink = `https://wa.me/${AppConfig.phoneNumber}?text=${encodeURIComponent(orderText)}`;
        window.location.href = waLink;
    }
}

// Inizializza l'app caricando i prodotti
document.addEventListener("DOMContentLoaded", () => {
    loadProducts();
});