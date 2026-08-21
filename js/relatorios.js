/**
 * FH CONTROL — Relatórios mensais PDF/Excel (Fase 9)
 * Balcão, Banco, Contas a Receber e Geral.
 * Extraído do index sem alterar a lógica.
 */
// --- RELATÓRIO MENSAL (PDF / EXCEL) ---
const RELATORIO_TITULOS = {
    geral:     'RELATÓRIO MENSAL GERAL (BALCÃO + BANCO + CONTAS A RECEBER)',
    balcao:    'RELATÓRIO MENSAL - CAIXA / BALCÃO',
    banco:     'RELATÓRIO MENSAL - CAIXA BANCO (DIGITAL / PIX / CARTÕES)',
    pendentes: 'RELATÓRIO MENSAL - CONTAS A RECEBER'
};
const RELATORIO_PREFIXO_ARQ = {
    geral: 'Relatorio-Geral', balcao: 'Relatorio-Balcao',
    banco: 'Relatorio-Banco', pendentes: 'Relatorio-ContasReceber'
};

// Coleta, filtra e ordena os lançamentos do período conforme o filtro escolhido
window._coletarItensRelatorio = function(filtro, mesAno) {
    filtro = filtro || 'geral';

    // Caixa Geral (Balcão + Vendas Digitais) — data efetiva (recebimento se houver)
    let dadosCaixa = (window.caixaGlobal || []).filter(doc => window.dataEfetivaCaixaInclui(doc, mesAno));
    // Extrato do Banco (Lançamentos Manuais)
    let dadosBancoManual = (window.extratoBanco || []).filter(doc => doc.dataStr && doc.dataStr.includes(mesAno));

    let itens = [];
    dadosCaixa.forEach(v => {
        let status = v.statusPagamento || 'PAGO';
        if (v.tipo === 'ORCAMENTO' || v.tipo === 'FECHAMENTO') return; // Ignora simulações e fechamentos de tela
        itens.push({
            data: window.dataEfetivaCaixaDia(v),
            doc: v.os || '-',
            tipo: v.tipo,
            descricao: v.clienteNome,
            forma: v.formaPagamento || 'Dinheiro',
            valor: parseFloat(v.total) || 0,
            natureza: (v.tipo === 'DESPESA') ? 'SAIDA' : (status === 'PAGO' ? 'ENTRADA' : 'PENDENTE'),
            // canal: dinheiro/gaveta = balcão; PIX/cartão/boleto = banco
            canal: window.formaPagamentoEhDigital(v.formaPagamento) ? 'banco' : 'balcao'
        });
    });
    dadosBancoManual.forEach(b => {
        itens.push({
            data: b.dataStr.split(' ')[0],
            doc: 'BANCO',
            tipo: 'LANÇ. BANCO',
            descricao: `[BANCO] ${b.descricao}`,
            forma: 'Transferência/Taxa',
            valor: parseFloat(b.valor) || 0,
            natureza: b.tipo, // 'ENTRADA' ou 'SAIDA'
            canal: 'banco'
        });
    });

    // Aplica o filtro escolhido no menu lateral
    itens = itens.filter(function(it){
        if (filtro === 'pendentes') return it.natureza === 'PENDENTE';
        if (filtro === 'balcao')    return it.canal === 'balcao' && it.natureza !== 'PENDENTE';
        if (filtro === 'banco')     return it.canal === 'banco'  && it.natureza !== 'PENDENTE';
        return true; // geral: tudo
    });

    // Ordena por data (mais antigos primeiro)
    itens.sort((a, b) => {
        let dataA = a.data.split('/').reverse().join('');
        let dataB = b.data.split('/').reverse().join('');
        return dataA.localeCompare(dataB);
    });
    return itens;
};

// Mantém compatibilidade: chamada antiga gera o relatório GERAL
window.gerarRelatorioMensal = function() { window._gerarRelatorioMensalPDF('geral'); };

// filtro: 'balcao' | 'banco' | 'pendentes' | 'geral'
window._gerarRelatorioMensalPDF = function(filtro) {
    filtro = filtro || 'geral';
    const TITULOS = RELATORIO_TITULOS;
    const PREFIXO_ARQ = RELATORIO_PREFIXO_ARQ;

    let mesPadrao = new Date().toLocaleDateString('pt-BR').substring(3); // Pega MM/AAAA
    let mesAno = prompt("Digite o mês e ano para o relatório (Ex: 04/2026):", mesPadrao);
    if(!mesAno) return;

    let extratoUnificado = window._coletarItensRelatorio(filtro, mesAno);
    if(extratoUnificado.length === 0) return alert("Nenhum registro encontrado para o período: " + mesAno);

    let totEntradas = 0;
    let totSaidas = 0;
    let totPendentes = 0;
    
    let linhasEntradas = '';
    let linhasSaidas = '';
    let linhasPendentes = '';
    
    extratoUnificado.forEach(item => {
        if (item.natureza === 'PENDENTE') {
            totPendentes += item.valor;
            linhasPendentes += `
                <tr>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 70px;">${item.data}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 60px;">${item.doc}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; font-size: 9px; width: 80px;">${item.tipo}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd;">${item.descricao}<br><small style="color:#777">${item.forma}</small></td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; color: #d35400; font-weight: bold; text-align: right;">R$ ${item.valor.toFixed(2)}</td>
                </tr>
            `;
        } else if (item.natureza === 'ENTRADA') {
            totEntradas += item.valor;
            linhasEntradas += `
                <tr>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 70px;">${item.data}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 60px;">${item.doc}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; font-size: 9px; width: 80px;">${item.tipo}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd;">${item.descricao}<br><small style="color:#777">${item.forma}</small></td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; color: #27ae60; font-weight: bold; text-align: right;">+ R$ ${item.valor.toFixed(2)}</td>
                </tr>
            `;
        } else if (item.natureza === 'SAIDA') {
            totSaidas += item.valor;
            linhasSaidas += `
                <tr>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 70px;">${item.data}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; width: 60px;">${item.doc}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; font-size: 9px; width: 80px;">${item.tipo}</td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd;">${item.descricao}<br><small style="color:#777">${item.forma}</small></td>
                    <td style="padding: 6px; border-bottom: 1px solid #ddd; color: #e74c3c; font-weight: bold; text-align: right;">- R$ ${item.valor.toFixed(2)}</td>
                </tr>
            `;
        }
    });
    
    let saldoMes = totEntradas - totSaidas;

    if (linhasEntradas === '') linhasEntradas = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #777;">Nenhuma entrada/recebimento neste período.</td></tr>`;
    if (linhasSaidas === '') linhasSaidas = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #777;">Nenhuma saída/despesa neste período.</td></tr>`;
    if (linhasPendentes === '') linhasPendentes = `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #777;">Nenhum pagamento pendente neste período.</td></tr>`;

    // Monta o RESUMO (topo) conforme o filtro
    let resumoHtml;
    if (filtro === 'pendentes') {
        resumoHtml = `
            <div class="resumo">
                <div class="resumo-box" style="color: #f39c12;">TOTAL A RECEBER<b>R$ ${totPendentes.toFixed(2)}</b></div>
            </div>`;
    } else {
        resumoHtml = `
            <div class="resumo">
                <div class="resumo-box" style="color: #27ae60;">RECEBIMENTOS TOTAL<b>R$ ${totEntradas.toFixed(2)}</b></div>
                <div class="resumo-box" style="color: #e74c3c;">PAGAMENTOS/SAÍDAS<b>R$ ${totSaidas.toFixed(2)}</b></div>
                <div class="resumo-box" style="color: #2980b9;">SALDO LÍQUIDO DO MÊS<b>R$ ${saldoMes.toFixed(2)}</b></div>
            </div>`;
    }

    // Monta os blocos de seção conforme o filtro
    const secEntradas = `
            <div class="section-title entrada">
                <span>✅ ENTRADAS (RECEBIMENTOS REALIZADOS)</span>
                <span>TOTAL: R$ ${totEntradas.toFixed(2)}</span>
            </div>
            <table>
                <thead>
                    <tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Forma Pgto</th><th style="text-align: right;">Valor</th></tr>
                </thead>
                <tbody>${linhasEntradas}</tbody>
            </table>`;
    const secSaidas = `
            <div class="section-title saida">
                <span>🔻 SAÍDAS E DESPESAS (PAGAMENTOS REALIZADOS)</span>
                <span>TOTAL: R$ ${totSaidas.toFixed(2)}</span>
            </div>
            <table>
                <thead>
                    <tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição / Motivo</th><th style="text-align: right;">Valor</th></tr>
                </thead>
                <tbody>${linhasSaidas}</tbody>
            </table>`;
    const secPendentes = `
            <div class="section-title pendente">
                <span>⏳ PAGAMENTOS PENDENTES (A RECEBER)</span>
                <span>TOTAL: R$ ${totPendentes.toFixed(2)}</span>
            </div>
            <table>
                <thead>
                    <tr><th>Data</th><th>Doc</th><th>Tipo</th><th>Cliente / Forma Pgto Prevista</th><th style="text-align: right;">Valor</th></tr>
                </thead>
                <tbody>${linhasPendentes}</tbody>
            </table>`;

    let secoesHtml;
    if (filtro === 'pendentes') secoesHtml = secPendentes;
    else if (filtro === 'geral') secoesHtml = secEntradas + secSaidas + secPendentes;
    else secoesHtml = secEntradas + secSaidas; // balcao ou banco
    
    let htmlPDF = `
        <html>
        <head>
            <title>Extrato Mensal Unificado - ${mesAno}</title>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: sans-serif; font-size: 11px; color: #333; }
                .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; margin-bottom: 20px; }
                .resumo { display: flex; justify-content: space-around; background: #f4f4f4; padding: 15px; border-radius: 5px; margin-bottom: 20px; border: 1px solid #ccc; }
                .resumo-box { text-align: center; }
                .resumo-box b { display: block; font-size: 14px; margin-top: 5px; }
                
                .section-title { padding: 8px 10px; font-size: 11px; font-weight: bold; margin-top: 25px; text-transform: uppercase; border-radius: 4px 4px 0 0; display: flex; justify-content: space-between; align-items: center;}
                .section-title.entrada { background-color: #27ae60; color: white; }
                .section-title.saida { background-color: #e74c3c; color: white; }
                .section-title.pendente { background-color: #f39c12; color: white; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                th { background: #ecf0f1; color: #2c3e50; padding: 8px; text-align: left; text-transform: uppercase; font-size: 10px; border-bottom: 2px solid #bdc3c7;}
                .pdf-toolbar { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; z-index: 1000; background: rgba(44, 62, 80, 0.96); padding: 12px 18px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.35); }
                .pdf-toolbar-msg { color: #ecf0f1; font-size: 11px; }
                .btn-pdf-imprimir { background: #2980b9; color: #fff; border: none; padding: 10px 16px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; }
                @media print { .pdf-toolbar, .no-export-pdf { display: none !important; } }
            </style>
        </head>
        <body style="padding-bottom: 90px;">
            <div id="pdf-export-root">
            <div class="header">
                <h2 style="margin:0;">${TITULOS[filtro] || TITULOS.geral}</h2>
                <h3 style="margin:5px 0; color: #7f8c8d;">${window.empresaGlobal.nome} - Competência: ${mesAno}</h3>
            </div>
            
            ${resumoHtml}
            
            ${secoesHtml}

            <div style="text-align: center; margin-top: 30px; font-size: 9px; color: #999;">
                Este relatório contempla todas as entradas (Dinheiro, PIX, Cartões) e despesas lançadas no período.<br>
                Documento gerado pelo sistema FH CONSTRUÇÕES CIVIS LTDA em ${new Date().toLocaleString()}.
            </div>
            </div>
            ${window._rodapeBotoesPdf('loja', (PREFIXO_ARQ[filtro] || 'Relatorio') + '-' + String(mesAno).replace(/\//g, '-'))}
        </body>
        </html>
    `;
    let j = window.open('', '', 'width=900,height=750');
    j.document.write(htmlPDF);
    j.document.close();
};

// Exporta o mesmo relatório (conforme o filtro) para um arquivo Excel (.xls)
window._exportarRelatorioMensalExcel = function(filtro) {
    filtro = filtro || 'geral';
    let mesPadrao = new Date().toLocaleDateString('pt-BR').substring(3);
    let mesAno = prompt("Digite o mês e ano para exportar em Excel (Ex: 04/2026):", mesPadrao);
    if(!mesAno) return;

    let itens = window._coletarItensRelatorio(filtro, mesAno);
    if(itens.length === 0) return alert("Nenhum registro encontrado para o período: " + mesAno);

    const fmt = function(n){ return (Number(n)||0).toFixed(2).replace('.', ','); };

    let totEntradas = 0, totSaidas = 0, totPendentes = 0;
    let linhas = itens.map(function(it){
        if (it.natureza === 'ENTRADA') totEntradas += it.valor;
        else if (it.natureza === 'SAIDA') totSaidas += it.valor;
        else if (it.natureza === 'PENDENTE') totPendentes += it.valor;
        let natLabel = it.natureza === 'ENTRADA' ? 'ENTRADA' : (it.natureza === 'SAIDA' ? 'SAÍDA' : 'PENDENTE');
        let canalLabel = it.canal === 'banco' ? 'Banco (Digital)' : 'Balcão (Dinheiro)';
        return `<tr>
            <td>${it.data}</td>
            <td>${it.doc}</td>
            <td>${it.tipo}</td>
            <td>${it.descricao}</td>
            <td>${it.forma}</td>
            <td>${canalLabel}</td>
            <td>${natLabel}</td>
            <td>${fmt(it.valor)}</td>
        </tr>`;
    }).join('');

    let saldo = totEntradas - totSaidas;
    let resumo;
    if (filtro === 'pendentes') {
        resumo = `<tr><td colspan="7"><b>TOTAL A RECEBER</b></td><td><b>${fmt(totPendentes)}</b></td></tr>`;
    } else {
        resumo = `
            <tr><td colspan="7"><b>RECEBIMENTOS</b></td><td><b>${fmt(totEntradas)}</b></td></tr>
            <tr><td colspan="7"><b>SAÍDAS / DESPESAS</b></td><td><b>${fmt(totSaidas)}</b></td></tr>
            <tr><td colspan="7"><b>SALDO LÍQUIDO DO MÊS</b></td><td><b>${fmt(saldo)}</b></td></tr>`;
        if (filtro === 'geral') {
            resumo += `<tr><td colspan="7"><b>A RECEBER (PENDENTES)</b></td><td><b>${fmt(totPendentes)}</b></td></tr>`;
        }
    }

    let tabela = `
        <table border="1">
            <thead>
                <tr><th colspan="8">${RELATORIO_TITULOS[filtro] || RELATORIO_TITULOS.geral} — ${window.empresaGlobal.nome} — Competência: ${mesAno}</th></tr>
                <tr>
                    <th>Data</th><th>Doc</th><th>Tipo</th><th>Descrição</th>
                    <th>Forma Pgto</th><th>Canal</th><th>Natureza</th><th>Valor (R$)</th>
                </tr>
            </thead>
            <tbody>
                ${linhas}
                <tr><td colspan="8"></td></tr>
                ${resumo}
            </tbody>
        </table>`;

    let html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>${tabela}</body></html>`;
    let blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (RELATORIO_PREFIXO_ARQ[filtro] || 'Relatorio') + '-' + String(mesAno).replace(/\//g, '-') + '.xls';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
};
