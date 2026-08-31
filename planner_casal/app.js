// --- Estado da Aplicação e Configurações ---
const state = {
    user: null,
    trips: JSON.parse(localStorage.getItem('planner_viagens')) || [],
    finances: JSON.parse(localStorage.getItem('planner_financas')) || [],
    goals: JSON.parse(localStorage.getItem('planner_metas')) || []
};

// Utilidades para gerar ID único
const generateId = () => '_' + Math.random().toString(36).substr(2, 9);

// Formatação de Moeda e Data
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    setupEventListeners();
});

// --- Autenticação Simples ---
function checkLogin() {
    const savedUser = localStorage.getItem('planner_user');
    if (savedUser) {
        state.user = savedUser;
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        // Formatar o nome do usuário para ficar mais amigável
        const namePart = savedUser.split('@')[0];
        const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        document.getElementById('user-greeting').innerText = `Olá, ${formattedName}`;
        
        renderAll();
    } else {
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('app-screen').classList.remove('active');
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    // Em um app real, faríamos a chamada à API aqui (ex: Firebase Auth / Supabase)
    localStorage.setItem('planner_user', email);
    showToast('Login realizado com sucesso!', 'success');
    checkLogin();
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('planner_user');
    state.user = null;
    checkLogin();
});

// --- Navegação ---
function setupEventListeners() {
    // Menu de navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active classes
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            
            // Add active class to clicked item and target view
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
            
            // Close mobile menu if open
            document.querySelector('.sidebar').classList.remove('open');
            
            // Re-render specific view if needed
            if (targetId === 'dashboard') renderDashboard();
        });
    });

    // Mobile menu toggle
    document.getElementById('mobile-menu-btn').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    // Forms
    document.getElementById('form-trip').addEventListener('submit', handleTripSubmit);
    document.getElementById('form-finance').addEventListener('submit', handleFinanceSubmit);
    document.getElementById('form-goal').addEventListener('submit', handleGoalSubmit);
}

// --- Modais ---
window.openModal = (id) => {
    document.getElementById(id).classList.add('active');
}

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    // Limpa o formulário dentro do modal
    const form = document.querySelector(`#${id} form`);
    if(form) form.reset();
}

// --- Toasts (Feedback Visual) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Lógica de Renderização ---
function renderAll() {
    renderDashboard();
    renderTrips();
    renderFinances();
    renderGoals();
}

// 1. Dashboard
function renderDashboard() {
    // Próxima Viagem (a mais próxima do dia atual)
    const futureTrips = state.trips
        .filter(t => new Date(t.start) >= new Date(new Date().setHours(0,0,0,0)))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    const nextTripEl = document.getElementById('stat-next-trip');
    if (futureTrips.length > 0) {
        nextTripEl.innerText = `${futureTrips[0].destination} (${formatDate(futureTrips[0].start)})`;
    } else {
        nextTripEl.innerText = "Nenhuma agendada";
    }

    // Despesas do mês atual
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyExpenses = state.finances
        .filter(f => f.type === 'expense')
        .filter(f => {
            const d = new Date(f.date + 'T00:00:00');
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, f) => sum + parseFloat(f.value), 0);
    
    document.getElementById('stat-expenses').innerText = formatCurrency(monthlyExpenses);

    // Metas Ativas
    const activeGoals = state.goals.filter(g => new Date(g.deadline + 'T00:00:00') >= new Date(new Date().setHours(0,0,0,0))).length;
    document.getElementById('stat-goals').innerText = activeGoals;
}

// 2. Viagens
function handleTripSubmit(e) {
    e.preventDefault();
    const newTrip = {
        id: generateId(),
        destination: document.getElementById('trip-destination').value,
        start: document.getElementById('trip-start').value,
        end: document.getElementById('trip-end').value,
        link: document.getElementById('trip-link').value,
        budget: document.getElementById('trip-budget').value
    };
    
    state.trips.push(newTrip);
    saveData('planner_viagens', state.trips);
    renderTrips();
    closeModal('modal-trip');
    showToast('Viagem salva com sucesso!');
    renderDashboard();
}

function renderTrips() {
    const list = document.getElementById('trips-list');
    list.innerHTML = '';
    
    if (state.trips.length === 0) {
        list.innerHTML = '<p class="text-muted">Nenhuma viagem planejada ainda. Que tal marcar a próxima?</p>';
        return;
    }

    state.trips.sort((a, b) => new Date(a.start) - new Date(b.start)).forEach(trip => {
        const card = document.createElement('div');
        card.className = 'card glass-panel';
        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${trip.destination}</h3>
                <button class="btn-icon text-danger" onclick="deleteItem('trip', '${trip.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="card-body">
                <p><i class="fa-regular fa-calendar"></i> ${formatDate(trip.start)} até ${formatDate(trip.end)}</p>
                ${trip.link ? `<a href="${trip.link}" target="_blank" class="card-link"><i class="fa-solid fa-link"></i> Ver Hospedagem/Link</a>` : ''}
            </div>
            <div class="card-footer">
                <span class="budget-badge">Orçamento: ${formatCurrency(trip.budget)}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

// 3. Finanças
function handleFinanceSubmit(e) {
    e.preventDefault();
    const newFinance = {
        id: generateId(),
        desc: document.getElementById('finance-desc').value,
        type: document.getElementById('finance-type').value,
        value: document.getElementById('finance-value').value,
        resp: document.getElementById('finance-resp').value,
        date: document.getElementById('finance-date').value
    };
    
    state.finances.push(newFinance);
    saveData('planner_financas', state.finances);
    renderFinances();
    closeModal('modal-finance');
    showToast('Transação registrada com sucesso!');
    renderDashboard();
}

function renderFinances() {
    const list = document.getElementById('finances-list');
    list.innerHTML = '';
    
    let totalIncome = 0;
    let totalExpense = 0;

    // Sort by date descending
    const sortedFinances = [...state.finances].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedFinances.forEach(item => {
        const val = parseFloat(item.value);
        if (item.type === 'income') totalIncome += val;
        else totalExpense += val;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.desc}</td>
            <td>${item.resp}</td>
            <td>
                <span class="badge ${item.type}">
                    ${item.type === 'income' ? '+' : '-'} ${formatCurrency(val)}
                </span>
            </td>
            <td>
                <button class="btn-icon text-danger" onclick="deleteItem('finance', '${item.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        list.appendChild(row);
    });

    if (state.finances.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted)">Nenhuma transação registrada.</td></tr>';
    }

    document.getElementById('total-income').innerText = formatCurrency(totalIncome);
    document.getElementById('total-expense').innerText = formatCurrency(totalExpense);
    document.getElementById('total-balance').innerText = formatCurrency(totalIncome - totalExpense);
    
    const balanceEl = document.getElementById('total-balance');
    balanceEl.style.color = (totalIncome - totalExpense) >= 0 ? 'var(--success)' : 'var(--danger)';
}

// 4. Metas
function handleGoalSubmit(e) {
    e.preventDefault();
    const newGoal = {
        id: generateId(),
        title: document.getElementById('goal-title').value,
        deadline: document.getElementById('goal-deadline').value
    };
    
    state.goals.push(newGoal);
    saveData('planner_metas', state.goals);
    renderGoals();
    closeModal('modal-goal');
    showToast('Meta adicionada com sucesso!');
    renderDashboard();
}

function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = '';
    
    if (state.goals.length === 0) {
        list.innerHTML = '<p class="text-muted">Nenhuma meta definida ainda. Sonhem juntos!</p>';
        return;
    }

    state.goals.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).forEach(goal => {
        const card = document.createElement('div');
        card.className = 'card glass-panel';
        
        // Verifica se está atrasado (ajustando timezone)
        const isLate = new Date(goal.deadline + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
        const statusColor = isLate ? 'var(--danger)' : 'var(--success)';

        card.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${goal.title}</h3>
                <button class="btn-icon text-danger" onclick="deleteItem('goal', '${goal.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="card-body">
                <p style="color: ${statusColor}"><i class="fa-regular fa-clock" style="color: ${statusColor}"></i> Prazo: ${formatDate(goal.deadline)} ${isLate ? '(Atrasado)' : ''}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

// --- Funcionalidades Gerais ---
function saveData(key, data) {
    // Esta função centraliza o salvamento de dados. 
    // Em uma refatoração para BaaS (Firebase, Supabase), as integrações iriam aqui.
    localStorage.setItem(key, JSON.stringify(data));
}

window.deleteItem = (type, id) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    if (type === 'trip') {
        state.trips = state.trips.filter(t => t.id !== id);
        saveData('planner_viagens', state.trips);
        renderTrips();
    } else if (type === 'finance') {
        state.finances = state.finances.filter(f => f.id !== id);
        saveData('planner_financas', state.finances);
        renderFinances();
    } else if (type === 'goal') {
        state.goals = state.goals.filter(g => g.id !== id);
        saveData('planner_metas', state.goals);
        renderGoals();
    }
    
    showToast('Item removido.', 'success');
    renderDashboard();
}
