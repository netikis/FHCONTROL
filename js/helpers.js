/**
 * FH CONTROL — Funções globais (Fase 4)
 * Conversão de moeda, estoque, roteamento Caixa Balcão vs Digital, PDF.
 * Extraído do index sem alterar a lógica.
 */
// FUNÇÃO GLOBAL DE CONVERSÃO DE MOEDA (Corrige "1,50" e "1.500,00")
window.parseMoedaBr = function(v) {
    if (!v) return 0;
    let s = String(v).trim().replace(/[R$]/gi, '').trim();
    if (s.includes(',') && s.includes('.')) { return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0; } 
    else if (s.includes(',')) { return parseFloat(s.replace(',', '.')) || 0; }
    return parseFloat(s) || 0;
};

// Quantidade de estoque (metro, kg, litro, etc.) — aceita decimais e vírgula como separador
window.parseQtdEstoque = function(v) {
    if (v === '' || v === null || v === undefined) return NaN;
    let s = String(v).trim().replace(/\s/g, '');
    if (s === '') return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    if (isNaN(n) || n < 0) return NaN;
    return Math.round(n * 100000) / 100000;
};

window.formatQtdEstoque = function(v) {
    const n = parseFloat(String(v).replace(',', '.'));
    if (isNaN(n)) return '0';
    const r = Math.round(n * 100000) / 100000;
    return String(r).replace('.', ',');
};

// Unidade da quantidade no cadastro / venda (metro, peça, kg, litro)
window.UNIDADE_MEDIDA_LABEL = { un: 'un.', m: 'm', kg: 'kg', l: 'L' };
window.normalizarUnidadeMedida = function(u) {
    const x = String(u == null ? 'un' : u).trim().toLowerCase();
    if (x === 'metro' || x === 'metros' || x === 'm') return 'm';
    if (x === 'kg' || x === 'quilo' || x === 'quilos' || x === 'kilograma') return 'kg';
    if (x === 'l' || x === 'litro' || x === 'litros') return 'l';
    if (x === 'un' || x === 'unidade' || x === 'peca' || x === 'peça' || x === 'pc') return 'un';
    return 'un';
};
window.rotuloUnidadeMedida = function(u) {
    const c = window.normalizarUnidadeMedida(u);
    return window.UNIDADE_MEDIDA_LABEL[c] || 'un.';
};
window.formatQtdComUnidade = function(q, u) {
    return `${window.formatQtdEstoque(q)} ${window.rotuloUnidadeMedida(u)}`.trim();
};
window.unidadeEfetivaVenda = function(p, selectEl) {
    if (!p) return 'un';
    const sel = selectEl && selectEl.value != null ? String(selectEl.value).trim() : '';
    if (sel) return window.normalizarUnidadeMedida(sel);
    return window.normalizarUnidadeMedida(p.unidadeMedida);
};

window.aplicarDeltaQtdDb = function(qAtual, delta) {
    return Math.round(Math.max(0, (Number(qAtual) || 0) + (Number(delta) || 0)) * 100000) / 100000;
};

// Soma qtdBaixa já “reservada” no carrinho para o mesmo produto (evita 2× ADD com o mesmo item)
window.qtdEstoqueReservadaNoCarrinho = function(carrinho, idProd) {
    if (!idProd || !Array.isArray(carrinho)) return 0;
    let s = 0;
    for (let i = 0; i < carrinho.length; i++) {
        const it = carrinho[i];
        if (it && it.ehEstoque && it.idProd === idProd) s += Number(it.qtdBaixa) || 0;
    }
    return Math.round(s * 100000) / 100000;
};

// Crédito de estoque ao editar nota salva (itens antigos ainda “voltam” ao saldo até gravar de novo)
window._creditoEstoqueDocumentoEmEdicao = function (idProd, modo) {
    if (!idProd) return 0;
    const idEdit = sessionStorage.getItem('idNotaEditando') || window.editandoDocId || null;
    if (!idEdit) return 0;
    const lista = typeof caixaGlobal !== 'undefined' ? caixaGlobal : [];
    const doc = lista.find(x => String(x.id) === String(idEdit));
    if (!doc || !doc.itens) return 0;
    const tipo = String(doc.tipo || '').toUpperCase();
    if (modo === 'VENDA') {
        const ok = tipo === 'VD' || tipo.includes('VENDA') || tipo.includes('RECIBO') || tipo.includes('ORCAMENTO');
        if (!ok) return 0;
    } else if (modo === 'OS') {
        if (!tipo.includes('ORDEM') && !tipo.includes('OS')) return 0;
    }
    const itens = Array.isArray(doc.itens) ? doc.itens : Object.values(doc.itens);
    let s = 0;
    itens.forEach(function (o) {
        if (o && o.ehEstoque && o.idProd === idProd) s += Number(o.qtdBaixa) || 0;
    });
    return Math.round(s * 100000) / 100000;
};

// Disponível = cadastro + crédito (nota em edição e/ou linha que saiu do carrinho ao clicar ✏️) − reserva no carrinho
window.calcularDisponivelEstoque = function (p, carrinho, modo) {
    const cad = Number(p && p.quantidade) || 0;
    const idProd = p && p.id;
    const res = window.qtdEstoqueReservadaNoCarrinho(carrinho, idProd);
    let creditoDoc = window._creditoEstoqueDocumentoEmEdicao(idProd, modo);
    let creditoLinha = 0;
    const emEd = window._linhaEstoqueEmEdicao;
    const temNota = !!(sessionStorage.getItem('idNotaEditando') || window.editandoDocId);
    if (emEd && emEd.modo === modo && emEd.idProd === idProd && !temNota) {
        creditoLinha = Number(emEd.qtd) || 0;
    }
    const livre = Math.round((cad + creditoDoc + creditoLinha - res) * 100000) / 100000;
    return { cadastro: cad, reservado: res, creditoDoc: creditoDoc, creditoLinha: creditoLinha, livre: livre };
};

// PIX / cartão / boleto / transferência → não entra na gaveta física; entra no extrato do banco quando marcado
window.formaPagamentoEhDigital = function(formaPag) {
    let f = String(formaPag || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return f.includes('pix') || f.includes('cartao') || f.includes('cartoes') || f.includes('debito') || f.includes('credito') || f.includes('boleto') || f.includes('transfer') || f.includes('ted') || f.includes('doc');
};
// Só entra na gaveta física se for pagamento explícito não-digital (dinheiro, cheque, etc.)
window._recebimentoContaGaveta = function (formaPag) {
    const f = String(formaPag || '').trim();
    if (!f) return false;
    return !window.formaPagamentoEhDigital(f);
};

// Data para caixa / resumo do dia: se foi recebido depois (conta pendente), usa a data do recebimento, não a da venda.
window._diaBrDeString = function (s) {
    if (!s) return '';
    const part = String(s).trim().split(/[\s,]+/)[0];
    const m = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return part;
    const y = m[3].length === 2 ? ('20' + m[3]) : m[3];
    return m[1].padStart(2, '0') + '/' + m[2].padStart(2, '0') + '/' + y;
};
window._dataStrParaInputDate = function (dataStr) {
    if (!dataStr) return '';
    const part = String(dataStr).trim().split(/[\s,]+/)[0].replace(',', '');
    const m = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return '';
    const y = m[3].length === 2 ? ('20' + m[3]) : m[3];
    return y + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
};
window._dataInputParaDataStrBr = function (yyyyMmDd, dataStrExistente) {
    if (!yyyyMmDd) {
        return dataStrExistente || new Date().toLocaleString('pt-BR');
    }
    const partes = yyyyMmDd.split('-');
    if (partes.length !== 3) return dataStrExistente || new Date().toLocaleString('pt-BR');
    const y = partes[0];
    const m = partes[1];
    const d = partes[2];
    let hora = new Date().toLocaleTimeString('pt-BR');
    if (dataStrExistente) {
        const hm = String(dataStrExistente).match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
        if (hm) hora = hm[1];
    }
    return String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y + ' ' + hora;
};
window._timestampDeDataStrBr = function (dataStr) {
    if (!dataStr) return 0;
    const part = String(dataStr).trim().split(/[\s,]+/)[0].replace(',', '');
    const m = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) return 0;
    const y = m[3].length === 2 ? parseInt('20' + m[3], 10) : parseInt(m[3], 10);
    const mo = parseInt(m[2], 10) - 1;
    const dia = parseInt(m[1], 10);
    let h = 12, mi = 0, se = 0;
    const hm = String(dataStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (hm) {
        h = parseInt(hm[1], 10);
        mi = parseInt(hm[2], 10);
        se = parseInt(hm[3] || '0', 10);
    }
    const dt = new Date(y, mo, dia, h, mi, se);
    return isNaN(dt.getTime()) ? 0 : dt.getTime();
};
window.dataEfetivaCaixa = function (doc) {
    if (!doc) return '';
    // Se houve recebimento parcial, usa a data do recebimento mais recente
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        const ultimo = parciais.slice().sort(function (a, b) {
            return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0);
        })[0];
        if (ultimo && ultimo.dataStr) return String(ultimo.dataStr);
    }
    const st = doc.statusPagamento || 'PAGO';
    if (st === 'PAGO') {
        if (doc.dataRecebimentoStr) return String(doc.dataRecebimentoStr);
        if (doc.timestampRecebimento) return new Date(Number(doc.timestampRecebimento)).toLocaleString('pt-BR');
    }
    return String(doc.dataStr || '');
};
window.dataEfetivaCaixaInclui = function (doc, needle) {
    const dia = window._diaBrDeString(window.dataEfetivaCaixa(doc));
    const alvo = window._diaBrDeString(needle) || String(needle || '').trim();
    if (!dia || !alvo) return false;
    if (alvo.length <= 7 && alvo.indexOf('/') > 0) return dia.indexOf(alvo) !== -1;
    return dia === alvo;
};
window.aplicarCamposRecebimentoAoDoc = function (doc, statusNovo, original) {
    if (!doc || statusNovo !== 'PAGO') return doc;
    const eraPendente = !original || (original.statusPagamento || 'PENDENTE') === 'PENDENTE';
    if (eraPendente || !original || !original.dataRecebimentoStr) {
        const agora = Date.now();
        doc.dataRecebimentoStr = new Date(agora).toLocaleString('pt-BR');
        doc.timestampRecebimento = agora;
    } else if (original) {
        doc.dataRecebimentoStr = original.dataRecebimentoStr;
        doc.timestampRecebimento = original.timestampRecebimento;
    }
    return doc;
};
window.dataEfetivaCaixaDia = function (doc) {
    return window._dataLancamentoBancoDoc(doc) || '-';
};

// Data exibida no caixa do banco: SEMPRE prioriza data do RECEBIMENTO, nunca a da emissão da nota
window._dataLancamentoBancoDoc = function (doc, parcial) {
    if (!doc && !parcial) return '-';
    if (parcial && parcial.dataStr) return String(parcial.dataStr).split(/\s+/)[0];
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        const ult = parciais.slice().sort(function (a, b) {
            return (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0);
        })[0];
        if (ult && ult.dataStr) return String(ult.dataStr).split(/\s+/)[0];
    }
    const st = doc.statusPagamento || 'PAGO';
    if (st === 'PAGO') {
        if (doc.dataRecebimentoStr) return String(doc.dataRecebimentoStr).split(/\s+/)[0];
        if (doc.timestampRecebimento) return new Date(Number(doc.timestampRecebimento)).toLocaleDateString('pt-BR');
    }
    return String(doc.dataStr || '').split(/\s+/)[0] || '-';
};
window.timestampEfetivoCaixa = function (doc) {
    if (!doc) return 0;
    // Recebimentos parciais (PIX/cartão/dinheiro): usa o timestamp mais recente
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        let maxTs = 0;
        parciais.forEach(function (p) {
            const ts = Number(p.timestamp) || window._timestampDeDataStrBr(p.dataStr) || 0;
            if (ts > maxTs) maxTs = ts;
        });
        if (maxTs) return maxTs;
    }
    const st = doc.statusPagamento || 'PAGO';
    if (st === 'PAGO' && doc.timestampRecebimento) return Number(doc.timestampRecebimento) || 0;
    return Number(doc.timestamp) || 0;
};

// --- Pagamento parcial em contas pendentes ---
window._listaRecebimentosParciais = function (doc) {
    if (!doc || !doc.recebimentosParciais) return [];
    return Array.isArray(doc.recebimentosParciais) ? doc.recebimentosParciais : Object.values(doc.recebimentosParciais);
};
window._docTemRecebimentoGaveta = function (doc) {
    if (!doc) return false;
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        return parciais.some(function (p) { return window._recebimentoContaGaveta(p.formaPagamento); });
    }
    return window._recebimentoContaGaveta(doc.formaPagamento);
};
window._docTemRecebimentoDigital = function (doc) {
    if (!doc) return false;
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        return parciais.some(function (p) { return window.formaPagamentoEhDigital(p.formaPagamento); });
    }
    return window.formaPagamentoEhDigital(doc.formaPagamento);
};
// Resumo de como uma nota foi recebida (dinheiro x PIX/cartão) — usado na tabela do Caixa Balcão
window._infoRecebimentoBalcao = function (v) {
    const parciais = window._listaRecebimentosParciais(v);
    let dinheiro = 0, digital = 0;
    parciais.forEach(function (p) {
        const val = parseFloat(p.valor) || 0;
        if (window._recebimentoContaGaveta(p.formaPagamento)) dinheiro += val; else digital += val;
    });
    const total = parseFloat(v.total) || 0;
    const saldo = window._saldoDevedorDoc(v);
    return {
        temParcial: parciais.length > 0,
        dinheiro: dinheiro,
        digital: digital,
        total: total,
        recebido: window._totalRecebidoDoc(v),
        saldo: saldo,
        quitado: saldo <= 0.009
    };
};
window._totalRecebidoDoc = function (doc) {
    if (!doc) return 0;
    const lista = window._listaRecebimentosParciais(doc);
    if (lista.length) {
        return lista.reduce(function (s, r) { return s + (parseFloat(r.valor) || 0); }, 0);
    }
    if ((doc.statusPagamento || 'PENDENTE') === 'PAGO') return parseFloat(doc.total) || 0;
    return parseFloat(doc.valorRecebidoParcial) || 0;
};
window._saldoDevedorDoc = function (doc) {
    if (!doc) return 0;
    const total = parseFloat(doc.total) || 0;
    return Math.max(0, total - window._totalRecebidoDoc(doc));
};
window._docQuitado = function (doc) {
    return window._saldoDevedorDoc(doc) <= 0.009;
};
window._recebimentoParcialIncluiDia = function (rec, needle) {
    const dia = window._diaBrDeString(rec && rec.dataStr ? rec.dataStr : '');
    const alvo = window._diaBrDeString(needle) || String(needle || '').trim();
    if (!dia || !alvo) return false;
    if (alvo.length <= 7 && alvo.indexOf('/') > 0) return dia.indexOf(alvo) !== -1;
    return dia === alvo;
};
window._reverterRecebimentosGavetaDoc = function (doc) {
    if (!doc) return;
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        parciais.forEach(function (p) {
            if (window._recebimentoContaGaveta(p.formaPagamento)) {
                window.registrarMovimentoCaixa('entrada', -((parseFloat(p.valor) || 0)));
            }
        });
        return;
    }
    if ((doc.statusPagamento || 'PAGO') === 'PAGO' && window._recebimentoContaGaveta(doc.formaPagamento)) {
        window.registrarMovimentoCaixa('entrada', -((parseFloat(doc.total) || 0)));
    }
};
// Recalcula entradas/saídas da gaveta física a partir dos documentos de HOJE (PIX/cartão não entram)
window._calcularTotaisGavetaHoje = function (baseDados, hoje) {
    hoje = hoje || new Date().toLocaleDateString('pt-BR');
    baseDados = baseDados || (window._listaCaixaSincronizada ? window._listaCaixaSincronizada() : (typeof caixaGlobal !== 'undefined' ? caixaGlobal : []));
    let totalEntradasGaveta = 0;
    let totalSaidas = 0;
    baseDados.forEach(function (doc) {
        const tipo = doc.tipo || '';
        const parciais = window._listaRecebimentosParciais(doc);
        if (parciais.length && (tipo === 'VENDA' || tipo === 'ORDEM DE SERVIÇO' || tipo === 'VD')) {
            parciais.forEach(function (p) {
                if (!window._recebimentoParcialIncluiDia(p, hoje)) return;
                if (window._recebimentoContaGaveta(p.formaPagamento)) {
                    totalEntradasGaveta += parseFloat(p.valor) || 0;
                }
            });
            if (window.dataEfetivaCaixaInclui(doc, hoje) && tipo === 'DESPESA') {
                totalSaidas += parseFloat(doc.total) || 0;
            }
            return;
        }
        if (!window.dataEfetivaCaixaInclui(doc, hoje)) return;
        const valor = parseFloat(doc.total) || 0;
        const status = doc.statusPagamento || 'PAGO';
        if (tipo === 'ENTRADA_CAIXA' && status === 'PAGO') {
            totalEntradasGaveta += valor;
        } else if (status === 'PAGO' && window._recebimentoContaGaveta(doc.formaPagamento) &&
            (tipo === 'VENDA' || tipo === 'ORDEM DE SERVIÇO' || tipo === 'VD' || tipo === 'RECIBO')) {
            totalEntradasGaveta += valor;
        }
        if (tipo === 'DESPESA') totalSaidas += valor;
    });
    return { entradas: totalEntradasGaveta, saidas: totalSaidas };
};
window._recalcularPainelGavetaHoje = async function (silent) {
    const tot = window._calcularTotaisGavetaHoje();
    try {
        const { ref, set } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js');
        await set(ref(window.meuBanco, 'caixaStatus'), {
            entradas: tot.entradas,
            saidas: tot.saidas,
            caixaInicial: window.caixaFinanceiro.caixaInicial || 0
        });
        if (!silent) {
            alert('✅ Painel do caixa recalculado.\n\nEntradas na gaveta (hoje): R$ ' + tot.entradas.toFixed(2) + '\nSaídas: R$ ' + tot.saidas.toFixed(2) + '\n\nPIX e cartão ficam só no banco digital.');
        }
        if (window.atualizarPainelCaixa) window.atualizarPainelCaixa();
        if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
    } catch (e) {
        if (!silent) alert('Erro ao recalcular: ' + e.message);
    }
};
// Monta linhas da tabela do banco: cada recebimento parcial digital vira uma linha própria
window._montarLinhasDigitaisBanco = function () {
    const linhas = [];
    const cx = window._listaCaixaSincronizada ? window._listaCaixaSincronizada() : (typeof caixaGlobal !== 'undefined' ? caixaGlobal : []);
    const tiposOk = { VENDA: true, VD: true, 'ORDEM DE SERVIÇO': true, OS: true };
    cx.forEach(function (v) {
        if (!tiposOk[v.tipo]) return;
        const linhasAntes = linhas.length;
        const parciais = window._listaRecebimentosParciais(v);
        const parciaisDig = parciais.filter(function (p) { return window.formaPagamentoEhDigital(p.formaPagamento); });
        parciaisDig.forEach(function (p, idx) {
            linhas.push({
                docPai: v,
                isManual: false,
                isLinhaParcial: true,
                parcialInfo: p,
                parcialIdx: idx,
                _sortTs: Number(p.timestamp) || window._timestampDeDataStrBr(p.dataStr) || 0,
                id: v.id
            });
        });
        const formaDig = window.formaPagamentoEhDigital(v.formaPagamento);
        const quitado = window._docQuitado(v);
        const saldo = window._saldoDevedorDoc(v);
        const statusDoc = v.statusPagamento || 'PAGO';
        // Só mostra linha "principal" se for digital já quitado SEM histórico de parciais
        if (parciais.length === 0 && formaDig && statusDoc === 'PAGO' && quitado) {
            linhas.push({
                docPai: v,
                isManual: false,
                isLinhaParcial: false,
                isNotaEmAberto: false,
                _sortTs: window.timestampEfetivoCaixa(v),
                id: v.id
            });
        } else if (parciaisDig.length > 0 && !quitado && saldo > 0.009) {
            // Só mostra "nota em aberto" no banco se houve recebimento digital (PIX/cartão)
            linhas.push({
                docPai: v,
                isManual: false,
                isLinhaParcial: false,
                isNotaEmAberto: true,
                _sortTs: Number(v.timestamp) || 0,
                id: v.id
            });
        }
        // Nota quitada que não aparece no balcão nem gerou linha no banco — evita "sumir" após receber
        if (linhas.length === linhasAntes && statusDoc === 'PAGO' && quitado && !window.linhaEhCaixaBalcaoVisivel(v)) {
            linhas.push({
                docPai: v,
                isManual: false,
                isLinhaParcial: false,
                isNotaEmAberto: false,
                isLinhaFallback: true,
                _sortTs: window.timestampEfetivoCaixa(v),
                id: v.id
            });
        }
    });
    return linhas;
};
window._htmlPagamentoNotaDoc = function (doc) {
    const total = parseFloat(doc.total) || 0;
    const recebido = window._totalRecebidoDoc(doc);
    const saldo = window._saldoDevedorDoc(doc);
    const parciais = window._listaRecebimentosParciais(doc);
    let html = '<div style="margin-top:12px;padding:10px;border:1px solid #dee2e6;border-radius:6px;background:#f8f9fa;">';
    html += '<div style="font-weight:800;margin-bottom:6px;text-transform:uppercase;font-size:10px;color:#34495e;">Situação do pagamento</div>';
    html += `<div style="margin-bottom:4px;">Valor total da nota: <strong>R$ ${total.toFixed(2)}</strong></div>`;
    if (parciais.length) {
        html += '<table style="width:100%;margin-top:8px;font-size:10px;border-collapse:collapse;">';
        html += '<thead><tr style="background:#e9ecef;"><th style="text-align:left;padding:4px;">Data recebimento</th><th style="padding:4px;">Forma</th><th style="text-align:right;padding:4px;">Baixa</th></tr></thead><tbody>';
        parciais.forEach(function (p) {
            const v = parseFloat(p.valor) || 0;
            const dt = (p.dataStr || '').split(' ')[0] || '-';
            const fp = (p.formaPagamento || '-').replace('Cartão de ', '');
            html += `<tr><td style="padding:4px;border-bottom:1px solid #eee;">${dt}</td><td style="padding:4px;border-bottom:1px solid #eee;">${fp}</td><td style="padding:4px;border-bottom:1px solid #eee;text-align:right;color:#27ae60;font-weight:bold;">- R$ ${v.toFixed(2)}</td></tr>`;
        });
        html += '</tbody></table>';
        html += `<div style="margin-top:8px;font-size:11px;">Total recebido: <strong style="color:#27ae60;">R$ ${recebido.toFixed(2)}</strong></div>`;
        html += `<div style="margin-top:6px;font-size:15px;font-weight:900;color:#e74c3c;">SALDO DEVEDOR: R$ ${saldo.toFixed(2)}</div>`;
    } else if ((doc.statusPagamento || '') === 'PAGO') {
        html += '<div style="margin-top:6px;color:#27ae60;font-weight:bold;">Pagamento: recebido integralmente</div>';
    } else {
        html += '<div style="margin-top:6px;color:#f39c12;font-weight:bold;">Pagamento: pendente</div>';
    }
    html += '</div>';
    return html;
};

// Orçamentos ficam só no menu Orçamentos (não misturam no balcão).
window.linhaEhOrcamento = function (v) {
    return !!v && String(v.tipo || '').toUpperCase() === 'ORCAMENTO';
};

// Linhas que entram na tabela do caixa físico (balcão): sem PIX/cartão/boleto; pendentes sem recebimento em dinheiro ficam só em "Contas a receber".
window.linhaEhCaixaBalcaoVisivel = function (v) {
    if (window.linhaEhOrcamento(v)) return false;
    const tiposVenda = v.tipo === 'VENDA' || v.tipo === 'ORDEM DE SERVIÇO' || v.tipo === 'VD';
    const parciais = window._listaRecebimentosParciais(v);
    if (parciais.length && tiposVenda) {
        return window._docTemRecebimentoGaveta(v);
    }
    if (window.formaPagamentoEhDigital(v.formaPagamento)) return false;
    if (tiposVenda && (v.statusPagamento || '') === 'PENDENTE') return false;
    return true;
};

// Simula estoque após "devolver" itens do documento antigo e aplicar o carrinho novo (sem gravar no Firebase)
window.simularEstoqueAposTroca = async function(dbBanco, itensNovos, idNotaEditada, originalDoc, modo) {
    const { ref, get } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
    const ids = new Set();
    for (let item of itensNovos) {
        if (item.ehEstoque && item.idProd) ids.add(item.idProd);
    }
    const reverterEstoqueAntigo = !!(idNotaEditada && originalDoc && originalDoc.itens && (
        (modo === 'VENDA' && originalDoc.tipo === 'VENDA') ||
        (modo === 'OS' && originalDoc.tipo === 'ORDEM DE SERVIÇO')
    ));
    if (reverterEstoqueAntigo) {
        const antigos = Array.isArray(originalDoc.itens) ? originalDoc.itens : Object.values(originalDoc.itens);
        for (let o of antigos) {
            if (o.ehEstoque && o.idProd) ids.add(o.idProd);
        }
    }
    const virtual = {};
    for (let pid of ids) {
        const snap = await get(ref(dbBanco, 'produtos/' + pid));
        virtual[pid] = Number(snap.val()?.quantidade) || 0;
    }
    if (reverterEstoqueAntigo) {
        const antigos = Array.isArray(originalDoc.itens) ? originalDoc.itens : Object.values(originalDoc.itens);
        for (let o of antigos) {
            if (o.ehEstoque && o.idProd && o.qtdBaixa != null) {
                virtual[o.idProd] = (virtual[o.idProd] || 0) + (Number(o.qtdBaixa) || 0);
            }
        }
    }
    for (let item of itensNovos) {
        if (!item.ehEstoque || !item.idProd) continue;
        const q = Number(item.qtdBaixa) || 0;
        virtual[item.idProd] = (virtual[item.idProd] || 0) - q;
        if (virtual[item.idProd] < -1e-6) {
            return { ok: false, msg: 'Estoque insuficiente para um ou mais produtos nesta operação. Ajuste quantidades ou o cadastro.' };
        }
    }
    return { ok: true };
};

window.iniciarImportacao = async function(inputElement) {
    const arquivo = inputElement.files.item(0); 
    
    if (!arquivo) return alert("⚠️ Nenhum arquivo foi selecionado.");

    alert("🚀 Iniciando a leitura e cálculo de margens de:\n" + arquivo.name);
    document.body.style.cursor = 'wait';

    const leitor = new FileReader();

    leitor.onload = async function(e) {
        try {
            const texto = e.target.result;
            const linhas = texto.split(/\r?\n/);
            let importados = 0;

            for (let i = 1; i < linhas.length; i++) {
                const linha = linhas[i].trim();
                if (!linha) continue;

                let col = linha.split('\t'); 
                if (col.length < 3) col = linha.split(';');
                if (col.length < 3) continue;

                const limpar = (v) => v ? v.trim().replace(/^"|"$/g, '') : '';
                
                let codTxt = limpar(col[2]);
                if(!codTxt) codTxt = limpar(col[0]);
                let codPronto = codTxt || ("ID_" + Date.now() + i);
                
                let cst = window.parseMoedaBr(col[3]);
                let vnd = window.parseMoedaBr(col[4]);
                let mrg = cst > 0 ? ((vnd - cst) / cst) * 100 : 0;
                
                let novoProd = {
                    codigo: codPronto,
                    codigo_barras: codPronto,
                    nome: limpar(col[1]) || "Sem Nome", 
                    categoria: 'Geral',
                    custo: cst, 
                    venda: vnd, 
                    margem: Number.parseFloat(mrg.toFixed(2)) || 0,
                    quantidade: (() => { const q = window.parseQtdEstoque(limpar(col[5])); return isNaN(q) ? 0 : q; })(), 
                    estoque: (() => { const q = window.parseQtdEstoque(limpar(col[5])); return isNaN(q) ? 0 : q; })(), 
                    ncm: limpar(col[6]) || '', 
                    unidadeMedida: 'un',
                    foto: '' 
                };

                if (!window.meuBanco || !window.meuPush || !window.meuSet || !window.meuRef) {
                    throw new Error("As chaves do Firebase não foram encontradas!");
                }

                await window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'produtos')), novoProd);
                importados++;
            }

            document.body.style.cursor = 'default';
            alert(`✅ SUCESSO!\n\nForam importados ${importados} produtos.\nO Preço de Custo e a Porcentagem foram calculados e salvos corretamente!`);
            window.location.reload();

        } catch(err) {
            document.body.style.cursor = 'default';
            alert("🔴 Erro na hora de salvar:\n" + err.message);
        }
        inputElement.value = ''; 
    };
    leitor.readAsText(arquivo, 'ISO-8859-1');
};

// PDF: modo loja = imprimir na loja | modo cliente = arquivo protegido para enviar (ver/imprimir, sem editar).
window._nomeArquivoPdfSeguro = function (nome) {
    return String(nome || 'documento').replace(/[^\w\-\.]/g, '_') + '.pdf';
};

window._rodapeBotoesPdf = function (modo, nomeArquivo) {
    const arq = window._nomeArquivoPdfSeguro(nomeArquivo).replace(/'/g, '');
    if (modo === 'cliente') {
        return `
        <div class="pdf-toolbar pdf-toolbar-cliente no-export-pdf">
            <span class="pdf-toolbar-msg">Envio ao cliente: use Imprimir (loja) ou Baixar PDF protegido (anexo WhatsApp/e-mail).</span>
            <button type="button" class="btn-pdf-imprimir" onclick="window.print()">🖨️ Imprimir</button>
            <button type="button" id="btnBaixarPdfCliente" class="btn-pdf-protegido" onclick="window.__baixarPdfCliente && window.__baixarPdfCliente()">🔒 Baixar PDF para cliente</button>
        </div>`;
    }
    return `
        <div class="pdf-toolbar pdf-toolbar-loja no-export-pdf">
            <span class="pdf-toolbar-msg">Uso na loja: imprima o papel para entregar ao cliente.</span>
            <button type="button" class="btn-pdf-imprimir" onclick="window.print()">🖨️ Imprimir</button>
        </div>`;
};

window._criarPdfJsComProtecao = function (jsPDF) {
    try {
        return new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4',
            encryption: {
                userPassword: '',
                ownerPassword: 'FHControl-' + Date.now(),
                userPermissions: ['print']
            }
        });
    } catch (e1) {
        try {
            return new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        } catch (e2) {
            throw e1;
        }
    }
};

// Mesmas margens do @page (10mm). PNG = texto nítido (JPEG borrava o PDF cliente).
window._pdfAdicionarCanvas = function (pdf, canvas) {
    const margem = 10;
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const areaW = pageW - margem * 2;
    const areaH = pageH - margem * 2;
    const imgData = canvas.toDataURL('image/png');
    const pxPerMm = canvas.width / areaW;
    const imgH = canvas.height / pxPerMm;
    let heightLeft = imgH;
    let position = margem;
    pdf.addImage(imgData, 'PNG', margem, position, areaW, imgH, undefined, 'FAST');
    heightLeft -= areaH;
    while (heightLeft > 0) {
        position = margem - (imgH - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margem, position, areaW, imgH, undefined, 'FAST');
        heightLeft -= areaH;
    }
};

window.gerarPdfProtegidoDaJanela = async function (janela, nomeArquivo) {
    if (!janela || janela.closed) return alert('A janela de visualização foi fechada.');
    const libsOk = await (window._garantirLibsPdf ? window._garantirLibsPdf() : Promise.resolve(false));
    const JsPDF = window._obterJsPDF ? window._obterJsPDF() : null;
    if (!libsOk || !window.html2canvas || !JsPDF) {
        return alert(
            'Bibliotecas de PDF não carregaram.\n\n' +
            '• Pressione Ctrl+F5 na tela principal\n' +
            '• Verifique conexão com a internet\n' +
            '• Ou coloque na pasta lib (ao lado deste arquivo):\n' +
            '  html2canvas.min.js e jspdf.umd.min.js\n' +
            '  (baixe em cdnjs.cloudflare.com)'
        );
    }
    const alvo = janela.document.getElementById('pdf-export-root');
    if (!alvo) return alert('Conteúdo do PDF não encontrado na janela.');
    const toolbar = janela.document.querySelector('.pdf-toolbar');
    const btn = janela.document.getElementById('btnBaixarPdfCliente');
    const txtBtn = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Gerando PDF...'; }
    if (toolbar) toolbar.style.visibility = 'hidden';
    const escalaCaptura = Math.min(3, Math.max(2, Math.round((window.devicePixelRatio || 1) * 2)));
    const optsCanvas = function (omitirImagensExternas) {
        return {
            scale: escalaCaptura,
            useCORS: !omitirImagensExternas,
            allowTaint: omitirImagensExternas,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            ignoreElements: omitirImagensExternas
                ? function (el) {
                    return el.tagName === 'IMG' && el.src && /^https?:/i.test(el.src);
                }
                : undefined,
            onclone: function (docClone) {
                const root = docClone.getElementById('pdf-export-root');
                if (!root) return;
                root.style.width = '718px';
                root.style.maxWidth = '718px';
                root.style.margin = '0';
                root.style.boxSizing = 'border-box';
                root.querySelectorAll('img').forEach(function (img) {
                    try {
                        if (!img.complete || img.naturalWidth === 0) img.style.display = 'none';
                    } catch (ignore) {
                        img.style.display = 'none';
                    }
                });
            }
        };
    };
    try {
        let canvas;
        try {
            canvas = await window.html2canvas(alvo, optsCanvas(false));
        } catch (errCanvas) {
            canvas = await window.html2canvas(alvo, optsCanvas(true));
        }
        const arq = typeof nomeArquivo === 'string' && nomeArquivo.endsWith('.pdf')
            ? nomeArquivo
            : window._nomeArquivoPdfSeguro(nomeArquivo);
        const pdf = window._criarPdfJsComProtecao(JsPDF);
        window._pdfAdicionarCanvas(pdf, canvas);
        pdf.save(arq);
        alert('PDF salvo: ' + arq + '\n\nVerifique a pasta de Downloads do navegador. O cliente pode visualizar e imprimir; edição de texto fica bloqueada (documento em imagem).');
    } catch (e) {
        console.error('gerarPdfProtegidoDaJanela', e);
        alert('Erro ao gerar PDF: ' + (e && e.message ? e.message : e) + '\n\nDica: se o logo não carregar, tente de novo ou use Imprimir > Salvar como PDF na versão loja.');
    } finally {
        if (toolbar) toolbar.style.visibility = '';
        if (btn) { btn.disabled = false; btn.textContent = txtBtn || '🔒 Baixar PDF para cliente'; }
    }
};

window._vincularDownloadPdfCliente = function (janela, nomeArquivo) {
    if (!janela || janela.closed) return;
    const arq = window._nomeArquivoPdfSeguro(nomeArquivo);
    const parentWin = window;
    janela.__arquivoPdfCliente = arq;
    janela.__baixarPdfCliente = function () {
        if (!parentWin.gerarPdfProtegidoDaJanela) {
            return alert('Recarregue o sistema principal (Ctrl+F5) e abra o PDF de novo.');
        }
        return parentWin.gerarPdfProtegidoDaJanela(janela, janela.__arquivoPdfCliente || arq);
    };
};

/**
 * Numeracao de documentos e busca de produto na venda/OS (Fase 17).
 * Extraido do index. Nao grava venda nem baixa estoque.
 */
       // --- FUNÇÕES COMPARTILHADAS GLOBAIS ---
       window.gerarProximoNumeroDoc = function(inputId, valorInicial, tipoDoc) {
           let maxNum = valorInicial; 
           (window.caixaGlobal || []).forEach(v => { 
           if(v.tipo === tipoDoc && v.os && v.os >= maxNum) { 
                   maxNum = v.os; 
               } 
           });
           document.getElementById(inputId).value = maxNum + 1;
           if(document.getElementById('vendaVencimento')) document.getElementById('vendaVencimento').valueAsDate = new Date(); 
           if(document.getElementById('vendaDataEmissao')) document.getElementById('vendaDataEmissao').valueAsDate = new Date();
           if(document.getElementById('osVencimento')) document.getElementById('osVencimento').valueAsDate = new Date();
       }

    window.carregarSelectsGerais = function() {
    // 1. Carrega os Clientes na memória (como são poucos, não tem problema)
    const dCliVenda = document.getElementById('listaClientesNomesVenda'); 
    const dCliOS = document.getElementById('listaClientesNomesOS'); 
    
    let optCli = '';
    (window.clientesGlobais || []).forEach(c => { optCli += `<option value="${c.nome || ''}">`; });
    if(dCliVenda) dCliVenda.innerHTML = optCli; 
    if(dCliOS) dCliOS.innerHTML = optCli; 
    
    // 2. LIMPAMOS a lista de produtos! Não joga mais o estoque inteiro na tela de uma vez.
    const dProdVenda = document.getElementById('listaProdutosEstoqueVenda'); 
    if(dProdVenda) dProdVenda.innerHTML = ''; 
    const dProdOS = document.getElementById('listaProdutosEstoqueOS'); 
    if(dProdOS) dProdOS.innerHTML = ''; 
};

// 3. NOVA FUNÇÃO: Busca inteligente (só filtra o estoque quando você digita ou bipa)
window.filtrarDatalistProdutosDinamicamente = function(termo, datalistId) {
    const datalist = document.getElementById(datalistId);
    if(!datalist) return;

    termo = termo.trim().toLowerCase();
    
    // Se tiver menos de 2 letras (ou vazio), deixa a lista escondida
    if (termo.length < 2) {
        datalist.innerHTML = '';
        return;
    }

    let optProd = '';
    // Procura no estoque e limita a 30 opções para a tela não travar e ser instantâneo
    let resultados = (window.produtosGlobais || []).filter(p => 
        (p.nome && p.nome.toLowerCase().includes(termo)) || 
        (p.codigo && String(p.codigo).toLowerCase().includes(termo))
    ).slice(0, 30); 

    resultados.forEach(p => { 
        let codTxt = p.codigo ? `[${p.codigo}] ` : '';
        optProd += `<option value="${p.nome || ''}">${codTxt}R$ ${parseFloat(p.venda || 0).toFixed(2)} (Estoque: ${window.formatQtdEstoque(p.quantidade)})</option>`;
    });
    
    datalist.innerHTML = optProd;
};

// 4. Conecta os campos de Venda e OS à Busca Inteligente
setTimeout(() => {
    let campoVenda = document.getElementById('vendaProdutoEstoqueBusca');
    if (campoVenda) {
        campoVenda.addEventListener('input', function() {
            window.filtrarDatalistProdutosDinamicamente(this.value, 'listaProdutosEstoqueVenda');
        });
    }

    let campoOS = document.getElementById('osProdutoEstoqueBusca');
    if (campoOS) {
        campoOS.addEventListener('input', function() {
            window.filtrarDatalistProdutosDinamicamente(this.value, 'listaProdutosEstoqueOS');
        });
    }
}, 1000); // Aguarda o sistema carregar antes de conectar


