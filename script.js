const text = document.querySelector('.text')
const rate = document.querySelector('.rate')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')
const fileInput = document.getElementById('file-input');
const textArea = document.getElementById('text-area');

saveButton.addEventListener('click', e => start())
rate.addEventListener('change', e => rate.textContent = rate.value)

const FIRST_STRINGS_SIZE = 800
const LAST_STRINGS_SIZE = 4200
var book

fileInput.addEventListener('change', (event) => {
	const file = event.target.files[0]
	const reader = new FileReader()
	textArea.value = ""
	
	reader.onload = () => {
		book = new ProcessingFile(
			file.name.slice(0, file.name.lastIndexOf(".")),
			reader.result,
			FIRST_STRINGS_SIZE,
			LAST_STRINGS_SIZE
		)	
		
		let n = 0
		for (let part of book.all_sentences) {
			n += 1
			textArea.value += "Часть " + n + ":\n" + part + "\n\n"
		}
	}

	reader.readAsText(file)
})

const start = () => {
	let n = 0
	let timerId = setTimeout(function tick() {
		if ( n < book.all_sentences.length) {
			new SocketEdgeTTS(
				book.file_name + " " + (n+1).toString().padStart(4, '0'),
				"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
				"+" + String(rate.value) + "%",
				"+0%",
				book.all_sentences[n]
			).start_works()
			n += 1
			timerId = setTimeout(tick, 1000)
		}
	}, 10)
}