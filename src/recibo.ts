// Recibo de lançamento liquidado (detalhe do Financeiro). Arquivo sem dependência do Capacitor, para o teste rodar em Node.
//
// Recebido (a receber): a empresa emite e assina — "Recebemos de <cliente>…".
// Pago (a pagar): o recibo é para o fornecedor assinar — "Recebi de <empresa>…".
// O PDF é montado aqui mesmo (texto em Helvetica, uma página), sem biblioteca: o recibo é só texto e uma linha de assinatura.

export interface ReciboDados {
  /** Ex.: "REC-2026-00902". */
  numero: string;
  tipo: 'receber' | 'pagar';
  valor: number;
  /** Data do pagamento, AAAA-MM-DD. */
  data: string;
  /** O que foi pago: a descrição do lançamento. */
  referente: string;
  forma: string | null;
  documento: string | null;
  empresa: { nome: string; documento: string | null; cidade: string | null };
  parte: { nome: string; documento: string | null } | null;
}

// ── Valor e data por extenso ──

const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze',
  'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100;
  const dez = r < 20 ? UN[r] : DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : '');
  return [CEM[c], dez].filter(Boolean).join(' e ');
}

/** Inteiro por extenso: 1260 → "mil duzentos e sessenta"; 1500 → "mil e quinhentos". */
export function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero';
  const grupos: Array<[number, string, string]> = [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil'], [1, '', '']];
  const partes: Array<{ texto: string; valor: number }> = [];
  let resto = n;
  for (const [base, um, varios] of grupos) {
    const q = Math.floor(resto / base);
    resto -= q * base;
    if (!q) continue;
    if (base === 1e3) partes.push({ texto: q === 1 ? 'mil' : `${ate999(q)} mil`, valor: q });
    else if (base === 1) partes.push({ texto: ate999(q), valor: q });
    else partes.push({ texto: `${ate999(q)} ${q === 1 ? um : varios}`, valor: q });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda: "mil e um", "mil e quinhentos".
  return partes.map((p, i) => (i > 0 && i === partes.length - 1 && (p.valor < 100 || p.valor % 100 === 0) ? 'e ' : '') + p.texto).join(' ');
}

/** Reais por extenso: 1260.5 → "mil duzentos e sessenta reais e cinquenta centavos"; 2000000 → "dois milhões de reais". */
export function valorPorExtenso(v: number): string {
  const cents = Math.round(v * 100);
  const reais = Math.floor(cents / 100), cent = cents % 100;
  const partes: string[] = [];
  if (reais) {
    const t = inteiroPorExtenso(reais);
    const de = reais % 1e6 === 0 ? ' de' : '';
    partes.push(`${t}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (cent) partes.push(`${inteiroPorExtenso(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`);
  return partes.length ? partes.join(' e ') : 'zero real';
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "2026-10-15" → "15 de outubro de 2026". */
export function dataPorExtenso(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Textos do recibo, prontos para a tela, o PDF e o "copiar texto". */
export function textoRecibo(r: ReciboDados): { titulo: string; corpo: string; local: string; assinante: string; assinanteDoc: string | null } {
  const doc = (d: string | null) => (d ? `, ${d.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'} ${d},` : '');
  const valor = `${reais(r.valor)} (${valorPorExtenso(r.valor)})`;
  const ref = `referente a ${r.referente}${r.documento ? `, documento ${r.documento}` : ''}${r.forma ? `, pago via ${r.forma}` : ''}`;
  const parte = r.parte?.nome ?? (r.tipo === 'receber' ? 'cliente não informado' : 'fornecedor não informado');
  const corpo = r.tipo === 'receber'
    ? `Recebemos de ${parte}${doc(r.parte?.documento ?? null)} a importância de ${valor}, ${ref}. Para clareza, firmamos o presente recibo, dando plena quitação do valor.`
    : `Recebi de ${r.empresa.nome}${doc(r.empresa.documento)} a importância de ${valor}, ${ref}. Para clareza, firmo o presente recibo, dando plena quitação do valor.`;
  return {
    titulo: 'RECIBO',
    corpo,
    local: `${r.empresa.cidade ? `${r.empresa.cidade}, ` : ''}${dataPorExtenso(r.data)}.`,
    assinante: r.tipo === 'receber' ? r.empresa.nome : parte,
    assinanteDoc: r.tipo === 'receber' ? r.empresa.documento : r.parte?.documento ?? null,
  };
}

/** Texto corrido para copiar ou mandar por mensagem. */
export function reciboComoTexto(r: ReciboDados): string {
  const t = textoRecibo(r);
  return [`${t.titulo} Nº ${r.numero} — ${reais(r.valor)}`, '', t.corpo, '', t.local, '', `${t.assinante}${t.assinanteDoc ? ` — ${t.assinanteDoc}` : ''}`].join('\n');
}

// ── PDF de uma página (A4), Helvetica com WinAnsiEncoding ──

/** Caractere → byte WinAnsi; o que não existe vira "?". */
const WIN: Record<string, number> = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97 };
function winAnsi(s: string): number[] {
  return [...s].map((ch) => {
    const c = ch.codePointAt(0)!;
    if (WIN[ch] !== undefined) return WIN[ch];
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) return c;
    return 0x3f;
  });
}
/** String PDF literal: "(…)" com ( ) \ escapados. */
function literal(s: string): number[] {
  const out: number[] = [0x28];
  for (const b of winAnsi(s)) { if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); out.push(b); }
  out.push(0x29);
  return out;
}
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** Largura aproximada em pontos (Helvetica): o suficiente para quebrar linha sem estourar a margem. */
function largura(s: string, tam: number, negrito = false): number {
  let w = 0;
  for (const ch of s) {
    if (ch === ' ') w += 0.278;
    else if ('il.,;:!|\'’'.includes(ch)) w += 0.25;
    else if ('fjrtI()[]-'.includes(ch)) w += 0.33;
    else if ('mwMW'.includes(ch)) w += 0.85;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else w += 0.55;
  }
  return w * tam * (negrito ? 1.06 : 1);
}

export function quebrarLinhas(texto: string, max: number, tam: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  // Só o espaço comum quebra: o espaço inquebrável de "R$ 1.260,00" mantém o valor inteiro na mesma linha.
  for (const p of texto.split(/ +/)) {
    const tenta = atual ? `${atual} ${p}` : p;
    if (largura(tenta, tam) > max && atual) { linhas.push(atual); atual = p; } else atual = tenta;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function pdfRecibo(r: ReciboDados): Uint8Array {
  const t = textoRecibo(r);
  const W = 595, M = 56, larg = W - 2 * M;
  const ops: number[] = [];
  const op = (s: string) => ops.push(...ascii(s));
  const texto = (x: number, y: number, s: string, tam: number, fonte: 'F1' | 'F2' = 'F1') => {
    op(`BT /${fonte} ${tam} Tf ${x} ${y} Td `); ops.push(...literal(s)); op(' Tj ET\n');
  };
  const valor = reais(r.valor);
  // Moldura, título, número e valor em destaque.
  op('0.6 w 0.75 G\n'); op(`${M - 16} 470 ${larg + 32} 330 re S\n`); op('0 G\n');
  texto(M, 768, t.titulo, 20, 'F2');
  texto(M, 750, `Nº ${r.numero}`, 10);
  texto(W - M - largura(valor, 16, true), 762, valor, 16, 'F2');
  op(`0.4 w ${M} 738 m ${W - M} 738 l S\n`);
  let y = 712;
  for (const linha of quebrarLinhas(t.corpo, larg, 11.5)) { texto(M, y, linha, 11.5); y -= 17; }
  y -= 10;
  texto(M, y, t.local, 11.5);
  // Linha de assinatura centralizada.
  const ya = Math.min(y - 70, 540);
  op(`0.6 w ${W / 2 - 130} ${ya} m ${W / 2 + 130} ${ya} l S\n`);
  texto(W / 2 - largura(t.assinante, 11, true) / 2, ya - 15, t.assinante, 11, 'F2');
  if (t.assinanteDoc) texto(W / 2 - largura(t.assinanteDoc, 10) / 2, ya - 29, t.assinanteDoc, 10);

  const objetos: number[][] = [
    ascii('<< /Type /Catalog /Pages 2 0 R >>'),
    ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    ascii('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>'),
    [...ascii(`<< /Length ${ops.length} >>\nstream\n`), ...ops, ...ascii('\nendstream')],
    ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    ascii('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
  ];
  const out: number[] = [...ascii('%PDF-1.4\n%'), 0xe2, 0xe3, 0xcf, 0xd3, 0x0a];
  const offsets: number[] = [];
  objetos.forEach((o, i) => { offsets.push(out.length); out.push(...ascii(`${i + 1} 0 obj\n`), ...o, ...ascii('\nendobj\n')); });
  const xref = out.length;
  out.push(...ascii(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`));
  for (const off of offsets) out.push(...ascii(`${String(off).padStart(10, '0')} 00000 n \n`));
  out.push(...ascii(`trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return new Uint8Array(out);
}

/** Nome do arquivo: "recibo-REC-2026-00902.pdf". */
export const nomeArquivoRecibo = (r: ReciboDados) => `recibo-${r.numero}.pdf`;
