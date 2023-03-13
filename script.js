const text = document.querySelector('.text')
const rate = document.querySelector('.rate')
const max_threads = document.querySelector('.max-threads')
const max_threads_int = document.querySelector('#max-threads-int')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const save_alloneButton = document.querySelector('.save_allone')
const fileInput = document.getElementById('file-input');
const textArea = document.getElementById('text-area');
const statArea = document.getElementById('stat-area');

saveButton.addEventListener('click', e => start())
save_alloneButton.addEventListener('click', e => start_allone())
rate.addEventListener('change', e => rate.textContent = rate.value)
max_threads.addEventListener('change', e => max_threads_int.textContent = max_threads.value)

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 4200
var book
var book_loaded = false

function get_text(_filename, _text, is_file) {
	statArea.value = ""
	
	book = new ProcessingFile(
		_filename,
		_text,
		FIRST_STRINGS_SIZE,
		LAST_STRINGS_SIZE
	)	
	
	let tmp_ind = 0
	for (let part of book.all_sentences) {
		tmp_ind += 1
		if ( is_file == true ) {
			textArea.value += "Часть " + tmp_ind + ":\n" + part + "\n\n"
		}
		statArea.value += "Часть " + (tmp_ind).toString().padStart(4, '0') + ": Открыта\n"
	}
}

fileInput.addEventListener('change', (event) => {
	book_loaded = false
	//textArea.value = ""
	statArea.value = ""
	const file = event.target.files[0]
	const reader = new FileReader()
	
	reader.onload = () => {
		book_loaded = true
		get_text(file.name.slice(0, file.name.lastIndexOf(".")), reader.result, true)
	}

	reader.readAsText(file)
})



function get_audio(all_in_one) {
	if ( !book_loaded )  {
		get_text("Text", textArea.value, false)
	}
	let n = 0
	let parts_book = []
	let threads_info = { count: parseInt(max_threads.value) }
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