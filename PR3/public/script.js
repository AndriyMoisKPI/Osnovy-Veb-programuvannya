const API_URL = '/api/contracts';
const form = document.getElementById('contractForm');
const listContainer = document.getElementById('contractsList');

document.addEventListener('DOMContentLoaded', loadContracts);

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Клієнтська валідація
    const cost = parseFloat(document.getElementById('cost').value);
    const savings = parseFloat(document.getElementById('savingsPercentage').value);

    if (cost <= 0 || savings <= 0 || savings > 100) {
        alert("Будь ласка, введіть коректні дані: вартість > 0, економія від 1 до 100%");
        return;
    }

    await saveContract();
});

async function loadContracts() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        renderContracts(data);
    } catch (err) {
        showError("Не вдалося завантажити дані");
    }
}

async function saveContract() {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = "Збереження...";

    const payload = {
        number: document.getElementById('number').value.trim(),
        customer: document.getElementById('customer').value.trim(),
        targetObject: document.getElementById('targetObject').value.trim(),
        cost: Number(document.getElementById('cost').value),
        savingsPercentage: Number(document.getElementById('savingsPercentage').value),
        durationMonths: Number(document.getElementById('durationMonths').value)
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            form.reset();
            await loadContracts();
        } else {
            const errorData = await response.json();
            alert(`Помилка: ${errorData.error}`);
        }
    } catch (err) {
        showError("Помилка зв'язку з сервером");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Додати до реєстру";
    }
}

async function deleteContract(id) {
    if (!confirm("Ви впевнені, що хочете видалити цей контракт?")) return;

    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (response.ok) await loadContracts();
    } catch (err) {
        showError("Не вдалося видалити запис");
    }
}

function renderContracts(contracts) {
    listContainer.innerHTML = contracts.length === 0
        ? '<p style="color: #64748b; text-align: center;">Реєстр порожній</p>'
        : '';

    contracts.forEach(c => {
        const card = document.createElement('div');
        card.className = 'contract-card';
        card.innerHTML = `
            <div>
                <div class="info-header">№ ${c.number} — ${c.customer}</div>
                <div class="info-details">
                    Об'єкт: ${c.targetObject} <br>
                    Бюджет: <strong>${c.cost.toLocaleString()} грн</strong> | 
                    Очікувана економія: <strong>${c.savingsPercentage}%</strong> <br>
                    Період окупності: ${c.durationMonths} міс.
                </div>
            </div>
            <button class="btn-delete" onclick="deleteContract('${c.id}')">Видалити</button>
        `;
        listContainer.appendChild(card);
    });
}

function showError(msg) {
    console.error(msg);
    alert(msg);
}
