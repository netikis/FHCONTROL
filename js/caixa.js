/**
 * FH CONTROL — Tabelas e painel de ações do Caixa (Fase 5)
 * Balcão, Banco Digital, Orçamentos e botão OPÇÕES NOTA.
 * Extraído do index sem alterar a lógica. Gravação no Firebase permanece no módulo.
 */
if (!Array.isArray(window.caixaGlobal)) window.caixaGlobal = [];

// Botões Ed, Whats, Link, Sebrae, NFE, PDF, PDF Cliente, Cupom, Receber/Estornar, Excluir — compartilhado entre balcão, banco e pendentes.
window.montarAcoesDocCaixaHtml = function (doc, opts) {
    opts = opts || {};
    const id = doc.id;
    const idEnc = encodeURIComponent(String(id || ''));
    const tipoDoc = doc.tipo || '';
    const statusStr = doc.statusPagamento || 'PAGO';
    const isVendaOuOS = tipoDoc === 'VENDA' || tipoDoc === 'ORDEM DE SERVIÇO' || tipoDoc === 'VD';
    const recebidoParc = window._totalRecebidoDoc(doc);
    const isNotaEmAberto = !!opts.isNotaEmAberto;
    const ctx = opts.contexto || 'balcao';
    const del = !!opts.useDelegacao;

    if (tipoDoc === 'DESPESA' || tipoDoc === 'FECHAMENTO' || tipoDoc === 'ENTRADA_CAIXA') {
        if (del) {
            return `<button type="button" class="btn-acao del btn-pend-acao" data-pend-id="${idEnc}" data-acao="excluir" title="Cancelar Registro">🗑️</button>`;
        }
        return `<button class="btn-acao del" onclick="cancelarVenda('${id}')" title="Cancelar Registro">🗑️</button>`;
    }

    const mkBtn = function (cls, label, acaoOnclick, acaoDel, title, style) {
        const sty = style ? ` style="${style}"` : '';
        if (del) {
            return `<button type="button" class="btn-acao ${cls} btn-pend-acao"${sty} data-pend-id="${idEnc}" data-acao="${acaoDel}" title="${title || ''}">${label}</button>`;
        }
        return `<button class="btn-acao ${cls}"${sty} onclick="${acaoOnclick}" title="${title || ''}">${label}</button>`;
    };

    // Na tabela aparece só o botão que abre o painel lateral; as ações ficam todas lá dentro.
    if (!opts.semBotaoPainel) {
        return `<button type="button" class="btn-acao btn-painel-acoes" onclick="window.abrirPainelAcoesDoc('${id}','${ctx}')" title="Abrir todas as opções desta nota">⚙️ OPÇÕES NOTA</button>`;
    }

    let h = '';
    const edStyle = ctx === 'balcao' ? 'border-color:#ffffff;' : '';
    h += mkBtn('edit', '✏️ Ed', `editarDocumentoCaixa('${id}')`, 'editar', 'Editar Documento', edStyle);
    h += mkBtn('whats', '📱 Whats', `enviarOSWhatsApp('${id}')`, 'whats', 'WhatsApp', '');
    if (!doc.assinaturaBase64) {
        h += mkBtn('', '🔗 Link', `copiarLinkAssinatura('${id}')`, 'link', 'Copiar Link para Cliente', '');
    }
    h += `<a href="${window._urlSebraeNfe}" target="_blank" class="btn-acao nota" style="text-decoration:none;">🏢 Sebrae</a>`;
    h += `<a href="${window._urlNfeGov}" target="_blank" class="btn-acao nota" style="text-decoration:none;">📄 NFE</a>`;
    h += mkBtn('', '👁️ Ver', `visualizarNota('${id}')`, 'visualizar', 'Visualizar nota na tela', 'border-color:#000000; color:#000000; font-weight:800;');
    h += mkBtn('pdf', '📄 PDF', `gerarPDF_Historico('${id}','loja')`, 'pdf', 'Visualizar e imprimir na loja', '');
    h += mkBtn('', '📤 PDF Cliente', `gerarPDFparaCliente('${id}')`, 'pdf-cliente', 'PDF protegido para enviar ao cliente', '');
    h += mkBtn('', '🧾 Cupom', `imprimirCupom('${id}')`, 'cupom', 'Imprimir Cupom 80mm', '');

    if (ctx === 'balcao') {
        if (isVendaOuOS && statusStr === 'PENDENTE') {
            h += mkBtn('receber', '💰 Receber', `marcarComoPago('${id}')`, 'receber', 'Registrar Pagamento', 'border-color:#27ae60; color:#27ae60;');
            if (recebidoParc > 0) {
                h += mkBtn('', '🔄 Estornar', `estornarPagamento('${id}')`, 'estornar', 'Estornar os recebimentos parciais', 'color:#e74c3c;');
            }
        } else if (isVendaOuOS && statusStr === 'PAGO') {
            h += mkBtn('', '🔄 Estornar', `estornarPagamento('${id}')`, 'estornar', 'Desfazer Pagamento', 'color:#e74c3c;');
        }
    } else if (ctx === 'banco') {
        if (statusStr === 'PENDENTE' || isNotaEmAberto) {
            h += mkBtn('receber', '💰 Receber', `marcarComoPago('${id}')`, 'receber', 'Registrar Pagamento', 'border-color:#27ae60; color:#27ae60;');
        }
        if (recebidoParc > 0 || statusStr === 'PAGO') {
            h += mkBtn('', '🔄 Estornar', `estornarPagamento('${id}')`, 'estornar', 'Desfazer pagamento — volta para Contas a Receber', 'color:#e74c3c;');
            if (window._precisaCorrigirDataRecebimentoBanco && window._precisaCorrigirDataRecebimentoBanco(doc)) {
                h += `<button class="btn-acao" style="border-color:#f39c12; color:#f39c12;" onclick="window.corrigirDataRecebimentoParaHoje('${id}')" title="Contabilizar recebimento na data de hoje">📅 Data hoje</button>`;
            }
        }
    } else if (ctx === 'pendente') {
        h += mkBtn('receber', '💰 Receber', '', 'receber', 'Registrar Pagamento', 'border-color:#000000; color:#000000; font-weight:800;');
        if (recebidoParc > 0 && !window._docQuitado(doc)) {
            h += mkBtn('', '🔄 Estornar', '', 'estornar', 'Estornar todos os recebimentos parciais', 'color:#e74c3c;');
        }
    }

    if (del) {
        h += mkBtn('del', '🗑️ Excluir', '', 'excluir', 'Excluir nota e devolver produtos ao estoque', '');
    } else {
        h += `<button class="btn-acao del" onclick="cancelarVenda('${id}')" title="Cancelar Documento">🗑️</button>`;
    }
    return h;
};

// Painel lateral: mostra as mesmas ações da linha em botões grandes, sem precisar arrastar a barra.
window.abrirPainelAcoesDoc = function (id, ctx) {
    const lista = window._listaCaixaSincronizada
        ? window._listaCaixaSincronizada()
        : (window.caixaGlobal || []);
    const doc = lista.find(function (x) { return String(x.id) === String(id); });
    if (!doc) {
        alert('Documento não encontrado. Atualize a página e tente novamente.');
        return;
    }

    const esc = window._escPendTxt;
    const total = parseFloat(doc.total) || 0;
    const recebido = window._totalRecebidoDoc(doc);
    const saldo = window._saldoDevedorDoc(doc);
    const info = document.getElementById('painelAcoesInfo');
    if (info) {
        let html = '<div><span style="color:#95a5a6;">Nº Doc:</span> <strong>' + esc(String(doc.os || '-')) + '</strong>'
            + ' &nbsp;·&nbsp; <span style="color:#95a5a6;">Tipo:</span> <strong>' + esc(doc.tipo || '-') + '</strong></div>'
            + '<div><span style="color:#95a5a6;">Cliente:</span> <strong>' + esc(doc.clienteNome || '-') + '</strong></div>'
            + '<div><span style="color:#95a5a6;">Total:</span> <strong style="color:#2ecc71;">R$ ' + total.toFixed(2) + '</strong></div>';
        if (recebido > 0) {
            html += '<div><span style="color:#95a5a6;">Recebido:</span> <strong style="color:#2ecc71;">R$ ' + recebido.toFixed(2) + '</strong>'
                + ' &nbsp;·&nbsp; <span style="color:#95a5a6;">Saldo:</span> <strong style="color:#f1c40f;">R$ ' + saldo.toFixed(2) + '</strong></div>';
        }
        info.innerHTML = html;
    }

    const corpo = document.getElementById('painelAcoesCorpo');
    if (corpo) {
        const contexto = (ctx === 'banco' || ctx === 'balcao') ? ctx : 'balcao';
        corpo.innerHTML = window.montarAcoesDocCaixaHtml(doc, {
            contexto: contexto,
            isNotaEmAberto: saldo > 0.009,
            semBotaoPainel: true
        });
    }

    const backdrop = document.getElementById('painelAcoesBackdrop');
    const painel = document.getElementById('painelAcoesLateral');
    if (backdrop) backdrop.classList.add('aberto');
    if (painel) painel.classList.add('aberto');
};

window.fecharPainelAcoesDoc = function () {
    const backdrop = document.getElementById('painelAcoesBackdrop');
    const painel = document.getElementById('painelAcoesLateral');
    if (backdrop) backdrop.classList.remove('aberto');
    if (painel) painel.classList.remove('aberto');
};

// Fecha o painel depois de acionar qualquer botão dele, liberando a tela para o resultado da ação.
document.addEventListener('click', function (ev) {
    const alvo = ev.target.closest('#painelAcoesCorpo button, #painelAcoesCorpo a');
    if (alvo) setTimeout(window.fecharPainelAcoesDoc, 120);
});

// Mesmas ações do caixa balcão, para a tabela de contas a receber (pendentes).
window.montarAcoesCelulaPendente = function (v) {
    return '<td class="celula-acoes" style="min-width:150px;"><div class="acoes-flex">' + window.montarAcoesDocCaixaHtml(v, { contexto: 'pendente', useDelegacao: true }) + '</div></td>';
};

// ================================================================
// LÓGICA DE PAGINAÇÃO E FILTRO PARA O CAIXA DO BANCO
// ================================================================
window.paginaAtualBanco = 1;
window.itensPorPaginaBanco = 15;
window.termoBuscaBanco = "";

window.filtrarBanco = function() {
    const raw = document.getElementById('buscaBanco') ? document.getElementById('buscaBanco').value.trim() : '';
    window.termoBuscaBanco = window._pendNormBusca(raw);
    window.paginaAtualBanco = 1;
    window.renderizarTabelaBanco();
};

window.mudarPaginaBanco = function(direcao) {
    let filtrados = window.extratoBanco.filter(v => 
        (v.descricao || '').toLowerCase().includes(window.termoBuscaBanco)
    );

    const max = Math.ceil(filtrados.length / window.itensPorPaginaBanco);
    if (window.paginaAtualBanco + direcao >= 1 && window.paginaAtualBanco + direcao <= Math.max(1, max)) {
        window.paginaAtualBanco += direcao;
        window.renderizarTabelaBanco();
    }
};

// ================================================================
// LÓGICA DE PAGINAÇÃO PARA A TABELA PRINCIPAL DE VENDAS/CAIXA
// ================================================================
window.paginaAtualCaixa = 1;
window.itensPorPaginaCaixa = 20; // Limite de 20 itens por página
window.termoBuscaCaixa = "";

window.paginaAtualOrcamentos = 1;
window.itensPorPaginaOrcamentos = 20;
window.termoBuscaOrcamentos = "";

window.filtrarCaixa = function() {
    window.termoBuscaCaixa = document.getElementById('buscaCaixa').value.toLowerCase();
    window.paginaAtualCaixa = 1;
    window.renderizarTabelaCaixa();
};

window.mudarPaginaCaixa = function(direcao) {
    let filtrados = (window.caixaGlobal || []).filter(v => {
        if (!window.linhaEhCaixaBalcaoVisivel(v)) return false;
        let busca = (v.clienteNome || '').toLowerCase().includes(window.termoBuscaCaixa) || 
                    (v.os || '').toString().includes(window.termoBuscaCaixa);
        return busca;
    });

    const max = Math.ceil(filtrados.length / window.itensPorPaginaCaixa);
    if (window.paginaAtualCaixa + direcao >= 1 && window.paginaAtualCaixa + direcao <= Math.max(1, max)) {
        window.paginaAtualCaixa += direcao;
        window.renderizarTabelaCaixa();
    }
};

window._listaOrcamentosVisiveis = function () {
    const termo = String(window.termoBuscaOrcamentos || '').trim().toLowerCase();
    const base = (typeof window.caixaGlobal !== 'undefined' ? window.caixaGlobal : []).filter(function (v) {
        return window.linhaEhOrcamento(v);
    });
    if (!termo) return base;
    return base.filter(function (v) {
        const nome = String(v.clienteNome || '').toLowerCase();
        const num = String(v.os || '').toLowerCase();
        const obs = String(v.observacao || '').toLowerCase();
        return nome.indexOf(termo) !== -1 || num.indexOf(termo) !== -1 || obs.indexOf(termo) !== -1;
    });
};

window.filtrarOrcamentos = function () {
    const inp = document.getElementById('buscaOrcamentos');
    window.termoBuscaOrcamentos = inp ? String(inp.value || '').toLowerCase() : '';
    window.paginaAtualOrcamentos = 1;
    window.renderizarTabelaOrcamentos();
};

window.mudarPaginaOrcamentos = function (direcao) {
    const filtrados = window._listaOrcamentosVisiveis();
    const max = Math.max(1, Math.ceil(filtrados.length / window.itensPorPaginaOrcamentos) || 1);
    if (window.paginaAtualOrcamentos + direcao >= 1 && window.paginaAtualOrcamentos + direcao <= max) {
        window.paginaAtualOrcamentos += direcao;
        window.renderizarTabelaOrcamentos();
    }
};

window.renderizarTabelaOrcamentos = function () {
    const tabela = document.getElementById('tabelaOrcamentos');
    if (!tabela) return;
    const filtrados = window._listaOrcamentosVisiveis();
    const totalValor = filtrados.reduce(function (s, v) { return s + (parseFloat(v.total) || 0); }, 0);
    const elTot = document.getElementById('totalOrcamentosHead');
    const elQtd = document.getElementById('qtdOrcamentosHead');
    if (elTot) elTot.innerText = 'R$ ' + totalValor.toFixed(2);
    if (elQtd) elQtd.innerText = filtrados.length + ' orçamento(s)';

    if (!filtrados.length) {
        tabela.innerHTML = '<tr><td colspan="8" style="text-align:center;">Nenhum orçamento encontrado' +
            (window.termoBuscaOrcamentos ? ' para esta busca.' : '. Crie em Vendas → Tipo “Apenas Orçamento”.') +
            '</td></tr>';
        if (document.getElementById('infoPaginaOrcamentos')) {
            document.getElementById('infoPaginaOrcamentos').innerText = 'Pág 1 de 1';
        }
        return;
    }

    const maxPag = Math.max(1, Math.ceil(filtrados.length / window.itensPorPaginaOrcamentos));
    if (window.paginaAtualOrcamentos > maxPag) window.paginaAtualOrcamentos = maxPag;
    const inicio = (window.paginaAtualOrcamentos - 1) * window.itensPorPaginaOrcamentos;
    const pagina = filtrados.slice(inicio, inicio + window.itensPorPaginaOrcamentos);
    if (document.getElementById('infoPaginaOrcamentos')) {
        document.getElementById('infoPaginaOrcamentos').innerText = 'Pág ' + window.paginaAtualOrcamentos + ' de ' + maxPag;
    }

    tabela.innerHTML = '';
    pagina.forEach(function (v) {
        const tr = document.createElement('tr');
        const temAss = v.assinaturaBase64
            ? '<span style="color:#2ecc71;">✍️ OK</span>'
            : '<span style="color:#e74c3c;">❌ Pend</span>';
        const vencForm = v.vencimento ? String(v.vencimento).split('-').reverse().join('/') : '-';
        const dataLanc = (window.dataEfetivaCaixaDia ? window.dataEfetivaCaixaDia(v) : (v.dataStr || '-'));
        const acoes = window.montarAcoesDocCaixaHtml
            ? window.montarAcoesDocCaixaHtml(v, { contexto: 'balcao' })
            : '<button class="btn-acao del" onclick="cancelarVenda(\'' + v.id + '\')">🗑️</button>';
        tr.innerHTML =
            '<td style="font-weight:bold;color:#ffffff;">' + (v.os || '-') + '</td>' +
            '<td><span style="background-color:#9b59b6;color:#fff;padding:2px 4px;border-radius:4px;font-size:10px;font-weight:bold;">ORCAMENTO</span></td>' +
            '<td style="font-weight:bold;">' + dataLanc + '</td>' +
            '<td style="font-weight:bold;">' + (v.clienteNome || '-') + '</td>' +
            '<td style="font-weight:bold;">' + vencForm + '</td>' +
            '<td style="color:#9b59b6;font-weight:bold;">R$ ' + (parseFloat(v.total) || 0).toFixed(2) + '</td>' +
            '<td style="font-size:11px;font-weight:bold;">' + temAss + '</td>' +
            '<td class="celula-acoes"><div class="acoes-flex">' + acoes + '</div></td>';
        tabela.appendChild(tr);
    });
};

window.renderizarTabelaCaixa = function() {
    const tabela = document.getElementById('tabelaCaixa'); 
    if(!tabela) return;
    tabela.innerHTML = '';
    
    // Caixa físico: sem digital; pendentes (VENDA/OS/VD) só na tabela "Contas a receber".
    let dadosBalcao = (window.caixaGlobal || []).filter(v => window.linhaEhCaixaBalcaoVisivel(v));

    if (dadosBalcao.length === 0) { 
        tabela.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum documento físico registrado.</td></tr>'; 
        if(window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
        return; 
    }

    let dadosFiltrados = dadosBalcao.filter(v => {
        return (v.clienteNome || '').toLowerCase().includes(window.termoBuscaCaixa) || 
               (v.os || '').toString().includes(window.termoBuscaCaixa);
    });

    if (dadosFiltrados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum registro encontrado na busca.</td></tr>'; 
        return;
    }

    const inicio = (window.paginaAtualCaixa - 1) * window.itensPorPaginaCaixa;
    const itensDaPagina = dadosFiltrados.slice(inicio, inicio + window.itensPorPaginaCaixa);
    
    if(document.getElementById('infoPaginaCaixa')) {
        document.getElementById('infoPaginaCaixa').innerText = `Pág ${window.paginaAtualCaixa} de ${Math.ceil(dadosFiltrados.length / window.itensPorPaginaCaixa)}`;
    }

    itensDaPagina.forEach(v => {
        const tr = document.createElement('tr'); 
        const temAss = v.assinaturaBase64 ? '<span style="color:#2ecc71;">✍️ OK</span>' : '<span style="color:#e74c3c;">❌ Pend</span>';
        let vencForm = v.vencimento ? v.vencimento.split('-').reverse().join('/') : '-';
        let statusStr = v.statusPagamento || 'PAGO'; 
        let txtBadge = '';
        let formaPgto = v.formaPagamento ? v.formaPagamento.replace('Cartão de ', '') : '';
        let detalhePgto = formaPgto ? ` - ${formaPgto.toUpperCase()}` : '';
        const recebidoParc = window._totalRecebidoDoc(v);
        const saldoParc = window._saldoDevedorDoc(v);
        const temParcialGaveta = window._listaRecebimentosParciais(v).length > 0 && recebidoParc > 0 && saldoParc > 0.009;
        const infoParc = window._infoRecebimentoBalcao(v);
        let colValorCaixa = `R$ ${(parseFloat(v.total) || 0).toFixed(2)}`;

        if (v.tipo === 'ENTRADA_CAIXA') {
            txtBadge = `<span class="badge-pago" style="background-color: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">✅ ENTRADA MANUAL</span>`;
        } else if (v.tipo === 'ORCAMENTO' || v.tipo === 'DESPESA' || v.tipo === 'FECHAMENTO') {
            txtBadge = '-';
        } else if (infoParc.temParcial && infoParc.quitado) {
            txtBadge = `<span class="badge-pago" style="background-color: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">✅ RECEBIDA EM PARTES</span>`;
            colValorCaixa = `<div style="color:#2ecc71;font-weight:bold;">Dinheiro: R$ ${infoParc.dinheiro.toFixed(2)}</div><div style="font-size:10px;color:#95a5a6;font-weight:normal;">Total nota: R$ ${infoParc.total.toFixed(2)}${infoParc.digital > 0 ? ' · PIX/Cartão: R$ ' + infoParc.digital.toFixed(2) : ''}</div>`;
        } else if (temParcialGaveta) {
            txtBadge = `<span class="badge-pendente" style="background-color: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">💵 RECEBIDO PARCIAL — Saldo R$ ${saldoParc.toFixed(2)}</span>`;
            colValorCaixa = `<div style="color:#2ecc71;font-weight:bold;">Dinheiro: R$ ${infoParc.dinheiro.toFixed(2)}</div><div style="font-size:10px;color:#f1c40f;font-weight:normal;">Saldo: R$ ${infoParc.saldo.toFixed(2)} · Total: R$ ${infoParc.total.toFixed(2)}</div>`;
        } else if (statusStr === 'PAGO') {
            txtBadge = `<span class="badge-pago" style="background-color: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">✅ PAGO${detalhePgto}</span>`;
        } else {
            txtBadge = `<span class="badge-pendente" style="background-color: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">⏳ PENDENTE${detalhePgto}</span>`;
        }

        let acoesHtml = window.montarAcoesDocCaixaHtml(v, { contexto: 'balcao' });

        let corTipo = v.tipo === 'ENTRADA_CAIXA' ? '#27ae60' : (v.tipo === 'VENDA' ? '#3498db' : (v.tipo === 'ORCAMENTO' ? '#9b59b6' : (v.tipo === 'DESPESA' ? '#e74c3c' : '#f39c12')));
        let sigla = v.tipo === 'ENTRADA_CAIXA' ? 'ENTRADA' : (v.tipo === 'VENDA' ? 'VENDA' : (v.tipo === 'ORCAMENTO' ? 'ORCAMENTO' : (v.tipo === 'DESPESA' ? 'DESPESAS' : (v.tipo === 'FECHAMENTO' ? 'FECH.CAIXA' : 'ORDEM.SERV.'))));

        if(v.tipo === 'DESPESA' || v.tipo === 'FECHAMENTO' || v.tipo === 'ENTRADA_CAIXA') {
            acoesHtml = `<button class="btn-acao del" onclick="cancelarVenda('${v.id}')" title="Cancelar Registro">🗑️</button>`;
        }

        tr.innerHTML = `
            <td style="font-weight: bold; color: #ffffff;">${v.os || '-'}</td>
            <td><span style="background-color: ${corTipo}; color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold;">${sigla}</span></td>
            <td style="font-weight: bold;">${window.dataEfetivaCaixaDia(v)}</td>
            <td style="font-weight: bold;">${v.clienteNome}</td>
            <td style="font-weight: bold;">${vencForm}</td>
            <td style="color:${v.tipo==='DESPESA'?'#e74c3c':'#2ecc71'}; font-weight:bold;">${colValorCaixa}</td>
            <td style="text-align: center;">${txtBadge}</td>
            <td style="font-size: 11px; font-weight: bold;">${(v.tipo==='DESPESA'||v.tipo==='FECHAMENTO'||v.tipo==='ENTRADA_CAIXA')?'-':temAss}</td>
            <td class="celula-acoes"><div class="acoes-flex">${acoesHtml}</div></td>
        `; 
        tabela.appendChild(tr);
    });

    if(window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
};

window.renderizarTabelaBanco = function() {
    const tabela = document.getElementById('tabelaCaixaBanco');
    if(!tabela) return;
    tabela.innerHTML = '';
    
    let manuais = window.extratoBanco.map(e => ({...e, isManual: true, _sortTs: window.timestampEfetivoCaixa(e) || Number(e.timestamp) || 0}));

    let digitais = window._montarLinhasDigitaisBanco();

    let dadosUnidos = [...manuais, ...digitais].sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));

    let dadosFiltrados = dadosUnidos.filter(v => window._bancoMatchBusca(v, window.termoBuscaBanco));

    if (dadosFiltrados.length === 0) {
        const dica = window.termoBuscaBanco
            ? '<br><span style="font-size:11px;color:#95a5a6;">Dica: se recebeu em dinheiro, a nota pode estar no <strong>Caixa Balcão</strong>. Use também <strong>Registro Geral → Busca Geral</strong> para localizar e estornar.</span>'
            : '';
        tabela.innerHTML = '<tr><td colspan="9" style="text-align:center;">Nenhum movimento bancário encontrado.' + dica + '</td></tr>';
        return;
    }

    const inicio = (window.paginaAtualBanco - 1) * window.itensPorPaginaBanco;
    const fim = inicio + window.itensPorPaginaBanco;
    const itensDaPagina = dadosFiltrados.slice(inicio, fim);
    
    if(document.getElementById('infoPaginaBanco')) {
        document.getElementById('infoPaginaBanco').innerText = `Pág ${window.paginaAtualBanco} de ${Math.ceil(dadosFiltrados.length / window.itensPorPaginaBanco)}`;
    }

    itensDaPagina.forEach(v => {
        const tr = document.createElement('tr'); 

        if (v.isManual) {
            let isFechamento = v.tipo === 'FECHAMENTO_BANCO';
            let cor = isFechamento ? '#8e44ad' : (v.tipo === 'ENTRADA' ? '#2ecc71' : '#e74c3c');
            let sinal = isFechamento ? '' : (v.tipo === 'ENTRADA' ? '+' : '-');
            let tipoBadge = isFechamento ? 'FECHAMENTO' : v.tipo;
            
            tr.innerHTML = `
                <td style="font-weight: bold; color: #ffffff;">-</td>
                <td><span style="background-color: ${cor}; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${tipoBadge}</span></td>
                <td style="font-weight: bold;">${v.dataStr.split(' ')[0]}</td>
                <td style="font-weight: bold; color: #bdc3c7;">[MANUAL] ${v.descricao}</td>
                <td>-</td>
                <td style="color:${cor}; font-weight:bold;">${sinal} R$ ${parseFloat(v.valor).toFixed(2)}</td>
                <td style="text-align: center;">-</td>
                <td style="text-align: center;">-</td>
                <td class="celula-acoes"><div class="acoes-flex"><button class="btn-acao del" onclick="excluirLancamentoBanco('${v.id}')" title="Excluir">🗑️ Excluir</button></div></td>
            `;
        } else if (v.isLinhaParcial) {
            const doc = v.docPai;
            const p = v.parcialInfo;
            const valorParc = parseFloat(p.valor) || 0;
            const formaPgto = (p.formaPagamento || '').replace('Cartão de ', '');
            const dataParc = window._dataLancamentoBancoDoc(doc, p);
            const corTipo = doc.tipo === 'VENDA' ? '#3498db' : '#f39c12';
            const sigla = doc.tipo === 'VENDA' ? 'VENDA' : 'ORDEM.SERV.';
            const quitadoLinha = window._docQuitado(doc);
            const infoParc = window._infoRecebimentoBalcao(doc);
            const lblReceb = infoParc.temParcial && quitadoLinha ? '✅ RECEBIDA EM PARTES' : '💰 RECEBIDO PARCIAL';
            const txtBadge = `<span class="badge-pago" style="background-color: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">${lblReceb} — ${formaPgto.toUpperCase()}</span>`;
            const detalheValores = infoParc.temParcial
                ? `<div style="font-size:10px;color:#95a5a6;font-weight:normal;margin-top:2px;">Digital acumulado: R$ ${infoParc.digital.toFixed(2)}${infoParc.dinheiro > 0 ? ' · Dinheiro: R$ ' + infoParc.dinheiro.toFixed(2) : ''}<br>Total nota: R$ ${infoParc.total.toFixed(2)}</div>`
                : '';
            const acoesHtml = window.montarAcoesDocCaixaHtml(doc, { contexto: 'banco', isNotaEmAberto: !quitadoLinha });
            tr.innerHTML = `
                <td style="font-weight: bold; color: #ffffff;">${doc.os || '-'}</td>
                <td><span style="background-color: #27ae60; color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold;">ENTRADA</span></td>
                <td style="font-weight: bold; color: #2ecc71;">${dataParc}</td>
                <td style="font-weight: bold; color: #3498db;">${doc.clienteNome} <span style="font-size:10px;color:#95a5a6;">(${sigla} Nº ${doc.os || '-'})</span></td>
                <td>-</td>
                <td style="color:#5dade2; font-weight:bold;">+ R$ ${valorParc.toFixed(2)}${detalheValores}</td>
                <td style="text-align: center;">${txtBadge}</td>
                <td style="text-align: center;">-</td>
                <td class="celula-acoes"><div class="acoes-flex">${acoesHtml}</div></td>
            `;
        } else {
            const doc = v.docPai || v;
            const temAss = doc.assinaturaBase64 ? '<span style="color:#2ecc71;">✍️ OK</span>' : '<span style="color:#e74c3c;">❌ Pend</span>';
            let vencForm = doc.vencimento ? doc.vencimento.split('-').reverse().join('/') : '-';
            let formaPgto = doc.formaPagamento ? doc.formaPagamento.replace('Cartão de ', '') : '';
            let statusStr = doc.statusPagamento || 'PAGO'; 
            
            let txtBadge = '';
            const recebidoParc = window._totalRecebidoDoc(doc);
            const saldoParc = window._saldoDevedorDoc(doc);
            if (v.isNotaEmAberto && recebidoParc > 0) {
                txtBadge = `<span class="badge-pendente" style="background-color: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">⏳ NOTA EM ABERTO — Saldo R$ ${saldoParc.toFixed(2)}</span>`;
            } else if (statusStr === 'PAGO') {
                txtBadge = `<span class="badge-pago" style="background-color: #27ae60; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">✅ VENDIDO - ${formaPgto.toUpperCase()}</span>`;
            } else if (recebidoParc > 0) {
                txtBadge = `<span class="badge-pendente" style="background-color: #2980b9; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">💰 PARCIAL — Saldo R$ ${saldoParc.toFixed(2)}</span>`;
            } else {
                txtBadge = `<span class="badge-pendente" style="background-color: #f39c12; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;">⏳ PENDENTE - ${formaPgto.toUpperCase()}</span>`;
            }

            let acoesHtml = window.montarAcoesDocCaixaHtml(doc, { contexto: 'banco', isNotaEmAberto: !!v.isNotaEmAberto });

            let corTipo = doc.tipo === 'VENDA' ? '#3498db' : '#f39c12';
            let sigla = doc.tipo === 'VENDA' ? 'VENDA' : 'ORDEM.SERV.';
            let colValor = v.isNotaEmAberto
                ? `<div style="font-size:10px;color:#95a5a6;">Total: R$ ${(parseFloat(doc.total) || 0).toFixed(2)}</div><div style="color:#f1c40f;font-weight:bold;">Saldo: R$ ${saldoParc.toFixed(2)}</div>`
                : `R$ ${parseFloat(doc.total).toFixed(2)}`;

            tr.innerHTML = `
                <td style="font-weight: bold; color: #ffffff;">${doc.os || '-'}</td>
                <td><span style="background-color: ${corTipo}; color: #fff; padding: 2px 4px; border-radius: 4px; font-size: 10px; font-weight: bold;">${sigla}</span></td>
                <td style="font-weight: bold; color: #2ecc71;">${window._dataLancamentoBancoDoc(doc)}</td>
                <td style="font-weight: bold; color: #3498db;">${doc.clienteNome}</td>
                <td style="font-weight: bold;">${vencForm}</td>
                <td style="color:#2ecc71; font-weight:bold;">${colValor}</td>
                <td style="text-align: center;">${txtBadge}</td>
                <td style="font-size: 11px; font-weight: bold;">${temAss}</td>
                <td class="celula-acoes"><div class="acoes-flex">${acoesHtml}</div></td>
            `; 
        }
        tabela.appendChild(tr);
    });
};

// Totais do banco após o último fechamento (PIX/cartão pendente usa data do RECEBIMENTO)
window._calcularFluxoBancoAtual = function () {
    let lastFechamentoTime = 0;
    const getTs = function (doc) { return window.timestampEfetivoCaixa(doc); };

    (window.extratoBanco || []).forEach(function (d) {
        const ts = getTs(d);
        if ((d.tipo === 'FECHAMENTO_BANCO' || d.tipo === 'FECHAMENTO') && ts > lastFechamentoTime) {
            lastFechamentoTime = ts;
        }
    });

    let totalEntradasManual = 0;
    let totalEntradasDigital = 0;
    let totalSaidas = 0;

    (window.extratoBanco || []).forEach(function (doc) {
        const ts = getTs(doc);
        if (ts <= lastFechamentoTime) return;
        if (doc.tipo === 'ENTRADA') totalEntradasManual += (parseFloat(doc.valor) || 0);
        else if (doc.tipo === 'SAIDA') totalSaidas += (parseFloat(doc.valor) || 0);
    });

    const baseVendas = typeof window.caixaGlobal !== 'undefined' ? window.caixaGlobal : [];
    baseVendas.forEach(function (v) {
        const tipo = v.tipo || '';
        if (tipo === 'ORCAMENTO' || tipo === 'FECHAMENTO' || tipo === 'DESPESA') return;
        const parciais = window._listaRecebimentosParciais(v);
        if (parciais.length) {
            parciais.forEach(function (p) {
                const ts = Number(p.timestamp) || 0;
                if (ts <= lastFechamentoTime) return;
                if (window.formaPagamentoEhDigital(p.formaPagamento)) {
                    totalEntradasDigital += parseFloat(p.valor) || 0;
                }
            });
            return;
        }
        const ts = getTs(v);
        if (ts <= lastFechamentoTime) return;
        const status = v.statusPagamento || 'PAGO';
        if (status === 'PAGO' && window.formaPagamentoEhDigital(v.formaPagamento)) {
            totalEntradasDigital += (parseFloat(v.total) || 0);
        }
    });

    const saldoInicial = window.saldoInicialBanco || 0;
    const totalEntradas = totalEntradasManual + totalEntradasDigital;
    const saldoAtual = saldoInicial + totalEntradas - totalSaidas;

    return {
        saldoInicial: saldoInicial,
        totalEntradas: totalEntradas,
        totalEntradasManual: totalEntradasManual,
        totalEntradasDigital: totalEntradasDigital,
        totalSaidas: totalSaidas,
        saldoAtual: saldoAtual
    };
};

window.atualizarPainelBanco = function() {
    const fluxo = window._calcularFluxoBancoAtual();
    if (document.getElementById('dashIniBanco')) {
        document.getElementById('dashIniBanco').innerText = `R$ ${fluxo.saldoInicial.toFixed(2)}`;
        document.getElementById('dashEntBanco').innerText = `R$ ${fluxo.totalEntradas.toFixed(2)}`;
        document.getElementById('dashSaiBanco').innerText = `R$ ${fluxo.totalSaidas.toFixed(2)}`;
        document.getElementById('dashSaldoBanco').innerText = `R$ ${fluxo.saldoAtual.toFixed(2)}`;
    }
};
