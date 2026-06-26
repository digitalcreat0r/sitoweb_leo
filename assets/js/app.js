let products = [];
let cart = {};
let currentOrderText = "";
let initialLimit = 0;
let isExpanded = false; // Traccia se l'utente ha visualizzato tutto
let pressTimer;
let pressInterval;
let lastClickTime = 0;
let rapidClickCount = 0;
let lastTarget = null;

function getGridColumns() {
    const container = document.getElementById('product-list');
    const width = container ? container.offsetWidth : window.innerWidth;
    const cols = Math.floor((width + 15) / (160 + 15));
    return Math.max(1, cols);
}

async function loadProducts() {
    const cachedData = localStorage.getItem('la_mezza_luna_products');
    const cachedTime = localStorage.getItem('la_mezza_luna_products_time');
    const now = Date.now();

    if (cachedData && cachedTime) {
        try {
            products = JSON.parse(cachedData);
            renderProductGrid();
            
            // Se la cache è più recente di 5 minuti, non facciamo richieste di rete aggiuntive
            if (now - parseInt(cachedTime) < 5 * 60 * 1000) {
                console.log("Prodotti caricati da cache locale fresca.");
                return;
            }
            
            console.log("Cache locale scaduta. Avvio aggiornamento prodotti in background...");
            fetchProducts(true);
            return;
        } catch (e) {
            console.error("Errore nel parsing della cache dei prodotti, la rimuovo:", e);
            localStorage.removeItem('la_mezza_luna_products');
            localStorage.removeItem('la_mezza_luna_products_time');
        }
    }

    // Se non c'è cache o è stata rimossa per errore, fa un fetch bloccante iniziale
    await fetchProducts(false);
}

async function fetchProducts(isBackground = false) {
    try {
        const response = await fetch(AppConfig.sheetUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.text();
        const rows = data.split('\n').slice(1);

        const parsedProducts = [];
        rows.forEach((row, index) => {
            const cols = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if (cols.length < 3) return;

            const p = {
                id: index,
                name: (cols[0] || "").replace(/"/g, '').trim(),
                price: parseFloat(cols[2]),
                unit: (cols[3] || "").trim(),
                available: (cols[4] || "").trim().toUpperCase() === 'SÌ' || (cols[4] || "").trim().toUpperCase() === 'SI',
                img: cols[5] ? cols[5].trim() : 'https://via.placeholder.com/150?text=Verdura'
            };

            if (p.available) parsedProducts.push(p);
        });

        // Controlla se i dati del catalogo sono effettivamente cambiati
        const productsChanged = JSON.stringify(products) !== JSON.stringify(parsedProducts);

        if (productsChanged) {
            // Se l'utente ha oggetti nel carrello, rimappiamoli sui nuovi ID (basandoci sul nome del prodotto)
            const hasCartItems = Object.values(cart).some(q => q > 0);
            if (hasCartItems && products.length > 0) {
                const newCart = {};
                parsedProducts.forEach(newP => {
                    const oldP = products.find(op => op.name === newP.name);
                    if (oldP && cart[oldP.id] !== undefined) {
                        newCart[newP.id] = cart[oldP.id];
                    }
                });
                cart = newCart;
            }

            products = parsedProducts;
            renderProductGrid();
            updateTotal();
            console.log("Catalogo prodotti aggiornato con nuovi dati da Google Sheets.");
        } else {
            console.log("Nessuna modifica rilevata nel catalogo prodotti.");
        }

        // Salva sempre i dati aggiornati nella cache locale
        localStorage.setItem('la_mezza_luna_products', JSON.stringify(parsedProducts));
        localStorage.setItem('la_mezza_luna_products_time', Date.now().toString());

    } catch (error) {
        console.error("Errore durante il fetch dei prodotti:", error);
        
        // Se il fetch fallisce e non abbiamo nessun prodotto caricato (nemmeno da cache), mostra l'errore a schermo
        if (!isBackground && products.length === 0) {
            const container = document.getElementById('product-list');
            if (container) {
                container.innerHTML = '<p class="error-msg" style="grid-column: 1 / -1; text-align: center; color: #d62828; padding: 20px;">Errore nel caricamento dei prodotti. Controlla la connessione e riprova più tardi.</p>';
            }
        }
    }
}

function renderProductGrid() {
    if (products.length === 0) return;

    const container = document.getElementById('product-list');
    
    if (isExpanded) {
        container.innerHTML = products.map(p => renderProductCard(p)).join('');
        const btnShowAll = document.getElementById('btn-show-all');
        if (btnShowAll) btnShowAll.style.display = 'none';
        return;
    }

    const cols = getGridColumns();
    
    if (cols === 1) {
        initialLimit = 3;
    } else {
        const fullRowsPossible = Math.floor(products.length / cols);
        
        if (fullRowsPossible >= 2) {
            initialLimit = cols * 2;
        } else if (fullRowsPossible === 1) {
            initialLimit = cols;
        } else {
            initialLimit = products.length;
        }
    }

    const initialProducts = products.slice(0, initialLimit);
    container.innerHTML = initialProducts.map(p => renderProductCard(p)).join('');

    const btnShowAll = document.getElementById('btn-show-all');
    if (btnShowAll) {
        btnShowAll.style.display = (products.length > initialLimit) ? 'block' : 'none';
    }
}

function showAllProducts() {
    isExpanded = true;
    const container = document.getElementById('product-list');
    const remainingProducts = products.slice(initialLimit);
    
    container.insertAdjacentHTML('beforeend', remainingProducts.map(p => renderProductCard(p)).join(''));
    
    document.getElementById('btn-show-all').style.display = 'none';
}


function renderProductCard(p) {
    const qty = cart[p.id] || 0;
    const displayQty = (qty % 1 === 0) ? qty : qty.toFixed(1);
    return `
        <div class="card">
            <img src="${p.img}" alt="${p.name}" loading="lazy">
            <h3>${p.name}</h3>
            <div class="price">${p.price.toFixed(2)}€ / ${p.unit}</div>
            <div class="controls">
                <button class="btn-qty" 
                    onpointerdown="startChange(${p.id}, -1)" 
                    onpointerup="stopChange()" 
                    onpointerleave="stopChange()"
                    oncontextmenu="event.preventDefault()">-</button>
                <span id="qty-${p.id}">${displayQty}</span>
                <button class="btn-qty" 
                    onpointerdown="startChange(${p.id}, 1)" 
                    onpointerup="stopChange()" 
                    onpointerleave="stopChange()"
                    oncontextmenu="event.preventDefault()">+</button>
            </div>
        </div>
    `;
}

function startChange(id, direction) {
    const now = Date.now();
    const currentTarget = `${id}-${direction}`;
    
    if (now - lastClickTime < 300 && lastTarget === currentTarget) {
        rapidClickCount++;
    } else {
        rapidClickCount = 0;
    }

    lastClickTime = now;
    lastTarget = currentTarget;

    const step = (rapidClickCount >= 3) ? 0.5 : 0.1;
    applyChange(id, direction * step);

    stopChange();
    pressTimer = setTimeout(() => {
        pressInterval = setInterval(() => {
            applyChange(id, direction * 0.5);
        }, 150);
    }, 500);
}

function stopChange() {
    clearTimeout(pressTimer);
    clearInterval(pressInterval);
}

function applyChange(id, delta) {
    if (!cart[id]) cart[id] = 0;
    let newQty = parseFloat((cart[id] + delta).toFixed(1));
    if (newQty < 0) newQty = 0;
    cart[id] = newQty;
    
    const qtyElement = document.getElementById(`qty-${id}`);
    if (qtyElement) {
        qtyElement.innerText = (newQty % 1 === 0) ? newQty : newQty.toFixed(1);
    }
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
                    <label class="address-label" for="delivery-address">Indirizzo di consegna:</label>
                    <textarea id="delivery-address" class="address-input" rows="2" placeholder="Via, numero civico, città..."></textarea>
                    
                    <label class="address-label" for="order-notes" style="margin-top: 10px;">Note aggiuntive (opzionale):</label>
                    <textarea id="order-notes" class="address-input" rows="2"></textarea>
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
        <div id="cookie-banner" class="cookie-banner">
            <p>Questo sito utilizza solo cookie tecnici e strumenti funzionali per gestire l'ordine. 
               Utilizzando il sito, accetti la nostra <a href="cookie-policy.html">Cookie Policy</a>.</p>
            <button class="btn-send" style="padding: 10px; font-size: 0.9rem;" onclick="acceptCookies()">Ho capito</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    if (!localStorage.getItem('cookie-consent')) {
        document.getElementById('cookie-banner').style.display = 'flex';
    }
}

function acceptCookies() {
    localStorage.setItem('cookie-consent', 'true');
    document.getElementById('cookie-banner').style.display = 'none';
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
    document.getElementById('order-notes').value = '';
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

    currentOrderText = `Ciao! Vorrei prenotare questi prodotti:\n\n${orderList.trim()}\n\n*TOTALE: ${total.toFixed(2)}€*`;
    
    document.getElementById('modal-order-details').innerText = orderList;
    document.getElementById('modal-order-total').innerText = `${total.toFixed(2)}€`;
    
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

    const addressInput = document.getElementById('delivery-address');
    
    if (!addressInput.value) {
        const savedAddress = localStorage.getItem('deliveryAddress');
        if (savedAddress) addressInput.value = savedAddress;
    }

    addressInput.focus();
}

function prepareWAMessage(event) {
    const address = document.getElementById('delivery-address').value.trim();
    const notes = document.getElementById('order-notes').value.trim();
    if (!address) {
        event.preventDefault();
        showWarning("<span style='display: block; font-weight: bold; font-size: 1.3rem; margin-bottom: 10px; color: var(--dark);'>Indirizzo mancante</span>Inserisci l'indirizzo di consegna per procedere. Il tuo browser lo dovrebbe ricordare per i tuoi prossimi ordini!");
        return;
    }

    localStorage.setItem('deliveryAddress', address);

    let finalMessage = `${currentOrderText.trim()}\n\n*Indirizzo di consegna:*\n${address}`;
    
    if (notes) {
        finalMessage += `\n\n*Note:*\n${notes}`;
    }

    const waLink = `https://wa.me/${AppConfig.phoneNumber}?text=${encodeURIComponent(finalMessage)}`;
    
    event.preventDefault();
    window.open(waLink, '_blank');

    executeResetCart();
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

document.addEventListener("DOMContentLoaded", () => {
    initModal();
    loadProducts();
});

// Gestisce la rotazione del telefono o il ridimensionamento finestra PC
window.addEventListener('resize', () => {
    // Usiamo un piccolo timeout per evitare troppi calcoli durante il ridimensionamento fluido su PC
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(renderProductGrid, 100);
});