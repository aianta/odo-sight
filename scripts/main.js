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
 * utils.js -> Communication layer utilities that helps handlerMagic communicate with main.js using the same API/communication constructs as the rest of the extension. 
 */
var handlerMagicScript = document.createElement('script')
var logUIScript = document.createElement('script')
var utilsScript = document.createElement('script')
var domeffectsScript = document.createElement('script')
// var html2canvasScript = document.createElement('script')

utilsScript.src = browser.runtime.getURL('/scripts/utils.js')
logUIScript.src = browser.runtime.getURL('/libs/logui.bundle.js')
handlerMagicScript.src = browser.runtime.getURL('/scripts/handlerMagic.js')
domeffectsScript.src = browser.runtime.getURL('/libs/dom-effects.js')

domeffectsScript.onload = function(){this.remove();};
utilsScript.onload = function(){this.remove();};
logUIScript.onload = function(){this.remove();};
handlerMagicScript.onload = function(){this.remove();};


(document.head || document.documentElement).appendChild(utilsScript);
(document.head || document.documentElement).appendChild(logUIScript);
(document.head || document.documentElement).appendChild(handlerMagicScript);
(document.head || document.documentElement).appendChild(domeffectsScript);


console.log('Establishing connection to background script!')
// Establish connection to background.js to communicate with Popup and remote LogUI/Odo servers
let conn = new PortConnection(CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME, 'main.js')

console.log("Establishing connection to page scripts!")
let pageConn = new WindowConnection('main.js', 'handlerMagic.js')

console.log("Establishing connection to logUI client")
let logUIConn = new WindowConnection('main.js', 'logui.bundle.js')

/**
 * Handle LOGUI_HANDSHAKE_SUCCESS by relaying it. 
 */
conn.on('LOGUI_HANDSHAKE_SUCCESS', function(data){
    return new Promise((resolve,reject)=>{
        //TODO: the way utils.js handles data._ids may cause bugs here. 
        logUIConn.send(data, (response)=>resolve(response), (err)=>reject(err))
    })
})


/**
 * Handle LOGUI_CACHE_OVERFLOW by relaying it.
 */
conn.on('LOGUI_CACHE_OVERFLOW', function(data){
    return new Promise((resolve,reject)=>{
        //TODO: the way utils.js handles data._ids may cause bugs here. 
        logUIConn.send(data, (response)=>resolve(response), (err)=>reject(err))
    })
})




//Relay to background.js
logUIConn.on('LOGUI_EVENT', function(data){
    conn.send(data, _=>console.log('event sent to background.js dispatcher'), (err)=>console.error(err))
})

//Relay to background.js
logUIConn.on('CONNECT_DISPATCHER', function(data){
    conn.send(data, _=>console.log('forwarded CONNECT_DISPATCHER to background.js'), (err)=>console.error(err))
})


function patchFlightToken(newToken){
    _odo_sight_LogUI_config.logUIConfiguration.authorisationToken = newToken
}

function startLogUI(){
    pageConn.send({
        type: 'START',
        config: _odo_sight_LogUI_config
    }, (response)=>{
        console.log('LogUI client started!')
        stateManager.set('isRecording', true)
    }, (err)=>{
        console.error('LogUI client falied to start!')
    })
}

function observeStateChange(changes){

    if ('flightAuthToken' in changes){
        //If a change is observed to the flight auth token, patch the logUI client config with the new token.
        patchFlightToken(changes['flightAuthToken'].newValue)
    }

    //If the new 'shouldRecord' value is true, start the LogUI client
    if ('shouldRecord' in changes && changes['shouldRecord'].newValue){
        startLogUI()
    }

    //If the new 'shouldRecord' value is false, stop the LogUI client
    if('shouldRecord' in changes && !changes['shouldRecord'].newValue){
        pageConn.send({
            type: 'STOP'
        }, (response)=>{
            console.log('LogUI client has stopped!')
            stateManager.set('isRecording', false)
        },(err)=>{
            console.error('LogUI client failed to stop!')
            // stateManager.set('isRecording', true)
        })
    }
}

browser.storage.local.onChanged.addListener(observeStateChange)

//Once loaded in, check to see if we should be recording, if so, start LogUI ASAP
stateManager.shouldRecord().then((shouldRecord)=>{
    if(shouldRecord){
        startLogUI()
    }
})