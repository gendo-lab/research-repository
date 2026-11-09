// 画面の文言の日本語 / 英語切り替え．
//
// 切り替えるのはボタン・見出し・項目名などの決まった文言と，種別・査読などの決まった値だけ．
// 業績ファイルに書いた内容（タイトル・著者・掲載誌など）はそのまま表示する．
// 選んだ言語はブラウザに保存し，切り替えたらページを読み込み直す．
// 文言を追加・変更するときは下の DICT（英語訳）を編集する．日本語はキーそのもの．

// URL に ?lang=en（または ?lang=ja）を付けると，その言語で開く（英語版のリンクを共有するとき用）
const LANG = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    try {
        if (q === 'en' || q === 'ja') localStorage.setItem('lang', q);
        return (q || localStorage.getItem('lang')) === 'en' ? 'en' : 'ja';
    } catch (e) { return q === 'en' ? 'en' : 'ja'; }
})();
document.documentElement.lang = LANG;

const DICT = {
    // 一覧
    '読み込み中…': 'Loading…',
    'タイトル・著者・掲載誌で検索（スペース区切りで AND 検索）': 'Search by title, author or venue (space-separated words are ANDed)',
    '研究業績を検索': 'Search publications',
    '年別の研究業績': 'Publications by year',
    '全件表示': 'All',
    '業績一覧を読み込めませんでした': 'Failed to load the publication list',
    '現在掲載している業績はありません．': 'No publications yet.',
    '業績はありません．': 'No publications.',
    '一致する業績はありません': 'No publications match',
    '件': '',
    // 種別（一覧のグループ名・表の値）
    '論文': 'Journal Paper',
    '国際会議発表': 'International Conference',
    '国内会議発表': 'Domestic Conference',
    '解説・総説': 'Review / Commentary',
    '著作': 'Book',
    '特許': 'Patent',
    '受賞': 'Award',
    'メディア掲載': 'Media',
    '学位論文': 'Thesis',
    'その他': 'Other',
    '査読あり': 'Peer-reviewed',
    '査読なし': 'Not peer-reviewed',
    '日本語': 'Japanese',
    '英語': 'English',
    // 特許の状態
    '登録': 'Granted',
    '公開': 'Published',
    '出願': 'Filed',
    // メディアの種別
    'TV': 'TV',
    '全国紙': 'National newspaper',
    '地方紙': 'Local newspaper',
    '専門紙': 'Trade newspaper',
    '専門誌': 'Trade magazine',
    'Webメディア': 'Web media',
    '患者会報': 'Patient association newsletter',
    '施設内報': 'Facility newsletter',
    '書籍': 'Book',
    // 個別ページ
    '研究業績一覧へ戻る': 'Back to publication list',
    '業績データを読み込めませんでした': 'Failed to load the publication data',
    '指定された業績が見つかりませんでした．': 'The requested publication was not found.',
    '論文を読む': 'Read paper',
    '記事を見る': 'View article',
    'PDFをダウンロード': 'Download PDF',
    '本文の PDF ファイル（T2R2）を開きます': 'Opens the full-text PDF (T2R2)',
    // 表の項目名
    'タイトル': 'Title',
    '種別': 'Type',
    '査読': 'Peer review',
    '著者': 'Authors',
    '言語': 'Language',
    '掲載誌': 'Journal / Conference',
    '巻，号，ページ': 'Vol., No., Pages',
    '出版日': 'Published',
    '発表日': 'Presented',
    '発明者': 'Inventors',
    '出願人': 'Applicants',
    '出願番号': 'Application No.',
    '出願日': 'Filing date',
    '公開番号': 'Publication No.',
    '公開日': 'Publication date',
    '登録番号': 'Patent No.',
    '登録日': 'Registration date',
    '受賞者': 'Recipients',
    '受賞日': 'Date',
    '表彰機関': 'Awarded by',
    '関連研究': 'Related work',
    '媒体': 'Media outlet',
    '掲載日': 'Date',
    // ヘッダ
    '東京科学大学 Institute of Science Tokyo': 'Institute of Science Tokyo',
    '年不明': 'Unknown'
};

// 文言を今の言語にする（辞書に無いものはそのまま）
function t(text) {
    return LANG === 'en' && text && Object.prototype.hasOwnProperty.call(DICT, text) ? DICT[text] : text;
}

// 「TV, Webメディア」のように「, 」で並んだ値も1つずつ訳す
function tList(text) {
    return LANG === 'en' && text ? text.split(/\s*[,，、]\s*/).map(t).join(', ') : text;
}

// 「（」「）」の括弧（英語では半角）
const paren = s => LANG === 'en' ? ' (' + s + ')' : '（' + s + '）';

// 日付の表示（日本語 2024年3月22日 / 英語 Mar. 22, 2024）
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
function dateLabel(y, m, d) {
    if (LANG !== 'en') return y + '年' + (m ? m + '月' : '') + (d ? d + '日' : '');
    if (!m) return String(y);
    return MONTHS[m - 1] + (d ? ' ' + d + ',' : '') + ' ' + y;
}

// HTML に書いた文言を訳す: data-i18n（中身）/ data-i18n-placeholder / data-i18n-aria-label / data-i18n-alt
function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n],[data-i18n-placeholder],[data-i18n-aria-label],[data-i18n-alt]').forEach(e => {
        if (e.dataset.i18n !== undefined) e.textContent = t(e.textContent.trim());
        if (e.dataset.i18nPlaceholder !== undefined) e.placeholder = t(e.placeholder);
        if (e.dataset.i18nAriaLabel !== undefined) e.setAttribute('aria-label', t(e.getAttribute('aria-label')));
        if (e.dataset.i18nAlt !== undefined) e.alt = t(e.alt);
    });
}

// ヘッダ（js_includes/header.html）の切り替えボタン
function setupLangSwitch(root) {
    applyI18n(root);
    (root || document).querySelectorAll('.lang-switch button').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.lang === LANG);
        b.addEventListener('click', () => {
            if (b.dataset.lang === LANG) return;
            try { localStorage.setItem('lang', b.dataset.lang); } catch (e) { }
            location.reload();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => applyI18n());
