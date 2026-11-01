//DOM to TXT
// Строчные элементы FB2 и XHTML: их текст продолжает текущую строку.
// Все остальные элементы (абзацы, заголовки, секции, стихи, ячейки, <br>…) считаются блочными
// и начинают новую строку — для незнакомого тега лишний перенос безопаснее склеенных слов.
const INLINE_TAGS = new Set([
	'a', 'emphasis', 'strong', 'strikethrough', 'sub', 'sup', 'code', 'style',                          // FB2
	'span', 'em', 'i', 'b', 'u', 's', 'small', 'big', 'abbr', 'q', 'font', 'mark', 'del', 'ins', 'tt'  // XHTML
])

// Текст дерева в виде строк: обход в глубину посещает каждый текстовый узел ровно один раз,
// поэтому вложенные секции/главы не дублируются, а абзацы не склеиваются.
function domToText(root) {
	const lines = []
	let line = ''
	const breakLine = () => {
		const text = line.replace(/[ \t\r\n]+/g, ' ').trim()
		if (text) lines.push(text)
		line = ''
	}
	const walk = node => {
		for (const child of node.childNodes) {
			if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
				line += child.data
			} else if (child.nodeType === Node.ELEMENT_NODE) {
				const is_block = !INLINE_TAGS.has(child.localName)
				if (is_block) breakLine()
				walk(child)
				if (is_block) breakLine()
			}
		}
	}
	walk(root)
	breakLine()
	return lines.join('\n')
}

//FB2 to TXT
function convertFb2ToTxt(fb2String) {
	const fb2Doc = new DOMParser().parseFromString(fb2String, 'application/xml')
	// Основной текст — первый <body>; следующие (name="notes" и т. п.) содержат сноски
	const bodyNode = fb2Doc.getElementsByTagName('body')[0]
	return bodyNode ? domToText(bodyNode) : ''
}

//EPUB to TXT
// Порядок чтения задаёт spine из OPF: каждый файл книги входит в него ровно один раз.
// Оглавление (toc.ncx) для этого не годится: его пункты вложены и могут ссылаться
// на один файл несколько раз (chapter.xhtml#a, chapter.xhtml#b) или пропускать файлы.
async function convertEpubToTxt(epubBinary) {
	const zip = await JSZip.loadAsync(epubBinary)
	const parser = new DOMParser()
	const parseFile = async (path, type) => parser.parseFromString(await zip.file(path).async('text'), type)

	const opfPath = (await parseFile('META-INF/container.xml', 'application/xml'))
		.getElementsByTagName('rootfile')[0].getAttribute('full-path')
	const opfDoc = await parseFile(opfPath, 'application/xml')
	const hrefById = new Map([...opfDoc.getElementsByTagName('item')].map(item => [item.getAttribute('id'), item.getAttribute('href')]))
	// href в OPF — URL относительно самого OPF (может содержать ../ и %-кодирование)
	const resolve = href => decodeURIComponent(new URL(href, 'file:///' + opfPath).pathname.slice(1))

	const chapters = []
	for (const itemref of opfDoc.getElementsByTagName('itemref')) {
		if (itemref.getAttribute('linear') === 'no') continue // вспомогательное содержимое вне основного чтения (сноски и т. п.)
		const href = hrefById.get(itemref.getAttribute('idref'))
		const path = href && resolve(href)
		if (!path || !zip.file(path)) continue
		const htmlDoc = await parseFile(path, 'application/xhtml+xml')
		const bodyNode = htmlDoc.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'body')[0]
		if (bodyNode) chapters.push(domToText(bodyNode))
	}
	return chapters.join('\n')
}


//ZIP to TXT
function convertZipToTxt(zipFile) {

    JSZip.loadAsync(zipFile)
    .then(function (zip) {
        zip.forEach(function (relativePath, file) {
			const file_name_toLowerCase = file.name.toLowerCase()
			if ( file_name_toLowerCase.endsWith('.txt') ) {
				file.async('text').then( result => get_text(file.name.slice(0, file.name.lastIndexOf(".")), result, true, "", "", "") )
			} else if ( file_name_toLowerCase.endsWith('.fb2') ) {
				file.async('text').then( result => get_text(file.name.slice(0, file.name.lastIndexOf(".")), convertFb2ToTxt(result), true, "", "", "") )
			} else if ( file_name_toLowerCase.endsWith('.epub') ) {
				file.async('ArrayBuffer').then( result => unzip_epub(file, result) )
			}	
        })
    }, function (e) {
        console.log(e.message)
    })
}

function unzip_epub(file, file_text) {				
	const blob = new Blob([file_text], { type: 'application/epub+zip' });
	const epub_file = new File([blob], 'my_epub_file_name.epub', { type: 'application/epub+zip' });					
	convertEpubToTxt(epub_file).then(result => get_text(file.name.slice(0, file.name.lastIndexOf(".")), result, true, "", "", ""))
}