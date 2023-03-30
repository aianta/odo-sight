
// window.LogUI = LogUI
// // LogUI.init(_odo_sight_LogUI_config)
console.log("[Odo Sight] LogUI initalized.")


var _fields = [
    "serverIPAddress",
    "startedDateTime",
    "time", 
    "request",
    "response"
]


browser.devtools.network.onRequestFinished.addListener((record)=>{
    console.log("Odo's wrath can be felt in the wind.")

    // if (!LogUI || !LogUI.isActive()){
    //     return
    // }


    let target_host = "localhost:8088"
    console.log(record.request.url)
    console.log(record.request.url.includes(target_host))

    //Only capture events going to the app host

    if(record.request.url.includes(target_host)){
        console.log(record)
        let eventDetails = {
            name: "NETWORK_EVENT"
        }

        for (const [key, value] of Object.entries(record)){
            if(_fields.includes(key)){
                eventDetails[key] = value
            }
        }

        browser.runtime.sendMessage(eventDetails)
    }


})