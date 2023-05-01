/**
 * Inject handler magic into the page. This code has to be injected like this because we need to modify the 
 * prototype addEventListener on Node, and have that persist for the page scripts. Normally page scripts and content
 * scripts are isolated from each other.
 */
var handlerMagicScript = document.createElement('script')
var logUIScript = document.createElement('script')

logUIScript.src = browser.runtime.getURL('/libs/logui.bundle.js')
handlerMagicScript.src = browser.runtime.getURL('/scripts/handlerMagic.js')

logUIScript.onload = function(){
    this.remove();
}
handlerMagicScript.onload = function(){
    this.remove();
};

(document.head || document.documentElement).appendChild(logUIScript)
document.documentElement.appendChild(handlerMagicScript)

window.addEventListener("message", (event)=>{
    if(
        event.source === window &&
        event?.data?.direction === "from-page-script"
    ){
        alert(`Content script recieved message: "${JSON.stringify(event.data, null, 4)}"`)
    }
})

// window.postMessage({
//     direction: "from-content-script",
//     message: "Baa!"
// })

function sendStartCommand(){
    sendToPage({
        config: _odo_sight_LogUI_config
    })
}

function sendStopCommand(){
    sendToPage({}, "STOP")
}

function sendToPage(data, command){
    let payload = {
        direction: "from-content-script",
        command: command,
        ...data
    }

    window.postMessage(
        payload, "*"
    )
}


// Establish connection to background.js to communicate with Popup and remote LogUI/Odo servers
let conn = new BackgroundConnection(CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME, 'main.js')

function updateFlightToken(data){
    return new Promise((resolve, reject)=>{
       
        
        console.log(`Updating LogUI config with new authorization token for flight ${data.flightID}`)
        _odo_sight_LogUI_config.logUIConfiguration.authorisationToken = data.flightAuthorisationToken
        sendToPage({config:_odo_sight_LogUI_config}, "RESTART")
        resolve({
            sessionId: "broken for now"
        })
        // setTimeout(()=>{
        //     console.log('Re-starting LogUI with new config object!')
        //     LogUI.init(_odo_sight_LogUI_config)
        //     console.log('Authorization Token: ', _odo_sight_LogUI_config.logUIConfiguration.authorisationToken)
            
        //     setTimeout(()=>{
        //         resolve({
        //             sessionId: LogUI.Config.sessionData.getSessionIDKey()
        //         })
        //     },2000)
            
        // }, 2000)
    })
}


/**
 * Handle setting of flight token by control.html
 */
conn.on('SET_FLIGHT_TOKEN', function(data){
    console.log('Got request to set flight token!')
    console.log(data)

    return updateFlightToken(data)
})

conn.on('STOP_LOGUI', function(data){
    return new Promise((resolve, reject)=>{
        sendStopCommand()
        resolve({
            msg:'LogUI stopped'
        });
        // if(LogUI.isActive()){
        //     LogUI.stop()
        //     resolve({msg:'LogUI stopped'})
        // }else{
        //     reject('LogUI is already stopped!')
        // }
    })
})

conn.on('START_LOGUI', function(data){
    return new Promise((resolve, reject)=>{
        sendToPage({
            config: _odo_sight_LogUI_config
        }, "START")
        resolve({
            sessionId: "Broken for now..."
        })
        // if(LogUI.isActive()){
        //     console.log('LogUI already active')
        //     reject('LogUI already active!')
        // }else{
        //     console.log('Starting log UI')
        //     LogUI.init(_odo_sight_LogUI_config)
        //     setTimeout(()=>{
        //         resolve({
        //             sessionId: LogUI.Config.sessionData.getSessionIDKey()
        //         })
        //     })
        // }
    })
    
})



// Register our tab id with our background script
browser.runtime.sendMessage({
    _data: 'some text'
})

window.reportedNetworkEventLogged = false

//Pass along network events to LogUI
browser.runtime.onMessage.addListener(
    (data, sender)=>{
        console.log("Logging network event: ", data)
        
        LogUI.logCustomMessage(data)
        if(!window.reportedNetworkEventLogged){
            conn.send({
                type:'NETWORK_EVENT_LOGGED'
            }, function(response){
                console.log('toggling reportedNetworkEventLogged flag')
                window.reportedNetworkEventLogged = true
            },
            function(error){
                console.log('Error reporting network event!', JSON.stringify(error, null, 4))
            })
        }
        
    }
)



/**
 * Configure LogUI
 * Configuration is defined in logUIConfig.js
 */
window.LogUI = LogUI


console.log(LogUI)

conn.send({
    type:'GET_FLIGHT_TOKEN'
}, (token)=>{
    updateFlightToken(token)
}, (err)=>{
    console.log('Error getting token, no LogUI for now...')
    console.error(err)
})