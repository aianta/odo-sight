console.log('hello from guidance script')

const guidanceSocket = {
    socket: undefined,
    pathsRequestId: undefined,
    makePayload: function(type){
        return {
            source: 'GuidanceSocket',
            type: type
        }
    },

    notifyReconnected: async function(){
        const payload = this.makePayload('NOTIFY_RECONNECT')
        payload['pathsRequestId'] = guidanceSocket.pathsRequestId
        this.socket.send(JSON.stringify(payload))
    },

    onOpen: async function(){
        console.log(`[guidance.js] Guidance socket connection established`)
        guidanceSocket.notifyReconnected()
    },
    onError: async function(){

    },
    onMessage: async function(){

    },
    onClose: async function(){

    },
    shutdown: function(){
        guidanceSocket.socket.removeEventListener('close', guidanceSocket.onClose)
        guidanceSocket.socket.removeEventListener('open', guidanceSocket.onOpen)
        guidanceSocket.socket.removeEventListener('message', guidanceSocket.onMessage)
        guidanceSocket.socket.removeEventListener('error', guidanceSocket.onError)
        this.socket.close()
    }
}

//Bind an event listener to clean up the guidance socket before the page unloads.
window.addEventListener('onbeforeunload', (event)=>{
    guidanceSocket.shutdown()
})

//Bind an event listener to process messages from main.js
window.addEventListener("message", (event)=>{
    if(event.source === window && 
        event?.data?.origin === 'main.js'
    ){
        switch(event.data.type){
            //When we receive the socket config create the guidance socket and bind handlers.
            case "GUIDANCE_SOCKET_CONFIG":
                console.log('Got guidance socket configuration')
                guidanceSocket.pathsRequestId = event.data.id
                guidanceSocket.remoteHost = event.data.guidanceHost

                if(guidanceSocket.socket === undefined){
                    const socket = new WebSocket(`wss://${guidanceSocket.remoteHost}`)
                    socket.addEventListener('open', guidanceSocket.onOpen )
                    socket.addEventListener('error', guidanceSocket.onError)
                    socket.addEventListener('message', guidanceSocket.onMessage )
                    socket.addEventListener('close', guidanceSocket.onClose )
    
                    guidanceSocket.socket = socket
                }else{
                    guidanceSocket.notifyReconnected()
                }
                break;
            case "GUIDANCE_SOCKET_STOP":
                guidanceSocket.shutdown()
                break;
        }
    }
})

//Request socket config 
window.postMessage({
    origin: 'guidance.js',
    type: 'GET_GUIDANCE_SOCKET_CONFIG'
})

/**
 * https://stackoverflow.com/questions/10596417/is-there-a-way-to-get-element-by-xpath-using-javascript-in-selenium-webdriver
 * 
 * @param {string} path 
 * @returns 
 */
function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

const exampleXpath = '//html/body/div[3]/div[2]/div/div/div[1]/div/div/div/div/div/div[2]/form[1]/div[3]/div[2]/button'

setTimeout(()=>{
    console.log('highlighting example xpath')
    getElementByXpath(exampleXpath).style.boxShadow = "0px 0px 5px 11px #E6EF3E"
}, 2000)


