

/**
 * Inject scripts into the page. This code has to be injected like this because we need to modify the 
 * prototype addEventListener on Node, and have that persist for the page scripts. Normally page scripts and content
 * scripts are isolated from each other.
 * https://stackoverflow.com/questions/9515704/access-variables-and-functions-defined-in-page-context-using-a-content-script
 * 
 * Injected scripts:
 * logui.bundle.js -> The actual logUI client.
 * handlerMagic.js -> EventHandler hijack and re-order logic to ensure logUI handlers get invoked before DOM changes. handlerMagic also performs all communication with main.js
 * domeffects.js -> coupled tightly to logui so needs to exist in the same execution context as logui.bundle.js 
 */
var handlerMagicScript = document.createElement('script')
var logUIScript = document.createElement('script')
var domeffectsScript = document.createElement('script')
var guidanceScript = document.createElement('script')

logUIScript.src = browser.runtime.getURL('/libs/logui.bundle.js')
handlerMagicScript.src = browser.runtime.getURL('/scripts/handlerMagic.js')
domeffectsScript.src = browser.runtime.getURL('/libs/dom-effects.js')
guidanceScript.src = browser.runtime.getURL('/scripts/guidance.js')

domeffectsScript.onload = function(){this.remove();};
handlerMagicScript.onload = function(){this.remove();};
guidanceScript.onload = function(){this.remove();};

logUIScript.onload = function(){
    //Once loaded in, check to see if we should be recording, if so, start LogUI ASAP
    Promise.all([
        stateManager.shouldRecord(),
        stateManager.shouldTrace(),
        stateManager.sessionReady()
    ]).then((values)=>{
        const shouldRecord = values[0]
        const shouldTrace = values[1]
        const sessionReady = values[2]

        if(shouldTrace && sessionReady){
            startLogUI2()
        }

        if(shouldRecord && sessionReady){
            startLogUI3()
        }
    })
    

    this.remove();
};


(document.head || document.documentElement).prepend(guidanceScript);
(document.head || document.documentElement).prepend(handlerMagicScript);
(document.head || document.documentElement).prepend(logUIScript);
(document.head || document.documentElement).prepend(domeffectsScript);





function checkState(){
    Promise.all([
        stateManager.shouldRecord(),
        stateManager.shouldTrace(),
        stateManager.sessionReady()
    ]).then((values)=>{
        const shouldRecord = values[0]
        const shouldTrace = values[1]
        const sessionReady = values[2]

        if(shouldRecord && sessionReady){
            startLogUI3()
        }

        if(shouldTrace && sessionReady){
            startLogUI2()
        }
    })
}

function observeStateChange(changes){


    //If the new 'shouldRecord' value is false, stop the LogUI client
    //This is primarily used by menu-ui.js to stop passive recording or transmitting. 
    if('shouldRecord' in changes && !changes['shouldRecord'].newValue){
        stopLogUI2()
    }

    //If the new 'sessionReady' value is true, start the LogUI client
    if ('sessionReady' in changes && changes['sessionReady'].newValue){
        checkState()
    }

    //If the new 'shouldTrace' value is true, set the page origin.
    if('shouldTrace' in changes && changes['shouldTrace'].newValue){
        //Report the page orign
        console.log('Setting page origin: ', window.location.origin)
        stateManager.pageOrigin(window.location.origin);
    }

    //If the new 'shouldTrace' value is false, stop the LogUI client
    if('shouldTrace' in changes && !changes['shouldTrace'].newValue){
        stopLogUI2()
    }

    //If the eventCacheOverflow flag has been flipped
    if('eventCacheOverflow' in changes && changes['eventCacheOverflow'] === true){
        sendCacheOverflowError()
    }

    // if('activePathsRequestId' in changes && changes['activePathsRequestId'].newValue){
    //     gatherAndSendGuidanceSocketConfig()
    // }

    // if('activePathsRequestId' in changes && !changes['activePathsRequestId'].newValue){
    //     stopGuidanceSocket()
    // }
}

browser.storage.local.onChanged.addListener(observeStateChange)

/**
 * From
 * https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts#communicating_with_the_web_page
 */
/**
 * Handle the two kinds of messages main.js gets from logui.bundle.js.
 * 
 * 1) GET_SESSION_INFO -> here main.js needs to fetch the session info from the extensions state and pass it back to logui.bundle.js
 * 2) LOGUI_EVENT -> this is just a LogUI event that has been captured by the client, it must be relayed to background.js 
 */
window.addEventListener("message", (event)=>{
    if(event.source === window &&
       event?.data?.origin === "logui.bundle.js"){

            switch(event.data.type){
                case "GET_SESSION_INFO":
                    stateManager.sessionData()
                        .then((sessionData)=>{
                            sendSessionInfo(sessionData)
                            const data = sessionData
                            data['fresh'] = false //Mark session data as no longer fresh
                            stateManager.sessionData(data)
                        })
                        
                    break;
                case "LOGUI_EVENT":
                    browser.runtime.sendMessage(event.data)
                    break;
            }

        }
    if(event.source == window && 
        event?.data?.origin === "guidance.js"){
            console.log('got config request from guidance.js')
            switch(event.data.type){
                case "GET_GUIDANCE_SOCKET_CONFIG":
                    gatherAndSendGuidanceSocketConfig()
                    break;
            }
        }
})

function sendCacheOverflowError(){
    window.postMessage({
        origin: 'main.js',
        type: 'LOGUI_CACHE_OVERFLOW'
    })
}

function gatherAndSendGuidanceSocketConfig(){
    Promise.all([
        stateManager.guidanceHost(),
        stateManager.clientId()
    ]).then(values=>{
        const guidanceHost = values[0]
        const clientId = values[1]
        sendGuidanceSocketConfig( guidanceHost, clientId)
    },
    err=>console.log('Error while gather guidance socket config: ',err)
)
}

function stopGuidanceSocket(){
    window.postMessage({
        origin: 'main.js',
        type: 'GUIDANCE_SOCKET_STOP'
    })
}

function sendGuidanceSocketConfig( guidanceHost, clientId){
    window.postMessage({
        origin: 'main.js',
        type: "GUIDANCE_SOCKET_CONFIG",
        clientId: clientId,
        guidanceHost: guidanceHost
    })
}

function sendSessionInfo(data){
    window.postMessage({
        origin: 'main.js',
        type: 'SESSION_INFO',
        sessionData: data
    })
}

/**
 * Starts LogUI client without setting an endpoint or flight auth token, 
 * for use in bot mode.
 */
function startLogUI3(){
    stateManager.logUIConfig().then(config=>{
        window.postMessage({
            origin: 'main.js',
            type: 'START_LOGUI',
            config: config
        })
        console.log('sent start command to logui.bundle.js')
    })
}

/**
 * Starts LogUI client with endpoint and flight auth token,
 * for use in sight mode. 
 */
function startLogUI2(){
    Promise.all([
        stateManager.endpoint(),
        stateManager.flightAuthToken(),
        stateManager.logUIConfig()
    ]).then((values)=>{

        const endpoint = values[0]
        const flightAuthToken = values[1]
        const config = values[2]

        console.log(config)

        config.logUIConfiguration.authorisationToken = flightAuthToken
        config.logUIConfiguration.endpoint = endpoint

        window.postMessage({
            origin: 'main.js',
            type: 'START_LOGUI',
            config: config
        })

        console.log('sent start command to logui.bundle.js')

    })



}

function stopLogUI2(){
    window.postMessage({
        origin: 'main.js',
        type: 'STOP_LOGUI'
    })
}

