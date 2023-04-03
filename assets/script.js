const text = document.querySelector('.text')
const pitch = document.querySelector('.pitch')
const pitch_str = document.querySelector('#pitch-str')
const rate = document.querySelector('.rate')
const rate_str = document.querySelector('#rate-str')
const max_threads = document.querySelector('.max-threads')
const max_threads_int = document.querySelector('#max-threads-int')
const mergefiles = document.querySelector('.mergefiles')
const mergefiles_str = document.querySelector('#mergefiles-str')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const settingsButton = document.querySelector('.settingsbutton')
const textArea = document.getElementById('text-area')
const statArea = document.getElementById('stat-area')
const stat_info = document.querySelector('#stat-info')
const stat_str = document.querySelector('#stat-str')

const fileInputLex = document.getElementById('file-input-lex')
const fileInput = document.getElementById('file-input')
const fileButtonLex = document.getElementById('file-button-lex')
const fileButton = document.getElementById('file-button')
saveButton.addEventListener('click', e => start())
//save_alloneButton.addEventListener('click', e => start_allone())
settingsButton.addEventListener('click', e => lite_mod())
rate.addEventListener('input', e => rate_str.textContent = rate.value >= 0 ? `+${rate.value}%` : `${rate.value}%`)
pitch.addEventListener('input', e => pitch_str.textContent = pitch.value >= 0 ? `+${pitch.value}Hz` : `${pitch.value}Hz`)
max_threads.addEventListener('input', e => max_threads_int.textContent = max_threads.value)
mergefiles.addEventListener('input', e => mergefiles_str.textContent = mergefiles.value == 100 ? "ВСЕ" : `${mergefiles.value} шт.`)


stat_info.addEventListener('click', () => {
	if (textArea.style.display == 'none') {
		statArea.style.display = (statArea.style.display == 'none') ? 'block' : 'none';
	}
});

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 4200
var lexx = []
var book
var book_loaded = false

var parts_book = []
var file_name_ind = 0
var num_book = 0
var fix_num_book = 0
var threads_info = { count: parseInt(max_threads.value), stat: stat_str }
var run_work = false
var save_path_handle

document.addEventListener("DOMContentLoaded", function(event) {
	lite_mod()
});

fileButtonLex.addEventListener('click', () => {
	fileInputLex.click();
})

fileButton.addEventListener('click', () => {
	fileInput.click();
})

fileInputLex.addEventListener('change', (event) => {
	lexx = []
	const file = event.target.files[0]
	
	if (file) {
		const reader = new FileReader()
		
		reader.onload = () => {
			lexx = reader.result.split("\n")
		}
		reader.readAsText(file)
		fileButtonLex.textContent = "Загружен"
	} else {
		fileButtonLex.textContent = "Загрузить"
	}
})

fileInput.addEventListener('change', (event) => {
	run_work = false
	book_loaded = false
	statArea.value = ""
	
	if (book) {
		book.clear()
		book = null
	}
	
	if (event.target.files.length == 0) {
		fileButton.textContent = "Открыть"
		stat_info.textContent = ""//"Открыто"
	}
	
	for (let file of event.target.files) {
		stat_info.textContent = ""
		stat_str.textContent = "0 / 0"
		
		if (file) {
			fileButton.textContent = "Обработка..."
			const reader = new FileReader()
			reader.onload = () => {
				book_loaded = true
				const file_name_toLowerCase = file.name.toLowerCase()
				
				if ( file_name_toLowerCase.endsWith('.txt') ) {
					get_text(file.name.slice(0, file.name.lastIndexOf(".")), reader.result, true)	
				} else if ( file_name_toLowerCase.endsWith('.fb2') ) {
					get_text(file.name.slice(0, file.name.lastIndexOf(".")), convertFb2ToTxt(reader.result), true)	
				} else if ( file_name_toLowerCase.endsWith('.epub') ) {
					convertEpubToTxt(file).then(result => get_text(file.name.slice(0, file.name.lastIndexOf(".")), result, true))
				} else if ( file_name_toLowerCase.endsWith('.zip') ) {
					convertZipToTxt(file)
				}
				fileButton.textContent = "Открыты"
			}
			
			reader.readAsText(file)
		} else {
			fileButton.textContent = "Открыть"
		}
	}

})



function lite_mod() {
	const display_str = (textArea.style.display == 'none') ? 'block' : 'none';
	textArea.style.display = display_str;
	statArea.style.display = display_str;
	document.querySelector('#div-pitch').style.display = display_str;
	document.querySelector('#div-threads').style.display = display_str;
	document.querySelector('#div-mergefiles').style.display = display_str;
	
	if (book && book.all_sentences.length > 0) {
		textArea.value = ""
	}
	
	if (display_str == 'none') {
		document.querySelector("section").classList.replace("options", "optionslite");
	} else {
		document.querySelector("section").classList.replace("optionslite", "options");
		
		if (book && book.all_sentences.length > 0) {
			let tmp_ind = 0
			for (let part of book.all_sentences) {
				tmp_ind += 1
				textArea.value += "Часть " + tmp_ind + ":\n" + part + "\n\n"
			}
		}
		
	}
}

function get_text(_filename, _text, is_file) {
	statArea.value = ""
	if ( is_file == true ) {
		textArea.value = ""
	}	
	
	if (book && is_file) {
		book.addNewText(_filename, _text)
	} else {
		if (book) {
			book.clear()
			book = null
		}

		book = new ProcessingFile(
			_filename,
			_text,
			FIRST_STRINGS_SIZE,
			LAST_STRINGS_SIZE,
			lexx
		)	
	}
	
	let tmp_ind = 0
	for (let part of book.all_sentences) {
		tmp_ind += 1
		if ( is_file == true && textArea.style.display != 'none') {
			textArea.value += "Часть " + tmp_ind + ":\n" + part + "\n\n"
		}
		statArea.value += "Часть " + (tmp_ind).toString().padStart(4, '0') + ": Открыта\n"
	}
	stat_info.textContent = ""//"Открыто"
	stat_str.textContent = `0 / ${book.all_sentences.length}`
	
	//Очистка ранее запущенной обработки
	clear_old_run()
}

function clear_old_run() {
	if (parts_book) {
		for (let part of parts_book) {
			if (part) part.clear()
		}
	}
	parts_book = []
	file_name_ind = 0
	num_book = 0
	fix_num_book = 0
	threads_info = { count: parseInt(max_threads.value), stat: stat_str }	
}

function add_edge_tts(merge) {
	if (run_work == true) {
		if (book && num_book < threads_info.count) {
			let file_name = book.file_names[file_name_ind][0]
			let timerId = setTimeout(function tick() {
				if ( threads_info.count < parseInt(max_threads.value) ) {
					threads_info.count = parseInt(max_threads.value)
				}
				if ( num_book < threads_info.count && num_book < book.all_sentences.length) {
					if ( book.file_names[file_name_ind][1] > 0 && book.file_names[file_name_ind][1] <= num_book ) {
						file_name_ind += 1
						file_name = book.file_names[file_name_ind][0]
						fix_num_book = num_book
					}
					
					parts_book.push(
						new SocketEdgeTTS(
							num_book,
							file_name,// + " " +
							(num_book+1-fix_num_book).toString().padStart(4, '0'),
							"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
							String(pitch_str.textContent),
							rate_str.textContent,
							"+0%",
							book.all_sentences[num_book],
							statArea,
							threads_info,
							merge
						)
					)
					num_book += 1
				}
			}, 100)
		}
		if (merge) do_marge()
	}
}

function get_audio() {
	clear_old_run()
	run_work = true
	stat_info.textContent = "Обработано"
	const stat_count = stat_str.textContent.split(' / ');
	stat_str.textContent = "0 / " + stat_count[1]
	const merge = (mergefiles.value == 1) ? false : true;
	
	if ( !book_loaded )  {
		get_text("Text", textArea.value, false)
	}
	add_edge_tts(merge)
}

async function saveFiles(fix_filename, blob, from_ind, to_ind) {
	const new_folder_handle = await save_path_handle.getDirectoryHandle(parts_book[from_ind].my_filename, { create: true });
	const fileHandle = await new_folder_handle.getFileHandle(fix_filename, { create: true });
	const writableStream = await fileHandle.createWritable();
	const writable = writableStream.getWriter();
	await writable.write(blob);
	await writable.close();
	
	for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
		parts_book[ind_mp3].clear()
	}
}

function save_merge(num_mp3, from_ind, to_ind, mp3_length) {
	if (parts_book[from_ind].start_save == false) {
		parts_book[from_ind].start_save = true	
		const combinedUint8Array = new Uint8Array(mp3_length)
		let pos = 0
		
		for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
			combinedUint8Array.set(parts_book[ind_mp3].my_uint8Array, pos)
			pos += parts_book[ind_mp3].my_uint8Array.length
		}
		
		var blob_mp3 = new Blob([combinedUint8Array.buffer])
		var fix_filename = "file.mp3"
		if (num_mp3 == 1 && to_ind < parts_book.length-1 && parts_book[to_ind].my_filename != parts_book[to_ind + 1].my_filename) {
			fix_filename = parts_book[from_ind].my_filename + '.mp3'
		} else
		if (mergefiles.value < 100 && mergefiles.value < parts_book.length) {
			fix_filename = parts_book[from_ind].my_filename + " " + (num_mp3).toString().padStart(4, '0') + '.mp3'
		} else {
			fix_filename = parts_book[from_ind].my_filename + '.mp3'
		}
		
		if (save_path_handle ?? false) {
			saveFiles(fix_filename, blob_mp3, from_ind, to_ind)
		} else {	
			const url = window.URL.createObjectURL(blob_mp3)
			const link = document.createElement('a')
			link.href = url
			link.download = fix_filename
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
			window.URL.revokeObjectURL(url)
			
			for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
				parts_book[ind_mp3].clear()
			}
		}
	}
}

function do_marge() {
	let save_part = false
	let count_mergefiles = parseInt(mergefiles.value)
	if (count_mergefiles >= 100) {
		count_mergefiles = book.all_sentences.length
	}
	
	var books_map = []
	var sav_ind = true
	var last_ind = 0
	var part_mp3_length = 0
	var count_mp3 = 0
	var num_mp3 = 1
	let names_map = book.file_names.map(item => item[1])
	for (let ind = 0; ind < book.all_sentences.length; ind++) {
		
		if (parts_book && ind < parts_book.length && parts_book[ind].mp3_saved == true) {
			if (sav_ind == true) {
				part_mp3_length += parts_book[ind].my_uint8Array.length
			}
		} else {
			sav_ind = false
			part_mp3_length = 0
		}
	
		if (count_mp3 >= count_mergefiles-1 || ind == book.all_sentences.length-1 || names_map.includes(ind+1) ) {
			books_map.push([sav_ind, last_ind, ind, part_mp3_length, num_mp3])
			sav_ind = true
			last_ind = ind+1
			part_mp3_length = 0
			count_mp3 = 0
			if ( names_map.includes(ind+1) ) {
				num_mp3 = 1
			} else {
				num_mp3 += 1				
			}
		} else {
			count_mp3 += 1
		}
	}

	if (books_map.length > 0) {
		for (let book_map of books_map) {
			if (book_map[0] == true && book_map[3] > 0) {
				save_merge(book_map[4], book_map[1], book_map[2], book_map[3])
			}
		}
	}
}

async function selectDirectory() {
  try {
    save_path_handle = await window.showDirectoryPicker()
    const fileHandle = await save_path_handle.getFileHandle('temp.txt', {create: true})
    const writable = await fileHandle.createWritable()
    await writable.close()
    await fileHandle.remove()
	get_audio()
  } catch (err) {
    console.log('err', err);
	save_path_handle = null
	get_audio()
  }
}

const start = () => {
	selectDirectory()
}