/**
 * FH CONTROL — PDF da nota, cupom 80mm e WhatsApp (Fase 10)
 * Extraído do index sem alterar a lógica.
 */
       // --- CONSTRUÇÃO DO PDF (DOCUMENTOS) ---
       window.gerarPDF_Historico = function(id, modo) {
           const doc = (window.caixaGlobal || []).find(x => x.id === id);
           if (doc) window.construirPDF(doc, modo || 'loja');
       };

       window.gerarPDFparaCliente = function (id) {
           window.gerarPDF_Historico(id, 'cliente');
       };

       window._idNotaVisualizacaoAtual = null;

       window.fecharModalVisualizarNota = function () {
           const modal = document.getElementById('modalVisualizarNota');
           const container = document.getElementById('conteudoVisualizarNota');
           if (modal) modal.style.display = 'none';
           if (container) container.innerHTML = '';
           window._idNotaVisualizacaoAtual = null;
       };

       window.visualizarNota = function (id) {
           const lista = typeof window.caixaGlobal !== 'undefined' ? window.caixaGlobal : [];
           const doc = lista.find(function (x) { return String(x.id) === String(id); });
           if (!doc) return alert('Documento não encontrado.');
           const modal = document.getElementById('modalVisualizarNota');
           const container = document.getElementById('conteudoVisualizarNota');
           const titulo = document.getElementById('tituloVisualizarNota');
           if (!modal || !container) return;
           window._idNotaVisualizacaoAtual = doc.id;
           if (titulo) {
               titulo.textContent = (doc.tipo || 'Nota') + ' Nº ' + (doc.os || 'S/N') + ' — ' + (doc.clienteNome || '');
           }
           const htmlNota = window._montarHtmlCompletoNota(doc, 'loja', { semToolbar: true });
           container.innerHTML = '<iframe id="iframePreviewNota" title="Pré-visualização da nota"></iframe>';
           const iframe = document.getElementById('iframePreviewNota');
           if (iframe) iframe.srcdoc = htmlNota;
           modal.style.display = 'flex';
       };

       window.imprimirNotaVisualizada = function () {
           const iframe = document.getElementById('iframePreviewNota');
           if (iframe && iframe.contentWindow) {
               iframe.contentWindow.focus();
               iframe.contentWindow.print();
               return;
           }
           if (window._idNotaVisualizacaoAtual && window.gerarPDF_Historico) {
               window.gerarPDF_Historico(window._idNotaVisualizacaoAtual, 'loja');
           }
       };

       window.abrirPdfDaNotaVisualizada = function () {
           if (window._idNotaVisualizacaoAtual && window.gerarPDF_Historico) {
               window.gerarPDF_Historico(window._idNotaVisualizacaoAtual, 'loja');
           }
       };

       window._montarHtmlCompletoNota = function(doc, modo, opts) {
           opts = opts || {};
           modo = modo || 'loja';
           const paraCliente = (modo === 'cliente');
           const formataDataHora = (isoStr) => {
               if(!isoStr || isoStr === 'Não informado' || isoStr === '') return "-";
               let d = new Date(isoStr);
               return isNaN(d) ? isoStr : (d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}));
           };

           let htmlTabelas = '';
           let blocoDados = '';

           // Construção das Tabelas e Blocos de Informação
           if (doc.tipo === 'ORDEM DE SERVIÇO') {
               let matHtml = ''; let servHtml = '';
               let totalMat = 0; let totalServ = 0;

               let itensGarantidos = doc.itens ? (Array.isArray(doc.itens) ? doc.itens : Object.values(doc.itens)) : [];

               if(itensGarantidos.length > 0) {
                   itensGarantidos.forEach(i => {
                       let tdHtml = `<tr><td style="font-size: 9px; padding: 4px 6px;">${i.nome}</td><td class="text-right" style="font-size: 10px; padding: 4px 6px;">R$ ${i.valor.toFixed(2)}</td></tr>`;
                       if(i.categoriaOS === 'servico') { servHtml += tdHtml; totalServ += i.valor; } 
                       else { matHtml += tdHtml; totalMat += i.valor; }
                   });
               }
               
               if(!matHtml) matHtml = `<tr><td colspan="2" class="text-center text-muted">Nenhum material lançado.</td></tr>`;
               if(!servHtml) servHtml = `<tr><td colspan="2" class="text-center text-muted">Nenhum serviço lançado.</td></tr>`;

               blocoDados = `
                   <div class="info-card">
                       <div class="card-title">DADOS DA ORDEM DE SERVIÇO</div>
                       <div class="grid-3">
                          <div><strong>Cliente:</strong><br>${doc.clienteNome}</div>
                          <div><strong>Atendente / Técnico:</strong><br>${doc.vendedor || doc.funcionario || 'Sistema'}</div>
                          <div><strong>Equipe:</strong><br>${doc.equipe || 'Não informada'} (Pessoas: ${doc.pessoas || 1})</div>
                       </div>
                   </div>
                   <div class="info-card">
                       <div class="card-title">EXECUÇÃO E DESLOCAMENTO</div>
                       <div class="grid-4">
                          <div><strong>Início:</strong><br>${formataDataHora(doc.inicio)}</div>
                          <div><strong>Término:</strong><br>${formataDataHora(doc.fim)}</div>
                          <div><strong>Deslocamento:</strong><br>${doc.kmTotal || 0} km rodados</div>
                          <div><strong>Custo Km:</strong><br>R$ ${parseFloat(doc.kmCusto||0).toFixed(2)}</div>
                       </div>
                   </div>
               `;

               htmlTabelas = `
                   <div class="tabelas-container">
                       <div class="tabela-box">
                           <div class="card-title">MATERIAIS E PEÇAS</div>
                           <table class="tabela-bonita">
                              <thead><tr><th>Descrição</th><th class="text-right" style="width: 80px;">Valor</th></tr></thead>
                              <tbody>${matHtml}</tbody>
                              <tfoot><tr><th class="text-right">Subtotal:</th><th class="text-right">R$ ${totalMat.toFixed(2)}</th></tr></tfoot>
                           </table>
                       </div>
                       <div class="tabela-box">
                           <div class="card-title">MÃO DE OBRA / SERVIÇOS</div>
                           <table class="tabela-bonita">
                              <thead><tr><th>Descrição</th><th class="text-right" style="width: 80px;">Valor</th></tr></thead>
                              <tbody>${servHtml}</tbody>
                              <tfoot><tr><th class="text-right">Subtotal:</th><th class="text-right">R$ ${totalServ.toFixed(2)}</th></tr></tfoot>
                           </table>
                       </div>
                   </div>
               `;
           } else {
               let itensGarantidos = doc.itens ? (Array.isArray(doc.itens) ? doc.itens : Object.values(doc.itens)) : [];
               let matHtml = ''; let servHtml = '';
               let totalMat = 0; let totalServ = 0;

               if(itensGarantidos.length > 0) {
                   itensGarantidos.forEach(i => {
                       const isServ = (i.categoriaOS === 'servico') || String(i.nome || '').toLowerCase().includes('mão de obra') || String(i.nome || '').toLowerCase().includes('[mão de obra]') || String(i.nome || '').toLowerCase().includes('[serviço]');
                       let tdHtml = `<tr><td style="font-size: 9px; padding: 4px 6px;">${i.nome}</td><td class="text-right" style="width: 120px; font-size: 10px; padding: 4px 6px;">R$ ${i.valor.toFixed(2)}</td></tr>`;
                       if (isServ) { servHtml += tdHtml; totalServ += (Number(i.valor) || 0); }
                       else { matHtml += tdHtml; totalMat += (Number(i.valor) || 0); }
                   });
               }
               if(!matHtml) matHtml = `<tr><td colspan="2" class="text-center text-muted">Nenhum produto/material lançado.</td></tr>`;
               if(!servHtml) servHtml = `<tr><td colspan="2" class="text-center text-muted">Nenhuma mão de obra/serviço lançado.</td></tr>`;

               blocoDados = `
                   <div class="info-card">
                       <div class="card-title">DADOS DO DOCUMENTO</div>
                       <div class="grid-3">
                           <div><strong>Cliente:</strong><br>${doc.clienteNome}</div>
                           <div><strong>Data de Emissão:</strong><br>${doc.dataStr}</div>
                           <div><strong>Atendente/Vendedor:</strong><br>${doc.vendedor || 'Sistema'}</div>
                       </div>
                   </div>
               `;

               htmlTabelas = `
                   <div class="tabela-box" style="margin-top: 15px;">
                       <div class="card-title">PRODUTOS / MATERIAIS</div>
                       <table class="tabela-bonita">
                          <thead><tr><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
                          <tbody>${matHtml}</tbody>
                          <tfoot><tr><th class="text-right">Subtotal:</th><th class="text-right">R$ ${totalMat.toFixed(2)}</th></tr></tfoot>
                       </table>
                   </div>
                   <div class="tabela-box" style="margin-top: 15px;">
                       <div class="card-title">MÃO DE OBRA / SERVIÇOS</div>
                       <table class="tabela-bonita">
                          <thead><tr><th>Descrição</th><th class="text-right">Valor</th></tr></thead>
                          <tbody>${servHtml}</tbody>
                          <tfoot><tr><th class="text-right">Subtotal:</th><th class="text-right">R$ ${totalServ.toFixed(2)}</th></tr></tfoot>
                       </table>
                   </div>
               `;
           }
           
           let obsHTML = doc.observacao ? `<div class="info-card" style="margin-top:10px;"><div class="card-title">OBSERVAÇÕES</div><div style="font-size: 10px; white-space: pre-wrap;">${doc.observacao}</div></div>` : '';

           // Tratamento de Imagens e Assinatura
           let fotoHTML = doc.fotoAnexo ? `<div class="foto-box"><div class="card-title">REGISTRO FOTOGRÁFICO</div><img src="${doc.fotoAnexo}"></div>` : '';
           
           let assinaturaHTML = doc.assinaturaBase64 
               ? `<div class="ass-box"><img src="${doc.assinaturaBase64}"><div class="ass-linha" style="color: #27ae60;">Assinatura Digital Confirmada</div><div class="ass-nome">${doc.clienteNome}</div></div>` 
               : `<div class="ass-box" style="margin-top: 40px;"><div class="ass-linha">Assinatura do Cliente</div></div>`;

           // Tratamento do Cabeçalho
           let logoHeader = `<img src="https://www.image2url.com/r2/default/files/1777991879754-324ae06d-dd51-42bd-9f5b-f242d4babc74.jpeg" class="logo-img" crossorigin="anonymous" referrerpolicy="no-referrer" onerror="this.style.display='none'">`;
           let cnpjeTel = [];
           if(window.empresaGlobal.cnpj) cnpjeTel.push(`CNPJ: ${window.empresaGlobal.cnpj}`);
           if(window.empresaGlobal.telefone) cnpjeTel.push(`Contato: ${window.empresaGlobal.telefone}`);
           let contatosHeader = cnpjeTel.length > 0 ? cnpjeTel.join(' | ') : '';

           const htmlPDF = `
               <html>
               <head>
                   <title>Doc Nº ${doc.os}</title>
                   <style>
                       @page { size: A4; margin: 10mm; }
                       body {
                           font-family: 'Segoe UI', Arial, sans-serif; color: #333; font-size: 11px; margin: 0; padding: 0;
                           -webkit-print-color-adjust: exact; print-color-adjust: exact;
                           background: #eceff1;
                       }
                       #pdf-export-root {
                           box-sizing: border-box;
                           width: 190mm;
                           max-width: 190mm;
                           margin: 10mm auto;
                           padding: 0;
                           background: #ffffff;
                       }
                       
                       .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #2c3e50; padding-bottom: 15px; margin-bottom: 15px; }
                       .logo-container { width: 25%; text-align: left; }
                       .logo-img { max-height: 65px; max-width: 100%; object-fit: contain; }
                       .empresa-info { width: 45%; text-align: center; }
                       .empresa-nome { font-size: 15px; font-weight: bold; color: #2c3e50; text-transform: uppercase; margin-bottom: 3px; }
                       .empresa-detalhes { font-size: 10px; color: #555; }
                       .doc-info { width: 30%; text-align: right; }
                       .doc-tipo { font-size: 12px; font-weight: bold; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px; }
                       .doc-numero { font-size: 20px; font-weight: 900; color: #e74c3c; margin: 4px 0; }
                       
                       .info-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
                       .card-title { font-size: 10px; font-weight: 800; color: #34495e; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #dee2e6; padding-bottom: 4px; letter-spacing: 0.5px; }
                       .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                       .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
                       .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; }
                       
                       .tabelas-container { display: flex; gap: 15px; margin-top: 15px; }
                       .tabela-box { flex: 1; }
                       .tabela-bonita { width: 100%; border-collapse: collapse; border-radius: 6px; overflow: hidden; box-shadow: 0 0 0 1px #dee2e6; }
                       .tabela-bonita th { background-color: #2c3e50; color: #ffffff; padding: 4px 6px; font-size: 10px; text-transform: uppercase; }
                       .tabela-bonita td { border-bottom: 1px solid #e9ecef; }
                       .tabela-bonita tbody tr:nth-child(even) { background-color: #f8f9fa; }
                       .tabela-bonita tfoot th { background-color: #e9ecef; color: #2c3e50; font-size: 11px; border-top: 2px solid #ced4da; padding: 6px; }
                       
                       .text-right { text-align: right; }
                       .text-center { text-align: center; }
                       .text-muted { color: #6c757d; font-style: italic; }
                       
                       .total-destaque { background-color: #2c3e50; color: #ffffff; font-size: 16px; font-weight: 900; text-align: right; padding: 10px 15px; margin-top: 15px; border-radius: 6px; }
                       .foto-box { text-align: center; margin-top: 15px; background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef; }
                       .foto-box img { max-height: 180px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                       
                       .area-assinaturas { display: flex; justify-content: space-around; margin-top: 25px; align-items: flex-end; }
                       .ass-box { text-align: center; width: 40%; }
                       .ass-box img { max-height: 60px; margin-bottom: 5px; }
                       .ass-linha { border-top: 1px solid #34495e; padding-top: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
                       .ass-nome { font-size: 11px; color: #555; margin-top: 2px; }
                       
                       .rodape { text-align: center; margin-top: 20px; font-size: 9px; color: #adb5bd; border-top: 1px dashed #dee2e6; padding-top: 8px; }
                       ${paraCliente ? '#pdf-export-root { user-select: none; -webkit-user-select: none; }' : ''}
                       .pdf-marca-dagua {
                           position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
                           font-size: 42px; color: rgba(44, 62, 80, 0.07); font-weight: 900; pointer-events: none; z-index: 0; white-space: nowrap;
                       }
                       .pdf-toolbar {
                           position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                           display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px;
                           z-index: 1000; background: rgba(44, 62, 80, 0.96); padding: 12px 18px; border-radius: 8px;
                           box-shadow: 0 4px 14px rgba(0,0,0,0.35); max-width: 92%;
                       }
                       .pdf-toolbar-msg { color: #ecf0f1; font-size: 11px; max-width: 320px; line-height: 1.35; }
                       .btn-pdf-imprimir {
                           background-color: #2980b9; color: #fff; border: none; padding: 10px 16px;
                           font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer;
                       }
                       .btn-pdf-imprimir:hover { background-color: #3498db; }
                       .btn-pdf-protegido {
                           background-color: #27ae60; color: #fff; border: none; padding: 10px 16px;
                           font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer;
                       }
                       .btn-pdf-protegido:hover { background-color: #2ecc71; }
                       @media print {
                           body { background: #ffffff !important; }
                           #pdf-export-root { width: auto; max-width: none; margin: 0; }
                           .pdf-toolbar, .no-export-pdf { display: none !important; }
                       }
                   </style>
               </head>
               <body ${paraCliente ? 'oncontextmenu="return false;"' : ''} style="${opts.semToolbar ? 'padding: 12px;' : 'padding-bottom: 90px;'}">
                   ${paraCliente ? '<div class="pdf-marca-dagua">CÓPIA PARA CLIENTE — SOMENTE LEITURA</div>' : ''}
                   <div id="pdf-export-root" style="position: relative; z-index: 1;">
                   <div class="header">
                       <div class="logo-container">${logoHeader}</div>
                       <div class="empresa-info">
                           <div class="empresa-nome">${window.empresaGlobal.nome}</div>
                           <div class="empresa-detalhes">${window.empresaGlobal.endereco}</div>
                           <div class="empresa-detalhes">${contatosHeader}</div>
                       </div>
                       <div class="doc-info">
                           <div class="doc-tipo">${doc.tipo}</div>
                           <div class="doc-numero">Nº ${doc.os || 'S/N'}</div>
                           <div style="font-size: 10px; color: #7f8c8d;">Emitido em: ${doc.dataStr.split(' ')[0]}</div>
                       </div>
                   </div>

                   ${blocoDados}
                   ${htmlTabelas}
                   ${obsHTML}

                   <div class="total-destaque">TOTAL GERAL: R$ ${parseFloat(doc.total).toFixed(2)}</div>
                   ${window._htmlPagamentoNotaDoc(doc)}
                   
                   ${fotoHTML}

                   <div class="area-assinaturas">
                       <div class="ass-box" style="margin-top: 40px;">
                           <div class="ass-linha">Assinatura da Empresa / Técnico</div>
                       </div>
                       ${assinaturaHTML}
                   </div>

                   <div class="rodape">Documento gerado eletronicamente pelo sistema FH CONSTRUÇÕES CIVIS LTDA.${paraCliente ? ' — Versão para envio ao cliente (protegida contra edição).' : ''}</div>
                   </div>
                   ${opts.semToolbar ? '' : window._rodapeBotoesPdf(modo, 'Doc-' + (doc.os || doc.tipo || 'documento'))}
               </body>
               </html>
           `;
           return htmlPDF;
       };

       window.construirPDF = function(doc, modo) {
           modo = modo || 'loja';
           const paraCliente = (modo === 'cliente');
           const htmlPDF = window._montarHtmlCompletoNota(doc, modo);
           let j = window.open('', '', 'width=820,height=900');
           if (!j) return alert('O navegador bloqueou a janela do PDF. Permita pop-ups para este site.');
           j.document.write(htmlPDF);
           j.document.close();
           if (paraCliente) {
               window._vincularDownloadPdfCliente(j, 'Doc-' + (doc.os || doc.tipo || 'documento'));
           }
       };

       // --- IMPRIMIR CUPOM TÉRMICO (80mm) COM DADOS DA EMPRESA ---
    window.imprimirCupom = function(id) {
    const doc = (window.caixaGlobal || []).find(x => x.id === id);
    if(!doc) return;

    let itensHtml = '';
    let itensGarantidos = doc.itens ? (Array.isArray(doc.itens) ? doc.itens : Object.values(doc.itens)) : [];

    if(doc.tipo === 'ORDEM DE SERVIÇO') {
        let mats = itensGarantidos.filter(i => i.categoriaOS !== 'servico');
        let servs = itensGarantidos.filter(i => i.categoriaOS === 'servico');
        
        if (mats.length > 0) {
            itensHtml += `<tr><td colspan="2" class="bold" style="padding-top:10px; padding-bottom:5px;">-- MATERIAIS --</td></tr>`;
            mats.forEach(i => { itensHtml += `<tr><td style="padding-bottom:2px; padding-right: 5px;">${i.nome}</td><td style="text-align:right;">R$ ${i.valor.toFixed(2)}</td></tr>`; });
        }

        if (servs.length > 0) {
            itensHtml += `<tr><td colspan="2" class="bold" style="padding-top:10px; padding-bottom:5px;">-- MAO DE OBRA --</td></tr>`;
            servs.forEach(i => { itensHtml += `<tr><td style="padding-bottom:2px; padding-right: 5px;">${i.nome}</td><td style="text-align:right;">R$ ${i.valor.toFixed(2)}</td></tr>`; });
        }

        if(doc.kmCusto > 0) {
            itensHtml += `<tr><td colspan="2" class="bold" style="padding-top:10px; padding-bottom:5px;">-- DESLOCAMENTO --</td></tr>`;
            itensHtml += `<tr><td style="padding-bottom:2px; padding-right: 5px;">${doc.kmTotal} km rodados</td><td style="text-align:right;">R$ ${doc.kmCusto.toFixed(2)}</td></tr>`;
        }

    } else { 
        if(itensGarantidos) itensGarantidos.forEach(i => { itensHtml += `<tr><td style="padding-bottom:5px; padding-right: 5px;">${i.nome}</td><td style="text-align:right;">R$ ${i.valor.toFixed(2)}</td></tr>`; });
    }
    
    if(doc.observacao) {
        itensHtml += `<tr><td colspan="2" style="padding-top:10px; padding-bottom:5px; font-size:11px; border-top:1px dashed #000;"><b>OBS:</b> ${doc.observacao}</td></tr>`;
    }

    // --- LÓGICA DE EXIBIÇÃO DO TROCO NO CUPOM ---
    let htmlTroco = '';
    if (doc.valorRecebido && doc.troco > 0) {
        htmlTroco = `
            <div style="text-align:right; font-size:12px; margin-top: 5px;">Valor Recebido: R$ ${doc.valorRecebido.toFixed(2)}</div>
            <div style="text-align:right; font-size:12px; color: #333; font-weight: bold;">Troco: R$ ${doc.troco.toFixed(2)}</div>
        `;
    }

    let logoCupom = window.empresaGlobal.logo ? `<div class="center"><img src="${window.empresaGlobal.logo}" style="max-height: 60px; margin-bottom: 5px;"></div>` : '';
    let contatoCupom = [];
    if(window.empresaGlobal.cnpj) contatoCupom.push(`CNPJ: ${window.empresaGlobal.cnpj}`);
    if(window.empresaGlobal.telefone) contatoCupom.push(`Tel: ${window.empresaGlobal.telefone}`);
    let cTxt = contatoCupom.length > 0 ? `<div class="center" style="font-size: 10px;">${contatoCupom.join(' | ')}</div>` : '';
    let endCupom = window.empresaGlobal.endereco ? `<div class="center" style="font-size: 10px;">${window.empresaGlobal.endereco}</div>` : '';

    let htmlCupom = `
        <html>
        <head>
            <title></title>
            <style>
                @page { margin: 0; } 
                body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0 auto; padding: 15px; color: #000; font-size: 12px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; font-size: 12px; border-collapse: collapse; }
                td { vertical-align: top; }
                @media print { .btn-imprimir-flutuante { display: none !important; } }
                .btn-imprimir-flutuante { position: fixed; bottom: 20px; right: 20px; background-color: #27ae60; color: white; border: none; padding: 10px 15px; font-size: 13px; font-weight: bold; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 1000; }
                .btn-imprimir-flutuante:hover { background-color: #2ecc71; }
            </style>
        </head>
        <body>
            ${logoCupom}
            <div class="center bold" style="font-size: 14px; text-transform: uppercase;">${window.empresaGlobal.nome}</div>
            ${cTxt}
            ${endCupom}
            <div class="line"></div>
            <div class="center">RECIBO / CUPOM NÃO FISCAL</div>
            <div class="line"></div>
            <div>Doc Nº: <span class="bold">${doc.os || 'S/N'}</span> (${doc.tipo})</div>
            <div>Data: ${doc.dataStr}</div>
            <div>Cliente: ${doc.clienteNome}</div>
            <div>Atendente: ${doc.vendedor || doc.funcionario || 'Sistema'}</div>
            <div class="line"></div>
            <table>${itensHtml}</table>
            <div class="line"></div>
            <div style="text-align:right; font-size:14px;" class="bold">TOTAL: R$ ${parseFloat(doc.total).toFixed(2)}</div>
            ${window._htmlPagamentoNotaDoc(doc).replace(/font-size:15px/g, 'font-size:13px').replace(/font-size:10px/g, 'font-size:9px')}
            ${htmlTroco}
            <div class="line"></div>
            <div class="center" style="font-size:11px;">
                ${window._docQuitado(doc) ? 'PAGAMENTO: RECEBIDO' : (window._totalRecebidoDoc(doc) > 0 ? 'PAGAMENTO: PARCIAL' : 'PAGAMENTO: PENDENTE')}<br>
                ${doc.assinaturaBase64 ? 'Documento com Assinatura Digital Verificada.' : ''}
            </div>
            <div class="center" style="font-size:10px; margin-top: 15px; margin-bottom: 50px;">Obrigado pela preferência!</div>
            <button class="btn-imprimir-flutuante" onclick="window.print()">🖨️ Imprimir Cupom</button>
        </body>
        </html>
    `;
    let janela = window.open('', '', 'width=400,height=600');
    janela.document.write(htmlCupom);
    janela.document.close();
};

       // --- ENVIAR WHATSAPP / COPIAR LINK ---
       window.copiarLinkAssinatura = function(id) {
           const link = window.location.origin + window.location.pathname + "?assinar=" + id;
           navigator.clipboard.writeText(link).then(() => alert("Link copiado! Você já pode colar no WhatsApp.")).catch(() => alert("Erro ao copiar. O Link é: " + link));
       }

       window.enviarOSWhatsApp = function(id) {
           const v = (window.caixaGlobal || []).find(x => x.id === id);
           if (!v) return alert('Documento não encontrado.');
           const c = (window.clientesGlobais || []).find(x => x.id === v.clienteId);
           let tel = ''; if (c && c.telefone) { tel = c.telefone.replace(/\D/g, ''); if (tel.length === 11 || tel.length === 10) { tel = '55' + tel; } }
           let venc = v.vencimento ? v.vencimento.split('-').reverse().join('/') : 'À vista';

           let msg = `Olá *${v.clienteNome}*, tudo bem?\n\n`;
           let titulo = v.tipo === 'ORDEM DE SERVIÇO' ? 'sua ordem de serviço' : 'sua nota/orçamento';
           msg += `Aqui está ${titulo} *Nº ${v.os || 'S/N'}* com vencimento para o dia *${venc}*.\n\n`;
           
           if (v.tipo === 'ORDEM DE SERVIÇO') {
               msg += `*Equipe Executora:* ${v.equipe || 'Não informada'}\n`;
               if(v.kmTotal > 0) msg += `*Deslocamento:* ${v.kmTotal} km (R$ ${parseFloat(v.kmCusto).toFixed(2)})\n`;
               msg += `\n`;
           }

           msg += `*Resumo dos Itens/Serviços:*\n`;
           
           let itensGarantidos = v.itens ? (Array.isArray(v.itens) ? v.itens : Object.values(v.itens)) : [];
           if(itensGarantidos) itensGarantidos.forEach(i => { msg += `- ${i.nome}: R$ ${i.valor.toFixed(2)}\n`; });
           
           msg += `\n*Valor Total: R$ ${parseFloat(v.total).toFixed(2)}*\n`;
           const recebidoWa = window._totalRecebidoDoc(v);
           const saldoWa = window._saldoDevedorDoc(v);
           if (recebidoWa > 0) {
               msg += `*Recebido:* R$ ${recebidoWa.toFixed(2)}\n`;
               if (saldoWa > 0.009) msg += `*Saldo devedor:* R$ ${saldoWa.toFixed(2)}\n`;
           }
           msg += `\n`;
           
           if(v.observacao) {
               msg += `*Observações:* ${v.observacao}\n\n`;
           }

           if (!v.assinaturaBase64 && (v.tipo === 'VENDA' || v.tipo === 'ORDEM DE SERVIÇO')) {
               const link = window.location.origin + window.location.pathname + "?assinar=" + v.id;
               msg += `⚠️ Solicitamos por gentileza que confirme a ciência deste documento acessando o link seguro abaixo e realizando sua assinatura digital:\n\n${link}\n\n`;
           } else if (v.assinaturaBase64) { 
               msg += `✅ Documento confirmado com assinatura digital do cliente.\n\n`; 
           }

           msg += `Agradecemos a preferência! *${window.empresaGlobal.nome}*`;
           window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(msg)}`, '_blank');
       }
