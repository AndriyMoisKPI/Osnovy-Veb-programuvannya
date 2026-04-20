// =======================
// Стан
// =======================
const state = {
    currentPage: 1,
    limit: 5,
    totalPages: 1,
    search: "",
    filters: { voltage: "", position: "" },
    sortBy: "",
    sortOrder: "asc"
};

// =======================
// DOM
// =======================
const container = document.getElementById('cardsContainer');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// =======================
// Query builder
// =======================
function buildQuery() {
    const params = new URLSearchParams();

    params.append('page', state.currentPage);
    params.append('limit', state.limit);

    if (state.search) params.append('search', state.search);

    if (state.sortBy) {
        params.append('sortBy', state.sortBy);
        params.append('sortOrder', state.sortOrder);
    }

    Object.entries(state.filters).forEach(([k, v]) => {
        if (v) params.append(k, v);
    });

    return params.toString();
}

// =======================
// Fetch
// =======================
async function fetchBreakers() {
    try {
        const res = await fetch(`/api/circuit-breakers?${buildQuery()}`);

        if (!res.ok) throw new Error();

        const data = await res.json();

        state.totalPages = data.totalPages;

        renderBreakers(data.data);
        updatePagination();

    } catch (err) {
        console.error(err);
        alert("Помилка завантаження даних");
    }
}

// =======================
// Render
// =======================
function renderBreakers(list) {
    container.innerHTML = '';

    if (!list.length) {
        container.innerHTML = "<p>Немає даних</p>";
        return;
    }

    list.forEach(item => {
        const statusText = item.position === 'open' ? 'Відкритий' : 'Закритий';

        const card = document.createElement('div');
        card.className = 'breaker-card';

        card.innerHTML = `
      <h3>${item.name}</h3>
      <p><b>ID:</b> ${item.id}</p>
      <p><b>Напруга:</b> ${item.voltage} кВ</p>
      <p><b>Струм:</b> ${item.current} А</p>
      <p><b>Механізм:</b> ${translateMechanism(item.mechanism)}</p>
      <p><b>Комутації:</b> ${item.switchingCount}</p>
      <p class="status ${item.position}">${statusText}</p>

      <div class="actions">
        <button class="btn green" data-action="switch" data-id="${item.id}">Комутація</button>
        <button class="btn danger" data-action="delete" data-id="${item.id}">Видалити</button>
        <button class="btn" data-action="history" data-id="${item.id}">Історія</button>
      </div>
    `;

        container.appendChild(card);
    });
}

function translateMechanism(m) {
    return {
        spring: "Пружинний",
        hydraulic: "Гідравлічний",
        motor: "Моторний"
    }[m] || m;
}

// =======================
// Pagination
// =======================
function updatePagination() {
    pageInfo.textContent = `Сторінка ${state.currentPage} / ${state.totalPages}`;
    prevBtn.disabled = state.currentPage <= 1;
    nextBtn.disabled = state.currentPage >= state.totalPages;
}

prevBtn.onclick = () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        fetchBreakers();
    }
};

nextBtn.onclick = () => {
    if (state.currentPage < state.totalPages) {
        state.currentPage++;
        fetchBreakers();
    }
};

// =======================
// Actions
// =======================
async function addBreaker(e) {
    e.preventDefault();

    // ❗ ВАЖЛИВО: беремо input через getElementById
    const nameInput = document.getElementById('name');
    const voltageInput = document.getElementById('voltage');
    const currentInput = document.getElementById('current');
    const mechanismInput = document.getElementById('mechanism');

    const data = {
        name: nameInput.value.trim(),
        voltage: Number(voltageInput.value),
        current: Number(currentInput.value),
        mechanism: mechanismInput.value,
        position: "open",
        operationTime: 100
    };

    try {
        const res = await fetch('/api/circuit-breakers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json();
            alert(err.errors?.join('\n') || "Помилка додавання");
            return;
        }

        // очистка форми
        nameInput.value = "";
        voltageInput.value = "";
        currentInput.value = "";

        state.currentPage = 1;
        fetchBreakers();

    } catch (err) {
        console.error(err);
        alert("Помилка додавання");
    }
}

async function deleteBreaker(id) {
    if (!confirm("Ви впевнені, що хочете видалити?")) return;

    try {
        await fetch(`/api/circuit-breakers/${id}`, { method: 'DELETE' });
        fetchBreakers();
    } catch {
        alert("Помилка видалення");
    }
}

async function switchBreaker(id) {
    try {
        await fetch(`/api/circuit-breakers/${id}/switch`, { method: 'POST' });
        fetchBreakers();
    } catch {
        alert("Помилка комутації");
    }
}

async function showHistory(id) {
    try {
        const res = await fetch(`/api/circuit-breakers/${id}/history`);
        const data = await res.json();
        alert("Історія комутацій:\n" + JSON.stringify(data, null, 2));
    } catch {
        alert("Помилка отримання історії");
    }
}

// =======================
// Events
// =======================
document.getElementById('addForm').addEventListener('submit', addBreaker);

container.addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    const action = e.target.dataset.action;

    if (!id) return;

    if (action === 'delete') deleteBreaker(id);
    if (action === 'switch') switchBreaker(id);
    if (action === 'history') showHistory(id);
});

// фільтри
document.getElementById('search').oninput = e => state.search = e.target.value;
document.getElementById('filterVoltage').oninput = e => state.filters.voltage = e.target.value;
document.getElementById('filterPosition').onchange = e => state.filters.position = e.target.value;
document.getElementById('sortBy').onchange = e => state.sortBy = e.target.value;
document.getElementById('sortOrder').onchange = e => state.sortOrder = e.target.value;

// =======================
fetchBreakers();