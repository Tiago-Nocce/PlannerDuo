// --- Estado da Aplicação ---
const estado = {
    usuario: null,
    viagens: JSON.parse(localStorage.getItem('planner_viagens')) || [],
    financas: JSON.parse(localStorage.getItem('planner_financas')) || [],
    metas: JSON.parse(localStorage.getItem('planner_metas')) || []
};

const gerarId = () => '_' + Math.random().toString(36).substr(2, 9);

const formatarMoeda = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
};

const formatarData = (dataString) => {
    if (!dataString) return '';
    const [ano, mes, dia] = dataString.split('-');
    return `${dia}/${mes}/${ano}`;
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    verificarLogin();
    configurarEventos();
});

// --- Autenticação ---
function verificarLogin() {
    const usuarioSalvo = localStorage.getItem('planner_user');
    const containerAuth = document.getElementById('tela-autenticacao');
    const telaApp = document.getElementById('tela-app');

    if (usuarioSalvo) {
        estado.usuario = usuarioSalvo;
        if (containerAuth) containerAuth.classList.remove('ativa');
        if (telaApp) telaApp.classList.add('ativa');

        let nomeFormatado = '';
        const nomeSalvo = localStorage.getItem('planner_name');
        if (nomeSalvo) {
            nomeFormatado = nomeSalvo.split(' ')[0];
        } else {
            const parteNome = usuarioSalvo.split('@')[0];
            nomeFormatado = parteNome.charAt(0).toUpperCase() + parteNome.slice(1);
        }
        document.getElementById('saudacao-usuario').innerText = `Olá, ${nomeFormatado}`;

        renderizarTudo();
    } else {
        if (containerAuth) containerAuth.classList.add('ativa');
        if (telaApp) telaApp.classList.remove('ativa');
    }
}

document.getElementById('form-login')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    localStorage.setItem('planner_user', email);
    mostrarNotificacao('Login realizado com sucesso!', 'sucesso');
    verificarLogin();
});

document.getElementById('form-cadastro')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nome = document.getElementById('cadastro-nome').value;
    const email = document.getElementById('cadastro-email').value;
    localStorage.setItem('planner_user', email);
    localStorage.setItem('planner_name', nome);
    mostrarNotificacao('Conta criada com sucesso!', 'sucesso');
    verificarLogin();
});

window.alternarAuth = (tipo) => {
    const secaoLogin = document.getElementById('secao-login');
    const secaoCadastro = document.getElementById('secao-cadastro');
    if (tipo === 'cadastro') {
        secaoLogin.classList.remove('ativa');
        secaoCadastro.classList.add('ativa');
    } else {
        secaoCadastro.classList.remove('ativa');
        secaoLogin.classList.add('ativa');
    }
};

document.getElementById('btn-sair')?.addEventListener('click', () => {
    localStorage.removeItem('planner_user');
    estado.usuario = null;
    verificarLogin();
});

// --- Navegação ---
function configurarEventos() {
    document.querySelectorAll('.item-nav').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.item-nav').forEach(nav => nav.classList.remove('ativo'));
            document.querySelectorAll('.view').forEach(view => view.classList.remove('ativa'));

            item.classList.add('ativo');
            const alvoId = item.getAttribute('data-alvo');
            document.getElementById(alvoId).classList.add('ativa');

            document.querySelector('.menu-lateral').classList.remove('aberto');
            if (alvoId === 'dashboard') renderizarDashboard();
        });
    });

    document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
        document.querySelector('.menu-lateral').classList.toggle('aberto');
    });

    document.getElementById('form-viagem')?.addEventListener('submit', submeterViagem);
    document.getElementById('form-financa')?.addEventListener('submit', submeterFinanca);
    document.getElementById('form-meta')?.addEventListener('submit', submeterMeta);
}

// --- Modais e Notificações ---
window.abrirModal = (id) => document.getElementById(id).classList.add('ativa');
window.fecharModal = (id) => {
    document.getElementById(id).classList.remove('ativa');
    const form = document.querySelector(`#${id} form`);
    if (form) form.reset();
}

function mostrarNotificacao(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('container-notificacao');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icone = tipo === 'sucesso' ? 'fa-check-circle' : 'fa-circle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icone}"></i> <span>${mensagem}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('oculto');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- Renderização ---
function renderizarTudo() {
    renderizarDashboard();
    renderizarViagens();
    renderizarFinancas();
    renderizarMetas();
}

function renderizarDashboard() {
    const viagensFuturas = estado.viagens
        .filter(v => new Date(v.ida) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.ida) - new Date(b.ida));

    const elemProxViagem = document.getElementById('estatistica-viagem');
    if (viagensFuturas.length > 0) {
        elemProxViagem.innerText = `${viagensFuturas[0].destino} (${formatarData(viagensFuturas[0].ida)})`;
    } else {
        elemProxViagem.innerText = "Nenhuma agendada";
    }

    const mesAtual = new Date().getMonth();
    const anoAtual = new Date().getFullYear();
    const despesasMensais = estado.financas
        .filter(f => f.tipo === 'despesa')
        .filter(f => {
            const d = new Date(f.data + 'T00:00:00');
            return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        })
        .reduce((soma, f) => soma + parseFloat(f.valor), 0);

    document.getElementById('estatistica-despesas').innerText = formatarMoeda(despesasMensais);

    const metasAtivas = estado.metas.filter(m => new Date(m.prazo + 'T00:00:00') >= new Date(new Date().setHours(0, 0, 0, 0))).length;
    document.getElementById('estatistica-metas').innerText = metasAtivas;
}

// --- Hub de Buscas (Redirecionamento) ---
window.buscarNoSite = (plataforma) => {
    const destino = document.getElementById('busca-destino').value.trim();
    let url = '';

    if (!destino && plataforma !== 'voos') {
        mostrarNotificacao('Por favor, digite um destino primeiro.', 'erro');
        return;
    }

    const destinoFormatado = encodeURIComponent(destino);

    switch (plataforma) {
        case 'airbnb':
            url = `https://www.airbnb.com.br/s/${destinoFormatado}/homes`;
            break;
        case 'onibus':
            // Formatação básica para o ClickBus
            const destinoTraco = destino.toLowerCase().replace(/\s+/g, '-');
            url = `https://www.clickbus.com.br/onibus/${destinoTraco}`;
            break;
        case 'voos':
            url = destino ? `https://www.google.com/travel/flights?q=voos+para+${destinoFormatado}` : 'https://www.google.com/travel/flights';
            break;
    }

    window.open(url, '_blank');
};

// --- Viagens ---
function submeterViagem(e) {
    e.preventDefault();
    const novaViagem = {
        id: gerarId(),
        destino: document.getElementById('viagem-destino').value,
        ida: document.getElementById('viagem-ida').value,
        volta: document.getElementById('viagem-volta').value,
        link: document.getElementById('viagem-link').value,
        orcamento: document.getElementById('viagem-orcamento').value
    };

    estado.viagens.push(novaViagem);
    salvarDados('planner_viagens', estado.viagens);
    renderizarViagens();
    fecharModal('modal-viagem');
    mostrarNotificacao('Viagem salva com sucesso!');
    renderizarDashboard();
}

function renderizarViagens() {
    const lista = document.getElementById('lista-viagens');
    lista.innerHTML = '';

    if (estado.viagens.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted)">Nenhuma viagem planejada. Busque um destino acima!</p>';
        return;
    }

    estado.viagens.sort((a, b) => new Date(a.ida) - new Date(b.ida)).forEach(v => {
        const card = document.createElement('div');
        card.className = 'cartao painel-vidro';
        card.innerHTML = `
            <div class="cabecalho-cartao">
                <h3 class="titulo-cartao">${v.destino}</h3>
                <button class="btn-icone texto-perigo" onclick="excluirItem('viagem', '${v.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="corpo-cartao">
                <p><i class="fa-regular fa-calendar"></i> ${formatarData(v.ida)} até ${formatarData(v.volta)}</p>
                ${v.link ? `<a href="${v.link}" target="_blank" class="link-cartao"><i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar Reserva</a>` : ''}
            </div>
            <div class="rodape-cartao">
                <span class="badge-orcamento">Orçamento: ${formatarMoeda(v.orcamento)}</span>
            </div>
        `;
        lista.appendChild(card);
    });
}

// --- Finanças ---
function submeterFinanca(e) {
    e.preventDefault();
    const novaFinanca = {
        id: gerarId(),
        desc: document.getElementById('financa-desc').value,
        tipo: document.getElementById('financa-tipo').value,
        valor: document.getElementById('financa-valor').value,
        resp: document.getElementById('financa-resp').value,
        data: document.getElementById('financa-data').value
    };

    estado.financas.push(novaFinanca);
    salvarDados('planner_financas', estado.financas);
    renderizarFinancas();
    fecharModal('modal-financa');
    mostrarNotificacao('Transação registrada com sucesso!');
    renderizarDashboard();
}

function renderizarFinancas() {
    const lista = document.getElementById('lista-financas');
    lista.innerHTML = '';

    let totalReceitas = 0;
    let totalDespesas = 0;

    const financasOrdenadas = [...estado.financas].sort((a, b) => new Date(b.data) - new Date(a.data));

    financasOrdenadas.forEach(item => {
        const val = parseFloat(item.valor);
        if (item.tipo === 'receita') totalReceitas += val;
        else totalDespesas += val;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatarData(item.data)}</td>
            <td>${item.desc}</td>
            <td>${item.resp}</td>
            <td>
                <span class="badge ${item.tipo}">
                    ${item.tipo === 'receita' ? '+' : '-'} ${formatarMoeda(val)}
                </span>
            </td>
            <td>
                <button class="btn-icone texto-perigo" onclick="excluirItem('financa', '${item.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        lista.appendChild(row);
    });

    if (estado.financas.length === 0) {
        lista.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted)">Nenhuma transação registrada.</td></tr>';
    }

    document.getElementById('total-receitas').innerText = formatarMoeda(totalReceitas);
    document.getElementById('total-despesas').innerText = formatarMoeda(totalDespesas);

    const saldo = totalReceitas - totalDespesas;
    const elSaldo = document.getElementById('total-saldo');
    elSaldo.innerText = formatarMoeda(saldo);
    elSaldo.className = saldo >= 0 ? 'texto-sucesso' : 'texto-perigo';
}

// --- Metas ---
function submeterMeta(e) {
    e.preventDefault();
    const novaMeta = {
        id: gerarId(),
        titulo: document.getElementById('meta-titulo').value,
        prazo: document.getElementById('meta-prazo').value
    };

    estado.metas.push(novaMeta);
    salvarDados('planner_metas', estado.metas);
    renderizarMetas();
    fecharModal('modal-meta');
    mostrarNotificacao('Meta adicionada com sucesso!');
    renderizarDashboard();
}

function renderizarMetas() {
    const lista = document.getElementById('lista-metas');
    lista.innerHTML = '';

    if (estado.metas.length === 0) {
        lista.innerHTML = '<p style="color: var(--text-muted)">Nenhuma meta definida. Comecem a planejar o futuro!</p>';
        return;
    }

    estado.metas.sort((a, b) => new Date(a.prazo) - new Date(b.prazo)).forEach(m => {
        const card = document.createElement('div');
        card.className = 'cartao painel-vidro';

        const atrasado = new Date(m.prazo + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
        const corStatus = atrasado ? 'var(--perigo)' : 'var(--sucesso)';

        card.innerHTML = `
            <div class="cabecalho-cartao">
                <h3 class="titulo-cartao">${m.titulo}</h3>
                <button class="btn-icone texto-perigo" onclick="excluirItem('meta', '${m.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div class="corpo-cartao">
                <p style="color: ${corStatus}"><i class="fa-regular fa-clock" style="color: ${corStatus}"></i> Prazo: ${formatarData(m.prazo)} ${atrasado ? '(Atrasado)' : ''}</p>
            </div>
        `;
        lista.appendChild(card);
    });
}

// --- Utilitários ---
function salvarDados(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
}

window.excluirItem = (tipo, id) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    if (tipo === 'viagem') {
        estado.viagens = estado.viagens.filter(v => v.id !== id);
        salvarDados('planner_viagens', estado.viagens);
        renderizarViagens();
    } else if (tipo === 'financa') {
        estado.financas = estado.financas.filter(f => f.id !== id);
        salvarDados('planner_financas', estado.financas);
        renderizarFinancas();
    } else if (tipo === 'meta') {
        estado.metas = estado.metas.filter(m => m.id !== id);
        salvarDados('planner_metas', estado.metas);
        renderizarMetas();
    }

    mostrarNotificacao('Item removido.', 'sucesso');
    renderizarDashboard();
}