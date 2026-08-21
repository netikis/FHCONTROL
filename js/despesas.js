/**
 * FH CONTROL — Despesas de obras + alertas de vencimento (Fase 7)
 * 100% local (localStorage), sem Firebase.
 * Extraído do index sem alterar a lógica.
 */
(function(){
    "use strict";
    var K_OBRAS = 'FH_DESP_OBRAS';
    var K_TER   = 'FH_DESP_TERCEIROS';
    var K_REL   = 'FH_DESP_REL';

    // ---------- Armazenamento ----------
    function load(key){
        try {
            var raw = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch(e){
            return [];
        }
    }
    function save(key, arr){ try { localStorage.setItem(key, JSON.stringify(arr)); } catch(e){ alert('Não foi possível salvar (armazenamento cheio?).'); } }
    function novoId(){ return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

    function normalizarDespesaGeral(d) {
        if (!d || typeof d !== 'object') return null;
        var copy = Object.assign({}, d);
        if (!copy.obra_nome && copy.obra) copy.obra_nome = copy.obra;
        if (!copy.loja_nome && (copy.nome || copy.fornecedor)) copy.loja_nome = copy.nome || copy.fornecedor;
        if (!copy.obra_lower) copy.obra_lower = norm(copy.obra_nome || copy.obra || '');
        if (!copy.loja_lower) copy.loja_lower = norm(copy.loja_nome || copy.loja || '');
        if (copy.valor_numero == null || copy.valor_numero === '') {
            copy.valor_numero = parseMoeda(copy.valor_string || copy.valor || 0);
        }
        if (!copy.valor_string && copy.valor_numero != null) {
            copy.valor_string = (Number(copy.valor_numero) || 0).toFixed(2).replace('.', ',');
        }
        if (!copy.status) copy.status = 'pendente';
        if (!copy.data && copy.data_lancamento) copy.data = brDate(copy.data_lancamento);
        return copy;
    }

    function loadDespesasGeralConsolidadas() {
        var lista = [];
        var ids = {};
        function addAll(arr) {
            (arr || []).forEach(function (d) {
                var n = normalizarDespesaGeral(d);
                if (!n) return;
                var id = n.id || (n.obra_lower + '|' + n.loja_lower + '|' + String(n.timestamp || '') + '|' + String(n.valor_numero || ''));
                if (ids[id]) return;
                ids[id] = true;
                lista.push(n);
            });
        }
        addAll(load(K_OBRAS));
        addAll(load(K_REL));
        return lista;
    }

    // ---------- Helpers ----------
    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function norm(n){ return String(n||'').trim().replace(/\s+/g,' ').toLowerCase(); }
    function canon(n){ return String(n||'').trim().replace(/\s+/g,' ').toUpperCase(); }
    function parseMoeda(v){
        if(typeof v === 'number') return v;
        var s = String(v||'').trim().replace(/[^\d,.-]/g,'');
        if(!s) return 0;
        if(s.indexOf(',') > -1){ s = s.replace(/\./g,'').replace(',', '.'); }
        return parseFloat(s) || 0;
    }
    function fmt(n){ return 'R$ ' + (Number(n)||0).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}); }
    function brDate(iso){
        if(!iso) return '';
        var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if(m) return m[3] + '/' + m[2] + '/' + m[1];
        return String(iso);
    }
    function hojeIso(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
    function hojeBr(){ var d = new Date(); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear(); }
    function vencTs(iso){
        if(!iso) return null;
        var m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if(!m) return null;
        return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]), 12, 0, 0, 0).getTime();
    }

    function vencimentoTsDespesa(d) {
        if (!d) return null;
        var ts = vencTs(d.data_vencimento);
        if (ts != null) return ts;
        var br = String(d.data_vencimento || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (br) {
            var ano = br[3].length === 2 ? (2000 + Number(br[3])) : Number(br[3]);
            return new Date(ano, Number(br[2]) - 1, Number(br[1]), 12, 0, 0, 0).getTime();
        }
        if (d.data_vencimento_ts != null && d.data_vencimento_ts !== '' && isFinite(Number(d.data_vencimento_ts))) {
            return Number(d.data_vencimento_ts);
        }
        return null;
    }

    function formatTsBr(ts) {
        var dt = new Date(ts);
        if (isNaN(dt.getTime())) return '';
        return String(dt.getDate()).padStart(2, '0') + '/' + String(dt.getMonth() + 1).padStart(2, '0') + '/' + dt.getFullYear();
    }

    function despStatusPago(d) {
        return String(d && d.status != null ? d.status : '').toLowerCase().trim() === 'pago';
    }

    function estaVencida(d){
        if(!d || despStatusPago(d)) return false;
        var t = vencimentoTsDespesa(d);
        if(t == null) return false;
        var h = new Date();
        h.setHours(12, 0, 0, 0);
        return t < h.getTime();
    }

    function ehPendenteAVencer(d) {
        return d && !despStatusPago(d) && !estaVencida(d);
    }
    function statusLabel(d){ return despStatusPago(d) ? 'PAGO' : (estaVencida(d) ? 'VENCIDA' : 'A VENCER'); }
    function statusCor(d){ return despStatusPago(d) ? '#27ae60' : (estaVencida(d) ? '#e74c3c' : '#f39c12'); }
    function ordenarPorVenc(arr){
        arr.sort(function(a,b){
            var ta = vencimentoTsDespesa(a) || 8.64e15;
            var tb = vencimentoTsDespesa(b) || 8.64e15;
            return ta - tb;
        });
        return arr;
    }

    window._relDespOrdemVenc = window._relDespOrdemVenc || 'cronologico';

    function refChequeBoletoDesp(d) {
        var c = d.cheque_boleto_num != null ? String(d.cheque_boleto_num).trim() : '';
        if (c) return c;
        var n = d.nota_fiscal != null ? String(d.nota_fiscal).trim() : '';
        return n || '—';
    }

    function formatarVencimentoRelDespHtml(d) {
        var ts = vencimentoTsDespesa(d);
        var texto = ts != null ? formatTsBr(ts) : brDate(d.data_vencimento);
        if (!texto || texto === '-') return '—';
        if (!despStatusPago(d) && estaVencida(d)) {
            return '<span style="font-weight:800;color:#dc3545;">' + esc(texto) + '</span>';
        }
        return esc(texto);
    }

    function badgeEstadoRelDespesaHtml(d) {
        if (despStatusPago(d)) {
            return '<span style="background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:800;">Pago</span>'
                + '<br><span style="font-size:10px;color:#333;font-weight:700;">' + esc(d.data_pagamento || '—') + '</span>';
        }
        if (estaVencida(d)) {
            return '<span style="background:#f8d7da;color:#721c24;padding:2px 8px;border-radius:4px;font-weight:800;">⚠️ VENCIDA</span>'
                + '<br><span style="font-size:10px;color:#dc3545;font-weight:700;">Atrasada — pendente pagamento</span>';
        }
        return '<span style="background:#fff3cd;color:#856404;padding:2px 6px;border-radius:4px;font-weight:800;">⏳ A VENCER</span>'
            + '<br><span style="font-size:10px;color:#856404;font-weight:700;">No prazo</span>';
    }

    function calcularTotaisResumoRelDespesas(arr) {
        var somaVencidas = 0, somaAVencer = 0, somaPagas = 0;
        (arr || []).forEach(function (d) {
            var valor = Number(d.valor_numero) || 0;
            if (despStatusPago(d)) somaPagas += valor;
            else if (estaVencida(d)) somaVencidas += valor;
            else somaAVencer += valor;
        });
        return { somaVencidas: somaVencidas, somaAVencer: somaAVencer, somaPagas: somaPagas };
    }

    function bolinhaResumoHtml(cor) {
        return '<span class="bolinha-resumo" style="background:' + cor + ';"></span>';
    }

    function montarHtmlPainelResumoRelDespesas(somaVencidas, somaAVencer, somaPagas, rotuloTotal, colorido) {
        var label = rotuloTotal || 'Total Global (resultado da tabela):';
        var total = somaVencidas + somaAVencer + somaPagas;
        if (colorido) {
            return ''
                + '<div class="resumo-rel-desp-linhas">'
                + '<div><span style="font-size:12px;color:#d9534f;font-weight:800;">' + bolinhaResumoHtml('#dc3545') + 'Vencido</span><br><b style="color:#d9534f;font-size:16px;">' + fmt(somaVencidas) + '</b></div>'
                + '<div><span style="font-size:12px;color:#856404;font-weight:800;">' + bolinhaResumoHtml('#ffc107') + 'A Vencer</span><br><b style="color:#856404;font-size:16px;">' + fmt(somaAVencer) + '</b></div>'
                + '<div><span style="font-size:12px;color:#155724;font-weight:800;">' + bolinhaResumoHtml('#28a745') + 'Já Pago</span><br><b style="color:#28a745;font-size:16px;">' + fmt(somaPagas) + '</b></div>'
                + '</div>'
                + '<div class="resumo-rel-desp-total-global">'
                + '<span>' + esc(label) + '</span> <b class="resumo-rel-valor-total">' + fmt(total) + '</b>'
                + '</div>';
        }
        return ''
            + '<div class="resumo-rel-desp-linhas">'
            + '<div><span class="resumo-rel-desp-item">' + bolinhaResumoHtml('#dc3545') + 'Vencido</span><br><b class="resumo-rel-valor">' + fmt(somaVencidas) + '</b></div>'
            + '<div><span class="resumo-rel-desp-item">' + bolinhaResumoHtml('#ffc107') + 'A Vencer</span><br><b class="resumo-rel-valor">' + fmt(somaAVencer) + '</b></div>'
            + '<div><span class="resumo-rel-desp-item">' + bolinhaResumoHtml('#28a745') + 'Já Pago</span><br><b class="resumo-rel-valor">' + fmt(somaPagas) + '</b></div>'
            + '</div>'
            + '<div class="resumo-rel-desp-total-global">'
            + '<span>' + esc(label) + '</span> <b class="resumo-rel-valor-total">' + fmt(total) + '</b>'
            + '</div>';
    }

    function rotuloOrdemVencRelDesp() {
        var m = window._relDespOrdemVenc || 'cronologico';
        if (m === 'vencidos_topo') return 'Vencimento ⚠▲';
        if (m === 'desc') return 'Vencimento ▼';
        return 'Vencimento ▲';
    }

    function aplicarOrdemRelDespVencimento(arr, modo) {
        var m = modo || window._relDespOrdemVenc || 'cronologico';
        var copy = arr.slice();
        if (m === 'vencidos_topo') {
            copy.sort(function (a, b) {
                var pa = despStatusPago(a) ? 2 : (estaVencida(a) ? 0 : 1);
                var pb = despStatusPago(b) ? 2 : (estaVencida(b) ? 0 : 1);
                if (pa !== pb) return pa - pb;
                var ta = vencimentoTsDespesa(a) || 8.64e15;
                var tb = vencimentoTsDespesa(b) || 8.64e15;
                return ta - tb;
            });
            return copy;
        }
        if (m === 'desc') {
            copy.sort(function (a, b) {
                var ta = vencimentoTsDespesa(a) || 0;
                var tb = vencimentoTsDespesa(b) || 0;
                return tb - ta;
            });
            return copy;
        }
        return ordenarPorVenc(copy);
    }

    window.despAlternarOrdemVencRel = function () {
        var modos = ['cronologico', 'vencidos_topo', 'desc'];
        var atual = window._relDespOrdemVenc || 'cronologico';
        var idx = modos.indexOf(atual);
        window._relDespOrdemVenc = modos[(idx + 1) % modos.length];
        if (window._relDespDadosFiltrados && window._relDespDadosFiltrados.length) {
            window.despRenderizarTabelaRelDespesas(window._relDespDadosFiltrados.slice());
        }
    };

    window.despAtualizarPainelResumoRelDespesas = function (arr) {
        var panel = document.getElementById('resumo-total-rel-despesas');
        var display = document.getElementById('total-gasto-display-rel-desp');
        var subEl = document.getElementById('resumo-rel-desp-subtitulo');
        if (!panel || !display) return;
        if (!arr || !arr.length) {
            panel.style.display = 'none';
            return;
        }
        var totais = calcularTotaisResumoRelDespesas(arr);
        display.innerHTML = montarHtmlPainelResumoRelDespesas(totais.somaVencidas, totais.somaAVencer, totais.somaPagas, 'Total Global (resultado da tabela):');
        panel.style.display = 'block';
        if (subEl) subEl.style.display = 'none';
    };

    window.despRenderizarTabelaRelDespesas = function (arrOrigem) {
        var wrap = document.getElementById('tabela-relatorio-despesas-wrap');
        if (!wrap) return;
        var arr = aplicarOrdemRelDespVencimento(arrOrigem || [], window._relDespOrdemVenc);
        window._dpUltimaRel = arr;
        if (!arr.length) {
            wrap.innerHTML = '<p style="text-align:center; color:#212529; font-weight:700; padding:12px 0;">Nenhuma linha cadastrada / encontrada.</p>';
            wrap.setAttribute('data-rel-desp-carregado', '1');
            var resumo = document.getElementById('resumo-total-rel-despesas');
            if (resumo) resumo.style.display = 'none';
            return;
        }

        var html = '<table class="tabela-relatorio-despesas"><thead><tr>'
            + '<th>Obra</th>'
            + '<th>Nome (fornec.)</th>'
            + '<th>Chq. / boleto / NF</th>'
            + '<th class="th-ordem-venc" onclick="window.despAlternarOrdemVencRel()" title="Clique para alternar a ordem do vencimento">' + rotuloOrdemVencRelDesp() + ' <span style="font-size:10px;opacity:0.85;">↕</span></th>'
            + '<th>Lançamento</th>'
            + '<th>Valor</th>'
            + '<th>Estado</th>'
            + '<th>Observação</th>'
            + '<th>Acções</th>'
            + '</tr></thead><tbody>';

        arr.forEach(function (d) {
            var st = despStatusPago(d) ? 'pago' : 'pendente';
            var vencida = st === 'pendente' && estaVencida(d);
            var trClass = vencida ? ' class="linha-vencida"' : '';
            var rawObs = String(d.observacao || '').trim();
            var obsShort = rawObs.length > 100 ? esc(rawObs.slice(0, 97)) + '…' : esc(rawObs);
            var valorTxt = d.valor_string ? ('R$ ' + esc(String(d.valor_string))) : fmt(d.valor_numero);

            html += '<tr' + trClass + '>'
                + '<td>' + esc(d.obra_nome || '') + '</td>'
                + '<td>' + esc(d.loja_nome || '') + '</td>'
                + '<td>' + esc(refChequeBoletoDesp(d)) + '</td>'
                + '<td style="white-space:nowrap;">' + formatarVencimentoRelDespHtml(d) + '</td>'
                + '<td>' + esc(brDate(d.data_lancamento) || '—') + '</td>'
                + '<td style="white-space:nowrap;"><b>' + valorTxt + '</b></td>'
                + '<td>' + badgeEstadoRelDespesaHtml(d) + '</td>'
                + '<td style="max-width:220px;font-size:11px;" title="' + esc(rawObs) + '">' + (obsShort || '—') + '</td>'
                + '<td style="min-width:128px;">'
                + '<button type="button" class="btn-rel-acao btn-rel-editar" onclick="window.despEditar(\'' + d.id + '\',\'rel\')">✏️ Editar</button>';
            if (st === 'pendente') {
                html += '<button type="button" class="btn-rel-acao btn-rel-pago" onclick="window.despTogglePago(\'' + d.id + '\',\'rel\')">✅ Pago</button>';
            } else {
                html += '<button type="button" class="btn-rel-acao btn-rel-pendente" onclick="window.despTogglePago(\'' + d.id + '\',\'rel\')">↩️ Pendente</button>';
            }
            html += '<button type="button" class="btn-rel-acao btn-rel-excluir" onclick="window.despExcluir(\'' + d.id + '\',\'rel\')">🗑️ Excluir</button>'
                + '</td></tr>';
        });

        html += '</tbody></table>';
        wrap.innerHTML = html;
        wrap.setAttribute('data-rel-desp-carregado', '1');
        window.despAtualizarPainelResumoRelDespesas(arr);
    };

    // ---------- Máscara / anexo ----------
    window.despMascaraMoeda = function(input){
        var v = input.value.replace(/\D/g,'');
        v = (parseInt(v||'0',10)/100).toFixed(2);
        v = v.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        input.value = v;
    };
    window.despLerAnexo = function(input, hiddenId, prevId){
        var f = input.files && input.files[0];
        var hid = document.getElementById(hiddenId);
        var prev = prevId ? document.getElementById(prevId) : null;
        if(!f){ if(hid) hid.value=''; if(prev) prev.innerHTML=''; return; }
        var r = new FileReader();
        r.onload = function(e){ if(hid) hid.value = e.target.result; if(prev) prev.innerHTML = '<img src="'+e.target.result+'" style="max-width:120px; border-radius:6px; border:1px solid #7f8c8d;">'; };
        r.readAsDataURL(f);
    };

    window.despMascaraCep = function (input) {
        if (!input) return;
        var v = String(input.value || '').replace(/\D/g, '').slice(0, 8);
        input.value = v.length > 5 ? v.replace(/^(\d{5})(\d)/, '$1-$2') : v;
    };

    window.despLerCamposEndereco = function (prefix) {
        function val(id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
        var endereco = val(prefix + '-endereco');
        var bairro = val(prefix + '-bairro');
        var numero = val(prefix + '-numero');
        var cep = val(prefix + '-cep');
        var cpf_cnpj = val(prefix + '-cpf-cnpj');
        return {
            endereco: endereco,
            bairro: bairro,
            numero: numero,
            cep: cep,
            cpf_cnpj: cpf_cnpj,
            endereco_busca: norm([endereco, bairro, numero, cep, cpf_cnpj].join(' '))
        };
    };

    window.despPreencherEnderecoCampos = function (prefix, data) {
        if (!data) return;
        var map = {
            'cpf-cnpj': data.cpf_cnpj || data.cpf || data.cnpj || '',
            cep: data.cep || '',
            endereco: data.endereco || data.rua || '',
            numero: data.numero || '',
            bairro: data.bairro || ''
        };
        Object.keys(map).forEach(function (suf) {
            var el = document.getElementById(prefix + '-' + suf);
            if (el) el.value = map[suf];
        });
    };

    window.despAutofillEnderecoPorCliente = function (nomeObra, prefix) {
        prefix = prefix || 'd';
        var nome = String(nomeObra || '').trim();
        if (!nome || typeof clientesGlobais === 'undefined' || !Array.isArray(clientesGlobais)) return;
        var alvo = norm(nome);
        var c = clientesGlobais.find(function (x) { return norm(x.nome) === alvo; });
        if (!c) return;
        window.despPreencherEnderecoCampos(prefix, {
            cpf_cnpj: c.cpf || c.cnpj || '',
            cep: c.cep || '',
            endereco: c.rua || '',
            numero: c.numero || '',
            bairro: c.bairro || ''
        });
    };

    window.despHtmlEnderecoResumo = function (d) {
        if (!d) return '';
        var partes = [];
        if (d.endereco) partes.push(d.endereco);
        if (d.numero) partes.push('Nº ' + d.numero);
        if (d.bairro) partes.push(d.bairro);
        if (d.cep) partes.push('CEP ' + d.cep);
        if (d.cpf_cnpj) partes.push(d.cpf_cnpj);
        if (!partes.length) return '';
        return '<br><small style="color:#95a5a6; font-weight:600;">' + esc(partes.join(' · ')) + '</small>';
    };

    window.despLimparCamposEndereco = function (prefix) {
        ['cpf-cnpj', 'cep', 'endereco', 'numero', 'bairro'].forEach(function (suf) {
            var el = document.getElementById(prefix + '-' + suf);
            if (el) el.value = '';
        });
    };

    // ---------- Datalists ----------
    function atualizarDatalists(){
        var obras = {}, lojas = {};
        load(K_OBRAS).forEach(function(d){ if(d.obra_nome) obras[d.obra_nome]=1; if(d.loja_nome) lojas[d.loja_nome]=1; });
        load(K_REL).forEach(function(d){ if(d.obra_nome) obras[d.obra_nome]=1; if(d.loja_nome) lojas[d.loja_nome]=1; });
        load(K_TER).forEach(function(d){ if(d.obra) obras[d.obra]=1; });
        if (typeof clientesGlobais !== 'undefined' && Array.isArray(clientesGlobais)) {
            clientesGlobais.forEach(function (c) { if (c && c.nome) obras[c.nome] = 1; });
        }
        var dlO = document.getElementById('dl-obras');
        var dlL = document.getElementById('dl-lojas');
        if(dlO) dlO.innerHTML = Object.keys(obras).sort().map(function(o){ return '<option value="'+esc(o)+'">'; }).join('');
        if(dlL) dlL.innerHTML = Object.keys(lojas).sort().map(function(o){ return '<option value="'+esc(o)+'">'; }).join('');
    }
    window.despRenderCadastro = function(){
        atualizarDatalists();
        var lan = document.getElementById('d-lancamento');
        if (lan && !lan.value) lan.value = hojeIso();
    };

    // =====================================================================
    // 1) ADICIONAR DESPESAS
    // =====================================================================
    window.despSalvarDespesa = function(){
        var obra = canon(document.getElementById('d-obra').value);
        var loja = canon(document.getElementById('d-loja').value);
        var nf = (document.getElementById('d-nf').value||'').trim();
        var cheque = (document.getElementById('d-cheque-boleto').value||'').trim();
        var lanc = document.getElementById('d-lancamento').value || hojeIso();
        var venc = document.getElementById('d-vencimento').value || '';
        var valor = document.getElementById('d-valor').value;
        var desc = document.getElementById('d-desc').value || '';
        var obs = (document.getElementById('d-observacao').value||'').trim();
        var foto = document.getElementById('d-anexo-base64').value || '';
        var end = window.despLerCamposEndereco('d');
        if(!obra || !loja || !valor){ alert('Preencha Obra/Local/Cliente, Fornecedor/Loja e Valor!'); return; }
        var arr = load(K_OBRAS);
        arr.push({
            id: novoId(), obra_nome: obra, obra_lower: norm(obra),
            loja_nome: loja, loja_lower: norm(loja), nota_fiscal: nf,
            cheque_boleto_num: cheque, data_lancamento: lanc, data: brDate(lanc),
            data_vencimento: venc, data_vencimento_ts: vencTs(venc),
            valor_string: valor, valor_numero: parseMoeda(valor),
            descricao: desc, observacao: obs, foto_recibo: foto,
            endereco: end.endereco, bairro: end.bairro, numero: end.numero,
            cep: end.cep, cpf_cnpj: end.cpf_cnpj, endereco_busca: end.endereco_busca,
            timestamp: Date.now(), status: 'pendente'
        });
        save(K_OBRAS, arr);
        alert('Despesa cadastrada com sucesso!');
        if (window.monitorarVencimentosObrasFh) window.monitorarVencimentosObrasFh();
        ['d-obra','d-loja','d-nf','d-cheque-boleto','d-vencimento','d-valor','d-desc','d-observacao','d-anexo','d-anexo-base64'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
        window.despLimparCamposEndereco('d');
        document.getElementById('d-lancamento').value = hojeIso();
        var prev=document.getElementById('d-anexo-prev'); if(prev) prev.innerHTML='';
        atualizarDatalists();
    };

    // =====================================================================
    // 2) RELATÓRIO DE GASTOS POR OBRA
    // =====================================================================
    window.despInitRelatorio = function(){ atualizarDatalists(); };

    window._obraSelecionadaDesp = null;

    window._agruparDespesasPorObra = function (lista) {
        var mapa = {};
        lista.forEach(function (d) {
            var nome = d.obra_nome || '-';
            var chave = norm(nome);
            if (!mapa[chave]) mapa[chave] = { chave: chave, nome: nome, itens: [], total: 0, qtd: 0 };
            mapa[chave].itens.push(d);
            mapa[chave].total += (d.valor_numero || 0);
            mapa[chave].qtd += 1;
        });
        return Object.keys(mapa).map(function (k) { return mapa[k]; }).sort(function (a, b) {
            if (Math.abs(b.total - a.total) > 0.009) return b.total - a.total;
            return a.nome.localeCompare(b.nome, 'pt-BR');
        });
    };

    window._htmlBalaoObraDesp = function (grupo, selecionado) {
        var nome = esc(grupo.nome);
        var chave = esc(grupo.chave);
        var sel = selecionado ? ' badge-tag-selecionado' : '';
        var extra = ' <small>(' + grupo.qtd + ' desp. · ' + fmt(grupo.total) + ')</small>';
        return '<span class="badge-tag-wrap' + sel + '">'
            + '<span role="button" tabindex="0" class="badge-tag badge-tag-desp-obra" data-chave="' + chave + '" title="' + nome + '">' + nome + extra + '</span>'
            + '<button type="button" class="badge-tag-excluir" data-chave="' + chave + '" data-tipo="obra-desp" title="Excluir todas as despesas desta obra/cliente">×</button>'
            + '</span>';
    };

    window.excluirGrupoObraDesp = function (chave) {
        var arr = load(K_OBRAS);
        var alvo = arr.filter(function (d) { return norm(d.obra_nome || '') === chave; });
        if (!alvo.length) return;
        var nome = alvo[0].obra_nome || chave;
        if (!confirm('Excluir TODAS as ' + alvo.length + ' despesa(s) de "' + nome + '"?\n\nEsta ação não pode ser desfeita.')) return;
        save(K_OBRAS, arr.filter(function (d) { return norm(d.obra_nome || '') !== chave; }));
        window._obraSelecionadaDesp = null;
        atualizarDatalists();
        var temBusca = norm(document.getElementById('busca-obra').value);
        window.despBuscarDespesasObra(!temBusca, false);
        alert('✅ Despesas de "' + nome + '" excluídas.');
    };

    window.selecionarObraDesp = function (chave) {
        window._obraSelecionadaDesp = chave;
        window.despRenderDetalheObra();
    };

    window.despMontarTabelaDespesasObra = function (lista) {
        var html = '<div class="table-responsive"><table><thead><tr><th>Obra / Local / Cliente</th><th>Fornecedor</th><th>NF</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>';
        lista.forEach(function (d) {
            html += '<tr>'
                + '<td style="font-weight:800;">' + esc(d.obra_nome) + window.despHtmlEnderecoResumo(d) + '</td>'
                + '<td style="font-weight:700;">' + esc(d.loja_nome) + (d.descricao ? '<br><small style="color:#495057; font-weight:600;">' + esc(d.descricao) + '</small>' : '') + '</td>'
                + '<td>' + esc(d.nota_fiscal || '-') + '</td>'
                + '<td>' + (brDate(d.data_vencimento) || '-') + '</td>'
                + '<td style="font-weight:800;">' + fmt(d.valor_numero) + '</td>'
                + '<td><span style="color:' + statusCor(d) + '; font-weight:800;">' + statusLabel(d) + '</span></td>'
                + '<td style="white-space:nowrap;">'
                    + '<button class="btn-secundario" style="padding:4px 8px; font-size:10px; font-weight:800; background-color:' + (d.status === 'pago' ? '#7f8c8d' : '#27ae60') + ';" onclick="window.despTogglePago(\'' + d.id + '\',\'obra\')">' + (d.status === 'pago' ? '↩ Pendente' : '✓ Pago') + '</button> '
                    + (d.foto_recibo ? '<button class="btn-secundario" style="padding:4px 8px; font-size:10px; font-weight:800; background-color:#2980b9;" onclick="window.despVerFoto(\'' + d.id + '\',\'obra\')">📷</button> ' : '')
                    + '<button class="btn-secundario" style="padding:4px 8px; font-size:10px; font-weight:800; background-color:#e67e22;" onclick="window.despEditar(\'' + d.id + '\',\'obra\')">✏️</button> '
                    + '<button class="btn-danger" style="padding:4px 8px; font-size:10px; font-weight:800;" onclick="window.despExcluir(\'' + d.id + '\',\'obra\')">🗑️</button>'
                + '</td></tr>';
        });
        html += '</tbody></table></div>';
        return html;
    };

    window.despRenderDetalheObra = function () {
        var lista = window._dpUltimaBuscaObra || [];
        var grupos = window._agruparDespesasPorObra(lista);
        var divBaloes = document.getElementById('listaBaloesObrasDesp');
        var painelBaloes = document.getElementById('painel-baloes-desp-obra');
        var painelDet = document.getElementById('painel-detalhes-obra-desp');
        var cont = document.getElementById('lista-despesas-resultados');
        var lblQtd = document.getElementById('contagemObrasDesp');
        var lblNome = document.getElementById('nomeObraSelecionadaDesp');
        var lblResumo = document.getElementById('resumoObraSelecionadaDesp');
        if (!divBaloes || !cont) return;
        if (lblQtd) lblQtd.textContent = String(grupos.length);
        var grupoAtivo = grupos.find(function (g) { return g.chave === window._obraSelecionadaDesp; });
        if (!grupoAtivo && grupos.length) {
            grupoAtivo = grupos[0];
            window._obraSelecionadaDesp = grupoAtivo.chave;
        }
        divBaloes.innerHTML = grupos.length
            ? grupos.map(function (g) { return window._htmlBalaoObraDesp(g, grupoAtivo && g.chave === grupoAtivo.chave); }).join('')
            : '<p class="cadastro-pend-vazio">Nenhuma obra/cliente.</p>';
        if (!grupoAtivo) {
            if (painelDet) painelDet.style.display = 'none';
            cont.innerHTML = '';
            return;
        }
        if (painelBaloes) painelBaloes.style.display = 'block';
        if (painelDet) painelDet.style.display = 'block';
        if (lblNome) lblNome.textContent = grupoAtivo.nome;
        if (lblResumo) lblResumo.textContent = '— ' + grupoAtivo.qtd + ' despesa(s) · ' + fmt(grupoAtivo.total);
        cont.innerHTML = window.despMontarTabelaDespesasObra(grupoAtivo.itens);
    };

    window.despBuscarDespesasObra = function(mostrarTodas, manterSelecao){
        var termo = norm(document.getElementById('busca-obra').value);
        if(!mostrarTodas && !termo){ alert('Digite obra, local, cliente ou fornecedor.'); return; }
        var lista = load(K_OBRAS).filter(function(d){
            if(mostrarTodas) return true;
            return (d.obra_lower||'').indexOf(termo) > -1 || (d.loja_lower||'').indexOf(termo) > -1
                || (d.endereco_busca||'').indexOf(termo) > -1;
        });
        ordenarPorVenc(lista);
        lista.sort(function(a,b){ return (a.obra_nome||'').localeCompare(b.obra_nome||''); });
        window._dpUltimaBuscaObra = lista;
        if (!manterSelecao) window._obraSelecionadaDesp = null;
        var resumo = document.getElementById('resumo-total-despesas');
        var vazio = document.getElementById('desp-relatorio-vazio');
        var painelBaloes = document.getElementById('painel-baloes-desp-obra');
        var painelDet = document.getElementById('painel-detalhes-obra-desp');
        if(!lista.length){
            if (vazio) { vazio.style.display = 'block'; vazio.textContent = 'Nenhuma despesa encontrada.'; }
            if (painelBaloes) painelBaloes.style.display = 'none';
            if (painelDet) painelDet.style.display = 'none';
            var cont = document.getElementById('lista-despesas-resultados');
            if (cont) cont.innerHTML = '';
            if(resumo) resumo.style.display='none';
            document.getElementById('tabela-resumo-fornecedores').innerHTML='';
            return;
        }
        if (vazio) vazio.style.display = 'none';
        var total = 0;
        lista.forEach(function(d){ total += (d.valor_numero||0); });
        document.getElementById('total-gasto-display').textContent = fmt(total);
        if(resumo) resumo.style.display='block';
        document.getElementById('tabela-resumo-fornecedores').innerHTML='';
        window.despRenderDetalheObra();
    };

    window.despGerarResumoFornecedores = function(){
        var lista = window._dpUltimaBuscaObra || [];
        if(!lista.length){ alert('Faça uma busca primeiro.'); return; }
        var obras = [], forn = [], mapa = {};
        lista.forEach(function(d){
            var o = d.obra_nome||'-', f = d.loja_nome||'-';
            if(obras.indexOf(o)<0) obras.push(o);
            if(forn.indexOf(f)<0) forn.push(f);
            mapa[f+'||'+o] = (mapa[f+'||'+o]||0) + (d.valor_numero||0);
        });
        obras.sort(); forn.sort();
        var html = '<div class="table-responsive"><table><thead><tr><th>Fornecedor \\ Obra</th>';
        obras.forEach(function(o){ html += '<th>'+esc(o)+'</th>'; });
        html += '<th>Total</th></tr></thead><tbody>';
        var totCol = {};
        forn.forEach(function(f){
            var totLin = 0;
            html += '<tr><td style="font-weight:bold;">'+esc(f)+'</td>';
            obras.forEach(function(o){
                var v = mapa[f+'||'+o]||0; totLin += v; totCol[o]=(totCol[o]||0)+v;
                html += '<td>'+(v?fmt(v):'-')+'</td>';
            });
            html += '<td style="font-weight:bold;">'+fmt(totLin)+'</td></tr>';
        });
        html += '<tr style="background:#1a252f;"><td style="font-weight:bold;">Total</td>';
        var totGeral=0;
        obras.forEach(function(o){ totGeral+=(totCol[o]||0); html += '<td style="font-weight:bold; color:#f1c40f;">'+fmt(totCol[o]||0)+'</td>'; });
        html += '<td style="font-weight:bold; color:#f1c40f;">'+fmt(totGeral)+'</td></tr>';
        html += '</tbody></table></div>';
        document.getElementById('tabela-resumo-fornecedores').innerHTML = '<h3>Resumo Obra × Fornecedor</h3>' + html;
    };

    // =====================================================================
    // 3) EXPORTAR RELATÓRIOS → mesma tela do Relatório de Gastos por Obra
    // =====================================================================

    // =====================================================================
    // 4) RELATÓRIO GERAL DE OBRAS
    // =====================================================================
    var NOME_MESES_REL = {
        '01': 'Janeiro', '1': 'Janeiro', '02': 'Fevereiro', '2': 'Fevereiro',
        '03': 'Março', '3': 'Março', '04': 'Abril', '4': 'Abril',
        '05': 'Maio', '5': 'Maio', '06': 'Junho', '6': 'Junho',
        '07': 'Julho', '7': 'Julho', '08': 'Agosto', '8': 'Agosto',
        '09': 'Setembro', '9': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    function separarDataSeguraRel(dataString) {
        try {
            if (!dataString) return { ano: 'Outros', mes: 'Outros', dia: '??' };
            var iso = String(dataString).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (iso) return { ano: iso[1], mes: iso[2], dia: iso[3] };
            var br = String(dataString).trim().split(' ')[0].split('/');
            if (br.length >= 3) {
                var ano = br[2].length === 2 ? ('20' + br[2]) : br[2];
                return { ano: ano, mes: br[1], dia: br[0] };
            }
        } catch (e) {}
        return { ano: 'Outros', mes: 'Outros', dia: '??' };
    }

    function htmlCardDespesaRelGeralObra(d, isVencida) {
        var corBorda = isVencida ? '#dc3545' : '#ffc107';
        var corTexto = isVencida ? '#dc3545' : '#856404';
        var badgeFundo = isVencida ? '#f8d7da' : '#fff3cd';
        var textoBadge = isVencida ? '⚠️ VENCIDA' : '⏳ A VENCER';
        var vencTexto = formatarVencimentoRelDespHtml(d);
        var fotoHtml = d.foto_recibo
            ? '<img src="' + esc(d.foto_recibo) + '" onclick="window.despVerFoto(\'' + d.id + '\',\'obra\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        return ''
            + '<div class="resultado-item-rel-geral" style="border-left-color:' + corBorda + ';">'
            + fotoHtml
            + '<span style="font-size:10px;background:#e8edf2;color:#1a2a43;padding:2px 6px;border-radius:4px;font-weight:800;">🏪 FORNECEDOR</span> '
            + '<b style="color:' + corBorda + ';font-size:16px;">R$ ' + esc(String(d.valor_string || '0')) + '</b> '
            + '<span style="font-size:10px;background:' + badgeFundo + ';color:' + corTexto + ';padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:800;">' + textoBadge + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Obra:</b> ' + esc(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Fornecedor:</b> ' + esc(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Nota Fiscal:</b> ' + esc(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + '<span style="font-size:13px;color:' + corTexto + ';font-weight:700;"><b>Vencimento:</b> ' + vencTexto + '</span><br>'
            + '<span style="font-size:12px;color:#666;font-weight:600;">Inserido em: ' + esc(d.data || brDate(d.data_lancamento) || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;font-weight:600;">' + esc(String(d.descricao)) + '</div>' : '')
            + '</div>';
    }

    function htmlCardDespesaPagaRelGeralObra(d) {
        var fotoHtml = d.foto_recibo
            ? '<img src="' + esc(d.foto_recibo) + '" onclick="window.despVerFoto(\'' + d.id + '\',\'obra\')" style="width:60px;height:60px;object-fit:cover;border-radius:8px;border:2px solid #e0e6ed;float:right;cursor:pointer;">'
            : '';
        return ''
            + '<div class="resultado-item-rel-geral" style="border-left-color:#28a745;opacity:0.9;background:#f4fdf6;">'
            + fotoHtml
            + '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;font-weight:800;">🏪 FORNECEDOR</span> '
            + '<b style="color:#28a745;font-size:16px;">R$ ' + esc(String(d.valor_string || '0')) + '</b> '
            + '<span style="font-size:10px;background:#d4edda;color:#155724;padding:2px 6px;border-radius:4px;margin-left:5px;font-weight:800;">PAGO EM: ' + esc(d.data_pagamento || 'N/A') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Obra:</b> ' + esc(d.obra_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Fornecedor:</b> ' + esc(d.loja_nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Nota Fiscal:</b> ' + esc(d.nota_fiscal || 'Sem NF') + '</span><br>'
            + '<span style="font-size:12px;color:#666;font-weight:600;">Data Fatura: ' + esc(d.data || brDate(d.data_lancamento) || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;color:#444;font-weight:600;">' + esc(String(d.descricao)) + '</div>' : '')
            + '</div>';
    }

    function htmlCardTerceiroRelGeralObra(d) {
        return ''
            + '<div class="resultado-item-rel-geral" style="border-left-color:#1a2a43;background:#f8f9fb;">'
            + '<span style="font-size:10px;background:#1a2a43;color:#fff;padding:2px 6px;border-radius:4px;font-weight:800;">👷 TERCEIRO — PAGO</span> '
            + '<b style="color:#28a745;font-size:16px;">R$ ' + esc(String(d.valor_string || '0')) + '</b><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Profissional:</b> ' + esc(d.nome || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>Obra:</b> ' + esc(d.obra || '—') + '</span><br>'
            + '<span style="font-size:13px;color:#333;font-weight:700;"><b>CPF:</b> ' + esc(d.cpf || 'N/A') + ' · <b>Tel:</b> ' + esc(d.tel || 'N/A') + '</span><br>'
            + '<span style="font-size:12px;color:#666;font-weight:600;">Pago em: ' + esc(d.data || '—') + '</span>'
            + (d.descricao ? '<div style="font-size:12px;margin-top:5px;padding-top:5px;border-top:1px solid #eee;font-weight:600;">' + esc(String(d.descricao)) + '</div>' : '')
            + '</div>';
    }

    window.despToggleSecoesRelGeralObras = function (abrir) {
        var quadro = document.getElementById('rel-geral-obras-quadro');
        if (!quadro) return;
        quadro.querySelectorAll('details').forEach(function (det) {
            if (abrir) det.setAttribute('open', '');
            else det.removeAttribute('open');
        });
    };

    window.despCarregarRelatorioGeral = function(){
        var divSecoes = document.getElementById('rel-geral-obras-secoes');
        var divResumo = document.getElementById('rel-geral-obras-resumo');
        var divTotais = document.getElementById('rel-geral-obras-resumo-totais');
        var divDetalhe = document.getElementById('rel-geral-obras-resumo-detalhe');
        var divAcoes = document.getElementById('rel-geral-obras-acoes');

        if (!divSecoes) return;
        divSecoes.innerHTML = '<p style="text-align:center;color:#666;font-weight:700;padding:12px 0;">Carregando relatório geral...</p>';
        if (divResumo) divResumo.style.display = 'none';
        if (divAcoes) divAcoes.style.display = 'none';

        var despesas = loadDespesasGeralConsolidadas();
        var qObrasCad = load(K_OBRAS).length;
        var qRelCad = load(K_REL).length;
        var terceiros = load(K_TER).slice().sort(function(a,b){ return (b.timestamp||0)-(a.timestamp||0); });
        var pendentes = despesas.filter(function(d){ return !despStatusPago(d); });
        var pagas = despesas.filter(function(d){ return despStatusPago(d); });
        var listaVencidas = ordenarPorVenc(pendentes.filter(function(d){ return estaVencida(d); }).slice());
        var listaAVencer = ordenarPorVenc(pendentes.filter(ehPendenteAVencer).slice());

        var htmlVencidas = '';
        var htmlAVencer = '';
        var htmlPagasForn = '';
        var htmlPagasTerc = '';
        var somaVencidas = 0;
        var somaAVencer = 0;
        var somaPagasForn = 0;
        var somaPagasTerc = 0;

        listaVencidas.forEach(function(d){
            somaVencidas += (d.valor_numero || 0);
            htmlVencidas += htmlCardDespesaRelGeralObra(d, true);
        });
        listaAVencer.forEach(function(d){
            somaAVencer += (d.valor_numero || 0);
            htmlAVencer += htmlCardDespesaRelGeralObra(d, false);
        });

        var agrupadoPagas = {};
        pagas.forEach(function(d){
            somaPagasForn += (d.valor_numero || 0);
            var ref = separarDataSeguraRel(d.data_pagamento || d.data || d.data_lancamento);
            if (!agrupadoPagas[ref.ano]) agrupadoPagas[ref.ano] = {};
            if (!agrupadoPagas[ref.ano][ref.mes]) agrupadoPagas[ref.ano][ref.mes] = [];
            agrupadoPagas[ref.ano][ref.mes].push(d);
        });

        Object.keys(agrupadoPagas).sort(function(a,b){
            if (a === 'Outros') return 1;
            if (b === 'Outros') return -1;
            return Number(b) - Number(a);
        }).forEach(function(ano){
            htmlPagasForn += '<details class="pasta-ano"><summary>Ano ' + esc(ano) + '</summary><div class="folder-content">';
            Object.keys(agrupadoPagas[ano]).sort(function(a,b){
                if (a === 'Outros') return 1;
                if (b === 'Outros') return -1;
                return Number(b) - Number(a);
            }).forEach(function(mes){
                var nomeMes = NOME_MESES_REL[mes] || mes;
                htmlPagasForn += '<details class="pasta-mes"><summary>' + esc(nomeMes) + '</summary><div class="folder-content">';
                ordenarPorVenc(agrupadoPagas[ano][mes].slice()).forEach(function(d){
                    htmlPagasForn += htmlCardDespesaPagaRelGeralObra(d);
                });
                htmlPagasForn += '</div></details>';
            });
            htmlPagasForn += '</div></details>';
        });

        terceiros.forEach(function(d){
            somaPagasTerc += (d.valor_numero || 0);
            htmlPagasTerc += htmlCardTerceiroRelGeralObra(d);
        });

        var somaPagas = somaPagasForn + somaPagasTerc;
        var emAberto = somaVencidas + somaAVencer;
        var totalGeral = emAberto + somaPagas;

        window._dpUltimaGeral = {
            vencidas: listaVencidas, aVencer: listaAVencer, pagasForn: pagas, terceiros: terceiros,
            sVenc: somaVencidas, sAV: somaAVencer, sPagasForn: somaPagasForn, sTerc: somaPagasTerc,
            sPagas: somaPagas, emAberto: emAberto, totalGeral: totalGeral
        };

        if (divTotais) {
            divTotais.innerHTML = montarHtmlPainelResumoRelDespesas(somaVencidas, somaAVencer, somaPagas, 'Total Geral (Obras):', true);
        }
        if (divDetalhe) {
            divDetalhe.innerHTML = 'Em aberto (vencido + a vencer): <b>' + fmt(emAberto) + '</b>'
                + ' · Fornecedores pagos: <b>' + fmt(somaPagasForn) + '</b>'
                + ' · Terceiros pagos: <b>' + fmt(somaPagasTerc) + '</b>'
                + ' · <b>' + despesas.length + '</b> despesa(s)'
                + (qObrasCad ? ' (' + qObrasCad + ' em obras' + (qRelCad ? ' + ' + qRelCad + ' no relatório exportável' : '') + ')' : (qRelCad ? ' (' + qRelCad + ' no relatório exportável)' : ''))
                + ' · <b>' + terceiros.length + '</b> terceiro(s) · Total geral: <b>' + fmt(totalGeral) + '</b>';
        }
        if (divResumo) divResumo.style.display = 'block';
        if (divAcoes) divAcoes.style.display = 'flex';

        if (!despesas.length && !terceiros.length) {
            divSecoes.innerHTML = '<p style="text-align:center;color:#212529;font-weight:700;padding:20px;">Nenhum registro cadastrado.<br><span style="font-size:12px;font-weight:600;color:#666;">Cadastre em <b>Adicionar Despesas</b> ou em <b>Terceiros</b>.</span></p>';
            if (divResumo) divResumo.style.display = 'none';
            if (divAcoes) divAcoes.style.display = 'none';
            return;
        }

        var htmlSecoes = '<div id="rel-geral-obras-quadro">';

        htmlSecoes += '<details class="secao-despesas-busca secao-vencidas" open>'
            + '<summary>' + bolinhaResumoHtml('#dc3545') + ' Em aberto — Vencido (' + listaVencidas.length + ') — ' + fmt(somaVencidas) + ' <span class="secao-seta">▲</span></summary>'
            + '<div class="secao-despesas-conteudo">'
            + (htmlVencidas || '<p style="text-align:center;color:#888;padding:12px;font-weight:600;">Nenhuma despesa vencida.</p>')
            + '</div></details>';

        htmlSecoes += '<details class="secao-despesas-busca secao-avencer" open>'
            + '<summary>' + bolinhaResumoHtml('#ffc107') + ' A vencer — No prazo (' + listaAVencer.length + ') — ' + fmt(somaAVencer) + ' <span class="secao-seta">▲</span></summary>'
            + '<div class="secao-despesas-conteudo">'
            + (htmlAVencer || '<p style="text-align:center;color:#888;padding:12px;font-weight:600;">Nenhuma despesa a vencer.</p>')
            + '</div></details>';

        htmlSecoes += '<details class="secao-despesas-busca secao-pagas">'
            + '<summary>' + bolinhaResumoHtml('#28a745') + ' Já pago (' + (pagas.length + terceiros.length) + ') — ' + fmt(somaPagas) + ' <span class="secao-seta">▲</span></summary>'
            + '<div class="secao-despesas-conteudo">';

        htmlSecoes += '<details class="pasta-ano"><summary>🏪 Despesas de fornecedores (' + pagas.length + ') — ' + fmt(somaPagasForn) + '</summary><div class="folder-content">'
            + (htmlPagasForn || '<p style="text-align:center;color:#888;padding:12px;font-weight:600;">Nenhuma despesa de fornecedor paga.</p>')
            + '</div></details>';

        htmlSecoes += '<details class="pasta-ano"><summary>👷 Pagamentos a terceiros (' + terceiros.length + ') — ' + fmt(somaPagasTerc) + '</summary><div class="folder-content">'
            + (htmlPagasTerc || '<p style="text-align:center;color:#888;padding:12px;font-weight:600;">Nenhum pagamento a terceiro registado.</p>')
            + '</div></details>';

        htmlSecoes += '</div></details></div>';
        divSecoes.innerHTML = htmlSecoes;
    };

    // =====================================================================
    // 5) TERCEIROS
    // =====================================================================
    window.despInitTerceiros = function(){ atualizarDatalists(); window.despBuscarTerceiros(true); };

    window.despSalvarTerceiro = function(){
        var nome = (document.getElementById('t-nome').value||'').trim();
        var cpf = (document.getElementById('t-cpf').value||'').trim();
        var tel = (document.getElementById('t-tel').value||'').trim();
        var obra = (document.getElementById('t-obra').value||'').trim();
        var valor = document.getElementById('t-valor').value;
        var desc = (document.getElementById('t-desc').value||'').trim();
        if(!nome || !obra || !valor){ alert('Preencha Nome, Obra e Valor!'); return; }
        var arr = load(K_TER);
        arr.push({
            id: novoId(), nome: nome, nome_lower: nome.toLowerCase(), cpf: cpf, tel: tel,
            obra: obra, obra_lower: obra.toLowerCase(), valor_string: valor, valor_numero: parseMoeda(valor),
            descricao: desc, data: hojeBr(), timestamp: Date.now()
        });
        save(K_TER, arr);
        alert('Pagamento a terceiro registrado!');
        ['t-nome','t-cpf','t-tel','t-obra','t-valor','t-desc'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
        atualizarDatalists();
        window.despBuscarTerceiros(true);
    };

    window.despBuscarTerceiros = function(mostrarTodos){
        var termo = norm(document.getElementById('busca-terceiro').value);
        if(!mostrarTodos && !termo){ alert('Digite o nome da obra ou do profissional.'); return; }
        var lista = load(K_TER).filter(function(d){
            if(mostrarTodos) return true;
            return (d.obra_lower||'').indexOf(termo)>-1 || (d.nome_lower||'').indexOf(termo)>-1;
        }).sort(function(a,b){ return (b.timestamp||0)-(a.timestamp||0); });
        var div = document.getElementById('lista-terceiros-resultados');
        if(!lista.length){ div.innerHTML = '<p style="text-align:center; color:#95a5a6;">Nenhum registro encontrado.</p>'; return; }
        var total = lista.reduce(function(s,d){ return s+(d.valor_numero||0); },0);
        var html = '<div style="text-align:center; margin-bottom:12px; padding:10px; background:#1a252f; border-radius:8px; color:#ecf0f1;">Total nesta busca: <b style="color:#f1c40f; font-size:16px;">'+fmt(total)+'</b></div>';
        html += '<div class="table-responsive"><table><thead><tr><th>Profissional</th><th>CPF</th><th>Contato</th><th>Obra / Local / Cliente</th><th>Valor</th><th>Data</th><th>Ações</th></tr></thead><tbody>';
        lista.forEach(function(d){
            html += '<tr>'
                + '<td>'+esc(d.nome)+(d.descricao?'<br><small style="color:#95a5a6;">'+esc(d.descricao)+'</small>':'')+'</td>'
                + '<td>'+esc(d.cpf||'-')+'</td>'
                + '<td>'+esc(d.tel||'-')+'</td>'
                + '<td>'+esc(d.obra)+'</td>'
                + '<td style="font-weight:bold;">'+fmt(d.valor_numero)+'</td>'
                + '<td>'+esc(d.data||'-')+'</td>'
                + '<td style="white-space:nowrap;"><button class="btn-secundario" style="padding:4px 8px; font-size:10px; background-color:#e67e22;" onclick="window.despEditar(\''+d.id+'\',\'ter\')">✏️</button> <button class="btn-danger" style="padding:4px 8px; font-size:10px;" onclick="window.despExcluir(\''+d.id+'\',\'ter\')">🗑️</button></td>'
                + '</tr>';
        });
        html += '</tbody></table></div>';
        div.innerHTML = html;
    };

    // =====================================================================
    // AÇÕES COMUNS: pago, excluir, editar, ver foto
    // =====================================================================
    function keyDe(tipo){ return tipo==='obra' ? K_OBRAS : (tipo==='rel' ? K_REL : K_TER); }
    function recarrega(tipo){
        if(tipo==='obra') window.despBuscarDespesasObra(!norm(document.getElementById('busca-obra').value), true);
        else if(tipo==='rel') window.despBuscarDespesasObra(true);
        else window.despBuscarTerceiros(true);
    }
    window.despTogglePago = function(id, tipo){
        var key = keyDe(tipo); var arr = load(key);
        var d = arr.filter(function(x){ return x.id===id; })[0];
        if(!d) return;
        if(d.status==='pago'){ d.status='pendente'; delete d.data_pagamento; }
        else { d.status='pago'; d.data_pagamento = hojeBr(); }
        save(key, arr); recarrega(tipo);
        if (window.monitorarVencimentosObrasFh) window.monitorarVencimentosObrasFh();
    };
    window.despExcluir = function(id, tipo){
        if(!confirm('Tem certeza que deseja excluir este registro?')) return;
        var key = keyDe(tipo);
        save(key, load(key).filter(function(x){ return x.id!==id; }));
        recarrega(tipo); atualizarDatalists();
    };
    window.despVerFoto = function(id, tipo){
        var d = load(keyDe(tipo)).filter(function(x){ return x.id===id; })[0];
        if(!d || !d.foto_recibo){ alert('Sem foto anexada.'); return; }
        var w = window.open('', '', 'width=700,height=800');
        w.document.write('<title>Recibo</title><body style="margin:0; background:#111; text-align:center;"><img src="'+d.foto_recibo+'" style="max-width:100%;"></body>');
        w.document.close();
    };
    window.despEditar = function(id, tipo){
        var key = keyDe(tipo); var arr = load(key);
        var d = arr.filter(function(x){ return x.id===id; })[0];
        if(!d) return;
        abrirModalEdicao(d, tipo, function(){ save(key, arr); recarrega(tipo); atualizarDatalists(); });
    };

    function campo(label, id, valor, tipoInput){
        return '<label style="display:block; margin-top:8px; color:#bdc3c7; font-size:12px;">'+label+'</label>'
            + '<input type="'+(tipoInput||'text')+'" id="'+id+'" value="'+esc(valor==null?'':valor)+'" style="width:100%; padding:8px; border-radius:6px; border:1px solid #7f8c8d; background:#2c3e50; color:#fff;">';
    }
    function camposEnderecoEdicao(d) {
        d = d || {};
        return campo('CPF / CNPJ','edt-cpf-cnpj', d.cpf_cnpj)
            + campo('CEP','edt-cep', d.cep)
            + campo('Endereço','edt-endereco', d.endereco)
            + campo('Número','edt-numero', d.numero)
            + campo('Bairro','edt-bairro', d.bairro);
    }
    function aplicarEnderecoEdicao(d, val) {
        d.cpf_cnpj = (val('edt-cpf-cnpj') || '').trim();
        d.cep = (val('edt-cep') || '').trim();
        d.endereco = (val('edt-endereco') || '').trim();
        d.numero = (val('edt-numero') || '').trim();
        d.bairro = (val('edt-bairro') || '').trim();
        d.endereco_busca = norm([d.endereco, d.bairro, d.numero, d.cep, d.cpf_cnpj].join(' '));
    }
    function abrirModalEdicao(d, tipo, onSave){
        var old = document.getElementById('despModalEdicao'); if(old) old.remove();
        var campos = '';
        if(tipo==='ter'){
            campos += campo('Nome','edt-nome',d.nome)
                + campo('CPF','edt-cpf',d.cpf)
                + campo('Telefone','edt-tel',d.tel)
                + campo('Obra / Local / Cliente','edt-obra',d.obra)
                + campo('Valor (R$)','edt-valor',d.valor_string)
                + campo('Descrição','edt-desc',d.descricao);
        } else {
            campos += campo('Obra / Local / Cliente','edt-obra',d.obra_nome)
                + camposEnderecoEdicao(d)
                + campo('Fornecedor','edt-loja',d.loja_nome)
                + campo('Nota Fiscal','edt-nf',d.nota_fiscal)
                + campo('Cheque/Boleto','edt-cheque',d.cheque_boleto_num)
                + campo('Lançamento','edt-lanc',d.data_lancamento,'date')
                + campo('Vencimento','edt-venc',d.data_vencimento,'date')
                + campo('Valor (R$)','edt-valor',d.valor_string)
                + campo('Descrição','edt-desc',d.descricao)
                + campo('Observação','edt-obs',d.observacao);
        }
        var wrap = document.createElement('div');
        wrap.id = 'despModalEdicao';
        wrap.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;';
        wrap.innerHTML = '<div style="background:#1a252f; border:1px solid #7f8c8d; border-radius:10px; padding:20px; max-width:560px; width:100%; max-height:90vh; overflow:auto;">'
            + '<h3 style="margin-top:0; color:#e67e22;">✏️ Editar registro</h3>'
            + campos
            + '<div style="display:flex; gap:10px; margin-top:16px;">'
            + '<button class="btn-primary" style="flex:1; padding:10px; background-color:#27ae60;" id="edt-salvar">Salvar</button>'
            + '<button class="btn-secundario" style="flex:1; padding:10px; background-color:#7f8c8d;" onclick="document.getElementById(\'despModalEdicao\').remove()">Cancelar</button>'
            + '</div></div>';
        document.body.appendChild(wrap);
        document.getElementById('edt-salvar').onclick = function(){
            function val(id){ var el=document.getElementById(id); return el?el.value:''; }
            if(tipo==='ter'){
                d.nome = (val('edt-nome')||'').trim(); d.nome_lower = d.nome.toLowerCase();
                d.cpf = val('edt-cpf'); d.tel = val('edt-tel');
                d.obra = (val('edt-obra')||'').trim(); d.obra_lower = d.obra.toLowerCase();
                d.valor_string = val('edt-valor'); d.valor_numero = parseMoeda(d.valor_string);
                d.descricao = val('edt-desc');
            } else {
                d.obra_nome = canon(val('edt-obra')); d.obra_lower = norm(d.obra_nome);
                d.loja_nome = canon(val('edt-loja')); d.loja_lower = norm(d.loja_nome);
                aplicarEnderecoEdicao(d, val);
                d.nota_fiscal = val('edt-nf');
                d.data_vencimento = val('edt-venc'); d.data_vencimento_ts = vencTs(d.data_vencimento);
                d.valor_string = val('edt-valor'); d.valor_numero = parseMoeda(d.valor_string);
                d.descricao = val('edt-desc');
                d.cheque_boleto_num = val('edt-cheque');
                d.data_lancamento = val('edt-lanc'); d.data = brDate(d.data_lancamento);
                d.observacao = val('edt-obs');
            }
            document.getElementById('despModalEdicao').remove();
            if(onSave) onSave();
        };
    }

    // =====================================================================
    // EXPORTAÇÃO PDF / EXCEL
    // =====================================================================
    function rotuloPrazoExportDespesas(prazo) {
        if (prazo === '10') return 'Próximos 10 dias';
        if (prazo === '30') return 'Próximos 30 dias';
        return 'Total';
    }

    function sufixoPrazoExportDespesas(prazo) {
        if (prazo === '10') return '_10D';
        if (prazo === '30') return '_30D';
        return '_TOTAL';
    }

    function filtrarDespesasPorPrazoExportacao(arr, prazo) {
        var lista = (arr || []).slice();
        if (!prazo || prazo === 'total') return lista;
        var dias = prazo === '10' ? 10 : 30;
        var hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        var limite = new Date(hoje.getTime());
        limite.setDate(limite.getDate() + dias);
        var tsLimite = limite.getTime();
        return lista.filter(function(d) {
            if (despStatusPago(d)) return false;
            var ts = vencimentoTsDespesa(d);
            if (ts == null) return false;
            return ts <= tsLimite;
        });
    }

    function filtrarPackGeralPorPrazoExportacao(g, prazo) {
        if (!g) return null;
        if (!prazo || prazo === 'total') return g;
        var dias = prazo === '10' ? 10 : 30;
        var hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        var limite = new Date(hoje.getTime());
        limite.setDate(limite.getDate() + dias);
        var tsLimite = limite.getTime();
        function passaFiltroVenc(d) {
            if (despStatusPago(d)) return false;
            var ts = vencimentoTsDespesa(d);
            if (ts == null) return false;
            return ts <= tsLimite;
        }
        var vencidas = (g.vencidas || []).filter(passaFiltroVenc);
        var aVencer = (g.aVencer || []).filter(passaFiltroVenc);
        var somaVencidas = vencidas.reduce(function(s, d) { return s + (d.valor_numero || 0); }, 0);
        var somaAVencer = aVencer.reduce(function(s, d) { return s + (d.valor_numero || 0); }, 0);
        return {
            vencidas: vencidas,
            aVencer: aVencer,
            pagasForn: [],
            terceiros: [],
            somaVencidas: somaVencidas,
            somaAVencer: somaAVencer,
            somaPagasForn: 0,
            somaPagasTerc: 0,
            somaPagas: 0,
            emAberto: somaVencidas + somaAVencer,
            totalGeral: somaVencidas + somaAVencer
        };
    }

    function perguntarPrazoExportDespesas(tipo) {
        return new Promise(function(resolve) {
            var old = document.getElementById('despModalPrazoExport');
            if (old) old.remove();
            var wrap = document.createElement('div');
            wrap.id = 'despModalPrazoExport';
            wrap.className = 'modal modal-prazo-export';
            wrap.style.display = 'flex';
            var intro = (tipo === 'geral')
                ? 'Escolha o período para o espelho do Relatório Geral (com base na data de vencimento das pendências):'
                : 'Escolha quais vencimentos incluir no PDF/Excel (com base na data de vencimento):';
            wrap.innerHTML = ''
                + '<div class="modal-content">'
                + '<h3>📅 Período para exportar</h3>'
                + '<p class="modal-prazo-intro">' + intro + '</p>'
                + '<label class="modal-prazo-opcao"><input type="radio" name="prazo-export-rel" value="10" checked> <b>10 D</b> <span>— pendentes/vencidas com vencimento até 10 dias</span></label>'
                + '<label class="modal-prazo-opcao"><input type="radio" name="prazo-export-rel" value="30"> <b>30 D</b> <span>— pendentes/vencidas com vencimento até 30 dias</span></label>'
                + '<label class="modal-prazo-opcao"><input type="radio" name="prazo-export-rel" value="total"> <b>TOTAL</b> <span>— tudo carregado no relatório</span></label>'
                + '<div class="modal-prazo-acoes">'
                + '<button type="button" class="btn-prazo-export-cancelar">Cancelar</button>'
                + '<button type="button" class="btn-prazo-export-confirmar">Exportar</button>'
                + '</div></div>';
            document.body.appendChild(wrap);
            wrap.addEventListener('click', function(e) {
                if (e.target === wrap) { wrap.remove(); resolve(null); }
            });
            wrap.querySelector('.btn-prazo-export-cancelar').onclick = function() {
                wrap.remove();
                resolve(null);
            };
            wrap.querySelector('.btn-prazo-export-confirmar').onclick = function() {
                var sel = wrap.querySelector('input[name="prazo-export-rel"]:checked');
                if (!sel) {
                    alert('Selecione um período: 10 D, 30 D ou TOTAL.');
                    return;
                }
                var valor = sel.value;
                wrap.remove();
                resolve(valor);
            };
        });
    }

    function datasetExport(tipo, prazo){
        if(tipo==='obra'){
            var l = window._dpUltimaBuscaObra || [];
            return { titulo:'Relatório de Gastos por Obra',
                cols:['Obra / Local / Cliente','Fornecedor','NF','Vencimento','Valor','Status'],
                linhas: l.map(function(d){ return [d.obra_nome, d.loja_nome, d.nota_fiscal||'-', brDate(d.data_vencimento)||'-', fmt(d.valor_numero), statusLabel(d)]; }),
                total: l.reduce(function(s,d){ return s+(d.valor_numero||0); },0) };
        }
        if(tipo==='rel'){
            var r = filtrarDespesasPorPrazoExportacao(window._dpUltimaRel || [], prazo);
            var tituloRel = 'Relatório de Despesas';
            if (prazo && prazo !== 'total') tituloRel += ' — ' + rotuloPrazoExportDespesas(prazo);
            return { titulo: tituloRel,
                cols:['Obra / Local / Cliente','Fornecedor','Cheque/Boleto','NF','Lançamento','Vencimento','Valor','Status','Observação'],
                linhas: r.map(function(d){ return [d.obra_nome, d.loja_nome, d.cheque_boleto_num||'-', d.nota_fiscal||'-', brDate(d.data_lancamento)||'-', brDate(d.data_vencimento)||'-', fmt(d.valor_numero), statusLabel(d), d.observacao||'']; }),
                total: r.reduce(function(s,d){ return s+(d.valor_numero||0); },0),
                sufixo: sufixoPrazoExportDespesas(prazo || 'total') };
        }
        // geral
        var g = window._dpUltimaGeral;
        if(!g){ window.despCarregarRelatorioGeral(); g = window._dpUltimaGeral; }
        g = filtrarPackGeralPorPrazoExportacao(g, prazo);
        var linhas = [];
        g.vencidas.forEach(function(d){ linhas.push(['VENCIDO', d.obra_nome, d.loja_nome, brDate(d.data_vencimento)||'-', fmt(d.valor_numero)]); });
        g.aVencer.forEach(function(d){ linhas.push(['A VENCER', d.obra_nome, d.loja_nome, brDate(d.data_vencimento)||'-', fmt(d.valor_numero)]); });
        if (!prazo || prazo === 'total') {
            g.pagasForn.forEach(function(d){ linhas.push(['PAGO (Fornecedor)', d.obra_nome, d.loja_nome, d.data_pagamento||d.data||'-', fmt(d.valor_numero)]); });
            g.terceiros.forEach(function(d){ linhas.push(['PAGO (Terceiro)', d.obra, d.nome, d.data||'-', fmt(d.valor_numero)]); });
        }
        var tituloGeral = 'Relatório Geral de Obras';
        if (prazo && prazo !== 'total') tituloGeral += ' — ' + rotuloPrazoExportDespesas(prazo);
        return { titulo: tituloGeral,
            cols:['Categoria','Obra / Local / Cliente','Fornecedor/Nome','Data','Valor'],
            linhas: linhas, total: g.totalGeral,
            sufixo: sufixoPrazoExportDespesas(prazo || 'total') };
    }

    function executarDespExportarPDF(tipo, prazo) {
        var ds = datasetExport(tipo, prazo);
        if(!ds.linhas.length){
            alert('Nenhum registro para exportar no período "' + rotuloPrazoExportDespesas(prazo || 'total') + '".');
            return;
        }
        var thead = ds.cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('');
        var tbody = ds.linhas.map(function(row){ return '<tr>'+row.map(function(c){ return '<td>'+esc(c)+'</td>'; }).join('')+'</tr>'; }).join('');
        var html = '<html><head><meta charset="UTF-8"><title>'+esc(ds.titulo)+'</title><style>'
            + '@page{size:A4 landscape; margin:10mm;} body{font-family:sans-serif; font-size:11px; color:#222;} h2{margin:0 0 4px 0;} table{width:100%; border-collapse:collapse; margin-top:10px;} th,td{border:1px solid #ccc; padding:6px; text-align:left;} th{background:#2c3e50; color:#fff; text-transform:uppercase; font-size:10px;} .tot{margin-top:14px; font-size:14px; font-weight:bold; text-align:right;} .no-print{margin-top:14px;} @media print{.no-print{display:none;}}'
            + '</style></head><body>'
            + '<h2>'+esc(ds.titulo)+'</h2><div style="color:#666;">Gerado em '+new Date().toLocaleString('pt-BR')+'</div>'
            + '<table><thead><tr>'+thead+'</tr></thead><tbody>'+tbody+'</tbody></table>'
            + '<div class="tot">TOTAL: '+fmt(ds.total)+'</div>'
            + '<div class="no-print"><button onclick="window.print()" style="padding:10px 16px; font-size:13px; font-weight:bold; background:#2980b9; color:#fff; border:none; border-radius:6px; cursor:pointer;">🖨️ Imprimir / Salvar PDF</button></div>'
            + '</body></html>';
        var w = window.open('', '', 'width=1000,height=750');
        w.document.write(html); w.document.close();
    }

    function executarDespExportarExcel(tipo, prazo) {
        var ds = datasetExport(tipo, prazo);
        if(!ds.linhas.length){
            alert('Nenhum registro para exportar no período "' + rotuloPrazoExportDespesas(prazo || 'total') + '".');
            return;
        }
        var thead = ds.cols.map(function(c){ return '<th>'+esc(c)+'</th>'; }).join('');
        var tbody = ds.linhas.map(function(row){ return '<tr>'+row.map(function(c){ return '<td>'+esc(c)+'</td>'; }).join('')+'</tr>'; }).join('');
        var tabela = '<table border="1"><thead><tr><th colspan="'+ds.cols.length+'">'+esc(ds.titulo)+' — '+new Date().toLocaleString('pt-BR')+'</th></tr><tr>'+thead+'</tr></thead><tbody>'+tbody
            + '<tr><td colspan="'+(ds.cols.length-1)+'"><b>TOTAL</b></td><td><b>'+fmt(ds.total)+'</b></td></tr>'
            + '</tbody></table>';
        var html = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>'+tabela+'</body></html>';
        var blob = new Blob(['\ufeff'+html], {type:'application/vnd.ms-excel;charset=utf-8'});
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = ds.titulo.replace(/[^\w]+/g,'-') + (ds.sufixo || '') + '-' + hojeIso() + '.xls';
        document.body.appendChild(a); a.click();
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 100);
    }

    window.despExportarPDF = function(tipo){
        if (tipo === 'rel') {
            if (!(window._dpUltimaRel || []).length) {
                alert('Nada para exportar. Clique em "Carregar tabela" primeiro.');
                return;
            }
            perguntarPrazoExportDespesas('rel').then(function(prazo) {
                if (!prazo) return;
                executarDespExportarPDF('rel', prazo);
            });
            return;
        }
        if (tipo === 'geral') {
            if (!window._dpUltimaGeral) {
                alert('Nada para exportar. Clique em "Atualizar Relatório Geral" primeiro.');
                return;
            }
            perguntarPrazoExportDespesas('geral').then(function(prazo) {
                if (!prazo) return;
                executarDespExportarPDF('geral', prazo);
            });
            return;
        }
        executarDespExportarPDF(tipo, 'total');
    };

    window.despExportarExcel = function(tipo){
        if (tipo === 'rel') {
            if (!(window._dpUltimaRel || []).length) {
                alert('Nada para exportar. Clique em "Carregar tabela" primeiro.');
                return;
            }
            perguntarPrazoExportDespesas('rel').then(function(prazo) {
                if (!prazo) return;
                executarDespExportarExcel('rel', prazo);
            });
            return;
        }
        if (tipo === 'geral') {
            if (!window._dpUltimaGeral) {
                alert('Nada para exportar. Clique em "Atualizar Relatório Geral" primeiro.');
                return;
            }
            perguntarPrazoExportDespesas('geral').then(function(prazo) {
                if (!prazo) return;
                executarDespExportarExcel('geral', prazo);
            });
            return;
        }
        executarDespExportarExcel(tipo, 'total');
    };

    // =====================================================================
    // ALERTAS DE VENCIMENTO (despesas) — igual Gestor 360
    // =====================================================================
    var K_ALERTA_SOM = 'FH_ALERTA_VENCIMENTO_SOM';
    var _intervalAlertasFh = null;

    function alertaSomFhAtivo() {
        return localStorage.getItem(K_ALERTA_SOM) !== '0';
    }

    function chaveAlertaSilenciadoFh(idDoc, dataStr) {
        return 'FH_alerta_sil_' + idDoc + '_' + dataStr;
    }

    function escAttr(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatarVencimentoAlertaFh(d) {
        var ts = vencimentoTsDespesa(d);
        if (ts != null) return formatTsBr(ts);
        var t = brDate(d.data_vencimento);
        return t || '—';
    }

    function sistemaFhLogado() {
        if (!window.usuarioLogado) return false;
        var main = document.getElementById('appMainContent');
        return main && main.style.display !== 'none';
    }

    function ensureAlertaStackFh() {
        var stack = document.getElementById('alerta-stack-global');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'alerta-stack-global';
            document.body.appendChild(stack);
        }
        var container = document.getElementById('alerta-container-global');
        if (!container) {
            container = document.createElement('div');
            container.id = 'alerta-container-global';
            container.style.cssText = 'padding:0; max-width:100%;';
            stack.appendChild(container);
        } else if (container.parentElement !== stack) {
            stack.appendChild(container);
        }
        stack.style.display = 'flex';
        return stack;
    }

    function tocarSomAlertaVencimentoFh() {
        var audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(function () {});
    }

    function montarPainelAlertaFh(id, loja, obra, desc, titulo, tipo, temNota, valor, vencimento) {
        var corTema = tipo === 'urgente' ? '#d9534f' : '#f0ad4e';
        var idEsc = escAttr(id);
        var lojaEsc = esc(loja);
        var obraEsc = esc(obra);
        var descEsc = esc(desc);
        var valorEsc = esc(valor || '');
        var vencEsc = esc(vencimento || '');
        var valorTxt = valorEsc.indexOf('R$') === 0 ? valorEsc : 'R$ ' + valorEsc;
        var btnNota = temNota
            ? '<button type="button" onclick="window.visualizarNotaAlertaVencimentoFh(\'' + idEsc + '\')" style="background:#4285F4;color:#fff;border:none;border-radius:6px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;width:100%;">📄 VER NOTA</button>'
            : '<span style="display:block;font-size:10px;color:#999;text-align:center;padding:4px 0;">Sem nota anexada</span>';
        return '<div id="card-alerta-' + idEsc + '" class="card-alerta-venc" style="border-left:8px solid ' + corTema + ';">'
            + '<div style="flex:1; min-width:0;">'
            + '<b style="color:' + corTema + '; font-size:14px; display:block; margin-bottom:6px;">' + esc(titulo) + '</b>'
            + '<span style="color:#666; font-size:11px; text-transform:uppercase; font-weight:800; display:block; margin-bottom:2px;">🏗️ OBRA: ' + obraEsc + '</span>'
            + '<span style="color:#666; font-size:11px; text-transform:uppercase; font-weight:800; display:block; margin-bottom:4px;">🏢 LOJA: ' + lojaEsc + '</span>'
            + '<span style="color:#d9534f; font-weight:700; font-size:13px; display:block; margin-bottom:2px;">' + valorTxt + '</span>'
            + '<span style="color:#666; font-size:11px; display:block; margin-bottom:4px;">📅 Venc.: ' + vencEsc + '</span>'
            + '<span style="color:#1a2a43; font-weight:600; font-size:13px; line-height:1.2; display:block;">' + descEsc + '</span>'
            + '</div>'
            + '<div style="display:flex; flex-direction:column; gap:8px; flex-shrink:0; min-width:88px;">'
            + btnNota
            + '<button type="button" onclick="window.confirmarLeituraAlertaFh(\'' + idEsc + '\')" style="background:#f8f9fa; border:1px solid #ddd; border-radius:6px; padding:6px 12px; font-weight:700; cursor:pointer; color:#333;">OK</button>'
            + '</div></div>';
    }

    function renderizarAlertasNoCantoFh(conteudo, som) {
        ensureAlertaStackFh();
        var container = document.getElementById('alerta-container-global');
        if (!container) return;
        var qtd = (conteudo.match(/card-alerta-/g) || []).length;
        var minimizado = sessionStorage.getItem('fh_alertas_painel_minimizado') === '1';
        container.style.display = 'block';
        container.innerHTML = ''
            + '<div class="alerta-barra-minimizada" style="display:' + (minimizado ? 'flex' : 'none') + '; align-items:center; gap:8px; background:#1a2a43; color:#fff; padding:10px 14px; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.2);">'
            + '<span style="font-weight:700; font-size:13px; flex:1; cursor:pointer;" onclick="window.togglePainelAlertasMinimizadoFh()" title="Clique para expandir">🔔 <span class="alerta-contagem-qtd">' + qtd + '</span> vencimento(s)</span>'
            + '<button type="button" class="alerta-btn-imprimir" onclick="event.stopPropagation(); window.imprimirRelatorioAlertasVencimentoFh()" title="Imprimir relatório">🖨️</button>'
            + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasFh()" title="Silenciar todos">Fechar</button>'
            + '<button type="button" onclick="window.togglePainelAlertasMinimizadoFh()" style="background:#fff; color:#1a2a43; border:none; border-radius:6px; padding:4px 10px; font-weight:700; font-size:12px; cursor:pointer;">Expandir</button>'
            + '</div>'
            + '<div class="alerta-painel-wrapper" style="display:' + (minimizado ? 'none' : 'block') + ';">'
            + '<div class="alerta-painel-header">'
            + '<span class="alerta-painel-header-titulo">⚠️ Vencimentos (<span class="alerta-contagem-qtd">' + qtd + '</span>)</span>'
            + '<div class="alerta-painel-header-acoes">'
            + '<button type="button" class="alerta-btn-fechar" onclick="window.confirmarLeituraTodosAlertasFh()" title="Silenciar todos os alertas de hoje">Fechar tudo</button>'
            + '<button type="button" class="alerta-btn-imprimir" onclick="window.imprimirRelatorioAlertasVencimentoFh()" title="Imprimir relatório">🖨️ Imprimir</button>'
            + '<button type="button" class="alerta-btn-minimizar" onclick="window.togglePainelAlertasMinimizadoFh()" title="Minimizar painel">−</button>'
            + '</div></div>'
            + '<div class="alerta-painel-corpo">' + conteudo + '</div>'
            + '</div>';
        if (som && alertaSomFhAtivo() && !minimizado) tocarSomAlertaVencimentoFh();
    }

    function atualizarContagemPainelAlertasFh() {
        var cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
        if (!cards.length) {
            var container = document.getElementById('alerta-container-global');
            if (container) { container.innerHTML = ''; container.style.display = 'none'; }
            sessionStorage.removeItem('fh_alertas_painel_minimizado');
            return;
        }
        var qtd = cards.length;
        document.querySelectorAll('.alerta-contagem-qtd').forEach(function (el) {
            el.textContent = String(qtd);
        });
    }

    function monitorarVencimentosObrasFh() {
        var containerAlerta = document.getElementById('alerta-container-global');
        if (!sistemaFhLogado()) {
            if (containerAlerta) containerAlerta.style.display = 'none';
            var stack = document.getElementById('alerta-stack-global');
            if (stack) stack.style.display = 'none';
            return;
        }
        ensureAlertaStackFh();
        if (containerAlerta) containerAlerta.style.display = 'block';
        window._mapAlertasDespesasFh = {};
        var hojeFormatado = new Date().toISOString().substring(0, 10);
        var hojeMeioDia = new Date();
        hojeMeioDia.setHours(12, 0, 0, 0);
        var filaAlertas = [];
        var emitirSom = false;
        loadDespesasGeralConsolidadas().forEach(function (dados) {
            var idDoc = dados.id;
            if (!idDoc || despStatusPago(dados)) return;
            var tsVenc = vencimentoTsDespesa(dados);
            if (tsVenc == null) return;
            var diffMs = tsVenc - hojeMeioDia.getTime();
            var diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (localStorage.getItem(chaveAlertaSilenciadoFh(idDoc, hojeFormatado))) return;
            var tituloAlerta = '';
            var classeUrgencia = '';
            if (diasRestantes === 0) {
                tituloAlerta = 'VENCE HOJE';
                classeUrgencia = 'urgente';
                emitirSom = true;
            } else if (diasRestantes > 0 && diasRestantes <= 3) {
                tituloAlerta = 'VENCE EM ' + diasRestantes + ' DIA(S)';
                classeUrgencia = 'aviso';
                emitirSom = true;
            } else if (diasRestantes < 0) {
                tituloAlerta = 'VENCIDO';
                classeUrgencia = 'urgente';
                emitirSom = true;
            }
            if (!tituloAlerta) return;
            var nomeLoja = dados.loja_nome || dados.loja || 'Fornecedor não informado';
            var nomeObra = dados.obra_nome || dados.obra || 'Obra não informada';
            var nomeDespesa = dados.descricao || 'Sem descrição';
            var valorAlerta = dados.valor_string || fmt(dados.valor_numero || 0);
            var vencAlerta = formatarVencimentoAlertaFh(dados);
            var temNota = Boolean(dados.foto_recibo);
            window._mapAlertasDespesasFh[idDoc] = dados;
            filaAlertas.push({
                ts: tsVenc,
                html: montarPainelAlertaFh(idDoc, nomeLoja, nomeObra, nomeDespesa, tituloAlerta, classeUrgencia, temNota, valorAlerta, vencAlerta)
            });
        });
        filaAlertas.sort(function (a, b) { return a.ts - b.ts; });
        var htmlAlertas = filaAlertas.map(function (a) { return a.html; }).join('');
        if (htmlAlertas) {
            renderizarAlertasNoCantoFh(htmlAlertas, emitirSom);
        } else if (containerAlerta) {
            containerAlerta.innerHTML = '';
            containerAlerta.style.display = 'none';
        }
    }

    window.monitorarVencimentosObrasFh = monitorarVencimentosObrasFh;

    window.confirmarLeituraAlertaFh = function (id) {
        var hj = new Date().toISOString().substring(0, 10);
        localStorage.setItem(chaveAlertaSilenciadoFh(id, hj), 'true');
        var el = document.getElementById('card-alerta-' + id);
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateX(50px)';
            setTimeout(function () {
                el.remove();
                atualizarContagemPainelAlertasFh();
            }, 400);
        }
    };

    window.confirmarLeituraTodosAlertasFh = function () {
        var cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
        if (!cards.length) return;
        var hj = new Date().toISOString().substring(0, 10);
        cards.forEach(function (el) {
            var id = el.id.replace('card-alerta-', '');
            localStorage.setItem(chaveAlertaSilenciadoFh(id, hj), 'true');
            el.style.opacity = '0';
            el.style.transform = 'translateX(50px)';
        });
        setTimeout(function () {
            var container = document.getElementById('alerta-container-global');
            if (container) { container.innerHTML = ''; container.style.display = 'none'; }
            sessionStorage.removeItem('fh_alertas_painel_minimizado');
        }, 400);
    };

    window.togglePainelAlertasMinimizadoFh = function () {
        var minimizado = sessionStorage.getItem('fh_alertas_painel_minimizado') === '1';
        sessionStorage.setItem('fh_alertas_painel_minimizado', minimizado ? '0' : '1');
        var container = document.getElementById('alerta-container-global');
        if (!container) return;
        var barra = container.querySelector('.alerta-barra-minimizada');
        var painel = container.querySelector('.alerta-painel-wrapper');
        if (barra) barra.style.display = minimizado ? 'none' : 'flex';
        if (painel) painel.style.display = minimizado ? 'block' : 'none';
    };

    window.visualizarNotaAlertaVencimentoFh = function (id) {
        var d = window._mapAlertasDespesasFh && window._mapAlertasDespesasFh[id];
        if (!d) { alert('Despesa não encontrada.'); return; }
        if (!d.foto_recibo) { alert('Esta despesa não tem foto da nota/boleto anexada.'); return; }
        var w = window.open('', '', 'width=720,height=820');
        var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Nota / Boleto</title></head><body style="font-family:sans-serif;padding:16px;background:#f5f5f5;">'
            + '<h2 style="margin:0 0 8px 0;color:#1a2a43;">📄 Nota / Boleto</h2>'
            + '<p style="margin:0 0 4px 0;"><b>Obra:</b> ' + esc(d.obra_nome || d.obra || '-') + '</p>'
            + '<p style="margin:0 0 4px 0;"><b>Fornecedor:</b> ' + esc(d.loja_nome || d.loja || '-') + '</p>'
            + '<p style="margin:0 0 12px 0;"><b>Vencimento:</b> ' + esc(formatarVencimentoAlertaFh(d)) + ' &nbsp; <b>Valor:</b> ' + esc(d.valor_string || fmt(d.valor_numero || 0)) + '</p>'
            + '<div style="text-align:center;background:#fff;padding:12px;border-radius:8px;border:2px solid #4285F4;">'
            + '<img src="' + d.foto_recibo + '" style="max-width:100%;max-height:70vh;object-fit:contain;" alt="Nota">'
            + '</div></body></html>';
        w.document.write(html);
        w.document.close();
    };

    window.imprimirRelatorioAlertasVencimentoFh = function () {
        var cards = document.querySelectorAll('#alerta-container-global [id^="card-alerta-"]');
        if (!cards.length) { alert('Não há boletos na lista de vencimentos para imprimir.'); return; }
        var linhas = [];
        var totalPagar = 0;
        function statusAlertaPdf(d) {
            var tsVenc = vencimentoTsDespesa(d);
            if (tsVenc == null) return 'PENDENTE';
            var hojeMeioDia = new Date();
            hojeMeioDia.setHours(12, 0, 0, 0);
            var dias = Math.round((tsVenc - hojeMeioDia.getTime()) / (1000 * 60 * 60 * 24));
            if (dias < 0) return 'VENCIDO';
            if (dias === 0) return 'VENCE HOJE';
            if (dias <= 3) return 'VENCE EM ' + dias + ' DIA(S)';
            return 'PENDENTE';
        }
        cards.forEach(function (el) {
            var id = el.id.replace('card-alerta-', '');
            var d = window._mapAlertasDespesasFh && window._mapAlertasDespesasFh[id];
            if (!d) return;
            var valorNum = parseMoeda(d.valor_string) || Number(d.valor_numero) || 0;
            totalPagar += valorNum;
            linhas.push([
                statusAlertaPdf(d),
                formatarVencimentoAlertaFh(d),
                d.obra_nome || d.obra || '',
                d.loja_nome || d.loja || '',
                d.valor_string || fmt(valorNum),
                d.nota_fiscal || '-',
                String(d.descricao || '').slice(0, 100)
            ]);
        });
        if (!linhas.length) { alert('Não foi possível montar o relatório.'); return; }
        var thead = '<tr><th>Situação</th><th>Vencimento</th><th>Obra</th><th>Fornecedor</th><th>Valor</th><th>NF</th><th>Descrição</th></tr>';
        var tbody = linhas.map(function (row) {
            return '<tr>' + row.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
        }).join('');
        var html = '<html><head><meta charset="UTF-8"><title>Vencimentos</title><style>'
            + '@page{size:A4 landscape; margin:10mm;} body{font-family:sans-serif;font-size:11px;} h2{margin:0;} table{width:100%;border-collapse:collapse;margin-top:12px;} th,td{border:1px solid #ccc;padding:6px;text-align:left;} th{background:#1a2a43;color:#fff;} .tot{margin-top:14px;font-size:14px;font-weight:bold;text-align:right;} .no-print{margin-top:14px;}'
            + '</style></head><body>'
            + '<h2>RELATÓRIO DE CONTAS A PAGAR — VENCIMENTOS</h2>'
            + '<div style="color:#666;">Gerado em ' + new Date().toLocaleString('pt-BR') + ' · ' + linhas.length + ' conta(s)</div>'
            + '<div class="tot" style="color:#d9534f;">TOTAL A PAGAR (lista): ' + fmt(totalPagar) + '</div>'
            + '<table><thead>' + thead + '</thead><tbody>' + tbody + '</tbody></table>'
            + '<div class="no-print"><button onclick="window.print()" style="padding:10px 16px;font-weight:bold;background:#1a2a43;color:#fff;border:none;border-radius:6px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button></div>'
            + '</body></html>';
        var w = window.open('', '', 'width=1000,height=750');
        w.document.write(html);
        w.document.close();
    };

    window.iniciarMonitorAlertasVencimentoFh = function () {
        setTimeout(function () { monitorarVencimentosObrasFh(); }, 3000);
        if (_intervalAlertasFh) clearInterval(_intervalAlertasFh);
        _intervalAlertasFh = setInterval(monitorarVencimentosObrasFh, 60000);
    };

    window.ocultarPainelAlertasVencimentoFh = function () {
        if (_intervalAlertasFh) { clearInterval(_intervalAlertasFh); _intervalAlertasFh = null; }
        var stack = document.getElementById('alerta-stack-global');
        if (stack) stack.style.display = 'none';
        var container = document.getElementById('alerta-container-global');
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }
    };

    window.fhSalvarCfgAlertaSom = function (on) {
        localStorage.setItem(K_ALERTA_SOM, on ? '1' : '0');
    };

    function fhCarregarCfgAlertaSom() {
        var el = document.getElementById('cfgAlertaVencimentoSom');
        if (el) el.checked = alertaSomFhAtivo();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fhCarregarCfgAlertaSom);
    } else {
        fhCarregarCfgAlertaSom();
    }
})();
