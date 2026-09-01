// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAywzg4yDP0p15RpnFwPc2Y2MGoT2U5l4M",
    authDomain: "plannerduo.firebaseapp.com",
    projectId: "plannerduo",
    storageBucket: "plannerduo.firebasestorage.app",
    messagingSenderId: "355035332668",
    appId: "1:355035332668:web:9c91fb300c4b601dfc4339",
    measurementId: "G-GFCLFVXP4E"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// A lógica de Estado, Utils e Controladores continua abaixo...

// ==========================================
// ESTADO GLOBAL & UTILITÁRIOS
// ==========================================
const Estado = { usuarioUid: null, emailId: null, viagens: [], financas: [], metas: [] };

const Utils = {
    gerarId: () => crypto.randomUUID ? crypto.randomUUID() : '_' + Math.random().toString(36).substr(2, 9),
    formatarMoeda: (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor),
    gerarSlug: (texto) => texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
    formatarData: (dataStr) => {
        if (!dataStr) return '';
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
};

const UI = {
    abrirModal: (id) => document.getElementById(id).classList.add('ativa'),
    fecharModal: (id) => {
        document.getElementById(id).classList.remove('ativa');
        document.querySelector(`#${id} form`)?.reset();
    },
    mostrarToast: (mensagem, tipo = 'sucesso') => {
        const container = document.getElementById('toast-container');
        if (!container) return alert(mensagem);
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<i class="fa-solid ${tipo === 'sucesso' ? 'fa-check-circle text-success' : 'fa-circle-exclamation text-danger'}"></i> <span>${mensagem}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },
    setupNav: () => {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('ativo'));
                document.querySelectorAll('.view').forEach(v => v.classList.remove('ativa'));
                item.classList.add('ativo');
                const alvoId = item.getAttribute('data-alvo');
                document.getElementById(alvoId).classList.add('ativa');
                document.querySelector('.sidebar').classList.remove('aberto');

                if (alvoId === 'dashboard') Analytics.atualizarGrafico();
                if (alvoId === 'viagens') Render.viagens();
            });
        });
        document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('aberto');
        });
    }
};

// ==========================================
// FIREBASE AUTHENTICATION (PROTEÇÃO DE ROTA)
// ==========================================
const Auth = {
    iniciarObserver: () => {
        auth.onAuthStateChanged((user) => {
            const path = window.location.pathname;
            const isAppPage = path.includes('app.html');
            const isAuthPage = path.includes('auth.html');
            const isLandingPage = path.includes('index.html') || path === '/' || path === '';

            if (user) {
                Estado.usuarioUid = user.uid;
                Estado.emailId = user.email.replace(/[^a-zA-Z0-9]/g, '');

                if (isAuthPage || isLandingPage) {
                    window.location.href = 'app.html';
                } else if (isAppPage) {
                    document.getElementById('loader-tela').style.display = 'none';
                    document.getElementById('tela-app').style.opacity = '1';
                    Controladores.ouvirNuvem();
                }
            } else {
                if (isAppPage) {
                    window.location.href = 'auth.html';
                }
            }
        });
    },
    login: (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;

        auth.signInWithEmailAndPassword(email, senha)
            .then(() => UI.mostrarToast("Login realizado com sucesso!"))
            .catch((error) => UI.mostrarToast("Erro no login. E-mail ou senha incorretos.", "erro"));
    },
    cadastro: (e) => {
        e.preventDefault();
        const email = document.getElementById('cadastro-email').value;
        const senha = document.getElementById('cadastro-senha').value;

        auth.createUserWithEmailAndPassword(email, senha)
            .then(() => UI.mostrarToast("Conta segura criada com sucesso!"))
            .catch((error) => UI.mostrarToast(error.message, "erro"));
    },
    logout: () => {
        if (confirm('Encerrar sessão segura?')) {
            auth.signOut();
        }
    }
};

// ==========================================
// BANCO DE DADOS EM TEMPO REAL E MOTOR DE BUSCA
// ==========================================
const ServicoBusca = {
    redirecionar: (plataforma) => {
        const origem = document.getElementById('busca-origem').value.trim();
        const destino = document.getElementById('busca-destino').value.trim();
        const dataIda = document.getElementById('busca-data-ida').value;
        const dataVolta = document.getElementById('busca-data-volta').value;
        const passageiros = document.getElementById('busca-passageiros').value;

        if (!destino) return UI.mostrarToast('Preencha pelo menos o destino!', 'erro');

        const origEnc = encodeURIComponent(origem);
        const destEnc = encodeURIComponent(destino);
        const origSlug = Utils.gerarSlug(origem);
        const destSlug = Utils.gerarSlug(destino);
        let url = '';

        switch (plataforma) {
            case 'airbnb': url = `https://www.airbnb.com.br/s/${destEnc}/homes?adults=${passageiros}`; if (dataIda) url += `&checkin=${dataIda}&checkout=${dataVolta}`; break;
            case 'booking': url = `https://www.booking.com/searchresults.pt-br.html?ss=${destEnc}&group_adults=${passageiros}`; if (dataIda) url += `&checkin=${dataIda}&checkout=${dataVolta}`; break;
            case 'googleflights': url = `https://www.google.com/travel/flights?q=voos+de+${origEnc}+para+${destEnc}`; if (dataIda) url += `+em+${dataIda}`; if (dataVolta) url += `+ate+${dataVolta}`; break;
            case 'azul': url = `https://www.voeazul.com.br/br/pt/home/selecao-voo?origem=${origEnc}&destino=${destEnc}&adultos=${passageiros}`; if (dataIda) url += `&dataIda=${dataIda}&dataVolta=${dataVolta}`; break;
            case 'gol': url = `https://www.voegol.com.br/compra/busca-de-voos?from=${origEnc}&to=${destEnc}&adults=${passageiros}`; if (dataIda) url += `&departure=${dataIda}&return=${dataVolta}`; break;
            case 'latam': url = `https://www.latamairlines.com/br/pt/ofertas-voos?origin=${origEnc}&destination=${destEnc}&adt=${passageiros}`; if (dataIda) url += `&outbound=${dataIda}&inbound=${dataVolta}`; break;
            case 'buser': url = `https://www.buser.com.br/onibus/${origSlug}/${destSlug}`; if (dataIda) url += `?ida=${dataIda}`; if (dataVolta) url += `${dataIda ? '&' : '?'}volta=${dataVolta}`; break;
            case 'clickbus': url = `https://www.clickbus.com.br/onibus/${origSlug}/${destSlug}`; if (dataIda) url += `?departureDate=${dataIda}`; if (dataVolta) url += `${dataIda ? '&' : '?'}returnDate=${dataVolta}`; break;
        }
        window.open(url, '_blank');
    }
};

const Controladores = {
    ouvirNuvem: () => {
        if (!Estado.emailId) return;
        db.collection('casais').doc(Estado.emailId).onSnapshot((doc) => {
            if (doc.exists) {
                const dados = doc.data();
                Estado.viagens = dados.viagens || [];
                Estado.financas = dados.financas || [];
                Estado.metas = dados.metas || [];
            }
            Render.tudo();
        });
    },
    salvarNaNuvem: async (colecao) => {
        if (!Estado.emailId) return;
        try {
            await db.collection('casais').doc(Estado.emailId).set({ [colecao]: Estado[colecao] }, { merge: true });
        } catch (error) {
            UI.mostrarToast("Acesso negado ou erro de rede.", "erro");
        }
    },
    adicionarViagem: (e) => {
        e.preventDefault();
        Estado.viagens.push({
            id: Utils.gerarId(),
            destino: document.getElementById('viagem-destino').value,
            ida: document.getElementById('viagem-ida').value,
            volta: document.getElementById('viagem-volta').value,
            link: document.getElementById('viagem-link').value,
            orcamento: parseFloat(document.getElementById('viagem-orcamento').value)
        });
        Controladores.salvarNaNuvem('viagens');
        UI.fecharModal('modal-viagem');
        UI.mostrarToast('Roteiro e link salvos na nuvem!');
    },
    adicionarFinanca: (e) => {
        e.preventDefault();
        Estado.financas.push({
            id: Utils.gerarId(),
            desc: document.getElementById('financa-desc').value,
            tipo: document.getElementById('financa-tipo').value,
            valor: parseFloat(document.getElementById('financa-valor').value),
            resp: document.getElementById('financa-resp').value,
            data: document.getElementById('financa-data').value
        });
        Controladores.salvarNaNuvem('financas');
        UI.fecharModal('modal-financa');
        UI.mostrarToast('Nova transação registrada!');
    },
    adicionarMeta: (e) => {
        e.preventDefault();
        Estado.metas.push({
            id: Utils.gerarId(),
            titulo: document.getElementById('meta-titulo').value,
            prazo: document.getElementById('meta-prazo').value
        });
        Controladores.salvarNaNuvem('metas');
        UI.fecharModal('modal-meta');
        UI.mostrarToast('Meta cadastrada com sucesso!');
    },
    deletar: (tipo, id) => {
        if (!confirm('Excluir este registro permanentemente?')) return;
        if (tipo === 'viagem') { Estado.viagens = Estado.viagens.filter(v => v.id !== id); Controladores.salvarNaNuvem('viagens'); }
        if (tipo === 'financa') { Estado.financas = Estado.financas.filter(f => f.id !== id); Controladores.salvarNaNuvem('financas'); }
        if (tipo === 'meta') { Estado.metas = Estado.metas.filter(m => m.id !== id); Controladores.salvarNaNuvem('metas'); }
        UI.mostrarToast('Item excluído.');
    }
};

let chartInstancia = null;
const Analytics = {
    atualizarGrafico: () => {
        const ctx = document.getElementById('graficoDespesas')?.getContext('2d');
        if (!ctx) return;
        const tiagoTotal = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Tiago').reduce((s, f) => s + f.valor, 0);
        const yasminTotal = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Yasmin').reduce((s, f) => s + f.valor, 0);

        if (chartInstancia) chartInstancia.destroy();
        chartInstancia = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pagos por Tiago', 'Pagos por Yasmin'],
                datasets: [{
                    data: [tiagoTotal, yasminTotal],
                    backgroundColor: ['#2B3A70', '#E87A3E'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
};

const Exportacao = {
    gerarCSV: () => {
        if (!Estado.financas.length) return UI.mostrarToast('Sem dados para exportar', 'erro');
        const cabecalho = "Data,Descricao,Responsavel,Tipo,Valor\n";
        const linhas = Estado.financas.map(f => `${f.data},"${f.desc}",${f.resp},${f.tipo},${f.valor}`).join("\n");
        const blob = new Blob([cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_plannerduo_${Date.now()}.csv`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        UI.mostrarToast('Download em CSV iniciado!');
    }
};

// ==========================================
// RENDERIZAÇÃO
// ==========================================
const Render = {
    tudo: () => { Render.dashboard(); Render.viagens(); Render.financas(); Render.metas(); },
    dashboard: () => {
        if (!document.getElementById('stat-next-trip')) return;
        const futuras = Estado.viagens.filter(v => new Date(v.ida) >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => new Date(a.ida) - new Date(b.ida));
        document.getElementById('stat-next-trip').innerText = futuras.length ? futuras[0].destino : 'Nenhuma';

        const despesasMes = Estado.financas.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);
        document.getElementById('stat-expenses').innerText = Utils.formatarMoeda(despesasMes);

        const tiago = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Tiago').reduce((s, f) => s + f.valor, 0);
        const yasmin = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Yasmin').reduce((s, f) => s + f.valor, 0);
        const dif = Math.abs(tiago - yasmin) / 2;
        const elAcerto = document.getElementById('stat-acerto');

        if (tiago > yasmin) elAcerto.innerHTML = `Yasmin deve pagar<br>+ ${Utils.formatarMoeda(dif)}`;
        else if (yasmin > tiago) elAcerto.innerHTML = `Tiago deve pagar<br>- ${Utils.formatarMoeda(dif)}`;
        else elAcerto.innerText = 'Tudo quite!';

        if (document.getElementById('dashboard').classList.contains('ativa')) Analytics.atualizarGrafico();
    },
    viagens: () => {
        const lista = document.getElementById('lista-viagens');
        if (!lista) return;

        const campoFiltro = document.getElementById('filtro-roteiros');
        const termoBusca = campoFiltro ? campoFiltro.value.toLowerCase() : '';

        const viagensFiltradas = Estado.viagens.filter(v => v.destino.toLowerCase().includes(termoBusca));

        lista.innerHTML = viagensFiltradas.length ? '' : '<p class="text-muted" style="grid-column: 1 / -1;">Nenhum roteiro salvo encontrado.</p>';

        viagensFiltradas.sort((a, b) => new Date(a.ida) - new Date(b.ida)).forEach(v => {
            lista.innerHTML += `
                <div class="card-flat">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <h3 style="color: var(--text-title); font-weight: 800; text-transform: capitalize;">${v.destino}</h3>
                        <button class="btn-icon text-danger" onclick="Controladores.deletar('viagem', '${v.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <p class="text-muted" style="font-size: 0.9rem;"><i class="fa-regular fa-calendar"></i> ${Utils.formatarData(v.ida)} a ${Utils.formatarData(v.volta)}</p>
                    ${v.link ? `<a href="${v.link}" target="_blank" style="color: var(--primary-blue); font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-block; margin-top: 5px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar Reserva</a>` : ''}
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                        <span class="badge receita">Orçamento: ${Utils.formatarMoeda(v.orcamento)}</span>
                    </div>
                </div>`;
        });
    },
    financas: () => {
        const lista = document.getElementById('lista-financas');
        if (!lista) return;
        lista.innerHTML = Estado.financas.length ? '' : '<tr><td colspan="5" style="text-align: center;" class="text-muted">Nenhuma movimentação.</td></tr>';
        [...Estado.financas].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(f => {
            lista.innerHTML += `
                <tr>
                    <td>${Utils.formatarData(f.data)}</td>
                    <td style="font-weight: 600;">${f.desc}</td>
                    <td>${f.resp}</td>
                    <td><span class="badge ${f.tipo}">${f.tipo === 'receita' ? '+' : '-'} ${Utils.formatarMoeda(f.valor)}</span></td>
                    <td><button class="btn-icon text-danger" onclick="Controladores.deletar('financa', '${f.id}')"><i class="fa-solid fa-trash"></i></button></td>
                </tr>`;
        });
    },
    metas: () => {
        const lista = document.getElementById('lista-metas');
        if (!lista) return;
        lista.innerHTML = Estado.metas.length ? '' : '<p class="text-muted">Nenhuma meta ativa no momento.</p>';
        Estado.metas.sort((a, b) => new Date(a.prazo) - new Date(b.prazo)).forEach(m => {
            const atrasado = new Date(m.prazo + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
            lista.innerHTML += `
                <div class="card-flat">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <h3 style="font-weight: 800;">${m.titulo}</h3>
                        <button class="btn-icon text-danger" onclick="Controladores.deletar('meta', '${m.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <p style="color: ${atrasado ? 'var(--danger)' : 'var(--success)'}; font-weight: 700; font-size: 0.9rem;">
                        <i class="fa-regular fa-clock"></i> Prazo: ${Utils.formatarData(m.prazo)} ${atrasado ? '(Atrasado)' : ''}
                    </p>
                </div>`;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Escuta estado de login em todas as páginas para redirecionamento imediato
    Auth.iniciarObserver();

    // Eventos da página de Auth
    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.addEventListener('submit', Auth.login);
    const formCadastro = document.getElementById('form-cadastro');
    if (formCadastro) formCadastro.addEventListener('submit', Auth.cadastro);

    // Eventos da página do App Principal
    if (window.location.pathname.includes('app.html')) {
        document.getElementById('form-viagem')?.addEventListener('submit', Controladores.adicionarViagem);
        document.getElementById('form-financa')?.addEventListener('submit', Controladores.adicionarFinanca);
        document.getElementById('form-meta')?.addEventListener('submit', Controladores.adicionarMeta);

        const filtroInput = document.getElementById('filtro-roteiros');
        if (filtroInput) filtroInput.addEventListener('input', Render.viagens);

        UI.setupNav();
    }
});