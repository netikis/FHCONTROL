/**
 * FH CONTROL — Registro Geral: busca, pastas, gráficos e reimpressão (Fase 12)
 * Extraído do index sem alterar gravação no Firebase.
 */
// MÓDULO 7: REGISTRO TOTAL (BUSCA, PASTAS, GRÁFICOS E REIMPRESSÃO)
       
       window.meuGraficoRegistro = null;
       const conversorMeses = {
           "01": "Janeiro", "02": "Fevereiro", "03": "Março", "04": "Abril", "05": "Maio", "06": "Junho",
           "07": "Julho", "08": "Agosto", "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro"
       };

       window.mudarSubAbaRegistro = function(aba) {
           document.getElementById('subRegistroBusca').style.display = aba === 'busca' ? 'block' : 'none';
           document.getElementById('subRegistroPastas').style.display = aba === 'pastas' ? 'block' : 'none';
           document.getElementById('subRegistroGraficos').style.display = aba === 'graficos' ? 'block' : 'none';

           // Marca o botão correspondente no submenu lateral
           var mapaBtn = { busca: 'subBtnRegBusca', pastas: 'subBtnRegPastas', graficos: 'subBtnRegGraficos' };
           document.querySelectorAll('#submenuRegistro .submenu-btn').forEach(function(b){ b.classList.remove('active'); });
           var btnSel = document.getElementById(mapaBtn[aba]);
           if (btnSel) btnSel.classList.add('active');
       };

       // Abre a aba de Registro Geral e vai direto para a sub-seção escolhida no menu lateral
       window.abrirRegistroSub = function(aba, botao) {
           window.abrirAba('tabRegistro', document.getElementById('btnTabRegistro'));
           if (window.iniciarRegistroTotal) window.iniciarRegistroTotal();
           window.mudarSubAbaRegistro(aba);
           if (botao) botao.classList.add('active');
       };

       window.iniciarRegistroTotal = function() {
           window.buscarNoRegistro(); 
           window.gerarArvoreDePastas(); 
           window.preencherFiltrosGrafico(); 
       };

     // 1. LÓGICA DE BUSCA E REIMPRESSÃO
      window.buscarNoRegistro = function() {
    const termoRaw = document.getElementById('inputBuscaRegistro').value.trim();
    const termo = window._pendNormBusca ? window._pendNormBusca(termoRaw) : termoRaw.toLowerCase();
    const tabela = document.getElementById('tabelaBuscaRegistro');
    tabela.innerHTML = '';
    
    let baseDados = window._listaCaixaSincronizada ? window._listaCaixaSincronizada() : (window.caixaGlobal || []);

    if(baseDados.length === 0) {
        tabela.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #f1c40f;">Nenhum histórico no sistema ainda.</td></tr>';
        return;
    }

    if(termo.length === 1) { 
        tabela.innerHTML = '<tr><td colspan="7" style="text-align: center;">Continue digitando para buscar no histórico completo...</td></tr>';
        return;
    }

    let resultados = [];

    if (termo === '') {
        // MODO 1: SEM BUSCA (Mostrar apenas o Mês Atual)
        let dataHoje = new Date();
        let mesAtual = String(dataHoje.getMonth() + 1).padStart(2, '0');
        let anoAtual = dataHoje.getFullYear();
        let filtroDataStr = `/${mesAtual}/${anoAtual}`; // Exemplo: /04/2026
        
        resultados = baseDados.filter(v => {
            return v.dataStr && v.dataStr.includes(filtroDataStr);
        });
        
        if (resultados.length === 0) {
            tabela.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #bdc3c7;">Nenhum documento gerado em ${mesAtual}/${anoAtual}. Digite acima para buscar arquivos de meses anteriores.</td></tr>`;
            return;
        }
    } else {
        // MODO 2: COM BUSCA (Ignora o mês e busca no sistema TODO desde o início)
        resultados = baseDados.filter(v => window._pendenteMatchBusca(v, termo));
        
        if (resultados.length === 0) {
            tabela.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #e74c3c;">Nenhum registro encontrado em todo o sistema.</td></tr>';
            return;
        }
    }

    // Desenha a tabela com os resultados (limitado a 50 para não travar a tela na busca geral)
    resultados.slice(0, 50).forEach(v => {
        let cor = v.tipo === 'DESPESA' ? '#e74c3c' : '#2ecc71';
        let formaPgtoRegistro = v.formaPagamento ? v.formaPagamento.replace('Cartão de ', '').toUpperCase() : '';
        const st = v.statusPagamento || 'PAGO';
        let onde = '';
        if (st === 'PAGO' && (v.tipo === 'VENDA' || v.tipo === 'ORDEM DE SERVIÇO' || v.tipo === 'VD')) {
            onde = window.formaPagamentoEhDigital(v.formaPagamento) ? ' · 📍 Banco' : ' · 📍 Balcão';
        } else if (st === 'PENDENTE') {
            onde = ' · 📍 Pendentes';
        }
        let statusTxt = v.tipo === 'FECHAMENTO'
            ? 'FECHADO'
            : st + (formaPgtoRegistro ? ` (${formaPgtoRegistro})` : '') + onde;
        let acoesHtml = '';
        if (v.tipo === 'VENDA' || v.tipo === 'ORDEM DE SERVIÇO' || v.tipo === 'VD') {
            acoesHtml = `<button onclick="window.reimprimirDocumentoRegistro('${v.id}')" style="background-color: #f39c12; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold; margin-right: 4px;">🖨️ PDF</button>`;
            if (window._totalRecebidoDoc(v) > 0 || st === 'PAGO') {
                acoesHtml += `<button onclick="estornarPagamento('${v.id}')" style="background-color: #c0392b; color: #fff; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-weight: bold;">🔄 Estornar</button>`;
            }
        }

        tabela.innerHTML += `
            <tr>
                <td>${(v.dataRecebimentoStr || v.dataStr || '').split(' ')[0].replace(',', '')}</td>
                <td style="font-weight: bold;">${v.os || '-'}</td>
                <td>${v.tipo}</td>
                <td>${v.clienteNome || '-'}</td>
                <td style="color: ${cor}; font-weight: bold;">R$ ${Number(v.total).toFixed(2)}</td>
                <td>${statusTxt}</td>
                <td class="celula-acoes" style="min-width:200px;"><div class="acoes-flex">${acoesHtml}</div></td>
            </tr>
        `;
    });
};

       // CORREÇÃO 1 (Continuação): Função reescrita para puxar pelo ID e com as variáveis corretas
  
    window.reimprimirDocumentoRegistro = function(idDocumento) {
    let baseDados = window.caixaGlobal || [];
    let doc = baseDados.find(x => x.id === idDocumento);
    
    if (!doc) {
        alert("Documento não encontrado no sistema.");
        return;
    }
    
    // Chama o layout oficial de PDF que tem logo e cabeçalho
    window.construirPDF(doc);
};
       // 2. LÓGICA DE PASTAS
       window.togglePasta = function(idAlvo) {
           let el = document.getElementById(idAlvo);
           if (el) {
               el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
           }
       };

       window.gerarArvoreDePastas = function() {
           let baseDados = window.caixaGlobal || [];
           
           if(baseDados.length === 0) {
               document.getElementById('arvorePastas').innerHTML = '<div style="color:#f1c40f; padding:10px; text-align:center;">Ainda não há dados registrados para gerar as pastas.</div>';
               return;
           }

           let arvore = {};
           
           baseDados.forEach(doc => {
               if(!doc.dataStr) return;
               
               // CORREÇÃO 2: Remove a vírgula da data que estava quebrando o split
               let dataLimpa = doc.dataStr.split(' ')[0].replace(',', '');
               let partesData = dataLimpa.split('/');
               
               if(partesData.length === 3) {
                   let dia = partesData[0];
                   let mesNum = partesData[1];
                   let ano = partesData[2];
                   let mesNome = conversorMeses[mesNum] || mesNum;

                   if(!arvore[ano]) arvore[ano] = {};
                   if(!arvore[ano][mesNome]) arvore[ano][mesNome] = {};
                   if(!arvore[ano][mesNome][dia]) arvore[ano][mesNome][dia] = [];
                   
                   arvore[ano][mesNome][dia].push(doc);
               }
           });

           let html = '';
           let idContador = 0;

           Object.keys(arvore).sort().reverse().forEach(ano => {
               idContador++; let idAno = `pasta_ano_${idContador}`;
               html += `<div class="pasta-nivel-1" style="background-color: #2980b9; color: #ffffff; padding: 12px; margin-bottom: 5px; border-radius: 4px; cursor: pointer; font-weight: bold; border: 1px solid #34495e;" onclick="window.togglePasta('${idAno}')">📁 Ano: ${ano}</div>`;
               html += `<div id="${idAno}" style="display:none;">`;
               
               Object.keys(arvore[ano]).forEach(mes => {
                   idContador++; let idMes = `pasta_mes_${idContador}`;
                   html += `<div class="pasta-nivel-2" style="background-color: #34495e; padding: 10px 10px 10px 30px; margin-bottom: 3px; cursor: pointer; color: #ffffff; font-weight: bold; border-left: 3px solid #f1c40f;" onclick="window.togglePasta('${idMes}')">📂 Mês: ${mes}</div>`;
                   html += `<div id="${idMes}" style="display:none;">`;
                   
                   Object.keys(arvore[ano][mes]).sort().reverse().forEach(dia => {
                       idContador++; let idDia = `pasta_dia_${idContador}`;
                       html += `<div class="pasta-nivel-3" style="background-color: #1a252f; padding: 8px 10px 8px 50px; margin-bottom: 2px; cursor: pointer; color: #bdc3c7; border-left: 3px solid #3498db; font-weight: bold;" onclick="window.togglePasta('${idDia}')">📅 Dia ${dia}</div>`;
                       html += `<div id="${idDia}" class="pasta-conteudo" style="padding: 10px 10px 10px 70px; background-color: #111827; border-left: 3px solid #bdc3c7;">`;
                       
                       arvore[ano][mes][dia].forEach(doc => {
                           let sigla = doc.tipo.substring(0, 4);
                           let cor = doc.tipo === 'DESPESA' ? '#e74c3c' : '#2ecc71';
                           let docNome = doc.tipo === 'DESPESA' || doc.tipo === 'FECHAMENTO' ? doc.tipo : `${doc.tipo} Nº ${doc.os || 'S/N'}`;
                           html += `
                               <div class="item-registro" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #34495e; font-size: 13px; color: #ecf0f1;">
                                   <span><strong>[${sigla}]</strong> ${doc.clienteNome || ''} | ${docNome}</span>
                                   <span style="color: ${cor}; font-weight:bold;">R$ ${Number(doc.total).toFixed(2)}</span>
                               </div>
                           `;
                       });
                       html += `</div>`;
                   });
                   html += `</div>`;
               });
               html += `</div>`;
           });

           if(html === '') html = '<div style="color:#e74c3c; padding:10px;">Nenhum histórico encontrado.</div>';
           document.getElementById('arvorePastas').innerHTML = html;
       };

       // 3. LÓGICA DE GRÁFICOS
       window.preencherFiltrosGrafico = function() {
           let baseDados = window.caixaGlobal || [];
           let selectAno = document.getElementById('filtroAnoGrafico');
           let selectMes = document.getElementById('filtroMesGrafico');

           if(baseDados.length === 0) {
               selectAno.innerHTML = '<option value="">Sem dados...</option>';
               return;
           }

           let anos = new Set();
           baseDados.forEach(doc => {
               if(doc.dataStr) {
                   // Limpa a vírgula
                   let dataLimpa = doc.dataStr.split(' ')[0].replace(',', '');
                   let partesData = dataLimpa.split('/');
                   if(partesData.length === 3) {
                       anos.add(partesData[2]); 
                   }
               }
           });
           
           selectAno.innerHTML = '<option value="">Selecione o Ano</option>';
           Array.from(anos).sort().reverse().forEach(ano => {
               if(ano) selectAno.innerHTML += `<option value="${ano}">${ano}</option>`;
           });

           selectMes.innerHTML = '<option value="todos">Resumo do Ano Todo</option>';
           Object.keys(conversorMeses).forEach(num => {
               selectMes.innerHTML += `<option value="${num}">${conversorMeses[num]}</option>`;
           });

           // CORREÇÃO 3: Auto-selecionar o ano e mês atuais ao invés de JANEIRO
           let dataHoje = new Date();
           let anoAtual = dataHoje.getFullYear().toString();
           let mesAtual = String(dataHoje.getMonth() + 1).padStart(2, '0');

           if(selectAno.querySelector(`option[value="${anoAtual}"]`)) {
               selectAno.value = anoAtual;
           } else if (anos.size > 0) {
               selectAno.value = Array.from(anos).sort().reverse()[0]; 
           }
           
           selectMes.value = mesAtual; 
           
           // Renderiza o gráfico automaticamente
           window.atualizarGraficoRegistro();
       };

       window.atualizarGraficoRegistro = function() {
           const anoFiltro = document.getElementById('filtroAnoGrafico').value;
           const mesFiltro = document.getElementById('filtroMesGrafico').value;
           let baseDados = window.caixaGlobal || [];
           
           if(!anoFiltro) return; 

           let labels = [];
           let dadosEntradas = [];
           let dadosSaidas = [];

           if (mesFiltro === 'todos') {
               labels = Object.values(conversorMeses);
               dadosEntradas = new Array(12).fill(0);
               dadosSaidas = new Array(12).fill(0);

               baseDados.forEach(doc => {
                   if(!doc.dataStr) return;
                   let dataLimpa = doc.dataStr.split(' ')[0].replace(',', '');
                   let [dia, mesNum, ano] = dataLimpa.split('/');
                   
                   if (ano === anoFiltro) {
                       let indexMes = parseInt(mesNum) - 1;
                       let valor = Number(doc.total) || 0;
                       let status = doc.statusPagamento || 'PAGO';
                       
                       if (status === 'PAGO' && (doc.tipo === 'VENDA' || doc.tipo === 'ORDEM DE SERVIÇO')) dadosEntradas[indexMes] += valor;
                       if (doc.tipo === 'DESPESA') dadosSaidas[indexMes] += valor;
                   }
               });
           } else {
               let diasNoMes = new Date(anoFiltro, parseInt(mesFiltro), 0).getDate();
               for(let i = 1; i <= diasNoMes; i++) labels.push(`Dia ${i}`);
               dadosEntradas = new Array(diasNoMes).fill(0);
               dadosSaidas = new Array(diasNoMes).fill(0);

               baseDados.forEach(doc => {
                   if(!doc.dataStr) return;
                   let dataLimpa = doc.dataStr.split(' ')[0].replace(',', '');
                   let [dia, mesNum, ano] = dataLimpa.split('/');
                   
                   if (ano === anoFiltro && mesNum === mesFiltro) {
                       let indexDia = parseInt(dia) - 1;
                       let valor = Number(doc.total) || 0;
                       let status = doc.statusPagamento || 'PAGO';
                       
                       if (status === 'PAGO' && (doc.tipo === 'VENDA' || doc.tipo === 'ORDEM DE SERVIÇO')) dadosEntradas[indexDia] += valor;
                       if (doc.tipo === 'DESPESA') dadosSaidas[indexDia] += valor;
                   }
               });
           }

           if(window.meuGraficoRegistro) window.meuGraficoRegistro.destroy();

           const ctx = document.getElementById('canvasGraficoRegistro').getContext('2d');
           window.meuGraficoRegistro = new Chart(ctx, {
               type: 'bar',
               data: {
                   labels: labels,
                   datasets: [
                       { label: 'Entradas (R$)', data: dadosEntradas, backgroundColor: '#27ae60' },
                       { label: 'Saídas (R$)', data: dadosSaidas, backgroundColor: '#e74c3c' }
                   ]
               },
               options: {
                   responsive: true,
                   plugins: { legend: { position: 'top' } },
                   scales: { y: { beginAtZero: true } }
               }
           });
       };

