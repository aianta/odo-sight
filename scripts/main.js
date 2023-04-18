
// Establish connection to background.js to communicate with Popup and remote LogUI/Odo servers
let conn = new BackgroundConnection(CONTENT_SCRIPTS_TO_BACKGROUND_PORT_NAME, 'main.js')

function updateFlightToken(data){
    return new Promise((resolve, reject)=>{
        if(LogUI.isActive()){
            console.log('Stopping LogUI')
            LogUI.stop()
        }
        LogUI.clearSessionID()
        console.log(`Updating LogUI config with new authorization token for flight ${data.flightID}`)
        _odo_sight_LogUI_config.logUIConfiguration.authorisationToken = data.flightAuthorisationToken
        setTimeout(()=>{
            console.log('Re-starting LogUI with new config object!')
            LogUI.init(_odo_sight_LogUI_config)
            console.log('Authorization Token: ', _odo_sight_LogUI_config.logUIConfiguration.authorisationToken)
            
            setTimeout(()=>{
                resolve({
                    sessionId: LogUI.Config.sessionData.getSessionIDKey()
                })
            },2000)
            
        }, 2000)
    })
}

// conn.on('REPORT_SESSION_ID', ()=>{
//         return Promise.resolve({
//     
//             sessionId: LogUI.Config.sessionData.getSessionIDKey()
//         })
// })

conn.on('SET_FLIGHT_TOKEN', function(data){
    console.log('Got request to set flight token!')
    console.log(data)

    return updateFlightToken(data)
})




// Register our tab id with our background script
browser.runtime.sendMessage({
    _data: 'some text'
})

//Pass along network events to LogUI
browser.runtime.onMessage.addListener(
    (data, sender)=>{
        console.log("Logging network event: ", data)
        
        LogUI.logCustomMessage(data)
    }
)

/**
 * Event Listener Hijack for accurate cause-effect logging. 
 * Key concept: Need to make sure logging event handlers fire BEFORE any dom changes take place.
 */

function reportIn(e){
    var a = this.lastListenerInfo[this.lastListenerInfo.length-1]
    // console.log(a)
  }
  
Node.prototype.realAddEventListener = Node.prototype.addEventListener;

Node.prototype.addEventListener = function(a,b,c){
    this.realAddEventListener(a, reportIn, c)
    this.realAddEventListener(a,b,c)
    if(!this.lastListenerInfo){
        this.lastListenerInfo = new Array()
    };
    this.lastListenerInfo.push({a:a, b:b, c:c})

    //this.lastListenerInfo.forEach(listener=>console.log(""+listener.b.toString()))
    let logUIIndex = this.lastListenerInfo.findIndex(listener=>listener.b.toString().startsWith('function (browserEvent) {'))
    //console.log('logUIIndex: ' + logUIIndex)
    let logUIListener = this.lastListenerInfo[logUIIndex]

    if(logUIIndex !== -1 || logUIIndex === 0){
        let newLastListenerInfo = []
        //If we do have a LogUI handler here that's not already in first place. Let's ensure it executes first by:
        //removing all other listeners, adding the logUI listener, then adding the other listeners back.
        let otherListeners = this.lastListenerInfo.filter(listener=>!listener.b.toString().startsWith('function (browserEvent) {'))
        for (let listener of otherListeners){
        this.removeEventListener(listener.a, listener.b, listener.c)
        }
        this.realAddEventListener(logUIListener.a, logUIListener.b, logUIListener.c)
        newLastListenerInfo.push({a:logUIListener.a, b:logUIListener.b, c:logUIListener.c})
        for (let listener of otherListeners){
        this.realAddEventListener(listener.a, listener.b, listener.c)
        newLastListenerInfo.push({a:listener.a, b:listener.b, c:listener.c})
        }
        this.lastListenerInfo = newLastListenerInfo
    }


}


/**
 * Configure LogUI
 * Configuration is defined in logUIConfig.js
 */
window.LogUI = LogUI
// LogUI.init(_odo_sight_LogUI_config)

// setTimeout(()=>{
//     conn.send({
//         type:'REPORT_SESSION_ID',
//         sessionId: LogUI.Config.sessionData.getSessionIDKey()
//     })
// },2000)

console.log(LogUI)
console.log("[Odo Sight] LogUI initalized.")

conn.send({
    type:'GET_FLIGHT_TOKEN'
}, (token)=>{
    updateFlightToken(token)
}, (err)=>{
    console.log('Error getting token, no LogUI for now...')
    console.error(err)
})