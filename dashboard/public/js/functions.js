function sendInformations(){
	const shortUrl = document.getElementById("surl");
	const title = document.getElementById("title");
	const description = document.getElementById("description");
	const date = document.getElementById("date");
	const errorText = document.getElementById("errorText");
	let whereError = new Array();

	errorText.innerHTML = "";

	const data = {
		shortUrl: shortUrl.value.trim(),
		title: title.value.trim(),
		description: description.value.trim(),
		date: date.value.trim()
	}

	for(const errors in data){
		if(!data[errors] && errors != "shortUrl") whereError.push(errors);
	}

	if(whereError.length > 0){
		return errorText.innerHTML = `${whereError.map(r => r).join(", and ")} are not filled`;
	}else{
		if(data.title.length >= 20 || data.title.length < 2) return errorText.innerHTML = "The page title is too long/ court (between 2 and 20 characters)";
		if(data.description.length >= 5000 || data.description.length <= 50) return errorText.innerHTML = "The page description is too long/ court (between 50 and 5000 characters)";
		
		if(data.shortUrl){
			if(data.shortUrl.length >= 10 || data.shortUrl.length <= 2) return errorText.innerHTML = "The short url for the page is too long/ court (between 2 and 10 characters)";
			if(data.shortUrl.replace(/[a-zA-Z0-9]/g, "").length > 0) data.shortUrl = data.shortUrl.replace(/[^a-zA-Z0-9]/g, "");
		}

		const dateSepareted = data.date.split("-");
		if(dateSepareted.length != 3) return errorText.innerHTML = "The date entered is invalid";
		const d = new Date(data.date);
		if(d == "Invalid Date") return errorText.innerHTML = "The date entered is invalid"
		const now = new Date();

		if(d.getTime() < now.getTime() + 7200000) return errorText.innerHTML = "The date entered is invalid";

		const head = {
			method: 'POST',
			headers: {
	          "Content-Type": "application/json;charset=utf-8"
	        },
			body: JSON.stringify(data)
		}
		fetch("/send_data", head).then(res => {
			return res.json()
		}).then(data => {
			if(data.code == 200){
				window.location.href = window.location.href.replace(/#/g, "") + data.accessCode
			}
			errorText.innerHTML = data.info;
		})
	}

}