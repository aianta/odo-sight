
// //Set up connection to background script to report network events.
// let conn = new PortConnection(DEVTOOLS_TO_BACKGROUND_PORT_NAME, 'networkRequestLogger.js')


// var _fields = [
//     "serverIPAddress",
//     "startedDateTime",
//     "time", 
//     "request",
//     "response"
// ]


// browser.devtools.network.onRequestFinished.addListener((record)=>{
//     console.log("Odo's wrath can be felt in the wind.")


//     let target_host = "localhost:8088"
//     console.log(record.request.url)
//     console.log(record.request.url.includes(target_host))

//     //Only capture events going to the app host

//     if(record.request.url.includes(target_host)){
//         console.log(record)
//         let eventDetails = {
//             name: "NETWORK_EVENT"
//         }

//         for (const [key, value] of Object.entries(record)){
//             if(_fields.includes(key)){
                
//                 if(typeof value === 'object'){
//                     eventDetails[key] = JSON.stringify(value)
//                 }else{
//                     eventDetails[key] = value
//                 }

//             }
//         }

//         record.getContent().then(([content, mimeType])=>{
//             // console.log("Content: ", content)
//             // console.log("MIME Type: ", mimeType)
            
//             //Only include JSON responses
//             if(mimeType.includes("application/json")){
//                 eventDetails['responseBody'] = content
//                 eventDetails['responseMimeType'] = mimeType
//             }


//             conn.send({
//                 type: "LOG_NETWORK_EVENT",
//                 eventDetails: eventDetails
//             })
//         })
        
        
//     }


// })