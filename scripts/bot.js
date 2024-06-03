
//Close the controls socket on unload
browser.runtime.onSuspend.addListener(_=>{controlSocket.shutdown()})


const controlSocket = {
    socket: undefined, 
    makePayload: function(type){
        return {
            source: 'ControlSocket',
            type: type
        }
    },
    makePathsRequest: async function(){
        const pathsRequestId = await stateManager.activePathsRequestId()
        const localContext = await stateManager.localContext()
        
        const payload = this.makePayload('PATHS_REQUEST')
        
        payload['pathsRequestId'] = pathsRequestId
        payload['localContext'] = localContext

        this.socket.send(JSON.stringify(payload))
    },
    notifyReconnected: async function(){
        const pathsRequestId = await stateManager.activePathsRequestId()
        
        const payload = this.makePayload('NOTIFY_RECONNECT')
        payload['pathsRequestId'] = pathsRequestId
        this.socket.send(JSON.stringify(payload))
    },
    onOpen: async function(event){
        console.log(`[bot.js] Controls socket opened!`)

        //Check to see if there is an active paths request if so, notify the server that the controls socket has reconnected
        if(await stateManager.exists('activePathsRequestId')){
            controlSocket.notifyReconnected()
        }
    },
    onError: async function(error){

    },
    onMessage: async function(msg){

    },
    onClose: async function(event){

    },
    shutdown: function(){
        this.socket.close()
    }
}




Promise.all([
    stateManager.boundDispatcher(),
    stateManager.shouldRecord(),
    stateManager.guidanceHost()
]).then(results=>{
    const boundDispatcher = results[0]
    const shouldRecord = results[1]
    const guidanceHost = results[2]

    //Check if the extension is already recording, if not start recording. 
    if(!shouldRecord){
        stateManager.set('shouldRecord', true)
    }

    //Check if the bound disbatcher isn't already set to local or realtime
    if(boundDispatcher !== 'local' && boundDispatcher !== 'realtime'){
        stateManager.boundDispatcher('local') //Set it to local
    }

    const socket = new WebSocket(`wss://${guidanceHost}`)
    socket.addEventListener('open', controlSocket.onOpen )
    socket.addEventListener('error', controlSocket.onError)
    socket.addEventListener('message', controlSocket.onMessage )
    socket.addEventListener('close', controlSocket.onClose )

    controlSocket.socket = socket
})

//Self-signed ssl check
services.guidanceConnectionCheck().then(
    _=>{console.log('guidanceConnection check done')},
    err=>handleSelfSignedCertificateError(err, services.guidanceConnectionCheck)
)

$('#guide-btn').click(_=>{
    console.log("guide button clicked!")

    Promise.all([
        stateManager.exists('activePathsRequestId'),
    ]).then(values=>{
        const pathsRequestExists = values[0]

        if(!pathsRequestExists){
            //No paths request is active, time to create one.
            stateManager.activePathsRequestId(crypto.randomUUID()) //Create a uuid for this paths request.
            .then(_=>controlSocket.makePathsRequest())
        }

        $('#guide-btn').removeClass('visible').addClass('hidden')
        $('#cancel-btn').removeClass('hidden').addClass('visible')

    })

})

