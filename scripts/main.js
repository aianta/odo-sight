

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
 * 
 * October 10, 2025 Update
 * Additionally we're going to inject logui.bundle.js into every iframe in the document so that we can capture
 * events from inside them. 
 * 
 * January 12, 2026 Update
 * Actually we're not going to do anything about iframes anymore. Simpler this way.
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
        stateManager.shouldRecord(), //The flag set by the extension in bot mode
        stateManager.shouldTrace(), //The flag set by clicking the record button in sight mode
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



(document.head || document.documentElement).prepend(handlerMagicScript);
(document.head || document.documentElement).prepend(logUIScript);
(document.head || document.documentElement).prepend(domeffectsScript);
(document.head || document.documentElement).prepend(guidanceScript);



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
    console.log("State Change detected:")
    console.log(changes)

    if('guidanceMode' in changes && !changes['guidanceMode'].newValue){
        disconnectGuidancePort()
    }

    if('guidanceMode' in changes  && changes['guidanceMode'].newValue){
        connectGuidancePort()
    }

    //If the new 'shouldRecord' value is false, stop the LogUI client
    //This is primarily used by menu-ui.js to stop passive recording or transmitting. 
    if('shouldRecord' in changes && !changes['shouldRecord'].newValue){
        stopLogUI2()
    }

    //If the new 'sessionReady' value is true, start the LogUI client
    if ('sessionReady' in changes && changes['sessionReady'].newValue){
        console.log("Got 'sessionReady', checking OdoX state to determine if we should start transmitting...")
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
 * 2) LOGUI_EVENT -> this is a LogUI event that has been captured by the client, it must be relayed to background.js 
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
            switch(event.data.type){
                case "GUIDANCE_READY":
                    guidanceScriptReady = true
                    connectGuidancePort()
                    break;
                case "GUIDANCE_MESSAGE":
                    //Messages sent while there is no port, e.g. with guidance mode off, have nowhere to go.
                    if(guidancePort !== null){
                        guidancePort.postMessage(event.data.message)
                    }
                    break;
            }
        }
})

/**
 * The bridge between guidance.js and OdoBot. guidance.js runs in the page, where page CSP can block connections to
 * OdoBot, so its messages go through a port to the background (guidanceRelay.js), which sends them over OdoX's socket
 * to OdoBot. The port is open while guidance mode is on and guidance.js has loaded, and its disconnect tells the
 * background the page is gone.
 */
var guidancePort = null
var guidanceScriptReady = false

function connectGuidancePort(){
    if(guidancePort !== null || !guidanceScriptReady){
        return
    }

    stateManager.guidanceMode().then(_guidanceMode=>{
        if(!_guidanceMode || guidancePort !== null){
            return
        }

        const port = browser.runtime.connect({name: _GUIDANCE_PORT_NAME})
        port.onMessage.addListener(message=>{
            window.postMessage({
                origin: 'main.js',
                type: 'GUIDANCE_MESSAGE',
                message: message
            })
        })
        port.onDisconnect.addListener(()=>{
            if(guidancePort === port){
                guidancePort = null
            }
        })
        guidancePort = port
    }).catch(err=>console.error('Error while connecting guidance.js to OdoBot: ', err))
}

function disconnectGuidancePort(){
    if(guidancePort === null){
        return
    }
    const port = guidancePort
    guidancePort = null
    port.disconnect()
}

//Tell the background the page is gone as soon as it is hidden, and reconnect if it comes back from the back/forward cache.
window.addEventListener('pagehide', ()=>disconnectGuidancePort())
window.addEventListener('pageshow', (event)=>{
    if(event.persisted){
        connectGuidancePort()
    }
})

/**
 * The DOM snapshot of an Observation, filtered as LogUI and dom-effects.js filter theirs, in their format: a JSON string of
 * {outerHTML, outerText}. It is taken here, in the content script, rather than in guidance.js, since main.js is in every
 * page from document_start, whether or not guidance.js has connected.
 */
function captureObservationDOMSnapshot(){
    const fullHtml = document.documentElement.outerHTML
    const noScripts = fullHtml.replaceAll(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    const noXMLCDATA = noScripts.replaceAll(/<!\[CDATA[\s\S]*\]\]>/gi, "")
    const noStyle = noXMLCDATA.replaceAll(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    const noSvgPaths = noStyle.replaceAll(/<path[\s\S]*?>[\s\S]*?<\/path>/gi, "")

    return JSON.stringify({
        outerHTML: noSvgPaths,
        outerText: document.documentElement.outerText
    })
}

//The background asks for the page's DOM snapshot while it captures the tab for an Observation, see guidanceConnector.js.
browser.runtime.onMessage.addListener((message)=>{
    if(message?.type === 'GET_DOM_SNAPSHOT'){
        return Promise.resolve({domSnapshot: captureObservationDOMSnapshot()})
    }
    return undefined
})

function sendCacheOverflowError(){
    window.postMessage({
        origin: 'main.js',
        type: 'LOGUI_CACHE_OVERFLOW'
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
    console.log("Starting LogUI for observing actions in bot mode")
    stateManager.logUIConfig().then(config=>{
        config.odoSettings.captureSetContent = true
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
        config.odoSettings.captureSetContent = false

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

/**
 * January 12, 2026 Note: Disabled iframe listening as it may not be necessary and only adds runtime logical complexity.
 * 
 */

// window.addEventListener('load', function(){

//     /**
//      * Handle injecting logui.bundle.js into all iframes with the same origin in this document.
//      * This needs to be done after the window is loaded so than any iframes are already in. 
//      */
//     console.log("Looking for iframes...")
//     for (let frame of document.querySelectorAll('iframe')){
//         console.log(`Found iframe: ${frame.src}`)
//         try{
//             const iframeUrl = new URL(frame.src)


//             //Only inject into iframes with the same origin to avoid cross-origin errors
//             if (iframeUrl.hostname === window.location.hostname){
                
//                 const iframeWindow = frame.contentWindow || frame;
//                 const iframeDocument = frame.contentDocument || iframeWindow.document;
//                 const scriptElement = iframeDocument.createElement('script')
//                 scriptElement.src = browser.runtime.getURL('/libs/logui.bundle.js')
//                 scriptElement.onload = function(){
//                     console.log('scriptElement onLOAD!')
//                     console.log(frame)
//                     console.log(frame.contentWindow.LogUI)
//                     //Get LogUI config and init the LogUI instance we just injected. 
//                     stateManager.logUIConfig().then(config=>{
                        
//                         console.log('Calling LogUI.iframeInit() with state manager sourced config.')
                        
//                         frame.contentWindow.wrappedJSObject.LogUI.iframeInit(JSON.stringify(config))
                        
//                     })
//                 }
//                 iframeDocument.documentElement.prepend(scriptElement)
//                 console.log(`injected logUI into iframe!`)

            

//         }            
//         }catch(error){
//             if (error.name !== 'TypeError'){
//                 console.error(error)
//             }
//         }


//     }

// })