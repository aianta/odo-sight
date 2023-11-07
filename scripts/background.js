/**
 * @author Alexandru Ianta
 * TODO: new write up
 * 
 */

//Bind init function to appropriate runtime events. 
//This is done here to avoid double initialization that would occur if it was done in 'stateManager.js'. 
//Double initialization would happen because stateManager.js is also loaded as a content script.
browser.runtime.onStartup.addListener(stateManager.init)
browser.runtime.onInstalled.addListener(stateManager.init)

browser.runtime.onMessage.addListener(handleMessage)

function handleMessage(message){
    if('payload' in message){
        console.log(`Got LogUI event ${JSON.stringify(message.payload, null, 4)}`)
        LogUIDispatcher.sendObject(message.payload)

        if(message.payload.eventType === 'statusEvent' && message.payload.eventDetails.type === 'stopped'){
            LogUIDispatcher.stop()
        }
    }
}



function logNetworkRequest(record){

    stateManager.shouldRecord().then((shouldRecord)=>{

        if(shouldRecord){ //Only intercept network requests if the 'shouldRecord' flag is set.
            var _fields = [
                "timeStamp", //The sky will fall if this is not included.
                "requestId",
                "method", 
                "requestBody",
                "url",
                "documentUrl",
                "type"
            ]
            
            //TODO: should get the host programatically.
            let target_host = "localhost:8088"
        
            //Only capture xmlhttprequests going to the target host
            if(record.type === 'xmlhttprequest' && record.url.includes(target_host)){
                //Intercept the response https://github.com/mdn/webextensions-examples/blob/main/http-response/background.js
                let filter = browser.webRequest.filterResponseData(record.requestId)
                let decoder = new TextDecoder("utf-8")
                let encoder = new TextEncoder()
                let eventDetails = {
                    name: "NETWORK_EVENT"
                }
        
        
                filter.ondata = event => {
        
        
                    console.log(record)
        
                    for (const [key, value] of Object.entries(record)){
                        if(_fields.includes(key)){
                            
                            if(typeof value === 'object'){
                                eventDetails[key] = JSON.stringify(value)
                            }else{
                                eventDetails[key] = value
                            }
        
                        }
                    }
                        
        
                    
        
                    let str = decoder.decode(event.data, {stream:true})
        
                    try{
                        let jsonData = JSON.parse(str)
                        eventDetails['responseBody'] = str
                    }catch(error){
                        //Parsing error, the response data wasn't json, so we don't care about it.
                    }finally{
                        filter.write(event.data)
                        filter.disconnect()
                    }
                    
                    
                    LogUIDispatcher.packageCustomEvent(eventDetails)
                    
                }
            }
        }

    }, _=>console.error('Missing shouldRecord flag.'))



}

browser.webRequest.onBeforeRequest.addListener(logNetworkRequest ,{
    urls: ["<all_urls>"]
},['blocking','requestBody'])
