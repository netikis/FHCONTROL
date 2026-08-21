/**
 * FH CONTROL — Lancamentos manuais Caixa Balcao e Banco (Fase 13)
 * Extraido do index. Escuta Firebase (onValue) permanece no modulo.
 * Nao altera venda/OS/estoque.
 */
if (!Array.isArray(window.extratoBanco)) window.extratoBanco = [];
if (typeof window.saldoInicialBanco !== 'number') window.saldoInicialBanco = 0;

// FUNÇÃO NOVA: Lança direto no banco sem precisar abrir o modal
window.lancarNoBancoAutomatico = function(descricao, valor) {
    let doc = {
        tipo: 'ENTRADA',
        descricao: descricao,
        valor: parseFloat(valor) || 0,
        dataStr: new Date().toLocaleString('pt-BR'),
        timestamp: Date.now(),
        usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema Automático'
    };
    window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixaBancoExtrato')), doc);
};

window.estornarNoBancoAutomatico = function(descricao, valor) {
    let doc = {
        tipo: 'SAIDA',
        descricao: 'Estorno: ' + String(descricao || ''),
        valor: parseFloat(valor) || 0,
        dataStr: new Date().toLocaleString('pt-BR'),
        timestamp: Date.now(),
        usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema Automático'
    };
    if (window.meuSet && window.meuPush && window.meuRef && window.meuBanco) {
        window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixaBancoExtrato')), doc);
    }
};


window.definirSaldoInicialBanco = function() {
    let valorStr = prompt("Informe o Saldo Inicial do Banco (ex: 1500.00):");
    if(!valorStr) return;
    let valor = parseFloat(valorStr.replace(',', '.'));
    if(isNaN(valor)) return alert("Valor inválido. Use pontos para separar os centavos.");
    
    window.meuUpdate(window.meuRef(window.meuBanco, 'caixaBancoStatus'), { saldoInicial: valor })
        .then(() => alert("Saldo inicial do banco atualizado com sucesso!"));
};

window.abrirModalCaixaBalcao = function () {
    const desc = document.getElementById('descCaixaBalcao');
    const val = document.getElementById('valorCaixaBalcao');
    if (desc) desc.value = '';
    if (val) val.value = '';
    const m = document.getElementById('modalLancamentoCaixa');
    if (m) m.style.display = 'flex';
    if (desc) desc.focus();
};

window.salvarLancamentoCaixaBalcao = function () {
    const desc = (document.getElementById('descCaixaBalcao') && document.getElementById('descCaixaBalcao').value || '').trim();
    const val = parseFloat(document.getElementById('valorCaixaBalcao') && document.getElementById('valorCaixaBalcao').value);
    if (!desc || isNaN(val) || val <= 0) return alert('Preencha a descrição e um valor maior que zero.');
    const agora = Date.now();
    const doc = {
        tipo: 'ENTRADA_CAIXA',
        clienteNome: '[ENTRADA] ' + desc,
        total: val,
        formaPagamento: 'Dinheiro',
        statusPagamento: 'PAGO',
        dataStr: new Date(agora).toLocaleString('pt-BR'),
        timestamp: agora,
        os: '-',
        usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema'
    };
    window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixa')), doc).then(() => {
        window.registrarMovimentoCaixa('entrada', val);
        const m = document.getElementById('modalLancamentoCaixa');
        if (m) m.style.display = 'none';
        alert('Entrada lançada no caixa físico (gaveta) com sucesso!');
        if (window.atualizarResumoPagamentosHoje) window.atualizarResumoPagamentosHoje();
    }).catch(e => alert('Erro ao salvar: ' + e.message));
};

window.abrirModalBanco = function(tipo) {
    document.getElementById('tipoLancamentoBanco').value = tipo;
    document.getElementById('descBanco').value = '';
    document.getElementById('valorBanco').value = '';
    
    let titulo = tipo === 'ENTRADA' ? '➕ Lançar Entrada no Banco' : '➖ Lançar Saída no Banco';
    let corBtn = tipo === 'ENTRADA' ? '#27ae60' : '#e74c3c';
    
    document.getElementById('tituloModalBanco').innerText = titulo;
    document.getElementById('tituloModalBanco').style.color = corBtn;
    document.getElementById('tituloModalBanco').style.borderBottomColor = corBtn;
    document.getElementById('btnSalvarBanco').style.backgroundColor = corBtn;
    
    document.getElementById('modalLancamentoBanco').style.display = 'flex';
    document.getElementById('descBanco').focus();
};

window.salvarLancamentoBanco = function() {
    let desc = document.getElementById('descBanco').value.trim();
    let val = parseFloat(document.getElementById('valorBanco').value);
    let tipo = document.getElementById('tipoLancamentoBanco').value;
    
    if(!desc || isNaN(val) || val <= 0) return alert("Preencha corretamente a descrição e um valor maior que zero.");
    
    let doc = {
        tipo: tipo,
        descricao: desc,
        valor: val,
        dataStr: new Date().toLocaleString('pt-BR'),
        timestamp: Date.now(),
        usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema'
    };
    
    window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixaBancoExtrato')), doc).then(() => {
        document.getElementById('modalLancamentoBanco').style.display = 'none';
    }).catch(e => alert("Erro ao salvar: " + e));
};

window.excluirLancamentoBanco = function(id) {
    if(confirm("Deseja realmente excluir este lançamento bancário? O saldo será recalculado automaticamente.")) {
        window.meuRemove(window.meuRef(window.meuBanco, 'caixaBancoExtrato/' + id));
    }
};


window.fecharCaixaBanco = async function() {
    const fluxo = window._calcularFluxoBancoAtual();
    const saldoInicial = fluxo.saldoInicial;
    const totalEntradas = fluxo.totalEntradas;
    const totalSaidas = fluxo.totalSaidas;
    const saldoAtual = fluxo.saldoAtual;

    let msg = `FECHAMENTO DO BANCO\n\nSaldo Inicial: R$ ${saldoInicial.toFixed(2)}\n`;
    msg += `Entradas manuais: R$ ${fluxo.totalEntradasManual.toFixed(2)}\n`;
    msg += `Entradas PIX/cartão (recebidas): R$ ${fluxo.totalEntradasDigital.toFixed(2)}\n`;
    msg += `Total de Entradas: R$ ${totalEntradas.toFixed(2)}\n`;
    msg += `Total de Saídas: R$ ${totalSaidas.toFixed(2)}\n\nSaldo Atual no Banco: R$ ${saldoAtual.toFixed(2)}\n\nDeseja realizar o Fechamento?\nO painel será TOTALMENTE ZERADO (R$ 0,00) para o próximo turno.`;

    if (!confirm(msg)) return;

    try {
        let docFechamento = {
            tipo: 'FECHAMENTO_BANCO',
            descricao: `🔒 FECHAMENTO DE CAIXA (Saldo Conferido: R$ ${saldoAtual.toFixed(2)})`,
            valor: saldoAtual,
            dataStr: new Date().toLocaleString('pt-BR'),
            timestamp: Date.now(),
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema'
        };
        
        await window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixaBancoExtrato')), docFechamento);
        await window.meuSet(window.meuRef(window.meuBanco, 'caixaBancoStatus'), { saldoInicial: 0 });

        if (window.atualizarPainelBanco) window.atualizarPainelBanco();
        alert("✅ Banco fechado com sucesso! Painel totalmente zerado.");
    } catch(e) {
        alert("Erro ao registrar o fechamento do banco: " + e.message);
    }
};

// --- ZERAR PAINEL DO BANCO (sem apagar extrato nem vendas digitais na tabela) ---
window.zerarFluxoBanco = async function () {
    if (!confirm(
        '⚠️ ATENÇÃO: Deseja realmente ZERAR o painel do Banco Digital?\n\n' +
        'O Saldo Inicial, Entradas e Saídas exibidos no painel voltarão a R$ 0,00.\n' +
        '(Lançamentos manuais e vendas PIX/cartão na tabela NÃO serão apagados — apenas o painel numérico será reiniciado, como no caixa balcão.)'
    )) {
        return;
    }
    try {
        const docZeragem = {
            tipo: 'FECHAMENTO_BANCO',
            descricao: '⚠️ ZERAGEM MANUAL DO PAINEL (reinício do fluxo)',
            valor: 0,
            dataStr: new Date().toLocaleString('pt-BR'),
            timestamp: Date.now(),
            usuario: window.usuarioLogado ? window.usuarioLogado.nome : 'Sistema'
        };
        await window.meuSet(window.meuPush(window.meuRef(window.meuBanco, 'caixaBancoExtrato')), docZeragem);
        await window.meuSet(window.meuRef(window.meuBanco, 'caixaBancoStatus'), { saldoInicial: 0 });
        if (window.atualizarPainelBanco) window.atualizarPainelBanco();
        alert('✅ Painel do banco zerado com sucesso!');
    } catch (erro) {
        alert('❌ Erro ao zerar o banco: ' + erro.message);
    }
};

// --- FUNÇÃO PARA ZERAR O PAINEL DO CAIXA MANUALMENTE ---
window.zerarFluxoCaixa = async function() {
    if (!confirm("⚠️ ATENÇÃO EXTREMA: Deseja realmente ZERAR o painel do Caixa Atual?\n\nIsso voltará as Entradas, Saídas e o Saldo Inicial para R$ 0,00.\n(Os documentos e vendas salvos na tabela não serão apagados, apenas o painel numérico será limpo).")) {
        return;
    }

    try {
        // Usamos as referências globais que você já tem no sistema para forçar os zeros
        await window.meuSet(window.meuRef(window.meuBanco, 'caixaStatus'), { 
            entradas: 0, 
            saidas: 0, 
            caixaInicial: 0 
        });
        
        alert("✅ Painel do caixa zerado com sucesso!");
    } catch (erro) {
        alert("❌ Erro ao zerar o caixa: " + erro.message);
    }
};


