// ==========================================
// ESTADO GLOBAL DA APLICAÇÃO (PLANNER DUO)
// ==========================================
const Estado = {
    usuario: null,
    viagens: JSON.parse(localStorage.getItem('planner_viagens')) || [],
    financas: JSON.parse(localStorage.getItem('planner_financas')) || [],
    metas: JSON.parse(localStorage.getItem('planner_metas')) || []
};

// ==========================================
// UTILITÁRIOS
// ==========================================
const Utils = {
    gerarId: () => crypto.randomUUID ? crypto.randomUUID() : '_' + Math.random().toString(36).substr(2, 9),
    formatarMoeda: (valor) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor),
    formatarData: (dataString) => {
        if (!dataString) return '';
        const [ano, mes, dia] = dataString.split('-');
        return `${dia}/${mes}/${ano}`;
    },
    gerarSlug: (texto) => {
        return texto.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    },
    salvar: (chave, dados) => localStorage.setItem(chave, JSON.stringify(dados))
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

                if (alvoId === 'dashboard') Render.dashboard();
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

            Render.tudo();
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
        UI.mostrarToast('Conta do Casal criada com sucesso!');
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
// BUSCAS PARAMÉTRICAS (HUB DE VIAGENS)
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
// CONTROLADORES DE CRUD
// ==========================================
const Controladores = {
    salvar: (tipo, formId, buildObj) => {
        const estadoKey = tipo === 'viagem' ? 'viagens' : tipo === 'financa' ? 'financas' : 'metas';
        Estado[estadoKey].push(buildObj());
        Utils.salvar(`planner_${estadoKey}`, Estado[estadoKey]);
        UI.fecharModal(`modal-${tipo}`);
        UI.mostrarToast('Salvo com sucesso!');
        Render.tudo();
    },
    deletar: (tipo, id) => {
        if (!confirm('Deseja excluir?')) return;
        const estadoKey = tipo === 'viagem' ? 'viagens' : tipo === 'financa' ? 'financas' : 'metas';
        Estado[estadoKey] = Estado[estadoKey].filter(item => item.id !== id);
        Utils.salvar(`planner_${estadoKey}`, Estado[estadoKey]);
        UI.mostrarToast('Removido com sucesso.');
        Render.tudo();
    }
};

// ==========================================
// RENDERIZAÇÃO
// ==========================================
const Render = {
    tudo: () => { Render.dashboard(); Render.viagens(); Render.financas(); Render.metas(); },
    dashboard: () => {
        const futuras = Estado.viagens.filter(v => new Date(v.ida) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => new Date(a.ida) - new Date(b.ida));
        document.getElementById('stat-next-trip').innerText = futuras.length ? `${futuras[0].destino} (${Utils.formatarData(futuras[0].ida)})` : 'Nenhum';

        const mesAtual = new Date().getMonth(), anoAtual = new Date().getFullYear();
        const despesasMes = Estado.financas.filter(f => f.tipo === 'despesa' && new Date(f.data + 'T00:00:00').getMonth() === mesAtual && new Date(f.data + 'T00:00:00').getFullYear() === anoAtual).reduce((s, f) => s + f.valor, 0);
        document.getElementById('stat-expenses').innerText = Utils.formatarMoeda(despesasMes);
        document.getElementById('stat-goals').innerText = Estado.metas.filter(m => new Date(m.prazo + 'T00:00:00') >= new Date(new Date().setHours(0, 0, 0, 0))).length;
    },
    viagens: () => {
        const lista = document.getElementById('lista-viagens');
        lista.innerHTML = Estado.viagens.length ? '' : '<p class="text-muted">Nenhum roteiro salvo.</p>';
        Estado.viagens.sort((a, b) => new Date(a.ida) - new Date(b.ida)).forEach(v => {
            lista.innerHTML += `<div class="card-flat">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <h3 style="color: var(--text-title); font-size: 1.1rem;">${v.destino}</h3>
                    <button class="btn-icon" onclick="Controladores.deletar('viagem', '${v.id}')"><i class="fa-solid fa-trash text-danger"></i></button>
                </div>
                <p class="text-muted" style="font-size: 0.9rem; margin-bottom: 8px;"><i class="fa-regular fa-calendar"></i> ${Utils.formatarData(v.ida)} a ${Utils.formatarData(v.volta)}</p>
                ${v.link ? `<a href="${v.link}" target="_blank" style="color: var(--primary-orange); font-size: 0.85rem; font-weight: 600; text-decoration: none;"><i class="fa-solid fa-link"></i> Ver Reserva</a>` : ''}
                <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-light);">
                    <span class="badge receita">Orçamento: ${Utils.formatarMoeda(v.orcamento)}</span>
                </div>
            </div>`;
        });
    },
    financas: () => {
        const totais = Estado.financas.reduce((acc, f) => { acc[f.tipo === 'receita' ? 'receitas' : 'despesas'] += f.valor; return acc; }, { receitas: 0, despesas: 0 });
        document.getElementById('total-receitas').innerText = Utils.formatarMoeda(totais.receitas);
        document.getElementById('total-despesas').innerText = Utils.formatarMoeda(totais.despesas);
        document.getElementById('total-saldo').innerText = Utils.formatarMoeda(totais.receitas - totais.despesas);

        const lista = document.getElementById('lista-financas');
        lista.innerHTML = Estado.financas.length ? '' : '<tr><td colspan="5" class="text-muted" style="text-align: center;">Nenhuma movimentação cadastrada.</td></tr>';
        [...Estado.financas].sort((a, b) => new Date(b.data) - new Date(a.data)).forEach(f => {
            lista.innerHTML += `<tr>
                <td>${Utils.formatarData(f.data)}</td>
                <td style="font-weight: 500;">${f.desc}</td>
                <td>${f.resp}</td>
                <td><span class="badge ${f.tipo}">${f.tipo === 'receita' ? '+' : '-'} ${Utils.formatarMoeda(f.valor)}</span></td>
                <td><button class="btn-icon text-danger" onclick="Controladores.deletar('financa', '${f.id}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
        });
    },
    metas: () => {
        const lista = document.getElementById('lista-metas');
        lista.innerHTML = Estado.metas.length ? '' : '<p class="text-muted">Nenhuma meta ativa.</p>';
        Estado.metas.sort((a, b) => new Date(a.prazo) - new Date(b.prazo)).forEach(m => {
            const atrasado = new Date(m.prazo + 'T00:00:00') < new Date(new Date().setHours(0, 0, 0, 0));
            lista.innerHTML += `<div class="card-flat">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <h3 style="color: var(--text-title); font-size: 1.1rem;">${m.titulo}</h3>
                    <button class="btn-icon" onclick="Controladores.deletar('meta', '${m.id}')"><i class="fa-solid fa-trash text-danger"></i></button>
                </div>
                <p style="color: ${atrasado ? 'var(--danger)' : 'var(--success)'}; font-weight: 600; font-size: 0.9rem;"><i class="fa-regular fa-clock"></i> Prazo: ${Utils.formatarData(m.prazo)} ${atrasado ? '(Atrasado)' : ''}</p>
            </div>`;
        });
    }
};

// ==========================================
// START
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('form-login').addEventListener('submit', Auth.login);
    document.getElementById('form-cadastro').addEventListener('submit', Auth.cadastro);
    document.getElementById('form-viagem').addEventListener('submit', (e) => Controladores.salvar('viagem', 'form-viagem', () => ({ id: Utils.gerarId(), destino: document.getElementById('viagem-destino').value, ida: document.getElementById('viagem-ida').value, volta: document.getElementById('viagem-volta').value, link: document.getElementById('viagem-link').value, orcamento: parseFloat(document.getElementById('viagem-orcamento').value) })));
    document.getElementById('form-financa').addEventListener('submit', (e) => Controladores.salvar('financa', 'form-financa', () => ({ id: Utils.gerarId(), desc: document.getElementById('financa-desc').value, tipo: document.getElementById('financa-tipo').value, valor: parseFloat(document.getElementById('financa-valor').value), resp: document.getElementById('financa-resp').value, data: document.getElementById('financa-data').value })));
    document.getElementById('form-meta').addEventListener('submit', (e) => Controladores.salvar('meta', 'form-meta', () => ({ id: Utils.gerarId(), titulo: document.getElementById('meta-titulo').value, prazo: document.getElementById('meta-prazo').value })));

    UI.setupNav();
    Auth.verificarSessao();
});