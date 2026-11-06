// 研究業績一覧（index.html）のタブ表示．
// Sugi-kmmm.github.io の publications.js を元に，データの読み込みを data/*.csv（js_includes/data.js）に変更し，
// 全件表示タブ・キーワード検索・横スクロールのタブを加えたもの．

// 種別の表示順（必要に応じて追加・変更してください）
const CATEGORY_ORDER = ['論文（査読あり）', '論文（査読なし）', '国際会議発表（査読あり）', '国際会議発表（査読なし）', '国内会議発表（査読あり）', '国内会議発表（査読なし）', '解説・総説', '著作', '特許', '受賞', 'メディア掲載', '学位論文', 'その他'];

(async function () {
    const status = document.getElementById('publication-status');
    const wrap = document.getElementById('publication-tabs');
    const tablist = wrap.querySelector('.pub-tablist');
    const panel = wrap.querySelector('.pub-panel');
    const search = document.getElementById('publication-search');
    const ALL = 'all';

    let items;
    try {
        items = await loadPublications();
    } catch (e) {
        status.textContent = '業績一覧を読み込めませんでした（' + e.message + '）．';
        return;
    }
    items = items
        // 日付の新しい順．同じ日付なら 口頭 → ポスター → その他 の順，それでも同じならタイトル順
        .sort((a, b) => b.sortKey.localeCompare(a.sortKey)
            || tagIndex(a.tag) - tagIndex(b.tag)
            || a.title.localeCompare(b.title, 'ja'));

    function tagIndex(tag) {
        const i = ['口頭', 'ポスター'].indexOf(tag);
        return i === -1 ? 2 : i;
    }

    if (items.length === 0) {
        status.textContent = '現在掲載している業績はありません．';
        return;
    }

    // 検索用の文字列（全角・半角，大文字・小文字，空白の違いを無視）
    const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    items.forEach(it => { it.haystack = norm([it.title, it.authors, it.detail, it.category, it.tag].join(' ')); });

    let query = '';
    const matches = it => !query || query.split(/[\s　]+/).every(w => !w || it.haystack.includes(norm(w)));

    // 全件表示（左端に固定）＋年の一覧（新しい順．多いときは横スクロール）
    const years = [...new Set(items.map(it => it.year))]
        .sort((a, b) => (/^\d+$/.test(b) - /^\d+$/.test(a)) || b.localeCompare(a, undefined, { numeric: true }));
    const tabs = [{ key: ALL, label: '全件表示' }]
        .concat(years.map(y => ({ key: y, label: y })));
    // 年タブを入れる横スクロールの枠（全件表示タブはこの外に置いて固定する）
    const yearTabs = document.createElement('div');
    yearTabs.className = 'pub-year-tabs';
    yearTabs.setAttribute('role', 'presentation');

    const itemsOf = key => (key === ALL ? items : items.filter(it => it.year === key)).filter(matches);
    const categoryIndex = c => {
        // 完全一致を優先し，次に先頭一致（例:「国内会議発表（口頭）」→「国内会議発表」）
        let i = CATEGORY_ORDER.indexOf(c);
        if (i === -1) i = CATEGORY_ORDER.findIndex(o => c.startsWith(o));
        return i === -1 ? CATEGORY_ORDER.length : i;
    };

    function buildLi(it, showYear) {
        const li = document.createElement('li');
        if (showYear) {
            const y = document.createElement('span');
            y.className = 'pub-year';
            y.textContent = it.year;
            li.appendChild(y);
        }
        if (it.tag) {
            const t = document.createElement('span');
            t.className = 'pub-tag';
            t.textContent = it.tag;
            li.appendChild(t);
        }
        const a = document.createElement('a');
        a.href = it.url;
        a.textContent = it.title;
        li.appendChild(a);
        [it.authors, it.detail].filter(Boolean).forEach(text => {
            const s = document.createElement('span');
            s.className = 'pub-meta';
            s.textContent = text;
            li.appendChild(s);
        });
        return li;
    }

    let current = tabs[0].key;

    function render(key) {
        current = key;
        const groups = new Map();
        itemsOf(key).forEach(it => {
            if (!groups.has(it.category)) groups.set(it.category, []);
            groups.get(it.category).push(it);
        });

        panel.innerHTML = '';
        if (groups.size === 0) {
            const p = document.createElement('p');
            p.className = 'pub-empty';
            p.textContent = query ? '「' + query + '」に一致する業績はありません．' : '業績はありません．';
            panel.appendChild(p);
        }
        // 検索中は全件表示と同じく年を表示する
        const showYear = key === ALL || !!query;
        [...groups.keys()].sort((a, b) => categoryIndex(a) - categoryIndex(b) || a.localeCompare(b, 'ja')).forEach(c => {
            const h = document.createElement('h3');
            h.className = 'pub-category';
            h.textContent = c + '（' + groups.get(c).length + '件）';
            const ul = document.createElement('ul');
            ul.className = 'publication-list';
            groups.get(c).forEach(it => ul.appendChild(buildLi(it, showYear)));
            panel.append(h, ul);
        });

        tablist.querySelectorAll('button').forEach(b => {
            const on = b.dataset.key === key;
            b.setAttribute('aria-selected', on);
            b.tabIndex = on ? 0 : -1;
            if (on) {
                panel.setAttribute('aria-labelledby', b.id);
                // 選んだ年タブがスクロールの外にあれば見える位置まで送る（ページ自体は縦に動かさない）
                if (b.parentNode === yearTabs) {
                    const left = b.offsetLeft - yearTabs.offsetLeft;
                    if (left < yearTabs.scrollLeft || left + b.offsetWidth > yearTabs.scrollLeft + yearTabs.clientWidth) {
                        yearTabs.scrollLeft = left - (yearTabs.clientWidth - b.offsetWidth) / 2;
                    }
                }
            }
            b.querySelector('.pub-count').textContent = itemsOf(b.dataset.key).length;
        });
    }

    function select(key, updateHash) {
        if (!tabs.some(t => t.key === key)) key = tabs[0].key;
        render(key);
        if (updateHash) history.replaceState(null, '', '#' + key);
    }

    tabs.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.id = 'pub-tab-' + t.key;
        b.dataset.key = t.key;
        b.textContent = t.label;
        const count = document.createElement('span');
        count.className = 'pub-count';
        b.appendChild(count);
        b.addEventListener('click', () => select(t.key, true));
        (t.key === ALL ? tablist : yearTabs).appendChild(b);
    });
    tablist.appendChild(yearTabs);

    // 左右キーでタブ移動
    tablist.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const btns = [...tablist.querySelectorAll('button')];
        const i = btns.indexOf(document.activeElement);
        const next = btns[(i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length];
        next.focus();
        next.click();
    });

    // マウスホイールの縦回転でも年タブを横にスクロールできるようにする（はみ出しているときだけ）
    yearTabs.addEventListener('wheel', e => {
        if (yearTabs.scrollWidth <= yearTabs.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        yearTabs.scrollLeft += e.deltaY;
        e.preventDefault();
    }, { passive: false });

    // 左右に続きがあるかどうか（端をぼかす表示に使う）
    const updateEdges = () => {
        const max = yearTabs.scrollWidth - yearTabs.clientWidth;
        yearTabs.classList.toggle('more-left', yearTabs.scrollLeft > 1);
        yearTabs.classList.toggle('more-right', yearTabs.scrollLeft < max - 1);
    };
    yearTabs.addEventListener('scroll', updateEdges, { passive: true });
    window.addEventListener('resize', updateEdges);

    // 検索: 入力のたびに現在のタブを絞り込む（タブの件数も一致件数に変わる）
    search.addEventListener('input', () => {
        query = search.value.trim();
        render(current);
    });

    status.hidden = true;
    wrap.hidden = false;
    search.hidden = false;
    // URL の #2025 や #all で初期タブを指定可能．指定がなければ全件表示
    select(decodeURIComponent(location.hash.slice(1)), false);
    updateEdges();
})();
