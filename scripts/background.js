/**
 * @author Alexandru Ianta
 * TODO: new write up
 * 
 */

//Bind init function to appropriate runtime events. 
browser.runtime.onStartup.addListener(stateManager.init)
browser.runtime.onInstalled.addListener(stateManager.init)



//Setup communication with controls.html & content scripts
let controlsPort;
let contentScriptsPort;
// let devtoolsPort;

function connected(p){
    console.log('connected port:', p)
    switch(p.name){
        case CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME:
            contentScriptsPort = p;
            setupPortHandler(contentScriptsPort, handleContentScriptRequest)
            break;

    }
}

browser.runtime.onConnect.addListener(connected);


/**
 * Communication layer logic: 
 * Saves message _id's and invokes the given logic handler.
 * Logic handler is expected to return a promise. 
 * 
 * If the logic handler's promise completes, injects the original message's _id
 * into the response and sends it back on the port it was recieved on. 
 * 
 * If the logic handler's promise fails, creates an error object which also includes
 * the original message's _id and sends the error object back on the port it was recieved on.
 * 
 */
function setupPortHandler(port, logicHandler){

    console.log('Logic Handler:')
    console.log(logicHandler)


    port.onMessage.addListener((data)=>{
        console.debug(`[background.js][PORT:${port.name}][REQUEST:${data._id}][${data.type}] ${JSON.stringify(data, null, 4)}`)
        let _id = data._id //Extract message id
       /**
         * Responses to requests won't have types, and because of that, we shouldn't
         * pass them down to our logic handler which infers what to do based on
         * the type of request. Instead we should send that message along to whomever
         * we didn't recieve it from. So if a message without a type comes from main.js/content scripts
         * we send it to controls. If a message without a type comes from controls, we send it
         * to content scripts.
         * 
         * TODO: if there ever are responses that have to go back to devtools, may have to make some changes here.
         */
        if(data.type === undefined){
            switch(port.name){
                case CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME:
                    controlsPort.postMessage(data)
                    break;
                case CONTROLS_TO_BACKGROUND_PORT_NAME:
                    contentScriptsPort.postMessage(data)
                    break;
            }
            return
        }
        //Otherwise if a message has a type, proceed with invoking the logic handler.
        logicHandler(data).then(function(result){
            //Handle successfully logic handler result.
            result._id = _id
            console.debug(`[background.js][PORT:${port.name}][RESPONSE:${result._id}] ${JSON.stringify(result, null, 4)}`)
            port.postMessage(result)
        }).catch((err)=>{
            //Handle logic handler error/failure
            error_object = {
                _id:_id,
                err_msg: typeof err === 'object'?err.message:err
            }
            console.debug(`[background.js][PORT:${port.name}][RESPONSE:${error_object._id}] ${JSON.stringify(error_object, null, 4)}`)
            port.postMessage(error_object)
        })
    })
}


/**
 * Handles request originating from the content scripts
 * @param {Object} data 
 * @returns 
 */
function handleContentScriptRequest(data){
    switch(data.type){
        case "CONNECT_DISPATCHER":
            console.log('executing CONNECT_DISPATCHER')
            stateManager.flightAuthToken().then((authToken)=>LogUIDispatcher.handleClientDispatcherConnection(data.endpoint, authToken, contentScriptsPort))
            break;
        case "LOGUI_EVENT":
            LogUIDispatcher.sendObject(data.payload)

            if(data.payload.eventType === 'statusEvent' && data.payload.eventDetails.type === 'stopped'){
                LogUIDispatcher.stop()
            }

            break;
    }
}



function logNetworkRequest(record){

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

browser.webRequest.onBeforeRequest.addListener(logNetworkRequest ,{
    urls: ["<all_urls>"]
},['blocking','requestBody'])
