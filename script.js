const text = document.querySelector('.text')
const pitch = document.querySelector('.pitch')
const pitch_str = document.querySelector('#pitch-str')
const rate = document.querySelector('.rate')
const rate_str = document.querySelector('#rate-str')
const max_threads = document.querySelector('.max-threads')
const max_threads_int = document.querySelector('#max-threads-int')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const save_alloneButton = document.querySelector('.save_allone')
const textArea = document.getElementById('text-area')
const statArea = document.getElementById('stat-area')
const stat_str = document.querySelector('#stat-str')

const fileInputLex = document.getElementById('file-input-lex')
const fileInput = document.getElementById('file-input')
const fileButtonLex = document.getElementById('file-button-lex')
const fileButton = document.getElementById('file-button')

saveButton.addEventListener('click', e => start())
save_alloneButton.addEventListener('click', e => start_allone())
rate.addEventListener('change', e => rate_str.textContent = rate.value >= 0 ? `+${rate.value}%` : `${rate.value}%`)
pitch.addEventListener('change', e => pitch_str.textContent = pitch.value >= 0 ? `+${pitch.value}Hz` : `${pitch.value}Hz`)
max_threads.addEventListener('change', e => max_threads_int.textContent = max_threads.value)

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 4200
var lexx = []
var book
var book_loaded = false

//document.addEventListener("DOMContentLoaded", function(event) {
	//load_lex();
//});

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
	const file = event.target.files[0]
	stat_str.textContent = "0 / 0"
	
	if (file) {
		fileButton.textContent = "Обработка..."
		textArea.value = ""
		const reader = new FileReader()
		reader.onload = () => {
			book_loaded = true
			const file_name_toLowerCase = file.name.toLowerCase()
			
			if ( file_name_toLowerCase.endsWith('.txt') ) {
				get_text(file.name.slice(0, file.name.lastIndexOf(".")), reader.result, true)	
			} else if ( file_name_toLowerCase.endsWith('.fb2') ) {
				get_text(file.name.slice(0, file.name.lastIndexOf(".")), convertFb2ToTxt(reader.result), true)	
			//} else if ( file_name_toLowerCase.endsWith('.epub') ) {
			//	get_text(file.name.slice(0, file.name.lastIndexOf(".")), convertEpubToTxt(reader.result), true)	
			}
			
			fileButton.textContent = "Открыта"
		}
		
		reader.readAsText(file)
	} else {
		fileButton.textContent = "Открыть"
	}
	

})


function get_text(_filename, _text, is_file) {
	statArea.value = ""
	
	book = new ProcessingFile(
		_filename,
		_text,
		FIRST_STRINGS_SIZE,
		LAST_STRINGS_SIZE,
		lexx
	)	
	
	let tmp_ind = 0
	for (let part of book.all_sentences) {
		tmp_ind += 1
		if ( is_file == true ) {
			textArea.value += "Часть " + tmp_ind + ":\n" + part + "\n\n"
		}
		statArea.value += "Часть " + (tmp_ind).toString().padStart(4, '0') + ": Открыта\n"
	}
	stat_str.textContent = `0 / ${book.all_sentences.length}`
}

function get_audio(all_in_one) {
	if ( !book_loaded )  {
		get_text("Text", textArea.value, false)
	}
	let n = 0
	let parts_book = []
	let threads_info = { count: parseInt(max_threads.value), stat: stat_str }
	let timerId = setTimeout(function tick() {
		if ( threads_info.count < parseInt(max_threads.value) ) {
			threads_info.count = parseInt(max_threads.value)
		}
		if ( n < threads_info.count && n < book.all_sentences.length) {
			parts_book.push(
				new SocketEdgeTTS(
					n,
					book.file_name + " " + (n+1).toString().padStart(4, '0'),
					"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
					String(pitch_str.textContent),
					"+" + String(rate.value) + "%",
					"+0%",
					book.all_sentences[n],
					statArea,
					threads_info,
					all_in_one
				)
			)
			n += 1
			timerId = setTimeout(tick, 100)
		} else
		if ( n >= threads_info.count ) {
			timerId = setTimeout(tick, 5000)
		}
	}, 10)
	
	if ( all_in_one ) {
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
					const combinedUint8Array = new Uint8Array(mp3_length)
					let pos = 0
					for (let part_mp3 of parts_book) {
						combinedUint8Array.set(part_mp3.my_uint8Array, pos)
						pos += part_mp3.my_uint8Array.length
					}
					
					var blob_mp3 = new Blob([combinedUint8Array.buffer])
					const url = window.URL.createObjectURL(blob_mp3)
					const link = document.createElement('a')
					link.href = url
					link.download = book.file_name + '.mp3'
					document.body.appendChild(link)
					link.click()
					document.body.removeChild(link)
					window.URL.revokeObjectURL(url)
					//statArea.value += "\nСохранено в один файл\n"
					for (let part_mp3 of parts_book) {
						part_mp3.clear()
					}
					
				} else {
					timerSave = setTimeout(tick, 10000)
				}
		}, 10000)	
		
	}
}

const start = () => {
	get_audio(false)
}

const start_allone = () => {
	get_audio(true)
}