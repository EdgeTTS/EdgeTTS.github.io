const text = document.querySelector('.text')
const rate = document.querySelector('.rate')
const voice = document.querySelector('.voices')
const saveButton = document.querySelector('.save')

saveButton.addEventListener('click', e => start())
rate.addEventListener('change', e => rate.textContent = rate.value)

const start = () => {
	var th1 = new SocketEdgeTTS(
		"Microsoft Server Speech Text to Speech Voice (" + voice.value + ")",
		"+" + String(rate.value) + "%",
		"+0%",
		text.value
	)
	th1.start_works()
}