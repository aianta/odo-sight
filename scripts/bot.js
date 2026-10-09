
//Close the controls socket on unload
browser.runtime.onSuspend.addListener(_=>{controlSocket.shutdown()})


/**
 * Tasks are started and stopped by OdoBot. The control socket identifies this OdoX instance to OdoBot, which waits for it
 * (and the event socket) to connect before it considers the client ready.
 */
const controlSocket = {
    socket: undefined,
    makePayload: async function(type){
        return {
            clientId: await stateManager.clientId(),
            source: 'ControlSocket',
            type: type
        }
    },
    notifyReconnected: async function(){
        const payload = await this.makePayload('NOTIFY_RECONNECT')

        controlSocket.socket.send(JSON.stringify(payload))
    },
    onOpen: async function(event){
        console.log(`[bot.js] Controls socket opened!`)

        controlSocket.notifyReconnected();
    },
    onError: async function(error){

    },
    onMessage: async function(msg){

    },
    onClose: async function(event){

    },
    shutdown: function(){
        controlSocket.socket.removeEventListener('open', controlSocket.onOpen)
        controlSocket.socket.removeEventListener('close', controlSocket.onClose)
        controlSocket.socket.removeEventListener('message', controlSocket.onMessage)
        controlSocket.socket.removeEventListener('error', controlSocket.onError)
        this.socket.close()
    }
}




Promise.all([
    stateManager.boundDispatcher(),
    stateManager.shouldRecord(),
    stateManager.guidanceMode()
]).then(results=>{
    const boundDispatcher = results[0]
    const shouldRecord = results[1]
    const _guidanceMode = results[2]

    console.log(`[bot.js] GuidanceMode: ${_guidanceMode}`)

    if(!_guidanceMode){
        stateManager.guidanceMode(true)
    }

    //Check if the extension is already recording, if not start recording.
    if(!shouldRecord){
        stateManager.set('shouldRecord', true)
    }

    //Check if the bound disbatcher isn't already set to local or realtime
    if(boundDispatcher !== 'local' && boundDispatcher !== 'realtime'){
        stateManager.boundDispatcher('local') //Set it to local
    }

    initControlSocket()



})

function initControlSocket(){
    return Promise.all([
        stateManager.guidanceHost(),
        stateManager.clientId()
    ]).then(results=>{
        const guidanceHost = results[0]
        const clientId = results[1]

    const socket = new WebSocket(_GUIDANCE_SOCKET_URL(guidanceHost, clientId, 'ControlSocket'))
    socket.addEventListener('open', controlSocket.onOpen )
    socket.addEventListener('error', controlSocket.onError)
    socket.addEventListener('message', controlSocket.onMessage )
    socket.addEventListener('close', controlSocket.onClose )

    controlSocket.socket = socket

    return Promise.resolve(socket)

    })
}

//Self-signed ssl check
services.guidanceConnectionCheck().then(
    _=>{console.log('guidanceConnection check done')},
    err=>handleSelfSignedCertificateError(err, services.guidanceConnectionCheck)
)

