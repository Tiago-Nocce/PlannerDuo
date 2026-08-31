// ==========================================
// CONFIGURAÇÃO DO FIREBASE (Substitua pelas suas chaves)
// ==========================================
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO
// ==========================================
const Estado = {
    usuario: null, // O e-mail do casal será a chave do documento no Firestore
    viagens: [],
    financas: [],
    metas: []
};

// ==========================================
// UTILITÁRIOS & SINCRONIZAÇÃO EM NUVEM
// ==========================================
const Utils = {
    gerarId: () => crypto.randomUUID ? crypto.randomUUID() : '_' + Math.random().toString(36).substr(2, 9),
    formatarMoeda: (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor),
    formatarData: (dataString) => {
        if (!dataString) return '';
        const [ano, mes, dia] = dataString.split('-');
        return `${dia}/${mes}/${ano}`;
    },
    gerarSlug: (texto) => texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),

    salvarNaNuvem: async (colecao) => {
        if (!Estado.usuario) return;
        try {
            await db.collection('casais').doc(Estado.usuario).set({
                [colecao]: Estado[colecao]
            }, { merge: true });
        } catch (error) {
            console.error("Erro ao salvar no Firebase:", error);
            UI.mostrarToast("Erro de conexão", "erro");
        }
    },

    ouvirNuvem: () => {
        if (!Estado.usuario) return;
        db.collection('casais').doc(Estado.usuario).onSnapshot((doc) => {
            if (doc.exists) {
                const dados = doc.data();
                Estado.viagens = dados.viagens || [];
                Estado.financas = dados.financas || [];
                Estado.metas = dados.metas || [];
                Render.tudo();
            }
        });
    }
};

// ==========================================
// UI / MODAIS / FEEDBACK
// ==========================================
const UI = {
    abrirModal: (id) => document.getElementById(id).classList.add('ativa'),
    fecharModal: (id) => {
        document.getElementById(id).classList.remove('ativa');
        const form = document.querySelector(`#${id} form`);
        if (form) form.reset();
    },
    mostrarToast: (mensagem, tipo = 'sucesso') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        const icone = tipo === 'sucesso' ? 'fa-check-circle text-success' : 'fa-circle-exclamation text-danger';
        toast.innerHTML = `<i class="fa-solid ${icone}"></i> <span>${mensagem}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.classList.add('oculto'); setTimeout(() => toast.remove(), 300); }, 3000);
    },
    setupNav: () => {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('ativo'));
                document.querySelectorAll('.view').forEach(view => view.classList.remove('ativa'));
                item.classList.add('ativo');
                const alvoId = item.getAttribute('data-alvo');
                document.getElementById(alvoId).classList.add('ativa');
                document.querySelector('.sidebar').classList.remove('aberto');
            });
        });
        document.getElementById('btn-menu-mobile')?.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('aberto');
        });
    }
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================
const Auth = {
    verificarSessao: () => {
        const user = localStorage.getItem('planner_user');
        const telaAuth = document.getElementById('tela-autenticacao');
        const telaApp = document.getElementById('tela-app');

        if (user) {
            Estado.usuario = user;
            telaAuth.classList.remove('ativa');
            telaApp.classList.add('ativa');
            const nomeStr = localStorage.getItem('planner_name') || user.split('@')[0];
            const primeiroNome = nomeStr.split(' ')[0];
            document.getElementById('saudacao-usuario').innerText = `Olá, ${primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1)}`;

            // Inicia Sincronização em Tempo Real (Firebase)
            Utils.ouvirNuvem();
        } else {
            telaAuth.classList.add('ativa');
            telaApp.classList.remove('ativa');
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
        localStorage.setItem('planner_name', document.getElementById('cadastro-nome').value);
        localStorage.setItem('planner_user', document.getElementById('cadastro-email').value);
        UI.mostrarToast('Conta criada com sucesso!');
        Auth.verificarSessao();
    },
    logout: () => {
        if (confirm('Desejam sair da conta?')) {
            localStorage.removeItem('planner_user');
            Estado.usuario = null;
            Auth.verificarSessao();
        }
    },
    alternarTela: (tipo) => {
        document.getElementById('secao-login').classList.remove('ativa');
        document.getElementById('secao-cadastro').classList.remove('ativa');
        document.getElementById(`secao-${tipo}`).classList.add('ativa');
    }
};

// ==========================================
// MOTOR DE BUSCAS PARAMÉTRICAS
// ==========================================
const ServicoBusca = {
    redirecionar: (plataforma) => {
        const origem = document.getElementById('busca-origem').value.trim();
        const destino = document.getElementById('busca-destino').value.trim();
        const dataIda = document.getElementById('busca-data-ida').value;
        const dataVolta = document.getElementById('busca-data-volta').value;
        const passageiros = document.getElementById('busca-passageiros').value;

        if (!destino) {
            UI.mostrarToast('Preencha o destino!', 'erro');
            return;
        }

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
            case 'decolar': url = (dataIda && dataVolta) ? `https://www.decolar.com/shop/flights/results/roundtrip/${origEnc}/${destEnc}/${dataIda}/${dataVolta}/${passageiros}/0/0` : `https://www.decolar.com/passagens-aereas/`; break;
            case 'buser': url = `https://www.buser.com.br/onibus/${origSlug}/${destSlug}`; if (dataIda) url += `?ida=${dataIda}`; if (dataVolta) url += `${dataIda ? '&' : '?'}volta=${dataVolta}`; break;
            case 'clickbus': url = `https://www.clickbus.com.br/onibus/${origSlug}/${destSlug}`; if (dataIda) url += `?departureDate=${dataIda}`; if (dataVolta) url += `${dataIda ? '&' : '?'}returnDate=${dataVolta}`; break;
        }
        window.open(url, '_blank');
    }
};

// ==========================================
// CONTROLADORES DE CRUD (AGORA SALVA NO FIREBASE)
// ==========================================
const Controladores = {
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
        Utils.salvarNaNuvem('viagens');
        UI.fecharModal('modal-viagem');
        UI.mostrarToast('Roteiro salvo na nuvem!');
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
        Utils.salvarNaNuvem('financas');
        UI.fecharModal('modal-financa');
        UI.mostrarToast('Transação salva na nuvem!');
    },

    adicionarMeta: (e) => {
        e.preventDefault();
        Estado.metas.push({
            id: Utils.gerarId(),
            titulo: document.getElementById('meta-titulo').value,
            prazo: document.getElementById('meta-prazo').value
        });
        Utils.salvarNaNuvem('metas');
        UI.fecharModal('modal-meta');
        UI.mostrarToast('Meta salva na nuvem!');
    },

    deletar: (tipo, id) => {
        if (!confirm('Desejam excluir este item?')) return;
        if (tipo === 'viagem') { Estado.viagens = Estado.viagens.filter(v => v.id !== id); Utils.salvarNaNuvem('viagens'); }
        if (tipo === 'financa') { Estado.financas = Estado.financas.filter(f => f.id !== id); Utils.salvarNaNuvem('financas'); }
        if (tipo === 'meta') { Estado.metas = Estado.metas.filter(m => m.id !== id); Utils.salvarNaNuvem('metas'); }
        UI.mostrarToast('Item excluído.');
    }
};

// ==========================================
// RENDERIZAÇÃO
// ==========================================
const Render = {
    tudo: () => { Render.dashboard(); Render.viagens(); Render.financas(); Render.metas(); },

    dashboard: () => {
        const futuras = Estado.viagens.filter(v => new Date(v.ida) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => new Date(a.ida) - new Date(b.ida));
        document.getElementById('stat-next-trip').innerText = futuras.length ? `${futuras[0].destino}` : 'Nenhum agendado';

        const mesAtual = new Date().getMonth(), anoAtual = new Date().getFullYear();
        const despesasMes = Estado.financas.filter(f => f.tipo === 'despesa' && new Date(f.data + 'T00:00:00').getMonth() === mesAtual && new Date(f.data + 'T00:00:00').getFullYear() === anoAtual).reduce((s, f) => s + f.valor, 0);
        document.getElementById('stat-expenses').innerText = Utils.formatarMoeda(despesasMes);

        document.getElementById('stat-goals').innerText = Estado.metas.filter(m => new Date(m.prazo + 'T00:00:00') >= new Date(new Date().setHours(0, 0, 0, 0))).length;

        // Calculadora de Acerto (Dashboard)
        const totalEu = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Eu').reduce((s, f) => s + f.valor, 0);
        const totalEle = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Ele(a)').reduce((s, f) => s + f.valor, 0);
        const diferenca = Math.abs(totalEu - totalEle) / 2;
        const elAcertoDash = document.getElementById('stat-acerto');
        if (totalEu > totalEle) elAcertoDash.innerHTML = `Ele(a) deve: <br> ${Utils.formatarMoeda(diferenca)}`;
        else if (totalEle > totalEu) elAcertoDash.innerHTML = `Você deve: <br> ${Utils.formatarMoeda(diferenca)}`;
        else elAcertoDash.innerText = 'Tudo quite!';
    },

    viagens: () => {
        const lista = document.getElementById('lista-viagens');
        lista.innerHTML = Estado.viagens.length ? '' : '<p class="text-muted">Nenhum roteiro salvo. Utilizem a busca acima para planejar!</p>';

        Estado.viagens.sort((a, b) => new Date(a.ida) - new Date(b.ida)).forEach(v => {
            lista.innerHTML += `
                <div class="card-flat">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <h3 style="font-size: 1.15rem; color: var(--text-title); font-weight: 800;">${v.destino}</h3>
                        <button class="btn-icon text-danger" onclick="Controladores.deletar('viagem', '${v.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 8px;"><i class="fa-regular fa-calendar"></i> ${Utils.formatarData(v.ida)} a ${Utils.formatarData(v.volta)}</p>
                    ${v.link ? `<a href="${v.link}" target="_blank" style="color: var(--primary-orange); text-decoration: none; font-size: 0.85rem; font-weight: 700;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Acessar Reserva</a>` : ''}
                    <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                        <span class="badge receita">Orçamento: ${Utils.formatarMoeda(v.orcamento)}</span>
                    </div>
                </div>`;
        });
    },

    financas: () => {
        const lista = document.getElementById('lista-financas');
        const totais = Estado.financas.reduce((acc, f) => { acc[f.tipo === 'receita' ? 'receitas' : 'despesas'] += f.valor; return acc; }, { receitas: 0, despesas: 0 });

        document.getElementById('total-receitas').innerText = Utils.formatarMoeda(totais.receitas);
        document.getElementById('total-despesas').innerText = Utils.formatarMoeda(totais.despesas);
        const saldo = totais.receitas - totais.despesas;
        document.getElementById('total-saldo').innerText = Utils.formatarMoeda(saldo);
        document.getElementById('total-saldo').className = saldo >= 0 ? 'text-success' : 'text-danger';

        // Lógica de Acerto de Contas na aba Finanças
        const totalEu = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Eu').reduce((s, f) => s + f.valor, 0);
        const totalEle = Estado.financas.filter(f => f.tipo === 'despesa' && f.resp === 'Ele(a)').reduce((s, f) => s + f.valor, 0);
        const diferenca = Math.abs(totalEu - totalEle) / 2;
        const elAcerto = document.getElementById('status-acerto');

        if (totalEu > totalEle) {
            elAcerto.innerHTML = `Ele(a) deve pagar<br><span style="color: #10b981; font-weight: 800;">+ ${Utils.formatarMoeda(diferenca)}</span>`;
        } else if (totalEle > totalEu) {
            elAcerto.innerHTML = `Você deve pagar<br><span style="color: #ef4444; font-weight: 800;">- ${Utils.formatarMoeda(diferenca)}</span>`;
        } else {
            elAcerto.innerHTML = `Tudo quite!<br><i class="fa-solid fa-handshake"></i>`;
        }

        lista.innerHTML = Estado.financas.length ? '' : '<tr><td colspan="5" style="text-align: center;" class="text-muted">Nenhuma movimentação cadastrada.</td></tr>';

        [...Estado.financas].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(f => {
            lista.innerHTML += `
                <tr>
                    <td>${Utils.formatarData(f.data)}</td>
                    <td style="font-weight: 600; color: var(--text-dark);">${f.desc}</td>
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
            const cor = atrasado ? 'var(--danger)' : 'var(--success)';
            lista.innerHTML += `
                <div class="card-flat">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                        <h3 style="font-size: 1.15rem; color: var(--text-dark); font-weight: 800;">${m.titulo}</h3>
                        <button class="btn-icon text-danger" onclick="Controladores.deletar('meta', '${m.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <p style="color: ${cor}; font-weight: 700; font-size: 0.9rem;"><i class="fa-regular fa-clock"></i> Prazo: ${Utils.formatarData(m.prazo)} ${atrasado ? '(Atrasado)' : ''}</p>
                </div>`;
        });
    }
};

// ==========================================
// INICIALIZAÇÃO EVENT LISTENERS
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