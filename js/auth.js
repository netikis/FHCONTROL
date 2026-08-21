/**
 * FH CONTROL — Login / sessão (Fase 3)
 * Telas de perfil, login admin/balcão, sessão (F5) e logout.
 * Cadastro de vendedores / senha admin permanece no módulo Firebase (usa db).
 */
(function () {
    'use strict';

    window.mostrarFormAdmin = function () {
        document.getElementById('botoesPerfil').style.display = 'none';
        document.getElementById('formLoginAdmin').style.display = 'block';
        document.getElementById('inputSenhaAdmin').value = '';
        document.getElementById('inputSenhaAdmin').focus();
    };

    window.mostrarFormBalcao = function () {
        document.getElementById('botoesPerfil').style.display = 'none';
        document.getElementById('formLoginBalcao').style.display = 'block';
        document.getElementById('inputUserBalcao').value = '';
        document.getElementById('inputSenhaBalcao').value = '';
        document.getElementById('inputUserBalcao').focus();
    };

    window.voltarParaPerfis = function () {
        document.getElementById('formLoginAdmin').style.display = 'none';
        document.getElementById('formLoginBalcao').style.display = 'none';
        document.getElementById('botoesPerfil').style.display = 'block';
    };

    // Sessão da aba: sobrevive a F5 / atualizar; some ao fechar o navegador (sessionStorage)
    window.FH_SESSAO_KEY = 'FH_SESSAO_USUARIO';

    window._salvarSessaoUsuario = function (user) {
        if (!user) return;
        try {
            sessionStorage.setItem(window.FH_SESSAO_KEY, JSON.stringify({
                id: user.id || null,
                nome: user.nome || 'Usuário',
                role: user.role || 'balcao',
                login: user.login || ''
            }));
        } catch (e) {}
    };

    window._limparSessaoUsuario = function () {
        try { sessionStorage.removeItem(window.FH_SESSAO_KEY); } catch (e) {}
    };

    window._lerSessaoUsuario = function () {
        try {
            var raw = sessionStorage.getItem(window.FH_SESSAO_KEY);
            if (!raw) return null;
            var u = JSON.parse(raw);
            if (!u || !u.nome || !u.role) return null;
            return u;
        } catch (e) {
            return null;
        }
    };

    window.logarAdmin = function () {
        var senhaDigitada = document.getElementById('inputSenhaAdmin').value;
        var adminUser = (window.usuariosGlobais || []).find(function (u) { return u.role === 'admin'; });
        var senhaCorreta = adminUser ? adminUser.senha : 'admin';

        if (senhaDigitada === senhaCorreta) {
            window.entrarSistema(adminUser || { nome: 'Administrador', role: 'admin' });
        } else {
            alert('Senha Mestra Incorreta!');
        }
    };

    window.logarBalcao = function () {
        var u = document.getElementById('inputUserBalcao').value.trim();
        var p = document.getElementById('inputSenhaBalcao').value.trim();

        if (!u || !p) return alert('Preencha seu Login e Senha!');

        var validUser = (window.usuariosGlobais || []).find(function (x) {
            return x.login === u && x.senha === p && x.role === 'balcao';
        });
        if (validUser) {
            window.entrarSistema(validUser);
        } else {
            alert('Login ou Senha Incorretos!');
        }
    };

    window.entrarSistema = function (user, opts) {
        opts = opts || {};
        window.usuarioLogado = user;
        if (!opts.semSalvarSessao) window._salvarSessaoUsuario(user);
        document.getElementById('telaLogin').style.display = 'none';
        document.getElementById('appSidebar').style.display = 'flex';
        document.getElementById('appMainContent').style.display = 'block';
        document.getElementById('blocoUserLogado').style.display = 'block';
        document.getElementById('nomeUserLogado').innerText = '👨‍💻 ' + user.nome;

        document.getElementById('btnTabCaixa').style.display = 'block';

        if (user.role === 'balcao') {
            document.getElementById('btnTabConfig').style.display = 'none';
            window.abrirAba('tabVendas', document.getElementById('btnTabVendas'));
        } else {
            document.getElementById('btnTabConfig').style.display = 'block';
            window.abrirAba('tabCaixa', document.getElementById('btnTabCaixa'));
            // Mantém o menu Caixa / Relatórios recolhido ao entrar
            var subCx = document.getElementById('submenuCaixa');
            if (subCx) subCx.style.display = 'none';
            document.getElementById('btnTabCaixa').classList.remove('grupo-aberto');
        }
        if (window.iniciarMonitorAlertasVencimentoFh) {
            window.iniciarMonitorAlertasVencimentoFh();
        }
    };

    window.fazerLogout = function () {
        window.usuarioLogado = null;
        window._limparSessaoUsuario();
        if (window.ocultarPainelAlertasVencimentoFh) window.ocultarPainelAlertasVencimentoFh();
        window.voltarParaPerfis();
        document.getElementById('telaLogin').style.display = 'flex';
        document.getElementById('appSidebar').style.display = 'none';
        document.getElementById('appMainContent').style.display = 'none';
    };

    // Restaura login após F5 (espera o módulo principal definir abrirAba)
    (function tentarRestaurarSessaoFh() {
        var sessao = window._lerSessaoUsuario();
        if (!sessao) return;

        var tentativas = 0;
        var maxTentativas = 100; // ~5s
        function tenta() {
            if (typeof window.abrirAba === 'function') {
                window.entrarSistema(sessao, { semSalvarSessao: true });
                return;
            }
            tentativas++;
            if (tentativas < maxTentativas) setTimeout(tenta, 50);
        }
        tenta();
    })();
})();
