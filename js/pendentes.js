/**
 * FH CONTROL — Contas a Receber / Pendentes (Fase 6)
 * Tabela, receber parcial, estornar, excluir nota e corrigir data.
 * Extraído do index sem alterar a lógica.
 */
window.idDocRecebimentoPendente = null;

window._escPendTxt = function (s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

window._urlSebraeNfe = 'https://amei.sebrae.com.br/auth/realms/externo/protocol/openid-connect/auth?client_id=emissor-nfe-frontend&redirect_uri=https%3A%2F%2Femissornfe.sebrae.com.br%2F&state=8d2bc86c-0e59-4ece-85a1-37899762e0da&response_mode=fragment&response_type=code&scope=openid&nonce=42ceb5f7-4211-498c-9b29-53626699c44e';
window._urlNfeGov = 'https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional';

window._pendNormBusca = function (s) {
    return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

window._pendenteMatchBusca = function (v, qNorm) {
    if (!qNorm) return true;
    const valor = parseFloat(v.total) || 0;
    const venc = v.vencimento ? String(v.vencimento) : '';
    const vencBR = venc && venc.indexOf('-') > 0 ? venc.split('-').reverse().join('/') : venc;
    const parciais = window._listaRecebimentosParciais(v);
    const formasParc = parciais.map(function (p) { return p.formaPagamento || ''; }).join(' ');
    const partes = [
        v.clienteNome || '',
        String(v.os ?? ''),
        v.dataStr || '',
        (v.dataStr || '').split(/\s+/)[0] || '',
        v.dataRecebimentoStr || '',
        venc,
        vencBR,
        valor.toFixed(2),
        valor.toFixed(2).replace('.', ','),
        String(valor),
        v.id || '',
        v.formaPagamento || '',
        formasParc,
        v.statusPagamento || ''
    ];
    const hay = window._pendNormBusca(partes.join(' '));
    return hay.indexOf(qNorm) !== -1;
};

window._bancoMatchBusca = function (v, qNorm) {
    if (!qNorm) return true;
    if (v.isManual) {
        return window._pendNormBusca(v.descricao || '').indexOf(qNorm) !== -1;
    }
    const doc = v.docPai || v;
    return window._pendenteMatchBusca(doc, qNorm);
};

window.paginaAtualPendentes = 1;
window.itensPorPaginaPendentes = 30;

window._pendChaveCliente = function (nome) {
    return String(nome ?? '').trim().replace(/\s+/g, ' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

window._pendNomeCanonicoCliente = function (nome) {
    const n = String(nome ?? '').trim().replace(/\s+/g, ' ');
    return n || '-';
};

window._agruparPendentesPorCliente = function (listaVis) {
    const mapa = new Map();
    listaVis.forEach(function (v) {
        const canon = window._pendNomeCanonicoCliente(v.clienteNome || '-');
        const chave = window._pendChaveCliente(canon);
        if (!mapa.has(chave)) {
            mapa.set(chave, { chave: chave, nome: canon, notas: [], saldo: 0, qtd: 0 });
        }
        const g = mapa.get(chave);
        g.notas.push(v);
        g.saldo += window._saldoDevedorDoc(v);
        g.qtd += 1;
    });
    const grupos = Array.from(mapa.values());
    grupos.sort(function (a, b) {
        if (Math.abs(b.saldo - a.saldo) > 0.009) return b.saldo - a.saldo;
        return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    grupos.forEach(function (g) {
        g.notas.sort(function (a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    });
    return grupos;
};

window._htmlBalaoClientePendente = function (grupo, selecionado) {
    const nome = window._escPendTxt(grupo.nome);
    const chave = window._escPendTxt(grupo.chave);
    const sel = selecionado ? ' badge-tag-selecionado' : '';
    const extra = ' <small class="valor-saldo-pendente" style="opacity:1;">(' + grupo.qtd + ' nota' + (grupo.qtd === 1 ? '' : 's') + ' · R$ ' + grupo.saldo.toFixed(2) + ')</small>';
    return '<span class="badge-tag-wrap' + sel + '">'
        + '<span role="button" tabindex="0" class="badge-tag badge-tag-pend" data-chave="' + chave + '" title="' + nome + ' — ' + grupo.qtd + ' nota(s) pendente(s)">' + nome + extra + '</span>'
        + '<button type="button" class="badge-tag-excluir" data-chave="' + chave + '" data-tipo="pendente" title="Excluir todas as notas deste cliente">×</button>'
        + '</span>';
};

window.selecionarClientePendente = function (chave) {
    window._clienteSelecionadoPendentes = chave;
    if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
};

window._montarLinhaNotaPendenteHtml = function (v) {
    const prev = window._escPendTxt((v.formaPagamento || '—').replace(/Cartão de /g, ''));
    const totalNota = parseFloat(v.total) || 0;
    const recebido = window._totalRecebidoDoc(v);
    const saldo = window._saldoDevedorDoc(v);
    let colTotal = '';
    const badgeParc = (recebido > 0 && saldo > 0.009)
        ? '<span style="background:#2980b9;color:#fff;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:bold;margin-right:4px;">💰 RECEBIDO PARCIAL</span>'
        : '';
    if (recebido > 0 && saldo > 0.009) {
        colTotal = '<div style="font-size:10px;color:#5c636a;font-weight:600;">Total nota: R$ ' + totalNota.toFixed(2) + '</div>'
            + '<div class="valor-saldo-pendente">Saldo: R$ ' + saldo.toFixed(2) + '</div>'
            + '<div style="font-size:10px;color:#1e8449;font-weight:700;">Recebido: R$ ' + recebido.toFixed(2) + '</div>';
    } else {
        colTotal = '<span class="valor-saldo-pendente">R$ ' + totalNota.toFixed(2) + '</span>';
    }
    return '<tr>'
        + '<td style="font-weight:800;color:#000000;">' + window._escPendTxt(v.clienteNome || '-') + '</td>'
        + '<td style="font-weight:800;color:#000000;">' + badgeParc + window._escPendTxt(String(v.os || '-')) + '</td>'
        + '<td>' + window._escPendTxt(v.tipo || '') + '</td>'
        + '<td>' + window._escPendTxt((v.dataStr || '').split(' ')[0]) + '</td>'
        + '<td>' + colTotal + '</td>'
        + '<td style="font-size:11px;font-weight:700;">' + prev + '</td>'
        + window.montarAcoesCelulaPendente(v)
        + '</tr>';
};

window._obterListaPendentesVisiveis = function () {
    const cx = typeof window.caixaGlobal !== 'undefined' ? window.caixaGlobal : [];
    const lista = cx.filter(v =>
        (v.tipo === 'VENDA' || v.tipo === 'ORDEM DE SERVIÇO' || v.tipo === 'VD') &&
        (v.statusPagamento || '') === 'PENDENTE'
    );
    const inpBusca = document.getElementById('buscaPendentesCaixa');
    const qRaw = inpBusca && inpBusca.value != null ? String(inpBusca.value).trim() : '';
    const qNorm = window._pendNormBusca(qRaw);
    const listaVis = qNorm ? lista.filter(v => window._pendenteMatchBusca(v, qNorm)) : lista;
    listaVis.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return { lista: lista, listaVis: listaVis };
};

window.filtrarPendentesCaixa = function () {
    window.paginaAtualPendentes = 1;
    if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
};

window.mudarPaginaPendentes = function (direcao) {
    const dados = window._obterListaPendentesVisiveis();
    const max = Math.max(1, Math.ceil(dados.listaVis.length / window.itensPorPaginaPendentes));
    if (window.paginaAtualPendentes + direcao >= 1 && window.paginaAtualPendentes + direcao <= max) {
        window.paginaAtualPendentes += direcao;
        if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
    }
};

window.renderizarTabelaPendentesCaixa = function () {
    const tbody = document.getElementById('tabelaPendentesCaixa');
    const hTot = document.getElementById('totalPendentesCaixaHead');
    const hQtd = document.getElementById('qtdPendentesCaixaHead');
    const infoPag = document.getElementById('infoPaginaPendentes');
    const wrapPag = document.getElementById('paginacaoPendentesWrap');
    if (!tbody) return;
    const dados = window._obterListaPendentesVisiveis();
    const lista = dados.lista;
    const listaVis = dados.listaVis;
    const tot = listaVis.reduce(function (s, v) { return s + window._saldoDevedorDoc(v); }, 0);
    if (hTot) hTot.textContent = 'R$ ' + tot.toFixed(2);
    if (hQtd) hQtd.textContent = String(listaVis.length);
    const totalPaginas = Math.max(1, Math.ceil(listaVis.length / window.itensPorPaginaPendentes));
    if (window.paginaAtualPendentes > totalPaginas) window.paginaAtualPendentes = totalPaginas;
    if (window.paginaAtualPendentes < 1) window.paginaAtualPendentes = 1;
    if (infoPag) infoPag.textContent = 'Pág ' + window.paginaAtualPendentes + ' de ' + totalPaginas;
    if (!lista.length) {
        if (wrapPag) wrapPag.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #343a40; font-weight: 600;">Nenhuma conta pendente.</td></tr>';
        return;
    }
    if (!listaVis.length) {
        if (wrapPag) wrapPag.style.display = 'none';
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #343a40; font-weight: 600;">Nenhum resultado para essa busca. Limpe o campo para ver todas.</td></tr>';
        return;
    }
    if (wrapPag) wrapPag.style.display = totalPaginas > 1 ? 'flex' : 'none';
    const inicio = (window.paginaAtualPendentes - 1) * window.itensPorPaginaPendentes;
    const paginaItens = listaVis.slice(inicio, inicio + window.itensPorPaginaPendentes);
    tbody.innerHTML = paginaItens.map(function (v) {
        return window._montarLinhaNotaPendenteHtml(v);
    }).join('');
};

window.fecharModalReceberPendente = function () {
    window.idDocRecebimentoPendente = null;
    const m = document.getElementById('modalReceberPendente');
    if (m) m.style.display = 'none';
};

window._listaCaixaSincronizada = function () {
    return Array.isArray(window.caixaGlobal) ? window.caixaGlobal : [];
};

window.abrirModalReceberPendente = function (id) {
    const listaCx = window._listaCaixaSincronizada();
    const doc = listaCx.find(x => String(x.id) === String(id));
    if (!doc) {
        alert('Documento não encontrado na lista do caixa. Aguarde a sincronização ou recarregue a página.');
        return;
    }
    if (window._docQuitado(doc)) {
        return alert('Este documento já está quitado (PAGO).');
    }
    window.idDocRecebimentoPendente = doc.id;
    const totalNota = parseFloat(doc.total) || 0;
    const recebido = window._totalRecebidoDoc(doc);
    const saldo = window._saldoDevedorDoc(doc);
    const res = document.getElementById('receberPendenteResumo');
    if (res) {
        res.innerHTML = `<strong>${window._escPendTxt(doc.clienteNome || '-')}</strong> — Doc. <strong>${window._escPendTxt(String(doc.os || '-'))}</strong>`;
    }
    const infoSaldo = document.getElementById('receberPendenteSaldoInfo');
    if (infoSaldo) {
        let txt = `Valor total da nota: <strong>R$ ${totalNota.toFixed(2)}</strong>`;
        if (recebido > 0) txt += ` &nbsp;|&nbsp; Já recebido: <strong style="color:#2ecc71;">R$ ${recebido.toFixed(2)}</strong>`;
        txt += ` &nbsp;|&nbsp; Saldo devedor: <strong style="color:#f1c40f;">R$ ${saldo.toFixed(2)}</strong>`;
        infoSaldo.innerHTML = txt;
    }
    const inpVal = document.getElementById('receberValorParcial');
    if (inpVal) {
        inpVal.value = saldo.toFixed(2);
        inpVal.max = saldo.toFixed(2);
    }
    const sel = document.getElementById('receberFormaPgto');
    if (sel) {
        // No balcão, padrão é dinheiro físico (evita herdar PIX da nota original por engano)
        sel.value = 'Dinheiro';
    }
    const m = document.getElementById('modalReceberPendente');
    if (m) m.style.display = 'flex';
};

window.confirmarRecebimentoPendente = async function () {
    const id = window.idDocRecebimentoPendente;
    if (!id) return;
    const listaCx = window._listaCaixaSincronizada();
    const doc = listaCx.find(x => String(x.id) === String(id));
    if (!doc) {
        window.fecharModalReceberPendente();
        return;
    }
    const saldoAntes = window._saldoDevedorDoc(doc);
    if (saldoAntes <= 0.009) {
        window.fecharModalReceberPendente();
        return alert('Esta nota já está quitada.');
    }
    const inpVal = document.getElementById('receberValorParcial');
    const valorReceber = inpVal ? (parseFloat(String(inpVal.value).replace(',', '.')) || 0) : saldoAntes;
    if (valorReceber <= 0) {
        return alert('Informe um valor maior que zero para este recebimento.');
    }
    if (valorReceber > saldoAntes + 0.009) {
        return alert(`O valor informado (R$ ${valorReceber.toFixed(2)}) é maior que o saldo devedor (R$ ${saldoAntes.toFixed(2)}).`);
    }
    const sel = document.getElementById('receberFormaPgto');
    const forma = sel ? sel.value : 'Dinheiro';
    const isDig = window.formaPagamentoEhDigital(forma);
    try {
        const { ref, update } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
        const agora = Date.now();
        const dataRecebimentoStr = new Date(agora).toLocaleString('pt-BR');
        const historico = window._listaRecebimentosParciais(doc).slice();
        historico.push({
            valor: valorReceber,
            formaPagamento: forma,
            dataStr: dataRecebimentoStr,
            timestamp: agora
        });
        const totalRecebido = historico.reduce(function (s, r) { return s + (parseFloat(r.valor) || 0); }, 0);
        const saldoRestante = Math.max(0, (parseFloat(doc.total) || 0) - totalRecebido);
        const quitado = saldoRestante <= 0.009;
        const payload = {
            recebimentosParciais: historico,
            valorRecebidoParcial: totalRecebido,
            saldoDevedor: saldoRestante,
            formaPagamento: forma,
            autoLancamentoBanco: false,
            statusPagamento: quitado ? 'PAGO' : 'PENDENTE',
            // SEMPRE grava data do RECEBIMENTO (ignora data de emissão da nota)
            dataRecebimentoStr: dataRecebimentoStr,
            timestampRecebimento: agora
        };
        await update(ref(window.meuBanco, 'caixa/' + id), payload);
        // Atualiza memória local na hora (não espera o Firebase devolver)
        const idxLocal = window.caixaGlobal.findIndex(function (x) { return String(x.id) === String(id); });
        if (idxLocal >= 0) {
            Object.assign(window.caixaGlobal[idxLocal], payload);
            window.caixaGlobal = window.caixaGlobal;
        }
        window.fecharModalReceberPendente();
        let msgOk = quitado
            ? '✅ Nota quitada com sucesso!'
            : `✅ Pagamento parcial registrado!\n\nRecebido agora: R$ ${valorReceber.toFixed(2)}\nSaldo devedor restante: R$ ${saldoRestante.toFixed(2)}`;
        msgOk += isDig
            ? '\n\nValor contabilizado no banco digital na data de hoje (' + window._diaBrDeString(dataRecebimentoStr) + '). Não entra na gaveta física.'
            : '\n\nValor contabilizado no caixa físico (gaveta) na data de hoje.';
        alert(msgOk);
        if (window._recalcularPainelGavetaHoje) await window._recalcularPainelGavetaHoje(true);
        if (window.atualizarPainelBanco) window.atualizarPainelBanco();
        if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
        if (window.renderizarTabelaBanco) window.renderizarTabelaBanco();
        if (window.renderizarTabelaCaixa) window.renderizarTabelaCaixa();
        if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
    } catch (e) {
        alert('Erro ao atualizar: ' + e.message);
    }
};

window.marcarComoPago = function (id) {
    window.abrirModalReceberPendente(id);
};

window.excluirNotaPendente = async function (id, opcoes) {
    opcoes = opcoes || {};
    const listaCx = window._listaCaixaSincronizada();
    const doc = listaCx.find(x => String(x.id) === String(id));
    if (!doc) {
        if (!opcoes.silencioso) alert('Documento não encontrado. Aguarde a sincronização ou recarregue a página.');
        return false;
    }
    if ((doc.statusPagamento || 'PENDENTE') !== 'PENDENTE' || window._docQuitado(doc)) {
        if (!opcoes.silencioso) alert('Somente notas com saldo em aberto podem ser excluídas por aqui. Para notas quitadas, use Estornar ou Cancelar na tabela do caixa.');
        return false;
    }
    const recebidoParcial = window._totalRecebidoDoc(doc);
    const saldo = window._saldoDevedorDoc(doc);
    if (!opcoes.silencioso) {
        let msgExtra = '';
        if (recebidoParcial > 0) {
            msgExtra = `\n\n⚠️ Esta nota já teve R$ ${recebidoParcial.toFixed(2)} recebido(s). Esse valor será estornado do caixa/banco ao excluir.`;
        }
        const msg =
            '⚠️ ATENÇÃO: Ao clicar em excluir a nota, os produtos adicionados irão retornar ao estoque.\n\n' +
            `Documento Nº ${doc.os || '-'} — ${doc.clienteNome || 'Cliente'} — Saldo devedor: R$ ${saldo.toFixed(2)}${msgExtra}\n\n` +
            'Deseja prosseguir?';
        if (!confirm(msg)) return false;
    }
    try {
        const { ref, get, update, remove } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js');
        const dbBanco = window.meuBanco;
        const snap = await get(ref(dbBanco, 'caixa/' + id));
        const vCanc = snap.val();
        if (!vCanc) {
            if (!opcoes.silencioso) alert('Documento não encontrado no banco de dados.');
            return false;
        }
        const tiposComEstoque = { VENDA: true, VD: true, 'ORDEM DE SERVIÇO': true };
        if (tiposComEstoque[vCanc.tipo] && vCanc.itens) {
            const itensGarantidos = Array.isArray(vCanc.itens) ? vCanc.itens : Object.values(vCanc.itens);
            for (const item of itensGarantidos) {
                if (item.ehEstoque && item.idProd) {
                    const snapP = await get(ref(dbBanco, 'produtos/' + item.idProd));
                    const pDb = snapP.val();
                    if (pDb) {
                        await update(ref(dbBanco, 'produtos/' + item.idProd), {
                            quantidade: window.aplicarDeltaQtdDb(pDb.quantidade, item.qtdBaixa)
                        });
                    }
                }
            }
        }
        await remove(ref(dbBanco, 'caixa/' + id));
        if (typeof window.caixaGlobal !== 'undefined') {
            const idx = window.caixaGlobal.findIndex(function (x) { return String(x.id) === String(id); });
            if (idx >= 0) window.caixaGlobal.splice(idx, 1);
            window.caixaGlobal = window.caixaGlobal;
        }
        if (!opcoes.silencioso) {
            alert('✅ Nota excluída. Os produtos do estoque foram devolvidos quando aplicável.');
        }
        if (!opcoes.pularRecalculo) {
            if (window._recalcularPainelGavetaHoje) await window._recalcularPainelGavetaHoje(true);
            if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
            if (window.renderizarTabelaCaixa) window.renderizarTabelaCaixa();
            if (window.renderizarTabelaBanco) window.renderizarTabelaBanco();
            if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
        }
        return true;
    } catch (erro) {
        if (!opcoes.silencioso) alert('Erro ao excluir: ' + (erro.message || erro));
        return false;
    }
};

window.excluirGrupoClientePendente = async function (chave) {
    const dados = window._obterListaPendentesVisiveis();
    const grupos = window._agruparPendentesPorCliente(dados.listaVis);
    const grupo = grupos.find(function (g) { return g.chave === chave; });
    if (!grupo || !grupo.notas.length) return;
    const msg =
        'Excluir TODAS as ' + grupo.qtd + ' nota(s) pendentes de "' + grupo.nome + '"?\n\n' +
        'Os produtos voltam ao estoque. Esta ação não pode ser desfeita.';
    if (!confirm(msg)) return;
    let ok = 0;
    for (let i = 0; i < grupo.notas.length; i++) {
        const feito = await window.excluirNotaPendente(grupo.notas[i].id, { silencioso: true, pularRecalculo: true });
        if (feito) ok++;
    }
    if (window._recalcularPainelGavetaHoje) await window._recalcularPainelGavetaHoje(true);
    if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
    if (window.renderizarTabelaCaixa) window.renderizarTabelaCaixa();
    if (window.renderizarTabelaBanco) window.renderizarTabelaBanco();
    if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
    alert('✅ ' + ok + ' nota(s) de "' + grupo.nome + '" excluída(s).');
};

(function () {
    if (window._delegPendentesCaixaAcoes) return;
    window._delegPendentesCaixaAcoes = true;
    document.addEventListener('click', function (ev) {
        const t = ev.target;
        if (!t || !t.closest) return;
        const btnDel = t.closest('.badge-tag-excluir');
        if (btnDel) {
            ev.preventDefault();
            ev.stopPropagation();
            const chaveDel = btnDel.getAttribute('data-chave');
            const tipoDel = btnDel.getAttribute('data-tipo');
            if (chaveDel && tipoDel === 'obra-desp' && window.excluirGrupoObraDesp) {
                window.excluirGrupoObraDesp(chaveDel);
            }
            return;
        }
        const badgeObra = t.closest('.badge-tag-desp-obra');
        if (badgeObra && badgeObra.closest('#listaBaloesObrasDesp')) {
            const chaveObra = badgeObra.getAttribute('data-chave');
            if (chaveObra && window.selecionarObraDesp) window.selecionarObraDesp(chaveObra);
            return;
        }
        const btn = t.closest('.btn-pend-acao');
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        const enc = btn.getAttribute('data-pend-id');
        const acao = btn.getAttribute('data-acao');
        if (enc == null || enc === '' || !acao) return;
        let id;
        try {
            id = decodeURIComponent(enc);
        } catch (e) {
            id = enc;
        }
        if (!id) return;
        if (acao === 'editar' && window.editarDocumentoCaixa) window.editarDocumentoCaixa(id);
        else if (acao === 'receber' && window.abrirModalReceberPendente) window.abrirModalReceberPendente(id);
        else if (acao === 'whats' && window.enviarOSWhatsApp) window.enviarOSWhatsApp(id);
        else if (acao === 'link' && window.copiarLinkAssinatura) window.copiarLinkAssinatura(id);
        else if (acao === 'pdf' && window.gerarPDF_Historico) window.gerarPDF_Historico(id, 'loja');
        else if (acao === 'pdf-cliente' && window.gerarPDFparaCliente) window.gerarPDFparaCliente(id);
        else if (acao === 'cupom' && window.imprimirCupom) window.imprimirCupom(id);
        else if (acao === 'visualizar' && window.visualizarNota) window.visualizarNota(id);
        else if (acao === 'excluir' && window.excluirNotaPendente) window.excluirNotaPendente(id);
        else if (acao === 'estornar' && window.estornarPagamento) window.estornarPagamento(id);
    }, true);
})();

window.corrigirDataRecebimentoParaHoje = async function (id) {
    const listaCx = window._listaCaixaSincronizada();
    const doc = listaCx.find(function (x) { return String(x.id) === String(id); });
    if (!doc) return alert('Documento não encontrado.');
    if ((doc.statusPagamento || 'PAGO') !== 'PAGO') {
        return alert('Só é possível corrigir notas já quitadas (PAGO).');
    }
    if (!window.formaPagamentoEhDigital(doc.formaPagamento)) {
        return alert('Esta correção é para recebimentos PIX/cartão/boleto no banco digital.');
    }
    const parciais = window._listaRecebimentosParciais(doc);
    if (parciais.length) {
        return alert('Esta nota já tem histórico de recebimentos parciais. Se a data estiver errada, use Estornar e receba novamente.');
    }
    const diaAtual = window._diaBrDeString(window.dataEfetivaCaixa(doc));
    const hoje = new Date().toLocaleDateString('pt-BR');
    if (diaAtual === hoje) {
        return alert('A data de recebimento desta nota já está em hoje (' + hoje + ').');
    }
    const msg =
        'Corrigir data de recebimento para HOJE (' + hoje + ')?\n\n' +
        'Nota Nº ' + (doc.os || '-') + ' — ' + (doc.clienteNome || '') + '\n' +
        'Valor: R$ ' + (parseFloat(doc.total) || 0).toFixed(2) + '\n' +
        'Data atual no sistema: ' + diaAtual + '\n\n' +
        'O valor passará a contar no caixa do banco a partir de hoje.';
    if (!confirm(msg)) return;
    try {
        const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js');
        const agora = Date.now();
        const dataRecebimentoStr = new Date(agora).toLocaleString('pt-BR');
        const payload = {
            dataRecebimentoStr: dataRecebimentoStr,
            timestampRecebimento: agora,
            recebimentosParciais: [{
                valor: parseFloat(doc.total) || 0,
                formaPagamento: doc.formaPagamento || 'PIX',
                dataStr: dataRecebimentoStr,
                timestamp: agora
            }],
            valorRecebidoParcial: parseFloat(doc.total) || 0,
            saldoDevedor: 0,
            statusPagamento: 'PAGO'
        };
        await update(ref(window.meuBanco, 'caixa/' + id), payload);
        const idxLocal = window.caixaGlobal.findIndex(function (x) { return String(x.id) === String(id); });
        if (idxLocal >= 0) {
            Object.assign(window.caixaGlobal[idxLocal], payload);
            window.caixaGlobal = window.caixaGlobal;
        }
        alert('✅ Data de recebimento corrigida para hoje. O valor já deve aparecer nas entradas do banco.');
        if (window.atualizarPainelBanco) window.atualizarPainelBanco();
        if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
        if (window.renderizarTabelaBanco) window.renderizarTabelaBanco();
        if (window.renderizarTabelaCaixa) window.renderizarTabelaCaixa();
        if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
    } catch (e) {
        alert('Erro ao corrigir: ' + e.message);
    }
};

window._precisaCorrigirDataRecebimentoBanco = function (doc) {
    if (!doc || (doc.statusPagamento || 'PAGO') !== 'PAGO') return false;
    if (!window.formaPagamentoEhDigital(doc.formaPagamento)) return false;
    if (window._listaRecebimentosParciais(doc).length) return false;
    if (!doc.timestampRecebimento) return true;
    const hoje = new Date().toLocaleDateString('pt-BR');
    return window._diaBrDeString(window.dataEfetivaCaixa(doc)) !== hoje;
};

window.estornarPagamento = async function(id) {
    const listaCx = window._listaCaixaSincronizada();
    const doc = listaCx.find(x => String(x.id) === String(id));
    if (!doc) return;
    if ((doc.statusPagamento || 'PAGO') === 'PENDENTE' && window._totalRecebidoDoc(doc) <= 0) {
        return alert('Este documento já está como PENDENTE (sem recebimentos).');
    }
    const recebido = window._totalRecebidoDoc(doc);
    const msgEstorno =
        '🔄 ESTORNAR PAGAMENTO\n\n' +
        'Nota Nº ' + (doc.os || '-') + '\n' +
        'Cliente: ' + (doc.clienteNome || '') + '\n\n' +
        'Deseja desfazer o(s) recebimento(s) desta nota?\n' +
        'Valor a estornar: R$ ' + recebido.toFixed(2) + '\n\n' +
        '✓ PIX/cartão: valor sai do banco digital\n' +
        '✓ Dinheiro: valor sai da gaveta física\n' +
        '✓ A nota voltará para Contas a Receber (Pendentes)';
    if (!confirm(msgEstorno)) return;
    try {
        const { ref, update } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js");
        const payloadEstorno = {
            statusPagamento: 'PENDENTE',
            autoLancamentoBanco: false,
            dataRecebimentoStr: null,
            timestampRecebimento: null,
            recebimentosParciais: null,
            valorRecebidoParcial: null,
            saldoDevedor: null
        };
        await update(ref(window.meuBanco, 'caixa/' + id), payloadEstorno);
        if (typeof window.caixaGlobal !== 'undefined') {
            const idxLocal = window.caixaGlobal.findIndex(function (x) { return String(x.id) === String(id); });
            if (idxLocal >= 0) Object.assign(window.caixaGlobal[idxLocal], payloadEstorno);
        }
        alert('Pagamento estornado! A nota voltou para Contas a Receber (Pendentes).');
        if (window._recalcularPainelGavetaHoje) await window._recalcularPainelGavetaHoje(true);
        if (window.atualizarPainelBanco) window.atualizarPainelBanco();
        if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
        if (window.renderizarTabelaPendentesCaixa) window.renderizarTabelaPendentesCaixa();
        if (window.renderizarTabelaCaixa) window.renderizarTabelaCaixa();
        if (window.renderizarTabelaBanco) window.renderizarTabelaBanco();
    } catch (e) {
        alert('Erro ao atualizar: ' + e.message);
    }
};
