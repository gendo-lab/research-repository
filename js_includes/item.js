// 業績1件の個別ページ（_layouts/item.html）の表示．
// research/index.json から，今のページの URL に対応する業績を探して表を作る．
(async function () {
    const root = document.getElementById('item');
    const status = document.getElementById('item-status');
    const el = (tag, props, children) => {
        const e = Object.assign(document.createElement(tag), props || {});
        (children || []).forEach(c => e.append(c));
        return e;
    };
    const backButton = () => el('p', {}, [el('a', { href: 'index.html', className: 'back-to-top-button', textContent: t('研究業績一覧へ戻る') })]);

    let items;
    try {
        items = await loadPublications();
    } catch (e) {
        status.textContent = t('業績データを読み込めませんでした') + paren(e.message) + (LANG === 'en' ? '.' : '．');
        return;
    }
    // 今のページの URL（…/research/2024/paper-202407.html）に対応する業績を探す
    //（GitHub Pages は .html を省いた URL でも開けるので，.html の有無は区別しない）
    const strip = u => u.replace(/\.html$/, '');
    const path = strip(decodeURIComponent(location.pathname));
    const it = items.find(x => path.endsWith('/' + strip(x.url)));
    if (!it) {
        status.textContent = t('指定された業績が見つかりませんでした．');
        root.append(backButton());
        return;
    }
    document.title = it.title + ' | Gen ENDO Lab. Research Repository';
    status.remove();

    root.append(el('h2', { textContent: it.title }));
    if (it.topButton) {
        root.append(el('a', {
            href: it.topButton.href, className: 'paper-link-button',
            target: '_blank', rel: 'noopener', textContent: it.topButton.text
        }));
    }

    const table = el('table', { className: 'publication-table' });
    [['タイトル', it.title]].concat(it.rows).forEach(([th, value]) => {
        const nodes = cellNodes(it, value);
        if (nodes.length) table.append(el('tr', {}, [el('th', { textContent: t(th) }), el('td', {}, nodes)]));
    });
    root.append(table);

    // PDF（T2R2 などに置いてある本文ファイルの URL）があるときだけ表示
    if (it.pdf) {
        root.append(
            el('a', { href: it.pdf, className: 'pdf-download-button', target: '_blank', rel: 'noopener', textContent: t('PDFをダウンロード') }),
            el('p', { className: 'pdf-download-note', textContent: t('本文の PDF ファイル（T2R2）を開きます') })
        );
    }
    root.append(backButton());
})();
