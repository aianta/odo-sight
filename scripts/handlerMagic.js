

//https://stackoverflow.com/questions/4634013/javascript-sleep
function sleep(ms){
  var start = new Date().getTime(), expire = start + ms;
  while (new Date().getTime() < expire) { }
  return;
}


/**
 * Event Listener Hijack for accurate cause-effect logging. 
 * Key concept: Need to make sure logging event handlers fire BEFORE any dom changes take place.
 */

function reportIn(e){
    var a = this.lastListenerInfo[this.lastListenerInfo.length-1]
    // console.log('reportIn')
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

    // this.lastListenerInfo.forEach(listener=>console.log(""+listener.b.toString()))
    let logUIIndex = this.lastListenerInfo.findIndex(listener=>listener.b.toString().startsWith('function (browserEvent) {'))
    // console.log('logUIIndex: ' + logUIIndex)
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

console.log('Establishing connection with content scripts!')
let contentScriptConn = new WindowConnection('handlerMagic.js', 'main.js')

// _odo_sight_LogUI_config = {
//     logUIConfiguration: {
//         endpoint: 'ws://localhost:8000/ws/endpoint/',
//         authorisationToken: 'eyJ0eXBlIjoibG9nVUktYXV0aG9yaXNhdGlvbi1vYmplY3QiLCJhcHBsaWNhdGlvbklEIjoiMWViZjRiYTEtMTc4My00OThiLTk2YzctNGFkZGMzODNiNjIwIiwiZmxpZ2h0SUQiOiI0NGNlZjYwYS1lNTlhLTRmYTEtOGUwNS1kYmM4MTMzMWM5ZjMifQ:1ptEoM:DctZVksPIBwsTZ_YqGtEMDsGDouyZoncuLMpNarIb_M',
//         verbose: true
//     },
//     applicationSpecificData: {
//         userID: 123,
//     },
//     browserEvents: {
//       trackCursor: false
//     },
//     trackingConfiguration: {
//         'page-load':{
//           selector: 'html',
//           event: 'load',
//           name: 'PAGE_LOAD'
//         },
//         'link-clicks':{
//           selector: 'a',
//           event: 'click',
//           name: 'LINK_CLICK', 
//           metadata: [
//             {
//               nameForLog: 'idAttribute',
//               sourcer: 'elementAttribute',
//               lookFor: 'id'
//             },
//             {
//               nameForLog: 'className',
//               sourcer: 'elementProperty',
//               lookFor: 'className'
//             },
//             {
//               nameForLog: 'baseURI',
//               sourcer: 'elementProperty',
//               lookFor: 'baseURI'
//             },
//             {
//               nameForLog: 'nodeName',
//               sourcer: 'elementProperty',
//               lookFor: 'nodeName'
//             }
//           ]
//         },
//         'table-data-clicks': {
//           selector: 'td', 
//           event: 'click',
//           name: 'TD_CLICK',
//           metadata: [
//             {
//               nameForLog: 'idAttribute',
//               sourcer: 'elementAttribute',
//               lookFor: 'id'
//             },
//             {
//               nameForLog: 'className',
//               sourcer: 'elementProperty',
//               lookFor: 'className'
//             },
//             {
//               nameForLog: 'baseURI',
//               sourcer: 'elementProperty',
//               lookFor: 'baseURI'
//             },
//             {
//               nameForLog: 'nodeName',
//               sourcer: 'elementProperty',
//               lookFor: 'nodeName'
//             }
//           ]
//         },
//         'button-clicks': {
//           selector: 'button',
//           event: 'click',
//           name: "BTN_CLICK",
//           metadata: [
//             {
//               nameForLog: 'idAttribute',
//               sourcer: 'elementAttribute',
//               lookFor: 'id'
//             },
//             {
//               nameForLog: 'buttonText',
//               sourcer: 'elementProperty',
//               lookFor: 'innerText'
//             },{
//               nameForLog: 'outerHTML',
//               sourcer: 'elementProperty',
//               lookFor: 'outerHTML'
//             }
//           ]
//         },
//         'input-data': {
//             selector: 'input',
//             event: 'input',
//             name: 'INPUT_CHANGE',
//             metadata: [
//               {
//                 nameForLog: 'idAttribute',
//                 sourcer: 'elementAttribute',
//                 lookFor: 'id'
//               },
//               {
//                 nameForLog: 'fieldValue',
//                 sourcer: 'elementProperty',
//                 lookFor: 'value'
//               },
//               {
//                 nameForLog: 'outerHTML',
//                 sourcer: 'elementProperty',
//                 lookFor: 'outerHTML'
//               }
//             ]
//         }
//     },
// }

window.reportedNetworkEventLogged = false

contentScriptConn.on('LOG_NETWORK_EVENT', function(request){
  return new Promise((resolve, reject)=>{
    if(!LogUI.isActive()){
      reject('LogUI is not active, cannot log network request')
    }
    console.log('Logging NETWORK_EVENT!')
    LogUI.logCustomMessage(request.eventDetails)
    if(!window.reportedNetworkEventLogged){
      contentScriptConn.send({
        type:'NETWORK_EVENT_LOGGED'
      }, function(response){
        window.reportedNetworkEventLogged = true
      }, function(error){
        console.error('Error reporting network event logged!', JSON.stringify(error, null, 4))
      })
    }
  })
})


/**
 * Handle LogUI restart request
 */
contentScriptConn.on('RESTART', function(request){
  return new Promise((resolve, reject)=>{
    if(LogUI.isActive()){
      console.log('Stopping LogUI')
      LogUI.stop()
    }
    LogUI.clearSessionID()
    console.log(`Starting LogUI with: ${JSON.stringify(request.config, null,4)}`)
    LogUI.init(request.config)
    setTimeout(()=>{
      resolve({
        sessionId: LogUI.Config.sessionData.getSessionIDKey()
      })
    }, 2000)
  })
})

/**
 * Handle LogUI start request
 */
contentScriptConn.on('START', function(request){
  return new Promise((resolve, reject)=>{
    if(LogUI.isActive()){
      console.log('LogUI is already active!')
      reject("LogUI is already active!")
    }
    LogUI.init(request.config)
    setTimeout(()=>{
      resolve({
        sessionId: LogUI.Config.sessionData.getSessionIDKey()
      })
    })

  })
})


/**
 * Handle LogUI stop request
 */

contentScriptConn.on('STOP', function(request){
  return new Promise((resolve,reject)=>{
    if(!LogUI.isActive()){
      console.log('LogUI is already stopped!')
      reject('LogUI is already stopped!')
    }else{
      LogUI.stop()
      resolve({msg:"LogUI stopped!"})
    }
  })
})

