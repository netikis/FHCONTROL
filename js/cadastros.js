/**
 * FH CONTROL — Tabelas de Clientes e Estoque + etiquetas (Fase 11)
 * Tabelas (Fase 11) + gravacao salvar/editar/excluir (Fase 15).
 * Baixa de estoque na venda permanece no index.
 */
window.paginaAtualCli = 1;
window.itensPorPaginaCli = 15;
window.termoBuscaCli = '';
window.paginaAtualProd = 1;
window.itensPorPaginaProd = 35;
window.termoBuscaProd = '';
if (!Array.isArray(window.clientesGlobais)) window.clientesGlobais = [];
if (!Array.isArray(window.produtosGlobais)) window.produtosGlobais = [];
   window.estoqueOrdem = window.estoqueOrdem || { campo: 'padrao', dir: 'asc' };
   window.ordenarEstoquePor = function(campo) {
       const atual = window.estoqueOrdem || { campo: 'padrao', dir: 'asc' };
       const mesma = atual.campo === campo;
       window.estoqueOrdem = { campo, dir: mesma ? (atual.dir === 'asc' ? 'desc' : 'asc') : 'asc' };
       window.paginaAtualProd = 1;
       if (typeof window.renderizarTabelaEstoque === 'function') window.renderizarTabelaEstoque();
   };

       window.filtrarClientes = function() { window.termoBuscaCli = document.getElementById('buscaCliente').value.toLowerCase(); window.paginaAtualCli = 1; window.renderizarTabelaClientes(); }
       window.mudarPaginaCli = function(direcao) { const f = window.clientesGlobais.filter(c => c.nome.toLowerCase().includes(window.termoBuscaCli)); const max = Math.ceil(f.length / window.itensPorPaginaCli); if (window.paginaAtualCli + direcao >= 1 && window.paginaAtualCli + direcao <= max) { window.paginaAtualCli += direcao; window.renderizarTabelaClientes(); } }

       window.renderizarTabelaClientes = function() {
           const tab = document.getElementById('tabelaClientes'); tab.innerHTML = ''; 
           let f = window.clientesGlobais.filter(c => c.nome.toLowerCase().includes(window.termoBuscaCli));
           const pag = f.slice((window.paginaAtualCli - 1) * window.itensPorPaginaCli, ((window.paginaAtualCli - 1) * window.itensPorPaginaCli) + window.itensPorPaginaCli);
           document.getElementById('infoPaginaCli').innerText = `Pág ${window.paginaAtualCli} de ${Math.max(1, Math.ceil(f.length / window.itensPorPaginaCli))}`;
           pag.forEach(c => {
               const tr = document.createElement('tr'); const doc = c.cpf ? c.cpf : (c.cnpj || '-');
               tr.innerHTML = `<td style="font-weight: bold;">${c.nome}</td><td style="font-weight: bold;">${doc}</td><td style="font-weight: bold;">${c.telefone || '-'}</td><td style="font-weight: bold;">${c.cidade || '-'}</td>
                   <td class="celula-acoes">
                       <div class="acoes-flex">
                       <button class="btn-acao" onclick="verCliente('${c.id}')" title="Ver Cliente">🔍 Ver</button>
                       <button class="btn-acao edit" onclick="editarCli('${c.id}')" title="Editar Cliente">✏️ Ed</button>
                       <button class="btn-acao del" onclick="excluirCli('${c.id}')" title="Excluir Cliente">🗑️</button>
                       </div>
                   </td>`;
               tab.appendChild(tr);
           });
       }

       window.verCliente = function(id) { const c = window.clientesGlobais.find(x => x.id === id); if(!c) return; const html = `<div class="detalhes-linha"><strong>Nome:</strong> ${c.nome}</div><div class="detalhes-linha"><strong>Documento:</strong> ${c.cpf ? c.cpf : (c.cnpj || '-')}</div><div class="detalhes-linha"><strong>Telefone:</strong> ${c.telefone}</div><div class="detalhes-linha"><strong>Endereço:</strong> ${c.rua || '-'}, Nº ${c.numero || '-'} - ${c.bairro || '-'} - ${c.cidade || '-'}/${c.estado || '-'}</div>`; document.getElementById('detalhesCliente').innerHTML = html; document.getElementById('modalVisualizar').style.display = 'flex'; }
       window.fecharModal = function() { document.getElementById('modalVisualizar').style.display = 'none'; }
       window.onclick = function(e) { if (e.target === document.getElementById('modalVisualizar')) window.fecharModal(); }

       window.filtrarProdutos = function() { window.termoBuscaProd = document.getElementById('buscaProduto').value.toLowerCase(); window.paginaAtualProd = 1; window.renderizarTabelaEstoque(); }
       window.mudarPaginaProd = function(direcao) { const f = window.produtosGlobais.filter(p => p.nome.toLowerCase().includes(window.termoBuscaProd) || (p.categoria && p.categoria.toLowerCase().includes(window.termoBuscaProd)) || (p.codigo && p.codigo.toLowerCase().includes(window.termoBuscaProd))); const max = Math.ceil(f.length / window.itensPorPaginaProd); if (window.paginaAtualProd + direcao >= 1 && window.paginaAtualProd + direcao <= max) { window.paginaAtualProd += direcao; window.renderizarTabelaEstoque(); } }

       window.renderizarTabelaEstoque = function() {
           const tab = document.getElementById('tabelaEstoque'); tab.innerHTML = '';
           
           let f = window.produtosGlobais.filter(p => p.nome.toLowerCase().includes(window.termoBuscaProd) || (p.categoria && p.categoria.toLowerCase().includes(window.termoBuscaProd)) || (p.codigo && p.codigo.toLowerCase().includes(window.termoBuscaProd)));
           
           const ord = window.estoqueOrdem || { campo: 'padrao', dir: 'asc' };
           const mult = ord.dir === 'desc' ? -1 : 1;
           const nomeCmp = (a, b) => String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', { sensitivity: 'base' });
           f.sort((a, b) => {
               const qtdA = Number(a?.quantidade) || 0;
               const qtdB = Number(b?.quantidade) || 0;
               if (ord.campo === 'quantidade') {
                   if (qtdA !== qtdB) return (qtdA - qtdB) * mult; // 0,1,2...
                   return nomeCmp(a, b);
               }
               if (ord.campo === 'nome') {
                   return nomeCmp(a, b) * mult; // A→Z / Z→A
               }
               // padrão: alerta (≤3) primeiro, depois nome
               const alertaA = qtdA <= 3;
               const alertaB = qtdB <= 3;
               if (alertaA && !alertaB) return -1;
               if (!alertaA && alertaB) return 1;
               return nomeCmp(a, b);
           });

           const pag = f.slice((window.paginaAtualProd - 1) * window.itensPorPaginaProd, ((window.paginaAtualProd - 1) * window.itensPorPaginaProd) + window.itensPorPaginaProd);
           
           document.getElementById('infoPaginaProd').innerText = `Pág ${window.paginaAtualProd} de ${Math.max(1, Math.ceil(f.length / window.itensPorPaginaProd))}`;
           
           pag.forEach(p => {
               let img = p.foto ? `<img src="${p.foto}" style="width:30px;height:30px;border-radius:4px;object-fit:cover;">` : '-';
               let alert = ((p.quantidade || 0) <= 3) ? 'linha-alerta' : '';
               const tr = document.createElement('tr'); tr.className = alert;
               
               let ncmTxt = p.ncm || '-'; 
               
               tr.innerHTML = `
                <td style="text-align: center; padding: 5px;"><input type="checkbox" class="check-etiqueta" data-nome="${p.nome}" data-codigo="${p.codigo || ''}" data-venda="${p.venda}"></td>
                <td style="font-weight:bold; color:#f1c40f; font-size:11px; overflow:hidden; text-overflow:ellipsis; padding: 5px;">${p.codigo || '-'}</td>
                <td style="font-weight:bold; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding: 5px;" title="${p.nome}">${p.nome}</td>
                <td style="padding: 5px;" title="${p.categoria || 'Geral'}"><span style="background-color:#f1c40f;color:#2c3e50;padding:2px 4px;border-radius:4px;font-size:10px; display:inline-block; max-width:75px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; vertical-align:middle;">${p.categoria || 'Geral'}</span></td>
                <td style="font-weight:bold; font-size:14px; text-align:center; padding: 5px;">${window.formatQtdComUnidade(p.quantidade, p.unidadeMedida)}</td>
                <td style="font-weight:bold; padding: 5px;">R$ ${(parseFloat(String(p.custo).replace(',', '.')) || 0).toFixed(2)}</td>
                <td style="color:#2ecc71; font-weight:bold; padding: 5px;">R$ ${(parseFloat(String(p.venda).replace(',', '.')) || 0).toFixed(2)}</td>
                <td style="font-weight:bold; padding: 5px;">${ncmTxt}</td>
                <td class="celula-acoes" style="text-align: center; padding: 5px;">
                    <div class="acoes-flex" style="justify-content: center;">
                    <button class="btn-acao edit" onclick="editarProd('${p.id}')" title="Editar Produto">✏️</button>
                    <button class="btn-acao del" onclick="excluirProd('${p.id}')" title="Excluir Produto">🗑️</button>
                    </div>
                </td>
                <td style="text-align: center; padding: 5px;">${img}</td>`;
               tab.appendChild(tr);
           });
       }

// =========================================================
// FUNÇÕES DE ETIQUETA
// =========================================================
   window.toggleTodasEtiquetas = function(source) {
    const checkboxes = document.querySelectorAll('.check-etiqueta');
    checkboxes.forEach(chk => chk.checked = source.checked);
};

// =========================================================
// FUNÇÕES DE ETIQUETA
// =========================================================
window.toggleTodasEtiquetas = function(source) {
    const checkboxes = document.querySelectorAll('.check-etiqueta');
    checkboxes.forEach(chk => chk.checked = source.checked);
};

window.imprimirEtiquetasEstoque = function() {
    const checkboxes = document.querySelectorAll('.check-etiqueta:checked');
    if (checkboxes.length === 0) {
        alert("⚠️ Selecione pelo menos um produto marcando a caixinha na tabela para imprimir.");
        return;
    }

    let qtdCopias = prompt("Quantas cópias de CADA ETIQUETA você deseja imprimir?", "1");
    if (!qtdCopias || isNaN(qtdCopias) || qtdCopias <= 0) return;

    let htmlEtiquetas = `
        <html>
        <head>
            <title>Impressão Elgin L42 Pro - Alinhamento Perfeito</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <style>
                /* ZERANDO QUALQUER ESPAÇO EXTRA */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                
                @page {
                    size: 104mm 30mm;
                    margin: 0mm !important; 
                }
                
                body { 
                    font-family: Arial, sans-serif; 
                    background: #fff; 
                    width: 104mm;
                    height: 30mm;
                    margin: 0;
                    padding: 0;
                    color: #000;
                    overflow: hidden; 
                }
                
                .linha-etiquetas {
                    display: flex;
                    flex-direction: row;
                    width: 104mm;
                    height: 30mm;
                    page-break-inside: avoid;
                    page-break-after: always; 
                    justify-content: space-between; 
                    align-items: center;
                }
                
                .etiqueta {
                    width: 50mm; 
                    height: 30mm;
                    padding: 1.5mm; 
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    overflow: hidden;
                }
                
                /* MÁGICA AQUI: Fonte menor (7pt), máximo 2 linhas e corta com '...' se for muito grande */
                .etq-nome { 
                    font-size: 7pt; 
                    font-weight: bold; 
                    line-height: 1.1; 
                    margin-bottom: 2px; 
                    text-align: center; 
                    width: 100%; 
                    display: -webkit-box; 
                    -webkit-line-clamp: 2; 
                    -webkit-box-orient: vertical; 
                    overflow: hidden; 
                    text-overflow: ellipsis;
                }
                
                .etq-preco { font-size: 12pt; font-weight: 900; margin-bottom: 2px; text-align: center;}
                
                /* CÓDIGO DE BARRAS GIGANTE E CENTRALIZADO */
                .etq-barcode-container { width: 100%; text-align: center; }
                .etq-barcode-container svg { max-width: 48mm; height: 42px !important; } 
                
                @media print {
                    .btn-imprimir { display: none !important; }
                }
                
                .btn-imprimir {
                    position: fixed; bottom: 20px; right: 20px;
                    background: #27ae60; color: white; border: none;
                    padding: 15px 20px; font-size: 16px; font-weight: bold;
                    border-radius: 8px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    z-index: 1000;
                }
            </style>
        </head>
        <body>
            <button class="btn-imprimir" onclick="window.print()">🖨️ IMPRIMIR NA ELGIN</button>
    `;

    let arrayEtiquetas = [];
    checkboxes.forEach(chk => {
        let nome = chk.getAttribute('data-nome') || '';
        
        // MÁGICA 2: Corta o nome na força bruta se tiver mais de 45 caracteres!
        if (nome.length > 45) {
            nome = nome.substring(0, 45) + "...";
        }
        
        let cod = chk.getAttribute('data-codigo') || '00000000';
        let preco = chk.getAttribute('data-venda');
        let precoNum = window.parseMoedaBr(preco);
        let precoFmt = precoNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        for (let i = 0; i < qtdCopias; i++) {
            arrayEtiquetas.push(`
                <div class="etiqueta">
                    <div class="etq-nome">${nome}</div>
                    <div class="etq-preco">R$ ${precoFmt}</div>
                    <div class="etq-barcode-container">
                        <svg class="barcode"
                            jsbarcode-value="${cod}"
                            jsbarcode-displayvalue="true"
                            jsbarcode-width="2"
                            jsbarcode-height="42"
                            jsbarcode-fontSize="11"
                            jsbarcode-textmargin="0"
                            jsbarcode-margin="0">
                        </svg>
                    </div>
                </div>
            `);
        }
    });

    for (let i = 0; i < arrayEtiquetas.length; i += 2) {
        let etq1 = arrayEtiquetas[i];
        let etq2 = arrayEtiquetas[i + 1] ? arrayEtiquetas[i + 1] : '<div class="etiqueta" style="border:none; visibility: hidden;"></div>';

        htmlEtiquetas += `
            <div class="linha-etiquetas">
                ${etq1}
                ${etq2}
            </div>
        `;
    }

    htmlEtiquetas += `
            <script>
                window.onload = function() {
                    if (typeof JsBarcode !== 'undefined') {
                        JsBarcode(".barcode").init();
                    } else {
                        setTimeout(() => { if (typeof JsBarcode !== 'undefined') JsBarcode(".barcode").init(); }, 500);
                    }
                };
            <\/script>
        </body>
        </html>
    `;

    let janela = window.open('', '', 'width=800,height=600');
    janela.document.write(htmlEtiquetas);
    janela.document.close();
};

/**
 * Gravação de cadastro (Fase 15) — salvar/editar/excluir cliente e produto.
 * Baixa de estoque na VENDA/OS permanece no index.html.
 */
window.editandoCliId = window.editandoCliId || null;
window.editandoProdId = window.editandoProdId || null;
window.fotoBase64Atual = window.fotoBase64Atual || "";

window.calcularVenda = function() {
    let c = parseFloat(document.getElementById('prodCusto').value) || 0;
    let m = parseFloat(document.getElementById('prodMargem').value) || 0;
    if (c > 0) { document.getElementById('prodVenda').value = (c + (c * (m / 100))).toFixed(2); }
};
window.calcularMargem = function() {
    let c = parseFloat(document.getElementById('prodCusto').value) || 0;
    let v = parseFloat(document.getElementById('prodVenda').value) || 0;
    if (c > 0 && v > 0) {
        let m = ((v - c) / c) * 100;
        document.getElementById('prodMargem').value = m.toFixed(2);
    }
};

(function bindFormulariosCadastro() {
    const formCli = document.getElementById('formCliente');
    if (formCli) formCli.addEventListener('submit', function(e) {
        e.preventDefault();
        const d = { nome: document.getElementById('nome').value, cpf: document.getElementById('cpf').value, cnpj: document.getElementById('cnpj').value, telefone: document.getElementById('telefone').value, pix: document.getElementById('pix').value, ie: document.getElementById('ie').value, cep: document.getElementById('cep').value, estado: document.getElementById('estado').value, cidade: document.getElementById('cidade').value, bairro: document.getElementById('bairro').value, rua: document.getElementById('rua').value, numero: document.getElementById('numero').value };
        if (window.editandoCliId) { window.meuUpdate(window.meuRef(window.meuBanco, 'clientes/' + window.editandoCliId), d).then(() => window.cancelarEdicaoCli()); }
        else { window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'clientes')), d).then(() => document.getElementById('formCliente').reset()); }
    });
    const pm = document.getElementById('prodMargem');
    const pc = document.getElementById('prodCusto');
    const pv = document.getElementById('prodVenda');
    if (pm) pm.addEventListener('input', window.calcularVenda);
    if (pc) pc.addEventListener('input', window.calcularVenda);
    if (pv) pv.addEventListener('input', window.calcularMargem);
    const foto = document.getElementById('prodFoto');
    if (foto) foto.addEventListener('change', function(e) {
        const f = e.target.files;
        if (f && f.length > 0) {
            const r = new FileReader();
            r.onload = function(ev) { window.fotoBase64Atual = ev.target.result; };
            r.readAsDataURL(f);
        }
    });
    const formProd = document.getElementById('formProduto');
    if (formProd) formProd.addEventListener('submit', function(e) {
        e.preventDefault();
        const qEstoque = window.parseQtdEstoque(document.getElementById('prodQtd').value);
        if (isNaN(qEstoque)) return alert("Quantidade em estoque inválida. Use número inteiro ou decimal (ex.: 50 ou 3,5).");
        const d = {
            nome: document.getElementById('prodNome').value,
            codigo: document.getElementById('prodCodigo').value,
            ncm: document.getElementById('prodNcm').value,
            categoria: document.getElementById('prodCategoria').value,
            custo: window.parseMoedaBr(document.getElementById('prodCusto').value),
            margem: window.parseMoedaBr(document.getElementById('prodMargem').value),
            venda: window.parseMoedaBr(document.getElementById('prodVenda').value),
            quantidade: qEstoque,
            unidadeMedida: window.normalizarUnidadeMedida(document.getElementById('prodUnidadeMedida') && document.getElementById('prodUnidadeMedida').value),
            foto: window.fotoBase64Atual
        };
        if (window.editandoProdId) {
            window.meuUpdate(window.meuRef(window.meuBanco, 'produtos/' + window.editandoProdId), d).then(() => window.cancelarEdicaoProd());
        } else {
            window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'produtos')), d).then(() => {
                document.getElementById('formProduto').reset();
                window.fotoBase64Atual = "";
                document.getElementById('prodVenda').value = "";
                const pu = document.getElementById('prodUnidadeMedida'); if (pu) pu.value = 'un';
            });
        }
    });
})();

window.editarCli = function(id) {
    const c = (window.clientesGlobais || []).find(function(x) { return x.id === id; });
    if (!c) return;
    ['nome','cpf','cnpj','telefone','pix','ie','cep','estado','cidade','bairro','rua','numero'].forEach(function(k) { document.getElementById(k).value = c[k] || ''; });
    window.editandoCliId = id;
    document.getElementById('tituloCliente').innerText = "Editando Cliente";
    document.getElementById('btnSalvarCli').innerText = "Salvar Atualização";
    document.getElementById('btnCancelarCli').style.display = "inline-block";
    window.scrollTo(0,0);
};
window.cancelarEdicaoCli = function() {
    window.editandoCliId = null;
    document.getElementById('formCliente').reset();
    document.getElementById('tituloCliente').innerText = "Cadastro de Cliente";
    document.getElementById('btnSalvarCli').innerText = "Salvar Cliente";
    document.getElementById('btnCancelarCli').style.display = "none";
};
window.excluirCli = function(id) {
    if (confirm("Deseja excluir este cliente?")) window.meuRemove(window.meuRef(window.meuBanco, 'clientes/' + id));
};

window.editarProd = function(id) {
    const p = (window.produtosGlobais || []).find(function(x) { return x.id === id; });
    if (!p) return;
    ['nome','codigo','ncm','categoria','custo','margem','venda','qtd'].forEach(function(k) {
        let campo = document.getElementById('prod' + k.charAt(0).toUpperCase() + k.slice(1));
        if (campo) {
            if (k === 'qtd') campo.value = window.formatQtdEstoque(p.quantidade ?? 0);
            else if (k === 'codigo') campo.value = p.codigo || '';
            else if (k === 'ncm') campo.value = p.ncm || '';
            else if (k === 'custo' || k === 'venda' || k === 'margem') {
                let valStr = String(p[k] || '0');
                if (valStr.includes(',') && valStr.includes('.')) {
                    campo.value = parseFloat(valStr.replace(/\./g, '').replace(',', '.')) || 0;
                } else if (valStr.includes(',')) {
                    campo.value = parseFloat(valStr.replace(',', '.')) || 0;
                } else {
                    campo.value = parseFloat(valStr) || 0;
                }
            }
            else campo.value = p[k] || '';
        }
    });
    const selUm = document.getElementById('prodUnidadeMedida');
    if (selUm) selUm.value = window.normalizarUnidadeMedida(p.unidadeMedida);
    let c = parseFloat(document.getElementById('prodCusto').value) || 0;
    let v = parseFloat(document.getElementById('prodVenda').value) || 0;
    let m = parseFloat(document.getElementById('prodMargem').value) || 0;
    if (c > 0 && v > 0 && m === 0) {
        document.getElementById('prodMargem').value = (((v - c) / c) * 100).toFixed(2);
    }
    window.fotoBase64Atual = p.foto || "";
    window.editandoProdId = id;
    document.getElementById('tituloProduto').innerText = "Editando Produto";
    document.getElementById('btnSalvarProd').innerText = "Atualizar Produto";
    document.getElementById('btnCancelarProd').style.display = "inline-block";
    window.scrollTo(0,0);
};
window.editarProduto = window.editarProd;
window.cancelarEdicaoProd = function() {
    window.editandoProdId = null;
    document.getElementById('formProduto').reset();
    window.fotoBase64Atual = "";
    document.getElementById('prodVenda').value = "";
    const pu = document.getElementById('prodUnidadeMedida'); if (pu) pu.value = 'un';
    document.getElementById('tituloProduto').innerText = "Cadastro de Produto";
    document.getElementById('btnSalvarProd').innerText = "Salvar Produto";
    document.getElementById('btnCancelarProd').style.display = "none";
};
window.excluirProd = function(id) {
    if (confirm("Excluir produto do estoque?")) window.meuRemove(window.meuRef(window.meuBanco, 'produtos/' + id));
};
