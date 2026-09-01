// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI", // Insira suas chaves do Firebase aqui
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// ESTADO GLOBAL & SEGURANÇA (SPRINT 1)
// ==========================================
const Estado = { usuario: null, viagens: [], financas: [], metas: [] };

const Seguranca = {
    sanitizar: (texto) => {
        const div = document.createElement('div');
        div.innerText = texto;
        return div.innerHTML;
    },
    validarEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    validarSenha: (senha) => /^(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/.test(senha) // 8+ chars, 1 maiúscula, 1 número
};

const Utils = {
    gerarId: () => crypto.randomUUID ? crypto.randomUUID() : '_' + Math.random().toString(36).substr(2, 9),
    formatarMoeda: (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor),
    formatarData: (dataStr) => {
        if (!dataStr) return '';
        const [ano, mes, dia] = dataStr.split('-');
        return `${dia}/${mes}/${ano}`;
    }
};

// ==========================================
// UI, ALERTAS & CONTROLE DE MODAIS
// ==========================================
const UI = {
    abrirModal: (id) => document.getElementById(id).classList.add('ativa'),
    fecharModal: (id) => {
        document.getElementById(id).classList.remove('ativa');
        document.querySelector(`#${id} form`)?.reset();
    },
    mostrarToast: (mensagem, tipo = 'sucesso') => {
        const container = document.getElementById('toast-container');
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

                // Recarrega o gráfico apenas se for a aba Dashboard
                if (alvoId === 'dashboard') Analytics.atualizarGrafico();
            });
        });
        document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('aberto');
        });
    }
};

// ==========================================
// AUTENTICAÇÃO E ROTEAMENTO (SPA)
// ==========================================
const Auth = {
    iniciarApp: (acao) => {
        Auth.navegar('autenticacao');
        Auth.alternarTela(acao);
    },
    navegar: (destino) => {
        document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
        document.getElementById(`tela-${destino}`).classList.add('ativa');
    },
    alternarTela: (tipo) => {
        document.querySelectorAll('.secao-form').forEach(s => s.classList.remove('ativa'));
        document.getElementById(`secao-${tipo}`).classList.add('ativa');
    },
    verificarSessao: () => {
        const user = localStorage.getItem('planner_user');
        if (user) {
            Estado.usuario = user;
            Auth.navegar('app');
            const nomeStr = localStorage.getItem('planner_name') || user.split('@')[0];
            document.getElementById('saudacao-usuario').innerText = `Olá, ${nomeStr.split(' ')[0]}`;
            Controladores.ouvirNuvem(); // Inicia escuta em tempo real do Firestore
        } else {
            Auth.navegar('landing');
        }
    },
    login: (e) => {
        e.preventDefault();
        localStorage.setItem('planner_user', document.getElementById('login-email').value);
        UI.mostrarToast('Login realizado com sucesso!');
        Auth.verificarSessao();
    },
    cadastro: (e) => {
        e.preventDefault();
        const nome = Seguranca.sanitizar(document.getElementById('cadastro-nome').value);
        const email = document.getElementById('cadastro-email').value;
        const senha = document.getElementById('cadastro-senha').value;

        if (!Seguranca.validarEmail(email)) return UI.mostrarToast('Formato de e-mail inválido.', 'erro');
        if (!Seguranca.validarSenha(senha)) return UI.mostrarToast('Senha deve ter 8+ caracteres, 1 maiúscula e 1 número.', 'erro');

        localStorage.setItem('planner_name', nome);
        localStorage.setItem('planner_user', email);
        UI.mostrarToast('Conta criada! Bem-vindos.');
        Auth.verificarSessao();
    },
    logout: () => {
        if (confirm('Desejam sair da conta?')) {
            localStorage.removeItem('planner_user');
            Estado.usuario = null;
            Auth.verificarSessao();
        }
    }
};

// ==========================================
// CONTROLADORES CRUD (FIREBASE) E NOTIFICAÇÕES (SPRINT 2)
// ==========================================
const Controladores = {
    ouvirNuvem: () => {
        if (!Estado.usuario) return;
        db.collection('casais').doc(Estado.usuario).onSnapshot((doc) => {
            if (doc.exists) {
                const dados = doc.data();
                Estado.viagens = dados.viagens || [];
                Estado.financas = dados.financas || [];
                Estado.metas = dados.metas || [];
                Render.tudo();
            } else {
                Render.tudo();
            }
        });
    },
    salvarNaNuvem: async (colecao) => {
        if (!Estado.usuario) return;
        try {
            await db.collection('casais').doc(Estado.usuario).set({ [colecao]: Estado[colecao] }, { merge: true });
        } catch (error) {
            UI.mostrarToast("Erro de conexão ao salvar.", "erro");
        }
    },
    adicionarViagem: (e) => {
        e.preventDefault();
        Estado.viagens.push({
            id: Utils.gerarId(),
            destino: Seguranca.sanitizar(document.getElementById('viagem-destino').value),
            ida: document.getElementById('viagem-ida').value,
            volta: document.getElementById('viagem-volta').value,
            orcamento: parseFloat(document.getElementById('viagem-orcamento').value)
        });
        Controladores.salvarNaNuvem('viagens');
        UI.fecharModal('modal-viagem');
        UI.mostrarToast('Roteiro salvo!');
    },
    adicionarFinanca: (e) => {
        e.preventDefault();
        Estado.financas.push({
            id: Utils.gerarId(),
            desc: Seguranca.sanitizar(document.getElementById('financa-desc').value),
            tipo: document.getElementById('financa-tipo').value,
            valor: parseFloat(document.getElementById('financa-valor').value),
            resp: document.getElementById('financa-resp').value,
            data: document.getElementById('financa-data').value
        });
        Controladores.salvarNaNuvem('financas');
        UI.fecharModal('modal-financa');
        UI.mostrarToast('Nova transação registrada! (Notificação simulada enviada ao parceiro)');
    },
    adicionarMeta: (e) => {
        e.preventDefault();
        Estado.metas.push({
            id: Utils.gerarId(),
            titulo: Seguranca.sanitizar(document.getElementById('meta-titulo').value),
            prazo: document.getElementById('meta-prazo').value
        });
        Controladores.salvarNaNuvem('metas');
        UI.fecharModal('modal-meta');
        UI.mostrarToast('Meta cadastrada!');
    },
    deletar: (tipo, id) => {
        if (!confirm('Excluir este registro permanentemente?')) return;
        if (tipo === 'viagem') { Estado.viagens = Estado.viagens.filter(v => v.id !== id); Controladores.salvarNaNuvem('viagens'); }
        if (tipo === 'financa') { Estado.financas = Estado.financas.filter(f => f.id !== id); Controladores.salvarNaNuvem('financas'); }
        if (tipo === 'meta') { Estado.metas = Estado.metas.filter(m => m.id !== id); Controladores.salvarNaNuvem('metas'); }
        UI.mostrarToast('Item excluído.');
    }
};

// ==========================================
// MÓDULOS DE ANALYTICS & EXPORTAÇÃO (SPRINT 3)
// ==========================================
let chartInstancia = null;
const Analytics = {
    atualizarGrafico: () => {
        const ctx = document.getElementById('graficoDespesas').getContext('2d');
        const euTotal = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Eu').reduce((s, f) => s + f.valor, 0);
        const eleTotal = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Ele(a)').reduce((s, f) => s + f.valor, 0);

        if (chartInstancia) chartInstancia.destroy();
        chartInstancia = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pagos por Mim', 'Pagos por Ele(a)'],
                datasets: [{
                    data: [euTotal, eleTotal],
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
        if (!Estado.financas.length) return UI.mostrarToast('Sem dados financeiros para exportar', 'erro');

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
        UI.mostrarToast('Download do relatório em CSV concluído!');
    }
};

// ==========================================
// MOTOR DE RENDERIZAÇÃO DOM
// ==========================================
const Render = {
    tudo: () => { Render.dashboard(); Render.viagens(); Render.financas(); Render.metas(); },
    dashboard: () => {
        const futuras = Estado.viagens.filter(v => new Date(v.ida) >= new Date().setHours(0, 0, 0, 0)).sort((a, b) => new Date(a.ida) - new Date(b.ida));
        document.getElementById('stat-next-trip').innerText = futuras.length ? futuras[0].destino : 'Nenhuma';

        const despesasMes = Estado.financas.filter(f => f.tipo === 'despesa').reduce((s, f) => s + f.valor, 0);
        document.getElementById('stat-expenses').innerText = Utils.formatarMoeda(despesasMes);

        const eu = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Eu').reduce((s, f) => s + f.valor, 0);
        const ele = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Ele(a)').reduce((s, f) => s + f.valor, 0);
        const dif = Math.abs(eu - ele) / 2;
        const elAcerto = document.getElementById('stat-acerto');

        if (eu > ele) elAcerto.innerHTML = `Ele(a) deve pagar<br>+ ${Utils.formatarMoeda(dif)}`;
        else if (ele > eu) elAcerto.innerHTML = `Você deve pagar<br>- ${Utils.formatarMoeda(dif)}`;
        else elAcerto.innerText = 'Tudo quite!';

        if (document.getElementById('dashboard').classList.contains('ativa')) Analytics.atualizarGrafico();
    },
    viagens: () => {
        const lista = document.getElementById('lista-viagens');
        lista.innerHTML = Estado.viagens.length ? '' : '<p class="text-muted">Nenhum roteiro salvo.</p>';
        Estado.viagens.sort((a, b) => new Date(a.ida) - new Date(b.ida)).forEach(v => {
            lista.innerHTML += `
                <div class="card-flat">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <h3 style="color: var(--text-title); font-weight: 800;">${v.destino}</h3>
                        <button class="btn-icon text-danger" onclick="Controladores.deletar('viagem', '${v.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <p class="text-muted" style="font-size: 0.9rem;"><i class="fa-regular fa-calendar"></i> ${Utils.formatarData(v.ida)} a ${Utils.formatarData(v.volta)}</p>
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                        <span class="badge receita">Orçamento: ${Utils.formatarMoeda(v.orcamento)}</span>
                    </div>
                </div>`;
        });
    },
    financas: () => {
        const lista = document.getElementById('lista-financas');
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

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-login').addEventListener('submit', Auth.login);
    document.getElementById('form-cadastro').addEventListener('submit', Auth.cadastro);
    document.getElementById('form-viagem').addEventListener('submit', Controladores.adicionarViagem);
    document.getElementById('form-financa').addEventListener('submit', Controladores.adicionarFinanca);
    document.getElementById('form-meta').addEventListener('submit', Controladores.adicionarMeta);

    UI.setupNav();
    Auth.verificarSessao();
});