// 業績データ（research/<年>/*.md）を読み込み，一覧（index.html）と個別ページ（_layouts/item.html）で使う形にする．
//
// 全業績は GitHub Pages がビルド時に research/index.json にまとめるので，それを1回読むだけ．
// ファイル名の先頭で種類を決める: paper-*.md（論文・発表）/ patent-*.md（特許）/ award-*.md（受賞）/ media-*.md（取材記事）
// 書き方は research/README.md を参照．

const INDEX_URL = 'research/index.json';
const KINDS = ['paper', 'patent', 'award', 'media'];

// ---- 日付: "2024-03-22" → 年・並び替え用キー・表示用（2024年3月22日 / Mar. 22, 2024．js_includes/i18n.js）
function parseDate(text) {
    const m = (text || '').match(/(\d{4})(?:\D+(\d{1,2}))?(?:\D+(\d{1,2}))?/);
    const pad = n => String(n || 0).padStart(2, '0');
    if (!m) return { year: '年不明', sortKey: '0000', label: text || '' };
    const label = dateLabel(m[1], m[2] && Number(m[2]), m[3] && Number(m[3]));
    return { year: m[1], sortKey: m[1] + pad(m[2]) + pad(m[3]), label };
}

// ---- 表のセルに入れる値（文字列，またはリンク {text, href, external}）
const link = (text, href, external) => ({ text, href, external: !!external });
const doiUrl = doi => 'https://doi.org/' + doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');

// ---- 日英の両方を書ける項目（タイトル・著者・掲載誌・受賞者・表彰機関）: 「タイトル（日本語）」「タイトル（英語）」の2つの項目に書く．
// 両方あれば選んでいる言語の方，片方しかなければどちらの言語でもその片方を表示する
function pick(r, key) {
    const ja = r[key + '（日本語）'] || '', en = r[key + '（英語）'] || '';
    return LANG === 'en' ? (en || ja) : (ja || en);
}
// 表示していない方の言語の値（検索用）
function other(r, key) {
    const ja = r[key + '（日本語）'] || '', en = r[key + '（英語）'] || '';
    return LANG === 'en' ? (en ? ja : '') : (ja ? en : '');
}

// 関連業績の書き方: "202407" → 論文 202407．"patent-40" のように種類付きでも可．";" 区切りで複数
function relatedIds(text) {
    return (text || '').split(/[;；,，\s]+/).filter(Boolean)
        .map(v => /^\d+$/.test(v) ? 'paper-' + v : v);
}

// ---- 種類ごとに，1件分のファイルの項目から業績データを作る
//   category: 一覧のグループ（並び順用．日本語）/ categoryLabel: その表示 / tag: 一覧の小ラベル / rows: 個別ページの表（[見出し, 値]）
//   見出しは日本語で書き，表示するときに t() で訳す（js_includes/i18n.js）．決まった値（種別・査読など）もここで t() を通す
const BUILDERS = {
    paper(r) {
        const d = parseDate(r['日付']);
        const doi = r['DOI'];
        const readUrl = doi ? doiUrl(doi) : r['URL'];
        const kind = r['種別'] || 'その他';
        const review = /^査読(あり|なし)$/.test(r['査読']) ? r['査読'] : '';
        return {
            category: kind + (review ? '（' + review + '）' : ''),
            categoryLabel: t(kind) + (review ? paren(t(review)) : ''),
            authors: pick(r, '著者'), venue: pick(r, '掲載誌'), volume: r['巻号ページ'], date: d,
            topButton: readUrl ? link(t('論文を読む'), readUrl, true) : null,
            pdf: r['PDF'],
            rows: [
                ['種別', t(r['種別'])], ['査読', t(r['査読'])], ['著者', pick(r, '著者')], ['言語', t(r['言語'])],
                ['掲載誌', pick(r, '掲載誌')], ['巻，号，ページ', r['巻号ページ']],
                [r['種別'] === '論文' ? '出版日' : '発表日', d.label],
                ['受賞', '@awards'],
                ['DOI', doi ? link(doi, doiUrl(doi), true) : '']
            ]
        };
    },
    patent(r) {
        const d = parseDate(r['公開日'] || r['出願日']);
        return {
            category: '特許', categoryLabel: t('特許'), tag: t(r['状態']),
            authors: r['発明者'], venue: r['出願人'], volume: r['登録番号'] || r['公開番号'], date: d,
            rows: [
                ['種別', t('特許') + (r['状態'] ? paren(t(r['状態'])) : '')], ['発明者', r['発明者']], ['出願人', r['出願人']],
                ['出願番号', r['出願番号']], ['出願日', parseDate(r['出願日']).label],
                ['公開番号', r['公開番号']], ['公開日', r['公開日'] ? parseDate(r['公開日']).label : ''],
                ['登録番号', r['登録番号']], ['登録日', r['登録日'] ? parseDate(r['登録日']).label : '']
            ]
        };
    },
    award(r) {
        const d = parseDate(r['日付']);
        return {
            category: '受賞', categoryLabel: t('受賞'),
            authors: pick(r, '受賞者'), venue: pick(r, '表彰機関'), date: d,
            related: relatedIds(r['関連業績']),
            rows: [
                ['種別', t('受賞')], ['受賞者', pick(r, '受賞者')], ['受賞日', d.label], ['表彰機関', pick(r, '表彰機関')],
                ['関連研究', '@related'],
                ['URL', r['URL'] ? link(r['URL'], r['URL'], true) : '']
            ]
        };
    },
    media(r) {
        const d = parseDate(r['日付']);
        return {
            category: 'メディア掲載', categoryLabel: t('メディア掲載'), tag: tList(r['種別']),
            venue: r['媒体'], date: d,
            topButton: r['URL'] ? link(t('記事を見る'), r['URL'], true) : null,
            rows: [
                ['種別', t('メディア掲載') + (r['種別'] ? paren(tList(r['種別'])) : '')], ['媒体', r['媒体']], ['掲載日', d.label],
                ['URL', r['URL'] ? link(r['URL'], r['URL'], true) : '']
            ]
        };
    }
};

// ---- 全データを読み込む（1回だけ）
let publicationsPromise;
function loadPublications() {
    if (!publicationsPromise) publicationsPromise = (async () => {
        const res = await fetch(INDEX_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(INDEX_URL + ' を読み込めませんでした（' + res.status + '）');
        const items = [];
        (await res.json()).forEach(entry => {
            // ファイル名（例 research/2024/paper-202407.md）から種類と ID を決める
            const id = entry.file.split('/').pop().replace(/\.md$/, '');
            const kind = id.split('-')[0];
            if (!KINDS.includes(kind)) return;
            // 値はすべて文字列にそろえる（空欄は ''）
            const r = {};
            Object.entries(entry.data || {}).forEach(([k, v]) => { r[k] = v == null ? '' : String(v).trim(); });
            if (!pick(r, 'タイトル')) return;
            const it = BUILDERS[kind](r);
            Object.assign(it, { kind, id, title: pick(r, 'タイトル'), url: entry.url, year: it.date.year, sortKey: it.date.sortKey });
            if (!it.categoryLabel) it.categoryLabel = it.category;
            it.otherLang = ['タイトル', '著者', '掲載誌', '受賞者', '表彰機関'].map(k => other(r, k)).join(' ');
            it.detail = [it.venue, it.volume, it.date.label].filter(Boolean).join(', ');
            items.push(it);
        });
        // 受賞 ⇔ 関連業績 を相互にリンクする
        const byId = new Map(items.map(it => [it.id, it]));
        items.forEach(it => { it.awards = []; });
        items.filter(it => it.kind === 'award').forEach(a => {
            a.relatedItems = a.related.map(id => byId.get(id)).filter(Boolean);
            a.relatedItems.forEach(p => p.awards.push(a));
        });
        return items;
    })();
    return publicationsPromise;
}

// ---- 個別ページの表の値を DOM にする（CSV の文字はすべて文字として扱い，HTML としては解釈しない）
function cellNodes(it, value) {
    const toNode = v => {
        if (typeof v === 'string') return document.createTextNode(v);
        const a = document.createElement('a');
        a.href = v.href;
        a.textContent = v.text;
        if (v.external) { a.target = '_blank'; a.rel = 'noopener'; }
        return a;
    };
    let values;
    if (value === '@awards') values = it.awards.map(a => link(a.title + (a.venue ? paren(a.venue) : ''), a.url));
    else if (value === '@related') values = (it.relatedItems || []).map(p => link(p.title, p.url));
    else values = value ? [value] : [];
    const nodes = [];
    values.forEach((v, i) => {
        if (i) nodes.push(document.createElement('br'));
        nodes.push(toNode(v));
    });
    return nodes;
}
