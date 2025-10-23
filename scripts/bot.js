
//Close the controls socket on unload
browser.runtime.onSuspend.addListener(_=>{controlSocket.shutdown()})

$('#execution-demo-btn').button({
    icon: 'fa-solid fa-gear blue',
    label: 'Execution Demo'
}).click(_=>{

    Promise.all([
        stateManager.exists('activePathsRequestId')
    ]).then(values=>{
        const pathsRequestExists = values[0]

        if(!pathsRequestExists){
            //No paths/execution request is active. time to create one.
            stateManager.activePathsRequestId(crypto.randomUUID())
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
            .then(socket=>{
                controlSocket.socket = socket
                console.log("Controls socket: ", controlSocket.socket)
                controlSocket.executionDemo()})
        }else{
            controlSocket.executionDemo()
        }
    })

})


const controlSocket = {
    socket: undefined, 
    messageQueue: [],
    executionDemo: async function(){
        console.log("Sending execution request")

        let payload = await this.makePayload("EXECUTION_REQUEST")
        payload['target'] = "78a0f623-0a70-4573-8303-33002df732b3"
        payload['id'] = await stateManager.activePathsRequestId()
        payload['userLocation'] = await getUserLocation()
        payload['parameters'] = [
            {
                "id": "005a7a59-86ac-438f-9109-c91f47fd3365",
                "type": "InputParameter",
                "value": "alana.mitchell@ualberta.ca"
            },
            {
                "id": "c6bb0305-b1f0-44be-b26b-64d0249de03a",
                "type": "InputParameter",
                "value": "V9rTq#7bP2wL"
            },
            // {
            //     "id": "db1f0ecf-95ee-4772-85c3-13b3963d11e1",
            //     "type": "SchemaParameter",
            //     "query": "Social Studies"
            // },
            {
                "id":"8585965f-d21b-4788-a841-39adee03b331",
                "type": "InputParameter",
                "value":"Victory Discussion"
            },
            {
                "id":"52e041d4-7310-4216-8197-a2a360eaf8a1",
                "type": "InputParameter",
                "value":"If you're reading this, it was entered inside a tinyMCE editor and Alex is a god."
            }
        ]


        if(controlSocket.socket == null || controlSocket.socket.readyState !== 1){
            this.messageQueue.push(JSON.stringify(payload))
        }else{
            controlSocket.socket.send(JSON.stringify(payload))
        }
    },
    makePayload: async function(type){
        return {
            clientId: await stateManager.clientId(),
            source: 'ControlSocket',
            type: type
        }
    },
    makePathsRequest: async function(){
        console.log("Controls socket ON makePathsRequest: ", controlSocket.socket)
        const pathsRequestId = await stateManager.activePathsRequestId()
        const targetNode = $('#target-node-select').find(":selected").val()
        const payload = await this.makePayload('PATHS_REQUEST')
    
        payload['userLocation'] = await getUserLocation()
        payload['pathsRequestId'] = pathsRequestId
        payload['targetNode'] = targetNode
        
        if(controlSocket.socket === null || controlSocket.socket.readyState !== 1){
            this.messageQueue.push(JSON.stringify(payload))
        }else{
            controlSocket.socket.send(JSON.stringify(payload))
        }

    },
    makeStopRequest: async function(){
        const pathsRequestId = await stateManager.activePathsRequestId()
        const payload = await this.makePayload('STOP_GUIDANCE_REQUEST')
        payload['pathsRequestId'] = pathsRequestId
        controlSocket.socket.send(JSON.stringify(payload))

        await stateManager.shouldTransmit(false)
    },
    notifyReconnected: async function(){        
        const payload = await this.makePayload('NOTIFY_RECONNECT')

        controlSocket.socket.send(JSON.stringify(payload))
    },
    onOpen: async function(event){
        console.log(`[bot.js] Controls socket opened!`)

        controlSocket.notifyReconnected();
        //Send any messages that have been queued...
        while(controlSocket.messageQueue.length > 0){
            controlSocket.socket.send(controlSocket.messageQueue.pop())
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

