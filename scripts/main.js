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

function updateFlightToken(data){
    return new Promise((resolve, reject)=>{
       
        
        console.log(`Updating LogUI config with new authorization token for flight ${data.flightID}`)
        _odo_sight_LogUI_config.logUIConfiguration.authorisationToken = data.flightAuthorisationToken
        pageConn.send({
            config: _odo_sight_LogUI_config,
            type: 'RESTART'
        }, (response)=>{
            console.log('Got response from page scripts!')
            resolve(response)
        }, (err)=>{
            console.log('Got error from page scripts!')
            reject(err)
        })
        

    })
}

/**
 * Handle a LOG_NETWORK_EVENT request.
 * 
 * Just pass it along to the page.
 */
conn.on('LOG_NETWORK_EVENT', function(data){
    pageConn.send(data)
})

/**
 * Handle setting of flight token by control.html
 */
conn.on('SET_FLIGHT_TOKEN', function(data){
    console.log('Got request to set flight token!')
    console.log(data)

    return updateFlightToken(data)
})

/**
 * Handle stop logui request
 */
conn.on('STOP_LOGUI', function(data){
    return new Promise((resolve, reject)=>{
        pageConn.send({
            type: 'STOP'
        }, (response)=>{
            resolve(response)
        },(err)=>{
            reject(err)
        })
    })
})

/**
 * Handle start log ui request
 */
conn.on('START_LOGUI', function(data){
    return new Promise((resolve, reject)=>{
        pageConn.send({
            type: 'START',
            config: _odo_sight_LogUI_config
        }, (response)=>{
            resolve(response)
        }, (err)=>{
            reject(err)
        })
       
    })
    
})



// Register our tab id with our background script
browser.runtime.sendMessage({
    _data: 'some text'
})

/**
 * Pass network event logged status update over to backround scripts.
 * Final destination should be controls.js to update the UI.
 */
pageConn.on('NETWORK_EVENT_LOGGED', function(data){
    conn.send(data)
})



conn.send({
    type:'GET_FLIGHT_TOKEN'
}, (token)=>{
    updateFlightToken(token)
}, (err)=>{
    console.log('Error getting token, no LogUI for now...')
    console.error(err)
})