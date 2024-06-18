
//Close the controls socket on unload
browser.runtime.onSuspend.addListener(_=>{controlSocket.shutdown()})

const controlSocket = {
    socket: undefined, 
    messageQueue: [],
    makePayload: function(type){
        return {
            source: 'ControlSocket',
            type: type
        }
    },
    makePathsRequest: async function(){
        console.log("Controls socket ON makePathsRequest: ", controlSocket.socket)
        const pathsRequestId = await stateManager.activePathsRequestId()
        const targetNode = $('#target-node-select').find(":selected").val()
        const payload = this.makePayload('PATHS_REQUEST')
    
        payload['userLocation'] = await getUserLocation()
        payload['pathsRequestId'] = pathsRequestId
        payload['targetNode'] = targetNode
        
        if(controlSocket.socket === null || controlSocket.socket.readyState !== 1){
            this.messageQueue.push(JSON.stringify(payload))
        }else{
            controlSocket.socket.send(JSON.stringify(payload))
        }

        //controlSocket.socket.send(JSON.stringify(payload))
    },
    makeStopRequest: async function(){
        const pathsRequestId = await stateManager.activePathsRequestId()
        const payload = this.makePayload('STOP_GUIDANCE_REQUEST')
        payload['pathsRequestId'] = pathsRequestId
        controlSocket.socket.send(JSON.stringify(payload))

        await stateManager.shouldTransmit(false)
    },
    notifyReconnected: async function(){
        const pathsRequestId = await stateManager.activePathsRequestId()
        
        const payload = this.makePayload('NOTIFY_RECONNECT')
        payload['pathsRequestId'] = pathsRequestId
        controlSocket.socket.send(JSON.stringify(payload))
    },
    onOpen: async function(event){
        console.log(`[bot.js] Controls socket opened!`)

        //Check to see if there is an active paths request if so, notify the server that the controls socket has reconnected
        if(await stateManager.exists('activePathsRequestId')){
            controlSocket.notifyReconnected()

            //Send any messages that have been queued...
            while(controlSocket.messageQueue.length > 0){
                controlSocket.socket.send(controlSocket.messageQueue.pop())
            }
        }
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
    stateManager.shouldRecord()
]).then(results=>{
    const boundDispatcher = results[0]
    const shouldRecord = results[1]


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
        stateManager.guidanceHost()
    ]).then(results=>{
        const guidanceHost = results[0]

    const socket = new WebSocket(`wss://${guidanceHost}`)
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

$('#guide-btn').click(_=>{
    console.log("guide button clicked!")

    Promise.all([
        stateManager.exists('activePathsRequestId'),
    ]).then(values=>{
        const pathsRequestExists = values[0]

        if(!pathsRequestExists){
            //No paths request is active, time to create one.
            stateManager.activePathsRequestId(crypto.randomUUID()) //Create a uuid for this paths request.
            .then(_=>{
                console.log("Checking control socket status")
                if(controlSocket.socket === null || controlSocket.socket.readyState !== 1){
                    console.log("Need to initalize new control socket")
                    return initControlSocket()
                }else{
                    console.log("Control socket exists and is connected")
                    return Promise.resolve(controlSocket.socket)
                }
            })
            //.then(_=>setTimeout(()=>controlSocket.makePathsRequest(), 10000))
            .then(socket=>{
                controlSocket.socket = socket
                console.log("Controls socket: ", controlSocket.socket)
                controlSocket.makePathsRequest()})
        }

    })

})


$('#cancel-btn').click(_=>{
    console.log('Cancel Guidance button clicked!')
    controlSocket.makeStopRequest()
    stateManager.clearActivePathsRequestId()
})

function getUserLocation(){
    return browser.tabs.query({currentWindow:true, active: true})
        .then((tabs)=>{
            return Promise.resolve(tabs[0].url)
        })
}