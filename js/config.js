/**
 * FH CONTROL — Config: backup, restauracao e usuarios do balcao (Fase 14)
 * Extraido do index. Escuta Firebase (usuarios/empresa) permanece no modulo.
 * Formulario da empresa (Fase 16) tambem vive aqui; onValue continua no index.
 * Nao altera venda/OS/estoque nem importarJSON.
 */
if (!Array.isArray(window.usuariosGlobais)) window.usuariosGlobais = [];

       // --- 6. SEGURANÇA (BACKUP E RESTAURAÇÃO) ---
       window.fazerBackupLocal = async function() { try { const snap = await window.meuGet(window.meuRef(window.meuBanco, '/')); const json = JSON.stringify(snap.val(), null, 2); const blob = new Blob([json], { type: "application/json" }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `FH_Backup_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.json`; a.click(); alert("Backup Local finalizado!"); } catch (e) { alert("Erro: " + e); } }
       window.fazerBackupNuvem = async function() { try { const snap = await window.meuGet(window.meuRef(window.meuBanco, '/')); const d = snap.val(); if (d && d.backups) delete d.backups; await window.meuSet(window.meuRef(window.meuBanco, 'backups/backup_' + Date.now()), { data: new Date().toLocaleString('pt-BR'), conteudo: d }); alert("Cópia salva na nuvem!"); } catch(e) { alert("Erro: " + e); } }
       window.restaurarBackupLocal = function() { const f = document.getElementById('arquivoRestore').files; if (!f || f.length === 0) return alert("Selecione um arquivo."); if (!confirm("RISCO: Substituir tudo?")) return; const r = new FileReader(); r.onload = async function(e) { try { await window.meuSet(window.meuRef(window.meuBanco, '/'), JSON.parse(e.target.result)); alert("Restauração Concluída!"); window.location.reload(); } catch (err) { alert("Falha ao restaurar: " + err); } }; r.readAsText(f); }
       
        // Motor de login: js/auth.js (Fase 3)

        // --- GESTÃO DE FUNCIONÁRIOS (SALVAR VENDEDORES DO BALCÃO) ---
        window.salvarFuncionario = function() {
            if(window.usuarioLogado.role !== 'admin') return alert("Sem permissão.");
            const d = { 
                nome: document.getElementById('cadFuncNome').value, 
                login: document.getElementById('cadFuncLogin').value, 
                senha: document.getElementById('cadFuncSenha').value, 
                role: "balcao" 
            };
            window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'usuarios')), d).then(() => { 
                alert('Vendedor Cadastrado com Sucesso!'); 
                document.getElementById('formFuncionario').reset(); 
            });
        };

        window.renderTabelaFuncionarios = function() {
            const tab = document.getElementById('tabelaFuncionarios');
            if(tab) {
                tab.innerHTML = '';
                // Filtra apenas quem é do balcao para mostrar na tabela
                let vendedores = window.usuariosGlobais.filter(u => u.role === 'balcao');
                if (vendedores.length === 0) {
                    tab.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum funcionário cadastrado.</td></tr>';
                } else {
                    vendedores.forEach(u => {
                        tab.innerHTML += `<tr><td>${u.nome}</td><td>${u.login}</td><td><button class="btn-danger" style="padding:4px 8px; font-size:10px;" onclick="excluirFuncionario('${u.id}')">Excluir</button></td></tr>`;
                    });
                }
            }
        };

        window.excluirFuncionario = function(id) {
            if(window.usuarioLogado.role !== 'admin') return;
            if(confirm("Deseja apagar o acesso deste vendedor?")) {
                window.meuRemove(window.meuRef(window.meuBanco, 'usuarios/' + id));
            }
        };

        // --- SALVAR A NOVA SENHA MESTRA DO ADMINISTRADOR ---
        window.salvarSenhaAdmin = function() {
            if(window.usuarioLogado.role !== 'admin') return alert("Sem permissão.");
            const d = { 
                nome: "Administrador", 
                login: "admin", 
                senha: document.getElementById('cadAdminSenha').value, 
                role: "admin" 
            };
            
            let adminAtual = window.usuariosGlobais.find(u => u.role === 'admin');
            if(adminAtual) {
                window.meuUpdate(window.meuRef(window.meuBanco, 'usuarios/' + adminAtual.id), d).then(() => { alert('Sua Senha de Administrador foi atualizada!'); });
            } else {
                window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'usuarios')), d).then(() => { alert('Senha Mestra Configurada!'); });
            }
        };


/** Dados da empresa (Fase 16) — formulario Config. Escuta Firebase permanece no index. */
if (!window.empresaGlobal) window.empresaGlobal = { nome: "Minha Empresa", cnpj: "", telefone: "", endereco: "", logo: "" };

window.aplicarDadosEmpresaNaTela = function(dados) {
    if (!dados) return;
    var el;
    el = document.getElementById('empNome'); if (el) el.value = dados.nome || '';
    el = document.getElementById('empCnpj'); if (el) el.value = dados.cnpj || '';
    el = document.getElementById('empTelefone'); if (el) el.value = dados.telefone || '';
    el = document.getElementById('empEndereco'); if (el) el.value = dados.endereco || '';
    if (dados.logo) {
        el = document.getElementById('previewLogoEmpresa');
        if (el) { el.src = dados.logo; el.style.display = 'block'; }
        el = document.getElementById('logoSidebar'); if (el) el.src = dados.logo;
        el = document.getElementById('logoLogin'); if (el) el.src = dados.logo;
    }
};

window.carregarLogoEmpresa = function(input) {
    var f = input && input.files;
    if (!f || f.length === 0) return;
    var r = new FileReader();
    r.onload = function(ev) {
        if (!window.empresaGlobal) window.empresaGlobal = {};
        window.empresaGlobal.logo = ev.target.result;
        var prev = document.getElementById('previewLogoEmpresa');
        if (prev) { prev.src = ev.target.result; prev.style.display = 'block'; }
    };
    r.readAsDataURL(f[0]);
};

window.salvarDadosEmpresa = function() {
    var emp = window.empresaGlobal || {};
    var d = {
        nome: document.getElementById('empNome').value,
        cnpj: document.getElementById('empCnpj').value,
        telefone: document.getElementById('empTelefone').value,
        endereco: document.getElementById('empEndereco').value,
        logo: emp.logo || ''
    };
    window.meuSet(window.meuRef(window.meuBanco, 'empresa'), d)
        .then(function() { alert('Dados da Empresa salvos com sucesso!'); })
        .catch(function(e) { alert("Erro: " + e); });
};
