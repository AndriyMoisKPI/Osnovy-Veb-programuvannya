document.addEventListener('DOMContentLoaded', () => {
    
    const defaultSettings = {
        qPower: { min: -500, max: 500, normMin: -100, normMax: 100, isInt: false, decimals: 1 },
        cosPhi: { min: 0.6, max: 1.0, normMin: 0.92, normMax: 0.98, isInt: false, decimals: 2 },
        voltage: { min: 350, max: 420, normMin: 380, normMax: 400, isInt: false, decimals: 1 },
        stages: { min: 0, max: 12, normMin: 2, normMax: 8, isInt: true, decimals: 0 },
        temp: { min: 10, max: 70, normMin: 20, normMax: 45, isInt: false, decimals: 1 }
    };

    let config = JSON.parse(localStorage.getItem('krmSettings')) || JSON.parse(JSON.stringify(defaultSettings));

    
    let currentValues = { qPower: 0.0, cosPhi: 0.95, voltage: 390.0, stages: 5, temp: 32.0 };
    let totalSavedEnergy = parseFloat(localStorage.getItem('savedEnergy')) || 12460.6;

    let autoInterval = null;
    let isAutoEnabled = false;
    let currentIntervalTime = 1000;
    let lastAlertTime = 0;
    const alertSound = new Audio('sounds/sound.mp3');

   
    const historyData = JSON.parse(localStorage.getItem('krmHistory')) || {
        labels: [],
        qPower: [],
        cosPhi: [],
        voltage: [],
        temp: [],
        stages: [],
        savedEnergy: []
    };

    const charts = {};

    function initCharts() {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? '#2f363d' : '#e0e0e0';
        const textColor = isDark ? '#959da5' : '#7f8c8d';

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor } },
                y: { grid: { color: gridColor }, ticks: { color: textColor } }
            }
        };

        charts.qPower = new Chart(document.getElementById('chart-qPower').getContext('2d'), {
            type: 'line',
            data: { labels: historyData.labels, datasets: [{ data: historyData.qPower, borderColor: '#1f5c4d', backgroundColor: 'rgba(31, 92, 77, 0.2)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: config.qPower.min, max: config.qPower.max } } }
        });

        charts.cosPhi = new Chart(document.getElementById('chart-cosPhi').getContext('2d'), {
            type: 'line',
            data: { labels: historyData.labels, datasets: [{ data: historyData.cosPhi, borderColor: '#f39c12', backgroundColor: 'rgba(243, 156, 18, 0.2)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: 0.5, max: 1.0 } } }
        });

        charts.voltage = new Chart(document.getElementById('chart-voltage').getContext('2d'), {
            type: 'line',
            data: { labels: historyData.labels, datasets: [{ data: historyData.voltage, borderColor: '#c0392b', backgroundColor: 'rgba(192, 57, 43, 0.2)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: config.voltage.min, max: config.voltage.max } } }
        });

        charts.temp = new Chart(document.getElementById('chart-temp').getContext('2d'), {
            type: 'line',
            data: { labels: historyData.labels, datasets: [{ data: historyData.temp, borderColor: '#2980b9', backgroundColor: 'rgba(41, 128, 185, 0.2)', borderWidth: 2, fill: true, tension: 0.4 }] },
            options: { ...commonOptions, scales: { ...commonOptions.scales, y: { ...commonOptions.scales.y, min: config.temp.min, max: config.temp.max } } }
        });

        charts.stages = new Chart(document.getElementById('chart-stages').getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Увімкнено', 'Вимкнено'],
                datasets: [{
                    data: [currentValues.stages, 12 - currentValues.stages],
                    backgroundColor: ['#27ae60', isDark ? '#2f363d' : '#e0e0e0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor } }
                }
            }
        });
    }

    function updateChartsTheme() {
        if (Object.keys(charts).length === 0) return;
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? '#2f363d' : '#e0e0e0';
        const textColor = isDark ? '#959da5' : '#7f8c8d';

        ['qPower', 'cosPhi', 'voltage', 'temp'].forEach(key => {
            charts[key].options.scales.x.grid.color = gridColor;
            charts[key].options.scales.x.ticks.color = textColor;
            charts[key].options.scales.y.grid.color = gridColor;
            charts[key].options.scales.y.ticks.color = textColor;
            charts[key].update();
        });

        charts.stages.data.datasets[0].backgroundColor[1] = isDark ? '#2f363d' : '#e0e0e0';
        charts.stages.options.plugins.legend.labels.color = textColor;
        charts.stages.update();
    }

    function generateSensorData() {
        let newData = {};

        Object.keys(config).forEach(key => {
            const c = config[key];
            let current = currentValues[key];
            const range = c.max - c.min;

            const target = (c.normMin + c.normMax) / 2;
            const drift = (target - current) * 0.01;
            const noise = (Math.random() * 2 - 1) * (range * 0.001);

            let next = current + drift + noise;

            const rand = Math.random();

            if (rand < 0.0005) {

                
                next = Math.random() < 0.5
                    ? c.min - range * 0.05
                    : c.max + range * 0.05;

            } else if (rand < 0.005) {

                
                next = Math.random() < 0.5
                    ? c.normMin - range * 0.03
                    : c.normMax + range * 0.03;

            }

           
            next = Math.max(c.min, Math.min(c.max, next));
            if (c.isInt) next = Math.round(next);

            newData[key] = next;
            currentValues[key] = next;
        });

        return newData;
    }


    function checkStatus(value, limits) {
        if (value >= limits.normMin && value <= limits.normMax) return 'normal';    
        if (value <= limits.min || value >= limits.max) return 'critical';
        return 'warning';
    }

 
    function formatTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString('uk-UA');
    }


    function saveData(dataObj) {
        const timeStr = formatTimestamp();

        historyData.labels.push(timeStr);
        historyData.qPower.push(dataObj.qPower.toFixed(2));
        historyData.cosPhi.push(dataObj.cosPhi.toFixed(3));
        historyData.voltage.push(dataObj.voltage.toFixed(1));
        historyData.temp.push(dataObj.temp.toFixed(1));
        historyData.stages.push(dataObj.stages);
        historyData.savedEnergy.push(totalSavedEnergy.toFixed(2));

    
        if (historyData.labels.length > 50) {
            Object.keys(historyData).forEach(key => historyData[key].shift());
        }

    
        localStorage.setItem('krmHistory', JSON.stringify(historyData));
        localStorage.setItem('savedEnergy', totalSavedEnergy);

     
        updateHistoryTable();
    }

    function updateHistoryTable() {
        const tbody = document.getElementById('historyTableBody');
        if (!tbody) return;

        tbody.innerHTML = ''; 

       
        for (let i = historyData.labels.length - 1; i >= 0; i--) {
            const row = `
            <tr>
                <td>${historyData.labels[i]}</td>
                <td>${historyData.qPower[i]}</td>
                <td>${historyData.cosPhi[i]}</td>
                <td>${historyData.voltage[i]}</td>
                <td>${historyData.temp[i]}</td>
                <td><span class="badge bg-info text-dark">${historyData.stages[i]}</span></td>
            </tr>
        `;
            tbody.innerHTML += row;
        }
    }

    
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Очистити всю історію вимірювань?')) {
            Object.keys(historyData).forEach(key => historyData[key] = []);
            localStorage.removeItem('krmHistory');
            updateHistoryTable();
            location.reload();
        }
    });

    updateHistoryTable();

    function updateDisplay(data) {
        let hasCritical = false;

        Object.keys(data).forEach(key => {
            const val = data[key];
            const status = checkStatus(val, config[key]);

            const valEl = document.getElementById(`val-${key}`);
            const statusEl = document.getElementById(`status-${key}`);
            const cardEl = document.getElementById(`card-${key}`);

            if (valEl) valEl.textContent = val.toFixed(config[key].decimals);

            if (cardEl && statusEl) {
                cardEl.classList.remove('card-warning', 'card-danger');
                statusEl.className = 'status-indicator';

                if (status === 'normal') {
                    statusEl.textContent = 'В нормі';
                    statusEl.classList.add('status-normal');
                } else if (status === 'warning') {
                    statusEl.textContent = 'Відхилення';
                    statusEl.classList.add('status-warning');
                    cardEl.classList.add('card-warning');
                } else {
                    statusEl.textContent = 'КРИТИЧНО!';
                    statusEl.classList.add('status-danger');
                    cardEl.classList.add('card-danger');
                    hasCritical = true;
                }
            }
        });

        if (hasCritical) playAlert();

        const activeStages = data.stages;
        const contactors = document.getElementById('val-contactors');
        const savingEl = document.getElementById('val-saving');

        if (activeStages > 0) {
            contactors.textContent = 'АКТИВНІ';
            contactors.className = 'badge bg-success';
            totalSavedEnergy += (activeStages * 0.01);
        } else {
            contactors.textContent = 'ВИМКНЕНО';
            contactors.className = 'badge bg-danger';
        }
        savingEl.textContent = totalSavedEnergy.toFixed(2);

        document.getElementById('lastUpdate').textContent = formatTimestamp();

        if (Object.keys(charts).length > 0) {
          
            charts.qPower.options.scales.y.min = config.qPower.min;
            charts.qPower.options.scales.y.max = config.qPower.max;
            charts.voltage.options.scales.y.min = config.voltage.min;
            charts.voltage.options.scales.y.max = config.voltage.max;

            charts.qPower.update('none');
            charts.cosPhi.update('none');
            charts.voltage.update('none');
            charts.temp.update('none');

            charts.stages.data.datasets[0].data = [activeStages, 12 - activeStages];
            charts.stages.update('none');
        }
    }

    function manualUpdate() {
        const newData = generateSensorData();
        saveData(newData);
        updateDisplay(newData);
    }

    function toggleAutoUpdate() {
        isAutoEnabled = !isAutoEnabled;
        const btn = document.getElementById('autoUpdateBtn');
        const statusText = document.getElementById('autoStatus');

        if (isAutoEnabled) {
            autoInterval = setInterval(manualUpdate, currentIntervalTime);
            btn.textContent = 'Зупинити';
            btn.className = 'btn btn-danger btn-sm';
            statusText.textContent = 'Активно';
            statusText.className = 'badge bg-success fs-6';
        } else {
            clearInterval(autoInterval);
            btn.textContent = 'Увімкнути авто';
            btn.className = 'btn btn-primary btn-sm';
            statusText.textContent = 'Вимкнено';
            statusText.className = 'badge bg-secondary fs-6';
        }
    }

    function playAlert() {
        if (Date.now() - lastAlertTime > 2000) {
            alertSound.play().catch(() => { });
            lastAlertTime = Date.now();
        }
    }

    const sections = document.querySelectorAll("section");
    const navLinks = document.querySelectorAll(".nav-link");

    window.addEventListener("scroll", () => {
        let current = "";
        const isBottom = (window.innerHeight + window.pageYOffset) >= document.body.offsetHeight - 2;

        if (isBottom) {
            current = sections[sections.length - 1].getAttribute("id");
        } else {
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 120;
                if (window.pageYOffset >= sectionTop) {
                    current = section.getAttribute("id");
                }
            });
        }

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${current}`) {
                link.classList.add("active");
            }
        });
    });


    const themeBtn = document.getElementById('themeToggle');
    function toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️ Світла' : '🌙 Темна';
        localStorage.setItem('theme', newTheme);
        updateChartsTheme();
    }

    if (localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeBtn.textContent = '☀️ Світла';
    }
    themeBtn.addEventListener('click', toggleTheme);

    document.querySelector('[data-bs-target="#settingsModal"]').addEventListener('click', () => {
        document.getElementById('set-qPower-min').value = config.qPower.normMin;
        document.getElementById('set-qPower-max').value = config.qPower.normMax;
        document.getElementById('set-qPower-abs-min').value = config.qPower.min;
        document.getElementById('set-qPower-abs-max').value = config.qPower.max;

        document.getElementById('set-cosPhi-min').value = config.cosPhi.normMin;
        document.getElementById('set-cosPhi-max').value = config.cosPhi.normMax;
        document.getElementById('set-cosPhi-abs-min').value = config.cosPhi.min;
        document.getElementById('set-cosPhi-abs-max').value = config.cosPhi.max;

        document.getElementById('set-voltage-min').value = config.voltage.normMin;
        document.getElementById('set-voltage-max').value = config.voltage.normMax;
        document.getElementById('set-voltage-abs-min').value = config.voltage.min;
        document.getElementById('set-voltage-abs-max').value = config.voltage.max;
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', () => {

        showConfirm(
            "Зміна параметрів",
            "Ви впевнені, що хочете змінити межі діапазонів та нормативів?",
            "⚙",
            function () {

                config.qPower.normMin = parseFloat(document.getElementById('set-qPower-min').value);
                config.qPower.normMax = parseFloat(document.getElementById('set-qPower-max').value);
                config.qPower.min = parseFloat(document.getElementById('set-qPower-abs-min').value);
                config.qPower.max = parseFloat(document.getElementById('set-qPower-abs-max').value);

                config.cosPhi.normMin = parseFloat(document.getElementById('set-cosPhi-min').value);
                config.cosPhi.normMax = parseFloat(document.getElementById('set-cosPhi-max').value);
                config.cosPhi.min = parseFloat(document.getElementById('set-cosPhi-abs-min').value);
                config.cosPhi.max = parseFloat(document.getElementById('set-cosPhi-abs-max').value);

                config.voltage.normMin = parseFloat(document.getElementById('set-voltage-min').value);
                config.voltage.normMax = parseFloat(document.getElementById('set-voltage-max').value);
                config.voltage.min = parseFloat(document.getElementById('set-voltage-abs-min').value);
                config.voltage.max = parseFloat(document.getElementById('set-voltage-abs-max').value);

                localStorage.setItem('krmSettings', JSON.stringify(config));

                updateNormativeTable();

                bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();

            }
        );

    });

    document.getElementById('resetSettingsBtn').addEventListener('click', () => {

        showConfirm(
            "Скидання налаштувань",
            "Скинути всі налаштування до базових?",
            "⚠",
            function () {

                config = JSON.parse(JSON.stringify(defaultSettings));

                localStorage.setItem('krmSettings', JSON.stringify(config));

                updateNormativeTable();

                bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();

            }
        );

    });

    function updateNormativeTable() {
        const rows = document.querySelectorAll('#normativeTable tbody tr');
        rows.forEach(row => {
            const param = row.getAttribute('data-param');
            if (config[param]) {
                row.querySelector('.norm-range').textContent = `${config[param].normMin} ... ${config[param].normMax}`;
                row.querySelector('.abs-range').textContent = `${config[param].min} ... ${config[param].max}`;
            }
        });
    }

    function showConfirm(title, message, icon, callback) {

        const modal = document.getElementById("confirmModal");
        const titleEl = document.getElementById("modalTitle");
        const messageEl = document.getElementById("modalMessage");
        const iconEl = document.getElementById("modalIcon");

        const yes = document.getElementById("confirmYes");
        const no = document.getElementById("confirmNo");

        titleEl.textContent = title;
        messageEl.textContent = message;
        iconEl.textContent = icon;

        modal.style.display = "flex";

        yes.onclick = function () {
            modal.style.display = "none";
            callback();
        }

        no.onclick = function () {
            modal.style.display = "none";
        }

    }


    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        let csv = "\uFEFFЧас;Реактивна потужність (кВАр);Коефіцієнт потужності (cos φ);Напруга мережі (В);Температура конденсаторів(°C);Увімкнені ступені (шт.);Економія електроенергії (кВт·год)\n";
        historyData.labels.forEach((l, i) => {
            csv += `${l};${historyData.qPower[i]};${historyData.cosPhi[i]};${historyData.voltage[i]};${historyData.temp[i]};${historyData.stages[i]};${historyData.savedEnergy[i]}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Parameters.csv";
        link.click();
    });

    document.getElementById('updateBtn').addEventListener('click', manualUpdate);
    document.getElementById('autoUpdateBtn').addEventListener('click', toggleAutoUpdate);

    document.getElementById('intervalSelect').addEventListener('change', (e) => {
        currentIntervalTime = parseInt(e.target.value);
        if (isAutoEnabled) {
            clearInterval(autoInterval);
            autoInterval = setInterval(manualUpdate, currentIntervalTime);
        }
    });

    initCharts();
    updateNormativeTable();
    manualUpdate();
});
