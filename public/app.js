// ==========================================
// CONFIGURAÇÃO DO FIREBASE
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAywzg4yDP0p15RpnFwPc2Y2MGoT2U5l4M",
    authDomain: "plannerduo.firebaseapp.com",
    projectId: "plannerduo",
    storageBucket: "plannerduo.firebasestorage.app",
    messagingSenderId: "355035332668",
    appId: "1:355035332668:web:9c91fb300c4b601dfc4339",
    measurementId: "G-GFCLFVXP4E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ==========================================
// SEGURANÇA E UTILITÁRIOS
// ==========================================
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

            if (user) {
                // Autenticado
                Estado.usuarioUid = user.uid;
                Estado.emailId = user.email.replace(/[^a-zA-Z0-9]/g, '');
                if (!isAppPage) {
                    window.location.href = 'app.html'; // Redireciona pro app se logado e tiver fora
                } else {
                    document.getElementById('loader-tela').style.display = 'none';
                    document.getElementById('tela-app').style.opacity = '1';
                    Controladores.ouvirNuvem();
                }
            } else {
                // Não autenticado
                if (isAppPage) {
                    window.location.href = 'auth.html'; // Expulsa do app se tentar entrar sem login
                }
            }
        });
    },
    login: (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const senha = document.getElementById('login-senha').value;

        auth.signInWithEmailAndPassword(email, senha)
            .catch((error) => UI.mostrarToast("Erro no login. Verifique as credenciais.", "erro"));
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
// BANCO DE DADOS EM TEMPO REAL
// ==========================================
const Controladores = {
    ouvirNuvem: () => {
        if (!Estado.emailId) return;
        // Usa o e-mail sanitizado como ID único do casal para o DB
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
    // ... MANTER AS FUNÇÕES ADICIONAR E DELETAR (adicionarViagem, adicionarFinanca, deletar) IDÊNTICAS AO CÓDIGO ANTERIOR ...
};

// ==========================================
// RENDERIZAÇÃO E INICIALIZAÇÃO
// ==========================================
const Render = {
    // ... MANTER AS FUNÇÕES RENDER (tudo, dashboard, viagens, financas, metas) E ANALYTICS EXATAMENTE IDÊNTICAS AO CÓDIGO ANTERIOR ...
};

document.addEventListener('DOMContentLoaded', () => {
    // Conecta formulários apenas se eles existirem na página atual
    const formLogin = document.getElementById('form-login');
    if (formLogin) formLogin.addEventListener('submit', Auth.login);

    const formCadastro = document.getElementById('form-cadastro');
    if (formCadastro) formCadastro.addEventListener('submit', Auth.cadastro);

    // Inicia a vigilância de segurança em todas as páginas
    Auth.iniciarObserver();
    if (window.location.pathname.includes('app.html')) {
        UI.setupNav();
        // ... (Manter bind de filtro de viagens, form-viagem, form-financa etc)
    }
});