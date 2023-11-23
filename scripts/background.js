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

//Capture request bodies -> Sometimes a single request will appear multiple times throughout the interception code, and we lose the body. 
//Login POST request is a good example, the same requestId hits the logNetworkRequest() function several times, but only has a request body
//the first time. I suspect this has to do with how re-directs are handled. 
//Anyways, to solve this, we'll create a map and store <request-id>:<request-body> then use the request body-value from the map if it exists. 
const requestBodyMap = new Map()

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
                "type",
                "originUrl"
            ]
            
            //TODO: should get the host programatically.
            let target_host = "localhost:8088"
        
            
            if(record['requestBody']){
                requestBodyMap.set(record['requestId'], record['requestBody'])
            }



            // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
            //Only capture xmlhttprequests or main_frame events going to the target host
            //main_frame: Top-level documents loaded into a tab.
            if((record.type === 'xmlhttprequest' || record.type === 'main_frame' ) && record.url.includes(target_host)){
                //Intercept the response https://github.com/mdn/webextensions-examples/blob/main/http-response/background.js
                let filter = browser.webRequest.filterResponseData(record.requestId)
                let decoder = new TextDecoder("utf-8")
                let encoder = new TextEncoder()
                let eventDetails = {
                    name: "NETWORK_EVENT"
                }
        
        
                filter.ondata = event => {
        
        
                    for (const [key, value] of Object.entries(record)){
                        if(_fields.includes(key)){
                            
                            if(typeof value === 'object'){
                                eventDetails[key] = JSON.stringify(value)
                            }else{
                                eventDetails[key] = value
                            }
        
                        }
                    }

                    //Insert request body from map if it wasn't set. 
                    if(eventDetails['requestBody'] === 'null'){
                        eventDetails['requestBody'] = requestBodyMap.get(record['requestId'])
                        requestBodyMap.delete(record['requestId'])
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
