console.log('hello from guidance script')

const highlightedElements = new Map();

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
    onError: async function(err){

    },
    onMessage: async function(msg){
        console.log('[guidance.js] GuidanceSocket got: ', msg)
        console.log(msg.data)
        const data = JSON.parse(msg.data)

        switch(data.type){
            case "SHOW_NAVIGATION_OPTIONS":

                clearHighlighting()

                setTimeout(()=>{
                    data.navigationOptions.forEach(option=>{
                        highlightOption(option)
                    })
                },3000) //TODO fix this

               
                const response = guidanceSocket.makePayload('NAVIGATION_OPTIONS_SHOW_RESULT')
                response['pathsRequestId'] = guidanceSocket.pathsRequestId
                guidanceSocket.socket.send(JSON.stringify(response))

                break;
        }
    },
    onClose: async function(event){

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

function highlightOption(option){
    //If the option's xpath value is an object, then we need to highlight a dynamicXPath
    if(typeof option.xpath === 'object' && !Array.isArray(option.xpath) && option.xpath !== null){
        const dynamicXPath = option.xpath
        console.log("Looking for parent: ", dynamicXPath.prefix)
        let parentElement = getElementByXpath(dynamicXPath.prefix)

        let highlightSites = [...parentElement.childNodes].filter(child=>child.localName === dynamicXPath.dynamicTag)
            .map((child, index)=>{
                let computedXPath = `${dynamicXPath.prefix}/${dynamicXPath.dynamicTag}`

                if(index === 0){
                    computedXPath = computedXPath + `${dynamicXPath.suffix}`
                }else{
                    computedXPath = computedXPath + `[${index}]${dynamicXPath.suffix}`
                }

                //TODO -> handle case where the computedXPath doesn't match anything in the document

                return computedXPath
            })
        highlightSites.forEach(xpath=>highlightXPath(xpath))
    }else{
        //Otherwise it's a plain old xpath, go highlight it.
        highlightXPath(option.xpath)
    }

}

function highlightXPath(xpath){
    const element = getElementByXpath(xpath)

    highlightedElements.set(xpath, element.style.boxShadow) //Save the original state of the element's boxshadow CSS style.

    element.style.boxShadow = "0px 0px 5px 11px #E6EF3E" //Apply highlight

}

function clearHighlighting(){
    highlightedElements.forEach((value,key,map)=>{
        console.log("clearing highlight for ", key)
        getElementByXpath(key).style.boxShadow = value //Return the element's box shadow style to its original state.
    })
}