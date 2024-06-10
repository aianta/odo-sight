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


/**
 * Web Navigation Trasition Interception
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onCommitted
 * 
 * Odo sight intercepts navigation requests to distinguish between those invoked through the underlying web-application,
 * and those initiated by the user by using the address bar. 
 */
browser.webNavigation.onCommitted.addListener(onNavigationEvent)

function onNavigationEvent(details){

    //console.log('Navigation Event!')
    //console.log(details)
}



browser.runtime.onMessage.addListener(handleMessage)

function handleMessage(message){
    if('payload' in message){
        //console.log(`Got LogUI event ${JSON.stringify(message.payload, null, 4)}`)

        stateManager.boundDispatcher().then(
            _dispatcher=>{

                switch(_dispatcher){
                    case "local":
                        GuidanceConnector.sendObject(message.payload)
                        break;
                    case "logui":
                        LogUIDispatcher.sendObject(message.payload)
                        break;
                    default:
                        console.log("Unrecognized boundDispatcher ", _dispatcher)
                }

                if(message.payload.eventType === 'statusEvent' && message.payload.eventDetails.type === 'stopped'){
                    switch(_dispatcher){
                        case "local":
                            //LocalDispatcher.stop()
                            break;
                        case "logui":
                            LogUIDispatcher.stop()
                            break;
                        default:
                            console.log("Unrecognized boundDispatcher ", _dispatcher)
                    }
                    
                }

            }
        )       
    }
}


/**
 * browser.webrequest API documentation: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest
 * 
 * From the docs we can see that, in the case of a redirect, onBeforeRequest will be invoked twice. The requestId field will remain the
 * same in this case, but the rest of the request details might change. 
 * 
 * Since we only produce a network request after reading the response body of a request, we won't actually capture the 
 * event for the initial non-redirected request. 
 * 
 * This is a problem because we are interested in what action the front-end of an application thinks it is invoking, so fundamentally 
 * we want to capture the initial non-redirected network request information. 
 * 
 * To do this we create a map of requests, and store the request details onBeforeRequest using the requestId as the key if there is
 * no entry for that key in the map. 
 * 
 * If there is a redirect, the requestId will already appear in the map, and so the request details are ignored. 
 *  
 * Later, in the response filter when we aim to package and send our request, we use the request details stored in the map. 
 */

//TODO: this might memory leak 

const requestMap = new Map()
const requestHeadersMap = new Map()
const responseHeadersMap = new Map()

function logNetworkRequest(record){



    Promise.all([
        stateManager.shouldTrace(),
        stateManager.shouldTransmit(),
        stateManager.targetHost()
    ]).then((values)=>{

        const shouldTrace = values[0]
        const shouldTransmit = values[1]
        const target_host = values[2]

        if(shouldTrace || shouldTransmit){ //Only intercept network requests if the 'shouldTrace' or 'shouldTransmit' flag is set.
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


            // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
            //Only capture xmlhttprequests or main_frame events going to the target host
            //main_frame: Top-level documents loaded into a tab.
            //Not GET: something is being sent to the server, it's important. 
            if((record.type === 'xmlhttprequest' || record.type === 'main_frame' || record.method !== 'GET' ) && record.url.includes(target_host)){
                
                let eventDetails = {
                    name: "NETWORK_EVENT"
                }

                for (const [key, value] of Object.entries(record)){
                    if(_fields.includes(key)){
                        
                        if(typeof value === 'object'){
                            eventDetails[key] = JSON.stringify(value)
                        }else{
                            eventDetails[key] = value
                        }
    
                    }
                }
                //If this is the first time we've seen this request id, store it's details for packaging later.
                //See redirect comments above. 
                if(!requestMap.has(record['requestId'])){
                    requestMap.set(record['requestId'], eventDetails)
                    //console.log("Saved new request to request map with id: ", record['requestId'])
                }


                
                //Intercept the response https://github.com/mdn/webextensions-examples/blob/main/http-response/background.js
                let filter = browser.webRequest.filterResponseData(record.requestId)
                let decoder = new TextDecoder("utf-8")
                let encoder = new TextEncoder()

        
        
                filter.ondata = event => {
        
                    
                    //Get the eventDetails of the original request as found in the map.
                    //See comments on redirects above.
                    const _eventDetails = requestMap.get(record['requestId'])

                    let str = decoder.decode(event.data, {stream:true})
                    
                    //Capture and save the response body
                    try{
                        let jsonData = JSON.parse(str)
                        _eventDetails['responseBody'] = str
                        
                        requestMap.set(record['requestId'], _eventDetails)

                    }catch(error){
                        //Parsing error, the response data wasn't json, so we don't care about it.
                    }finally{
                        filter.write(event.data)
                        filter.disconnect()
                    }
                    
                      
                }
            }
        }

    }, _=>console.error('Missing shouldTrace flag.'))



}

browser.webRequest.onBeforeRequest.addListener(logNetworkRequest ,{
    urls: ["<all_urls>"]
},['blocking','requestBody'])


function logRequestHeaders(record){

    Promise.all([
        stateManager.shouldTransmit(),
        stateManager.shouldTrace()
    ]).then((values)=>{

        const shouldTransmit = values[0]
        const shouldTrace = values[1]

        if(shouldTrace || shouldTransmit){

            const _headers = {}

            for (const header of record.requestHeaders){
                //https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/HttpHeaders
                _headers[header.name] = header.value?header.value:header.binaryValue
                
                
            }
            
            console.log('odo-sight-flag: ', _headers['odo-sight-flag'], " ",  record['requestId'])



            //If this is the first time we've seen this request id, store it's details for packaging later.
            //See redirect comments above. 
            if(!requestHeadersMap.has(record['requestId'])){
                requestHeadersMap.set(record['requestId'], _headers)
                //console.log('Saved request headers for ',record.method,' requestId: ', record['requestId'])
            }


        }

    })
}

//https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeSendHeaders
browser.webRequest.onSendHeaders.addListener(logRequestHeaders, {
    urls: ["<all_urls>"]
},["requestHeaders"])


function logResponseHeaders(record){

    Promise.all([
        stateManager.shouldTrace(),
        stateManager.shouldTransmit()
    ]).then((values)=>{

        const shouldTrace = values[0]
        const shouldTransmit = values[1]

        if(shouldTrace || shouldTransmit){

            const _headers = {}

            for(const header of record.responseHeaders){
                //https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/HttpHeaders
                _headers[header.name] = header.value?header.value:header.binaryValue
            }

            if(!responseHeadersMap.has(record['requestId'])){
                responseHeadersMap.set(record['requestId'], _headers)
                //console.log("Saved response headers for ",record.method," request id: ", record['requestId'])
            }

        }
    })
}

//https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onHeadersReceived
//https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onResponseStarted
browser.webRequest.onResponseStarted.addListener(logResponseHeaders, {
    urls: ["<all_urls>"]
}, ["responseHeaders"])

function bundleAndSend(record){

    Promise.all([
        stateManager.shouldTrace(),
        stateManager.shouldTransmit(),
        stateManager.targetHost()
    ]).then((values)=>{
        const shouldTrace = values[0]
        const shouldTransmit = values[1]
        const target_host = values[2]

        if(shouldTrace || shouldTransmit){
            
            // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/ResourceType
            //Only capture xmlhttprequests or main_frame events going to the target host
            //main_frame: Top-level documents loaded into a tab.
            //Not GET: something is being sent to the server, it's important. 
            if((record.type === 'xmlhttprequest' || record.type === 'main_frame' || record.method !== 'GET' ) && record.url.includes(target_host)){
                
                    
                        
                        console.log("bundling all network ",record.method," request info for requestId: ", record['requestId'])
            
                        //Assemble all the data gathered for this request now that it is complete
                        const _eventDetails = requestMap.get(record['requestId'])
                        const _requestHeaders = requestHeadersMap.get(record['requestId'])
                        const _responseHeaders = responseHeadersMap.get(record['requestId'])
                        //Bind request and response headers
                        _eventDetails['requestHeaders'] = JSON.stringify(_requestHeaders)
                        _eventDetails['responseHeaders'] = JSON.stringify(_responseHeaders)
                        
                        if(shouldTransmit){
                            GuidanceConnector.packageCustomEvent(_eventDetails)
                        }

                        if(shouldTrace){
                            LogUIDispatcher.packageCustomEvent(_eventDetails)
                        }
                        


                        //Try to prevent memory leaks.
                        requestMap.delete(record['requestId'])
                        requestHeadersMap.delete(record['requestId'])
                        responseHeadersMap.delete(record['requestId'])
            
                        
                    
                
            }
        }


    })
}

browser.webRequest.onCompleted.addListener(bundleAndSend, {
    urls : ["<all_urls>"] 
})