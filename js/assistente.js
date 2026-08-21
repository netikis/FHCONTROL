/**
 * FH CONTROL — Assistente local (Fase 8)
 * Consultas sobre estoque, clientes, pendências e caixa.
 * Extraído do index sem alterar a lógica.
 */
// --- ASSISTENTE (aba Config): consultas locais sobre estoque, clientes e caixa ---
(function () {
    function escHtml(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function norm(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    }
    function parseDataBr(dataStr) {
        if (!dataStr) return null;
        const part = String(dataStr).split(/[\s,]+/)[0];
        const m = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!m) return null;
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return isNaN(d.getTime()) ? null : d;
    }
    function mesAnoAtual() {
        const d = new Date();
        return { mes: d.getMonth() + 1, ano: d.getFullYear() };
    }
    function extrairMesAno(texto) {
        const m = String(texto).match(/(\d{1,2})\s*\/\s*(\d{4})/);
        if (m) return { mes: parseInt(m[1], 10), ano: parseInt(m[2], 10) };
        return null;
    }
    function extrairAno(texto) {
        const m = String(texto).match(/\b(20\d{2})\b/);
        return m ? parseInt(m[1], 10) : null;
    }
    function nomeEntreAspas(texto) {
        const s = String(texto);
        const m1 = s.match(/"([^"]+)"/);
        if (m1) return m1[1].trim();
        const m2 = s.match(/'([^']+)'/);
        if (m2) return m2[1].trim();
        return null;
    }
    function extrairNomeClienteHeuristico(texto) {
        const aspas = nomeEntreAspas(texto);
        if (aspas) return aspas;
        const t = String(texto).trim();
        const n = norm(t);

        // Frases do tipo "o que / do que NOME deve", "quanto NOME deve", "valor total ... NOME deve"
        const padroesAntesDeve = [
            /\b(?:o\s+)?que\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\bdo\s+que\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\bda\s+que\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\bquanto\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\bvalor\s+total\s+(?:do|da|de)\s+que\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\b(?:total|valor)\s+(?:do|da|de)\s+(.+?)\s+deve(?:m|r)?\b/i,
            /\bcliente\s+["']?([^"'\n]+?)["']?\s+deve(?:m|r)?\b/i,
            /\bpendentes?\s+(?:do|da|de)\s+["']?([^"'\n]+?)["']?\s*$/i
        ];
        for (const re of padroesAntesDeve) {
            const m = t.match(re);
            if (m && m[1]) {
                let cand = m[1].replace(/\s+/g, ' ').replace(/^(?:o|a|os|as)\s+/i, '').trim();
                cand = cand.replace(/^(?:cliente|cadastro)\s+/i, '').trim();
                if (cand.length >= 2 && cand.length <= 80) return cand;
            }
        }

        const mPendComDe = t.match(/\bpend[eê]ncias?\s+(?:de|do|da|dos|das)\s+(.+)/i);
        const mPendSemDe = t.match(/\bpend[eê]ncias?\s+(.+)/i);
        const mPendAlt = t.match(/\bpendentes?\s+(?:do|da|de)\s+(.+)/i);
        const mPendNome = mPendComDe || mPendAlt || mPendSemDe;
        if (mPendNome && mPendNome[1]) {
            let cand = mPendNome[1].replace(/\s+/g, ' ').trim();
            if (!mPendComDe && !mPendAlt) cand = cand.replace(/^(?:de|do|da|dos|das)\s+/i, '').trim();
            cand = cand.replace(/^(?:cliente|cadastro|o|a)\s+/i, '').trim();
            const cn = norm(cand);
            if (cn && cn !== 'pendencias' && cn !== 'pendencia' && cn !== 'pendente' && cn !== 'pendentes' && cand.length >= 2 && cand.length <= 80) return cand;
        }

        // Texto depois de marcadores (nunca use "deve" aqui — o nome fica antes de "deve")
        const chaves = ['notas do', 'pdfs do', 'documentos do', 'dados do cliente', 'do cliente', 'da cliente', 'pendentes do cliente', 'pendente do cliente', 'pendentes cliente', 'pendente cliente', 'cliente'];
        let resto = t;
        for (const ch of chaves) {
            const idx = n.lastIndexOf(norm(ch));
            if (idx >= 0) {
                resto = t.substring(idx + ch.length).replace(/^[:\s,-]+/, '').trim();
                break;
            }
        }
        if (resto === t) {
            const mCli = t.match(/\bcliente\s+["']?([^"'\n]+?)["']?\s*$/i);
            if (mCli && mCli[1]) resto = mCli[1].trim();
        }
        if (resto.length < 2 || resto.length > 80) return null;
        const rn = norm(resto);
        if (rn === 'pendencias' || rn === 'pendencia' || rn === 'pendente' || rn === 'pendentes') return null;
        return resto;
    }
    function filtroMesAno(docs, mes, ano) {
        const pad = String(mes).padStart(2, '0');
        const needle = `/${pad}/${ano}`;
        return docs.filter(v => window.dataEfetivaCaixaInclui(v, needle));
    }
    function filtroAno(docs, ano) {
        return docs.filter(v => {
            const d = parseDataBr(window.dataEfetivaCaixa(v));
            if (d && d.getFullYear() === ano) return true;
            const s = String(window.dataEfetivaCaixa(v) || '');
            return s.includes(`/${ano}`);
        });
    }
    function filtroUltimos7Dias(docs) {
        const fim = new Date();
        fim.setHours(23, 59, 59, 999);
        const ini = new Date(fim);
        ini.setDate(ini.getDate() - 6);
        ini.setHours(0, 0, 0, 0);
        return docs.filter(v => {
            const d = parseDataBr(window.dataEfetivaCaixa(v));
            return d && d >= ini && d <= fim;
        });
    }
    function isVendaOuOS(doc) {
        const t = doc.tipo || '';
        return t === 'VENDA' || t === 'ORDEM DE SERVIÇO' || t === 'VD';
    }
    function resumoFinanceiro(docs) {
        let entradas = 0, saidas = 0, pendentes = 0;
        let qEnt = 0, qSai = 0, qPen = 0;
        docs.forEach(v => {
            const tipo = v.tipo || '';
            const status = v.statusPagamento || 'PAGO';
            const val = parseFloat(v.total) || 0;
            if (tipo === 'ORCAMENTO' || tipo === 'FECHAMENTO' || tipo === 'FECHAMENTO_BANCO') return;
            if (tipo === 'DESPESA') {
                saidas += val;
                qSai++;
                return;
            }
            if (isVendaOuOS(v)) {
                if (status === 'PENDENTE') {
                    pendentes += window._saldoDevedorDoc(v);
                    qPen++;
                } else if (status === 'PAGO') {
                    entradas += val;
                    qEnt++;
                }
            }
        });
        return { entradas, saidas, pendentes, qEnt, qSai, qPen };
    }
    function resumoExtratoBancoMes(mes, ano) {
        const pad = String(mes).padStart(2, '0');
        const needle = `/${pad}/${ano}`;
        let ent = 0, sai = 0, qe = 0, qs = 0;
        (window.extratoBanco || []).forEach(b => {
            if (!b.dataStr || !String(b.dataStr).includes(needle)) return;
            const val = parseFloat(b.valor) || 0;
            if (b.tipo === 'ENTRADA') {
                ent += val;
                qe++;
            } else if (b.tipo === 'SAIDA') {
                sai += val;
                qs++;
            }
        });
        return { ent, sai, qe, qs };
    }
    function resumoExtratoBancoAno(ano) {
        let ent = 0, sai = 0, qe = 0, qs = 0;
        (window.extratoBanco || []).forEach(b => {
            if (!b.dataStr || !String(b.dataStr).includes(`/${ano}`)) return;
            const val = parseFloat(b.valor) || 0;
            if (b.tipo === 'ENTRADA') {
                ent += val;
                qe++;
            } else if (b.tipo === 'SAIDA') {
                sai += val;
                qs++;
            }
        });
        return { ent, sai, qe, qs };
    }
    /** Palavras-chave para busca no estoque a partir de frase natural (ex.: nome do produto). */
    function extrairTermosBuscaEstoque(texto) {
        const STOP = new Set([
            'me', 'passe', 'pasa', 'passem', 'traga', 'traz', 'mostre', 'mostra', 'mostrem', 'liste', 'lista', 'listar', 'diga', 'informe', 'informa',
            'quero', 'preciso', 'gostaria', 'saber', 'quais', 'qual', 'que', 'com', 'sem', 'sobre',
            'estoque', 'estoques', 'quantidade', 'quantidades', 'quantos', 'quantas', 'quanta', 'quanto', 'tem', 'tenho', 'temos', 'ha', 'há', 'cadastrado', 'cadastrados', 'cadastro',
            'produto', 'produtos', 'item', 'itens', 'modelo', 'modelos', 'tipo', 'tipos', 'skus', 'sku', 'unidades', 'unidade', 'disponivel', 'disponíveis', 'disponiveis',
            'meu', 'minha', 'meus', 'minhas', 'esse', 'essa', 'esses', 'essas', 'este', 'esta', 'neste', 'nesta', 'no', 'na', 'nos', 'nas', 'em', 'de', 'do', 'da', 'dos', 'das', 'um', 'uma', 'uns', 'umas', 'o', 'a', 'os', 'as',
            'por', 'pra', 'pro', 'pelo', 'pela', 'para', 'como', 'quando', 'onde', 'muito', 'muita', 'muitos', 'muitas', 'todo', 'toda', 'todos', 'todas', 'favor', 'pfv', 'porfavor',
            'quanto', 'quem', 'cujo', 'cuja', 'ser', 'são', 'sao', 'foi', 'fui', 'faz', 'fazer', 'faco', 'faço', 'tenha', 'ter', 'tem', 'tendo'
        ]);
        let s = String(texto || '').replace(/\s+/g, ' ').trim();
        s = s.replace(/\b(estoque|estoques)\b/gi, ' ');
        const partes = s.split(/[^0-9A-Za-zÀ-ÿ]+/u).filter(Boolean);
        const termos = [];
        const visto = new Set();
        for (const p of partes) {
            const w = p.length > 1 ? p : '';
            if (!w || w.length < 3) continue;
            const k = norm(w);
            if (STOP.has(k)) continue;
            if (visto.has(k)) continue;
            visto.add(k);
            termos.push(w);
        }
        return termos.slice(0, 10);
    }
    function produtosPorTermosEstoque(produtos, termos) {
        if (!termos.length) return produtos;
        return produtos.filter(p => {
            const blob = norm([p.nome, p.codigo, p.categoria].filter(Boolean).join(' '));
            return termos.some(t => blob.includes(norm(t)));
        });
    }
    function matchNomeCliente(docNome, termo) {
        const a = norm(docNome || '');
        const b = norm(termo || '');
        if (!b) return true;
        if (a.includes(b) || b.includes(a)) return true;
        const ta = a.split(/\s+/).filter(Boolean);
        const tb = b.split(/\s+/).filter(Boolean);
        if (!tb.length) return false;
        return tb.every(tok => ta.some(w => w.includes(tok) || tok.includes(w)));
    }
    /** Entre vários cadastros que “batem” com o filtro, prefere nome mais completo / igual ao digitado. */
    function escolherClienteCadastro(candidatos, filtro) {
        const f = norm(filtro || '');
        if (!candidatos || !candidatos.length) return null;
        if (!f) return candidatos[0];
        let best = candidatos[0];
        let bestScore = -1;
        for (const c of candidatos) {
            const cn = norm(c.nome || '');
            let score = 0;
            if (cn === f) score = 1000000;
            else if (f.length >= 6 && cn.includes(f)) score = 500000 + f.length;
            else if (cn.includes(f)) score = 300000 + Math.min(cn.length, 500);
            else {
                const ftoks = f.split(/\s+/).filter(t => t.length >= 2);
                score = ftoks.reduce((s, tok) => s + (cn.includes(tok) ? tok.length * 10 : 0), 0);
            }
            score += (c.nome || '').length * 0.001;
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        return best;
    }
    function assistenteAjudaHtml() {
        return `<p><strong>Exemplos de perguntas:</strong></p>
<ul style="margin:6px 0 0 18px;padding:0;">
<li><strong>Estoque:</strong> <code>estoque</code>, <code>estoque produto</code>, ou frases como <code>quantos modelos de produto tenho em estoque</code></li>
<li><strong>Clientes:</strong> <code>quantos clientes</code>, <code>cadastro "cliente"</code></li>
<li><strong>A receber:</strong> <code>pendencias de "cliente"</code>, <code>pendências "cliente"</code>, <code>pendentes cliente "cliente"</code>, <code>quem está devendo</code>, <code>valor total do que "cliente" deve</code></li>
<li><strong>PDFs:</strong> <code>pdfs do cliente "cliente"</code></li>
<li><strong>Nota (abrir PDF):</strong> <code>nota 1205</code>, <code>os 1205</code>, <code>documento 1205</code></li>
<li><strong>Vendas / despesas:</strong> <code>quanto vendi em 05/2026</code>, <code>despesas do mês</code></li>
<li><strong>Balanço:</strong> <code>balanço semanal</code>, <code>balanço mensal</code>, <code>balanço anual 2026</code></li>
</ul>
<p style="margin-top:8px;color:#bdc3c7;font-size:12px;">Respostas usam os dados já carregados neste computador (mesma base do caixa e do estoque).</p>`;
    }

    function _assistenteAcharNotaPorNumero(cx, numero) {
        const num = String(numero || '').trim();
        if (!num) return null;
        const hits = (cx || []).filter(v => isVendaOuOS(v) && String(v.os || '').trim() === num);
        if (hits.length) {
            hits.sort((a, b) => (window.timestampEfetivoCaixa ? window.timestampEfetivoCaixa(b) - window.timestampEfetivoCaixa(a) : (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)));
            return hits[0];
        }
        // fallback: contém (caso tenha prefixo/sufixo)
        const hits2 = (cx || []).filter(v => isVendaOuOS(v) && String(v.os || '').includes(num));
        if (!hits2.length) return null;
        hits2.sort((a, b) => (window.timestampEfetivoCaixa ? window.timestampEfetivoCaixa(b) - window.timestampEfetivoCaixa(a) : (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)));
        return hits2[0];
    }

    function _assistenteHtmlNota(doc) {
        if (!doc) return `<p>Nota não encontrada.</p>`;
        const os = escHtml(String(doc.os || '-'));
        const tipo = escHtml(String(doc.tipo || ''));
        const cliente = escHtml(String(doc.clienteNome || '-'));
        const total = (parseFloat(doc.total) || 0).toFixed(2);
        const st = escHtml(String(doc.statusPagamento || ''));
        const forma = escHtml(String((doc.formaPagamento || '').replace('Cartão de ', '')).toUpperCase());
        const dt = escHtml(String((doc.dataRecebimentoStr || doc.dataStr || '').split(' ')[0] || ''));
        const recebido = (window._totalRecebidoDoc ? window._totalRecebidoDoc(doc) : 0);
        const saldo = (window._saldoDevedorDoc ? window._saldoDevedorDoc(doc) : 0);
        const onde = (doc.statusPagamento || '') === 'PENDENTE'
            ? 'Pendentes'
            : (window.formaPagamentoEhDigital && window.formaPagamentoEhDigital(doc.formaPagamento) ? 'Banco' : 'Balcão');

        let html = `<p style="margin:0 0 6px 0;"><strong>Nota ${os}</strong> — ${cliente}</p>`;
        html += `<div style="font-size:12px;color:#bdc3c7;">Tipo: <strong>${tipo}</strong> · Status: <strong>${st}${forma ? ' (' + forma + ')' : ''}</strong> · Data: <strong>${dt}</strong> · Onde: <strong>${onde}</strong></div>`;
        html += `<div style="margin-top:8px;font-size:13px;">Total: <strong>R$ ${total}</strong>`;
        if (recebido > 0 || saldo > 0) {
            html += ` · Recebido: <strong style="color:#2ecc71;">R$ ${recebido.toFixed(2)}</strong> · Saldo: <strong style="color:#f1c40f;">R$ ${saldo.toFixed(2)}</strong>`;
        }
        html += `</div>`;
        html += `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">`;
        html += `<button type="button" class="btn-primary" style="font-size:12px;padding:7px 10px;background:#27ae60;" onclick="window.gerarPDF_Historico('${doc.id}','loja')">📄 Abrir PDF</button>`;
        html += `<button type="button" class="btn-secundario" style="font-size:12px;padding:7px 10px;" onclick="window.gerarPDFparaCliente('${doc.id}')">📤 PDF Cliente</button>`;
        html += `<button type="button" class="btn-secundario" style="font-size:12px;padding:7px 10px;" onclick="window.imprimirCupom('${doc.id}')">🧾 Cupom</button>`;
        if ((window._totalRecebidoDoc && window._totalRecebidoDoc(doc) > 0) || (doc.statusPagamento || '') === 'PAGO') {
            html += `<button type="button" class="btn-danger" style="font-size:12px;padding:7px 10px;" onclick="window.estornarPagamento('${doc.id}')">🔄 Estornar</button>`;
        }
        html += `</div>`;
        // sinalizador para auto-abrir PDF ao responder
        html += `<div data-auto-pdf="${escHtml(String(doc.id))}" style="display:none;"></div>`;
        return html;
    }
    function assistenteProcessar(texto) {
        const raw = String(texto || '').trim();
        const n = norm(raw);
        if (!n) return `<p>Digite uma pergunta ou <strong>ajuda</strong> para ver exemplos.</p>`;
        if (n === 'ajuda' || n === 'help' || n === 'comandos' || n.includes('o que voce faz') || n.includes('o que você faz')) {
            return assistenteAjudaHtml();
        }

        const cx = typeof window.caixaGlobal !== 'undefined' ? window.caixaGlobal : [];
        const cli = typeof window.clientesGlobais !== 'undefined' ? window.clientesGlobais : [];
        const pro = typeof window.produtosGlobais !== 'undefined' ? window.produtosGlobais : [];

        // Comando: "nota 1205" / "os 1205" / "documento 1205" → puxa a nota e abre o PDF
        const mNota = n.match(/^(?:nota|os|documento|doc)\s*#?\s*(\d{3,})\b/);
        if (mNota) {
            const doc = _assistenteAcharNotaPorNumero(cx, mNota[1]);
            if (!doc) {
                return `<p>Não encontrei a nota <strong>${escHtml(mNota[1])}</strong> no histórico carregado.</p>
<p style="font-size:12px;color:#bdc3c7;">Dica: recarregue a página (F5) para sincronizar, ou tente buscar pelo nome do cliente em <strong>Registro Geral → Busca Geral</strong>.</p>`;
            }
            return _assistenteHtmlNota(doc);
        }

        if (n.includes('balanco')) {
            if (n.includes('seman') || n.includes('7 dias') || n.includes('sete dias')) {
                const docs = filtroUltimos7Dias(cx);
                const titulo = 'Últimos 7 dias (incluindo hoje)';
                const r = resumoFinanceiro(docs);
                let html = `<p><strong>Balanço ${escHtml(titulo)}</strong></p>`;
                html += `<ul style="margin:6px 0 0 18px;"><li>Entradas (vendas/OS pagas): <strong>R$ ${r.entradas.toFixed(2)}</strong> (${r.qEnt} docs)</li>`;
                html += `<li>Saídas (despesas): <strong>R$ ${r.saidas.toFixed(2)}</strong> (${r.qSai} docs)</li>`;
                html += `<li>Pendentes: <strong>R$ ${r.pendentes.toFixed(2)}</strong> (${r.qPen} docs)</li></ul>`;
                html += `<p style="margin-top:8px;color:#bdc3c7;font-size:12px;">Resultado aproximado: entradas − saídas = <strong>R$ ${(r.entradas - r.saidas).toFixed(2)}</strong>.</p>`;
                return html;
            }
            const maInline = extrairMesAno(raw);
            const anoInline = extrairAno(raw);
            if (n.includes('anual') || (!n.includes('mensal') && !n.includes('seman') && !maInline && anoInline)) {
                const ano = extrairAno(raw) || mesAnoAtual().ano;
                const docs = filtroAno(cx, ano);
                const titulo = `Ano ${ano}`;
                const rb = resumoExtratoBancoAno(ano);
                const r = resumoFinanceiro(docs);
                let html = `<p><strong>Balanço ${escHtml(titulo)}</strong> (caixa / vendas registradas)</p>`;
                html += `<ul style="margin:6px 0 0 18px;"><li>Entradas (vendas/OS pagas): <strong>R$ ${r.entradas.toFixed(2)}</strong> (${r.qEnt} docs)</li>`;
                html += `<li>Saídas (despesas): <strong>R$ ${r.saidas.toFixed(2)}</strong> (${r.qSai} docs)</li>`;
                html += `<li>Pendentes (a receber): <strong>R$ ${r.pendentes.toFixed(2)}</strong> (${r.qPen} docs)</li></ul>`;
                if (rb.qe + rb.qs > 0) {
                    html += `<p style="margin-top:8px;"><strong>Lançamentos manuais do banco</strong> (módulo banco): entradas R$ ${rb.ent.toFixed(2)} (${rb.qe}), saídas R$ ${rb.sai.toFixed(2)} (${rb.qs}).</p>`;
                }
                html += `<p style="margin-top:8px;color:#bdc3c7;font-size:12px;">Resultado aproximado: entradas − saídas (caixa) = <strong>R$ ${(r.entradas - r.saidas).toFixed(2)}</strong>.</p>`;
                return html;
            }
            const ma = extrairMesAno(raw) || mesAnoAtual();
            const docs = filtroMesAno(cx, ma.mes, ma.ano);
            const titulo = `${String(ma.mes).padStart(2, '0')}/${ma.ano}`;
            const rb = resumoExtratoBancoMes(ma.mes, ma.ano);
            const r = resumoFinanceiro(docs);
            let html = `<p><strong>Balanço mensal ${escHtml(titulo)}</strong></p>`;
            html += `<ul style="margin:6px 0 0 18px;"><li>Entradas (vendas/OS pagas): <strong>R$ ${r.entradas.toFixed(2)}</strong> (${r.qEnt} docs)</li>`;
            html += `<li>Saídas (despesas): <strong>R$ ${r.saidas.toFixed(2)}</strong> (${r.qSai} docs)</li>`;
            html += `<li>Pendentes: <strong>R$ ${r.pendentes.toFixed(2)}</strong> (${r.qPen} docs)</li></ul>`;
            if (rb.qe + rb.qs > 0) {
                html += `<p style="margin-top:8px;"><strong>Banco (lanç. manuais)</strong> no mesmo período: +R$ ${rb.ent.toFixed(2)} / −R$ ${rb.sai.toFixed(2)}.</p>`;
            }
            html += `<p style="margin-top:8px;color:#bdc3c7;font-size:12px;">Para PDF detalhado do mês use o botão de relatório mensal em <strong>Caixa / Relatórios</strong>.</p>`;
            return html;
        }

        if (n.includes('estoque')) {
            const termos = extrairTermosBuscaEstoque(raw);
            const querContagemModelos = n.includes('modelos') || n.includes('modelo') || n.includes('quantos') || n.includes('quantas') || n.includes('quanto tipo');
            if (!termos.length) {
                const totalSkus = pro.length;
                const qtdTotal = pro.reduce((s, p) => s + (parseFloat(p.quantidade) || 0), 0);
                const criticos = pro.filter(p => (parseFloat(p.quantidade) || 0) <= 3).sort((a, b) => (parseFloat(a.quantidade) || 0) - (parseFloat(b.quantidade) || 0)).slice(0, 15);
                let html = `<p><strong>Estoque geral:</strong> ${totalSkus} produtos cadastrados, soma das quantidades: <strong>${qtdTotal.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</strong>.</p>`;
                if (criticos.length) {
                    html += `<p style="margin-top:6px;">Itens com quantidade ≤ 3:</p><ul style="margin:4px 0 0 18px;">`;
                    criticos.forEach(p => {
                        html += `<li>${escHtml(p.nome)} — <strong>${escHtml(String(p.quantidade ?? 0))}</strong></li>`;
                    });
                    html += `</ul>`;
                }
                return html;
            }
            let hits = produtosPorTermosEstoque(pro, termos);
            if (!hits.length && termos.length > 1) {
                hits = produtosPorTermosEstoque(pro, termos.filter(t => norm(t).length >= 5));
            }
            if (!hits.length) {
                return `<p>Nenhum produto encontrado para os termos: <strong>${escHtml(termos.join(', '))}</strong>.</p>
<p style="font-size:12px;color:#bdc3c7;">Dica: use uma palavra do nome do produto (ex.: <code>estoque produto</code>).</p>`;
            }
            const qtdSoma = hits.reduce((s, p) => s + (parseFloat(p.quantidade) || 0), 0);
            let html = '';
            if (querContagemModelos) {
                html += `<p><strong>${hits.length}</strong> modelo(s) / SKU(s) encontrado(s) com ${escHtml(termos.join(', '))}. Soma das quantidades em estoque: <strong>${qtdSoma.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</strong> unidade(s).</p>`;
            } else {
                html += `<p>Produtos encontrados (${hits.length}) para ${escHtml(termos.join(', '))}:</p>`;
            }
            html += `<ul style="margin:8px 0 0 18px;">`;
            hits.slice(0, 40).forEach(p => {
                const pv = typeof window.parseMoedaBr === 'function' ? window.parseMoedaBr(p.venda) : (parseFloat(String(p.venda).replace(',', '.')) || 0);
                html += `<li>${escHtml(p.nome)} — qtd <strong>${escHtml(String(p.quantidade ?? 0))}</strong>, venda R$ ${pv.toFixed(2)}</li>`;
            });
            html += `</ul>`;
            if (hits.length > 40) html += `<p style="font-size:12px;color:#bdc3c7;">Mostrando 40 de ${hits.length}. Refine a busca na aba Estoque.</p>`;
            return html;
        }

        const pedidoPendencias = n.includes('pendente') || n.includes('pendencia') || n.includes('devendo') || n.includes(' a receber') || n.includes('divida') || /\bdeve\b/.test(n);
        if (pedidoPendencias) {
            const nomeFiltro = extrairNomeClienteHeuristico(raw);
            const querTotal = n.includes('valor') || n.includes('total') || n.includes('quanto') || n.includes('puxe');
            let pends = cx.filter(v => isVendaOuOS(v) && (v.statusPagamento || '') === 'PENDENTE');
            if (nomeFiltro) pends = pends.filter(v => matchNomeCliente(v.clienteNome, nomeFiltro));
            if (!pends.length) {
                if (nomeFiltro) {
                    const cad = cli.filter(c => matchNomeCliente(c.nome, nomeFiltro));
                    if (cad.length) {
                        const escolhido = escolherClienteCadastro(cad, nomeFiltro);
                        const nm = escolhido ? escolhido.nome : cad[0].nome;
                        let extra = '';
                        if (cad.length > 1) {
                            extra = `<p style="font-size:12px;color:#bdc3c7;">Há ${cad.length} cadastro(s) parecido(s) com “${escHtml(nomeFiltro)}”; usei o mais provável: <strong>${escHtml(nm)}</strong>. Se for outro, use aspas no nome completo.</p>`;
                        }
                        return `<p>O cliente <strong>${escHtml(nm)}</strong> está <strong>cadastrado</strong>, mas não há <strong>venda/OS pendente</strong> no caixa com esse nome (total em aberto: <strong>R$ 0,00</strong>).</p>
${extra}
<p style="font-size:12px;color:#bdc3c7;">Dica: na nota pode constar nome diferente do cadastro — tente um trecho do nome como aparece na venda, ou <code>pendentes</code> sem filtro para ver todos em aberto.</p>`;
                    }
                }
                return `<p>Nenhuma venda/OS pendente${nomeFiltro ? ` para nome parecido com <strong>${escHtml(nomeFiltro)}</strong>` : ''}.</p>`;
            }
            const tot = pends.reduce(function (s, v) { return s + window._saldoDevedorDoc(v); }, 0);
            const nomesUnicos = [...new Set(pends.map(v => v.clienteNome).filter(Boolean))];
            let html = '';
            if (nomeFiltro && querTotal) {
                const exibirNome = nomesUnicos.length === 1 ? nomesUnicos[0] : (nomesUnicos[0] || nomeFiltro);
                html += `<p style="font-size:15px;margin-bottom:10px;">Total a receber de <strong>${escHtml(exibirNome)}</strong>: <strong style="color:#f1c40f;">R$ ${tot.toFixed(2)}</strong> <span style="font-size:12px;color:#bdc3c7;">(${pends.length} documento(s))</span></p>`;
            } else {
                html += `<p><strong>Contas a receber</strong> (${pends.length} documento(s)): total <strong>R$ ${tot.toFixed(2)}</strong></p>`;
            }
            html += `<ul style="margin:4px 0 0 18px;max-height:220px;overflow-y:auto;">`;
            pends.slice(0, 40).forEach(v => {
                const saldo = window._saldoDevedorDoc(v);
                const recebido = window._totalRecebidoDoc(v);
                let extra = recebido > 0 ? ` (recebido R$ ${recebido.toFixed(2)}, saldo R$ ${saldo.toFixed(2)})` : '';
                html += `<li>${escHtml(v.dataStr || '')} — ${escHtml(v.clienteNome || '-')} — OS ${escHtml(String(v.os || '-'))} — <strong>R$ ${saldo.toFixed(2)}</strong>${extra}</li>`;
            });
            html += `</ul>`;
            if (pends.length > 40) html += `<p style="font-size:12px;color:#bdc3c7;">+ ${pends.length - 40} documento(s) — refine o nome do cliente.</p>`;
            return html;
        }

        if (n.includes('quantos clientes') || n === 'listar clientes' || /\b(listar|lista)\s+de\s+clientes\b/.test(n) || /\b(listar|lista)\s+(?:todos\s+)?(?:os\s+)?clientes\b/.test(n)) {
            if (!cli.length) return `<p>Nenhum cliente cadastrado.</p>`;
            const slice = cli.slice(0, 25);
            let html = `<p><strong>${cli.length}</strong> cliente(s) cadastrado(s). Mostrando até 25:</p><ul style="margin:4px 0 0 18px;">`;
            slice.forEach(c => {
                html += `<li>${escHtml(c.nome)}${c.telefone ? ` — ${escHtml(c.telefone)}` : ''}</li>`;
            });
            html += `</ul>`;
            if (cli.length > 25) html += `<p style="font-size:12px;color:#bdc3c7;">Use a aba Clientes para ver todos.</p>`;
            return html;
        }

        if (n.includes('cadastro') || n.includes('dados do cliente') || (n.includes('cliente') && (n.includes('telefone') || n.includes('endereco') || n.includes('endereço')))) {
            const nome = extrairNomeClienteHeuristico(raw) || raw.replace(/.*cliente/gi, '').trim();
            if (!nome || nome.length < 2) return `<p>Informe o nome. Ex.: <code>cadastro "cliente"</code></p>`;
            const hits = cli.filter(c => matchNomeCliente(c.nome, nome)).slice(0, 5);
            if (!hits.length) return `<p>Nenhum cliente cadastrado com nome parecido com <strong>${escHtml(nome)}</strong>.</p>`;
            let html = '';
            hits.forEach(c => {
                const doc = c.cpf || c.cnpj || '-';
                html += `<p><strong>${escHtml(c.nome)}</strong><br>Doc: ${escHtml(doc)} | Tel: ${escHtml(c.telefone || '-')}<br>`;
                html += `Cidade: ${escHtml(c.cidade || '-')} | ${escHtml(c.rua || '')}, ${escHtml(c.numero || '')} — ${escHtml(c.bairro || '')}</p>`;
            });
            return html;
        }

        if (n.includes('pdf') || (n.includes('notas') && n.includes('cliente')) || (n.includes('vendas') && n.includes('cliente')) || (n.includes('documentos') && (n.includes('cliente') || n.includes('pdf')))) {
            const nome = extrairNomeClienteHeuristico(raw);
            if (!nome || nome.length < 2) return `<p>Diga o cliente. Ex.: <code>pdfs do cliente "cliente"</code></p>`;
            const docsCli = cx.filter(v => isVendaOuOS(v) && matchNomeCliente(v.clienteNome, nome));
            if (!docsCli.length) return `<p>Nenhuma venda/OS encontrada para <strong>${escHtml(nome)}</strong>.</p>`;
            docsCli.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            let html = `<p>Documentos de <strong>${escHtml(nome)}</strong> (${docsCli.length}). Clique para abrir o PDF:</p><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">`;
            docsCli.slice(0, 30).forEach(v => {
                const os = escHtml(String(v.os || 'S/N'));
                const st = escHtml(v.statusPagamento || '');
                html += `<button type="button" class="btn-primary" style="font-size:11px;padding:6px 10px;background:#f39c12;" onclick="window.gerarPDF_Historico('${v.id}')">PDF ${os} (${st})</button>`;
            });
            html += `</div>`;
            if (docsCli.length > 30) html += `<p style="margin-top:8px;font-size:12px;color:#bdc3c7;">Mostrando 30 mais recentes de ${docsCli.length}.</p>`;
            return html;
        }

        if (n.includes('vendi') || n.includes('vendas') || n.includes('faturamento') || (n.includes('quanto') && n.includes('entrada'))) {
            const ma = extrairMesAno(raw) || mesAnoAtual();
            const docs = filtroMesAno(cx, ma.mes, ma.ano);
            const r = resumoFinanceiro(docs);
            return `<p><strong>Vendas / entradas</strong> em ${String(ma.mes).padStart(2, '0')}/${ma.ano} (vendas e OS <em>pagas</em>): <strong>R$ ${r.entradas.toFixed(2)}</strong> em ${r.qEnt} documento(s).<br>Pendentes no mês: R$ ${r.pendentes.toFixed(2)} (${r.qPen}).</p>`;
        }

        if (n.includes('despesa') || n.includes('saida') || n.includes('saída') || n.includes('gasto')) {
            const ma = extrairMesAno(raw) || mesAnoAtual();
            const docs = filtroMesAno(cx, ma.mes, ma.ano);
            const r = resumoFinanceiro(docs);
            return `<p><strong>Despesas (saídas)</strong> em ${String(ma.mes).padStart(2, '0')}/${ma.ano}: <strong>R$ ${r.saidas.toFixed(2)}</strong> (${r.qSai} lançamento(s)).</p>`;
        }

        return `<p>Não reconheci o pedido. Tente <strong>ajuda</strong> ou seja mais específico (ex.: <code>balanço mensal 04/2026</code>).</p>`;
    }

    function appendMsg(role, htmlInner) {
        const log = document.getElementById('assistenteChatLog');
        if (!log) return;
        const wrap = document.createElement('div');
        wrap.style.marginBottom = '10px';
        wrap.style.padding = '8px 10px';
        wrap.style.borderRadius = '6px';
        if (role === 'user') {
            wrap.style.background = '#2980b9';
            wrap.style.marginLeft = '24px';
        } else {
            wrap.style.background = '#2c3e50';
            wrap.style.marginRight = '24px';
        }
        wrap.innerHTML = `<div style="font-size:10px;opacity:0.85;margin-bottom:4px;">${role === 'user' ? 'Você' : 'Assistente'}</div>` + htmlInner;
        log.appendChild(wrap);
        log.scrollTop = log.scrollHeight;

        // Auto-abrir PDF quando a resposta traz um documento único (ex.: "nota 1205")
        if (role === 'bot') {
            try {
                const el = wrap.querySelector('[data-auto-pdf]');
                const idDoc = el ? el.getAttribute('data-auto-pdf') : '';
                if (idDoc && window.gerarPDF_Historico) {
                    window.gerarPDF_Historico(idDoc, 'loja');
                }
            } catch (e) {}
        }
    }

    window.assistenteSistemaLimpar = function () {
        const log = document.getElementById('assistenteChatLog');
        if (!log) return;
        log.innerHTML = '';
        appendMsg('bot', `<p>Olá! Sou o assistente local do sistema. Pergunte sobre <strong>estoque</strong>, <strong>clientes</strong>, <strong>pendências</strong>, <strong>vendas do mês</strong> ou digite <strong>ajuda</strong>.</p>`);
    };

    window.assistenteSistemaEnviar = function () {
        const inp = document.getElementById('assistenteChatInput');
        if (!inp) return;
        const t = inp.value.trim();
        if (!t) return;
        appendMsg('user', `<div>${escHtml(t).replace(/\n/g, '<br>')}</div>`);
        inp.value = '';
        try {
            const resp = assistenteProcessar(t);
            appendMsg('bot', resp);
        } catch (e) {
            appendMsg('bot', `<p style="color:#e74c3c;">Erro ao processar: ${escHtml(e.message)}</p>`);
        }
    };

    const inp0 = document.getElementById('assistenteChatInput');
    if (inp0) {
        inp0.addEventListener('keydown', function (ev) {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                ev.preventDefault();
                window.assistenteSistemaEnviar();
            }
        });
    }
    window.assistenteSistemaLimpar();
})();
