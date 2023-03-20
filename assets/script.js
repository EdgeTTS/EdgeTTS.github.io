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
rate.addEventListener('change', e => rate_str.textContent = rate.value >= 0 ? `+${rate.value}%` : `${rate.value}%`)
pitch.addEventListener('change', e => pitch_str.textContent = pitch.value >= 0 ? `+${pitch.value}Hz` : `${pitch.value}Hz`)
max_threads.addEventListener('change', e => max_threads_int.textContent = max_threads.value)
mergefiles.addEventListener('change', e => mergefiles_str.textContent = mergefiles.value == 30 ? "ВСЕ" : `${mergefiles.value} шт.`)


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
	if (display_str == 'none') {
		document.querySelector("section").classList.replace("options", "optionslite");
	} else {
		document.querySelector("section").classList.replace("optionslite", "options");
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
		if ( is_file == true ) {
			textArea.value += "Часть " + tmp_ind + ":\n" + part + "\n\n"
		}
		statArea.value += "Часть " + (tmp_ind).toString().padStart(4, '0') + ": Открыта\n"
	}
	stat_info.textContent = ""//"Открыто"
	stat_str.textContent = `0 / ${book.all_sentences.length}`
}

function get_audio() {
	stat_info.textContent = "Обработано"
	const stat_count = stat_str.textContent.split(' / ');
	stat_str.textContent = "0 / " + stat_count[1]
	const merge = (mergefiles.value == 1) ? false : true;
	
	if ( !book_loaded )  {
		get_text("Text", textArea.value, false)
	}
	let n = 0
	let fix_n = 0
	let file_name_ind = 0
	let file_name = book.file_names[file_name_ind][0]
	let parts_book = []
	let threads_info = { count: parseInt(max_threads.value), stat: stat_str }
	let timerId = setTimeout(function tick() {
		if ( threads_info.count < parseInt(max_threads.value) ) {
			threads_info.count = parseInt(max_threads.value)
		}
		if ( n < threads_info.count && n < book.all_sentences.length) {
			if ( book.file_names[file_name_ind][1] > 0 && book.file_names[file_name_ind][1] <= n ) {
				file_name_ind += 1
				file_name = book.file_names[file_name_ind][0]
				fix_n = n
			}
			
			parts_book.push(
				new SocketEdgeTTS(
					n,
					file_name,// + " " +
					(n+1-fix_n).toString().padStart(4, '0'),
					"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
					String(pitch_str.textContent),
					"+" + String(rate.value) + "%",
					"+0%",
					book.all_sentences[n],
					statArea,
					threads_info,
					merge
				)
			)
			n += 1
			timerId = setTimeout(tick, 100)
		} else
		if ( n >= threads_info.count ) {
			timerId = setTimeout(tick, 5000)
		}
	}, 10)
	
	if ( merge ) {
		let timerSave = setTimeout(function tick() {
			
				let count_save_part = 0
				let mp3_length = 0
				for (let part of parts_book) {
					if ( part.mp3_saved == true ) {
						count_save_part += 1
						mp3_length += part.my_uint8Array.length
					}
				}
				
				if ( count_save_part == book.all_sentences.length && mp3_length > 0 ) {
					let num_mp3 = 0
					let last_ind = 0
					let count_mp3 = 0
					let part_mp3_length = 0
					for (let ind_mp3 = 0; ind_mp3 < parts_book.length; ind_mp3++) {
						part_mp3_length += parts_book[ind_mp3].my_uint8Array.length
						if (mergefiles.value < 30 && (count_mp3 >= mergefiles.value-1 || (
							ind_mp3 < parts_book.length-1 && parts_book[ind_mp3].my_filename != parts_book[ind_mp3 + 1].my_filename
						))) {
							num_mp3 += 1
							save_merge(parts_book, num_mp3, last_ind, ind_mp3, part_mp3_length)
							if (ind_mp3 < parts_book.length-1 && parts_book[ind_mp3].my_filename != parts_book[ind_mp3 + 1].my_filename) {
								num_mp3 = 0
							}
							count_mp3 = 0
							part_mp3_length = 0
							last_ind = ind_mp3 + 1
						} else {
							count_mp3 += 1
						}
					}
					if (count_mp3 > 0 && part_mp3_length > 0) {
						num_mp3 += 1
						save_merge(parts_book, num_mp3, last_ind, parts_book.length-1, part_mp3_length)
					}
					
				} else {
					timerSave = setTimeout(tick, 10000)
				}
		}, 10000)	
		
	}
}

function save_merge(parts_book, num_mp3, from_ind, to_ind, mp3_length) {
	const combinedUint8Array = new Uint8Array(mp3_length)
	let pos = 0
	
	for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
		combinedUint8Array.set(parts_book[ind_mp3].my_uint8Array, pos)
		pos += parts_book[ind_mp3].my_uint8Array.length
	}
	
	var blob_mp3 = new Blob([combinedUint8Array.buffer])
	const url = window.URL.createObjectURL(blob_mp3)
	const link = document.createElement('a')
	link.href = url
	
	
	if (num_mp3 == 1 && to_ind < parts_book.length-1 && parts_book[to_ind].my_filename != parts_book[to_ind + 1].my_filename) {
		link.download = parts_book[from_ind].my_filename + '.mp3'
	} else
	if (mergefiles.value < 30 && mergefiles.value < parts_book.length) {
		link.download = parts_book[from_ind].my_filename + " " + (num_mp3).toString().padStart(4, '0') + '.mp3'
	} else {
		link.download = parts_book[from_ind].my_filename + '.mp3'
	}
	
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	window.URL.revokeObjectURL(url)
	
	for (let ind_mp3 = from_ind; ind_mp3 <= to_ind; ind_mp3++) {
		parts_book[ind_mp3].clear()
	}
}

const start = () => {
	get_audio()
}