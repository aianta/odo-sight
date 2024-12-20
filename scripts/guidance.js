console.log('hello from guidance script')

const highlightedElements = new Map();

const guidanceSocket = {
    socket: undefined,
    clientId: undefined, 
    reconnectionReference: null,
    reconnectionAttempts : 0,
    socketPersistence: function(){
        //If the recoonection logic hasn't been set up yet
        if(!guidanceSocket.reconnectionReference){

            //Set it up on an interval
            guidanceSocket.reconnectionReference = setInterval(()=>{
                console.log(`[guidance.js] Checking WebSocket connection... websocket is ${guidanceSocket.socket} readyState: ${guidanceSocket.socket.readyState}`)
                if(guidanceSocket.socket){//If there is a non-null websocket object

                    switch(guidanceSocket.socket.readyState){
                        case 0:
                            return;
                        case 1:
                            console.log("[guidance.js] WebSocket connection re-established")
                            clearInterval(guidanceSocket.reconnectionReference)
                            guidanceSocket.reconnectionAttempts = 0;
                            guidanceSocket.reconnectionReference = null;
                            return;
                        default:
                            console.log(`[guidance.js] WebSocket connection to the server has failed; unable to reconnect.`)
                            guidanceSocket.shutdown()
                    }
                }

                guidanceSocket.reconnectionAttempts += 1;
                console.log(`(Re-)connection attempt ${guidanceSocket.reconnectionAttempts}`)
                initGuidanceSocket()
            })
        }
    },
    makePayload: function(type){
        return {
            clientId: guidanceSocket.clientId,
            source: 'GuidanceSocket',
            type: type
        }
    },

    notifyReconnected: async function(){
        try{
            console.log("Attempting to notify reconnected!")
            const payload = this.makePayload('NOTIFY_RECONNECT')
            this.socket.send(JSON.stringify(payload))
        }catch(error){
            console.error(error)
        }
        
    },

    onOpen: async function(){
        console.log(`[guidance.js] Guidance socket connection established`)
        guidanceSocket.notifyReconnected()
    },
    onError: async function(err){
        console.log(err)
    },
    onMessage: async function(msg){
        try{
            console.log('[guidance.js] GuidanceSocket got: ', msg)
            console.log(msg.data)
            const data = JSON.parse(msg.data)

            switch(data.type){
                case "PATH_COMPLETE":
                    clearHighlighting(); 
                    showPathComplete();
                    var response = guidanceSocket.makePayload("PATH_COMPLETE_ACK")
                    guidanceSocket.socket.send(JSON.stringify(response))
                    break;
                case "CLEAR_NAVIGATION_OPTIONS":
                    clearHighlighting();
                    
                    var response = guidanceSocket.makePayload("CLEAR_NAVIGATION_OPTIONS_RESULT")
                    guidanceSocket.socket.send(JSON.stringify(response))

                    break;
                case "SHOW_NAVIGATION_OPTIONS":
                    console.log('Got SHOW_NAVIGATION_OPTIONS')
                    clearHighlighting()

                    setTimeout(()=>{
                        data.navigationOptions.forEach(option=>{
                            highlightOption(option)
                        })
                    },3000) //TODO fix this

                
                    var response = guidanceSocket.makePayload('NAVIGATION_OPTIONS_SHOW_RESULT')
                    response['pathsRequestId'] = data.pathsRequestId
                    guidanceSocket.socket.send(JSON.stringify(response))

                    break;
                case "EXECUTE":
                    
                    switch(data.action){
                        
                        case "input":

                            const inputXpath = data.xpath

                            var targetElement = getElementByXpath(inputXpath)

                            if(targetElement === undefined){
                                console.log("Could not find element to enter data into")
                            }

                            performInput(targetElement, data.data)

                            break;
                        case "queryDom":
                            
                            console.log("Got queryDom command!")
                            let queryResults = performDomQuery(data)
                            
                            var response = guidanceSocket.makePayload('EXECUTION_RESULT')
                            response['pathsRequestId'] = data.pathsRequestId
                            response['queryResults'] = queryResults

                            guidanceSocket.socket.send(JSON.stringify(response))

                            break;
                        case "click":
                            console.log("Got click command to execute!")
                            const clickXpath = data.xpath

                            var targetElement = getElementByXpath(clickXpath)

                            if(targetElement === undefined){
                                console.log("Could not find element to click!")
                                return
                            }

                            console.log("Performing click on target element")
                            performClick(targetElement)
                            break;

                    }


                    break;
            }
        }catch(err){
            console.log(err)
        }

        
    },
    onClose: async function(event){
        console.log("[guidance.js] socket closed!")
        guidanceSocket.socketPersistence()
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
                try{
                    console.log('Got guidance socket configuration')
                    guidanceSocket.remoteHost = event.data.guidanceHost
                    guidanceSocket.clientId = event.data.clientId
    
                    if(guidanceSocket.socket === undefined || guidanceSocket.socket.readyState !== 1){
                        console.log("Creating guidance socket.")
                        const socket = new WebSocket(`wss://${guidanceSocket.remoteHost}`)
                        socket.addEventListener('open', guidanceSocket.onOpen )
                        socket.addEventListener('error', guidanceSocket.onError)
                        socket.addEventListener('message', guidanceSocket.onMessage )
                        socket.addEventListener('close', guidanceSocket.onClose )
        
                        guidanceSocket.socket = socket
                    }else{
    
                        console.log("Guidance socket exists")
                        guidanceSocket.notifyReconnected()
                    }
                }catch(error){
                    console.error("Error handling guidance socket config")
                    console.error(error)
                }


                break;
            case "GUIDANCE_SOCKET_STOP":
                //guidanceSocket.shutdown()
                break;
        }
    }
})

function performDomQuery(msg){
    const dynamicXPath = msg.xpath
    console.log("Looking for parent: ", dynamicXPath.prefix)
    let parentElement = getElementByXpath(dynamicXPath.prefix)

    let sites = [...parentElement.childNodes].filter(child=>child.localName === dynamicXPath.dynamicTag)
        .map((child, index)=>{
            let computedXPath = `${dynamicXPath.prefix}/${dynamicXPath.dynamicTag}`
            
            if(index !== 0){
                computedXPath = computedXPath + `[${index+1}]` //Xpaths are 1-indexed, so if the index is 0, the xpath index is 1, and we don't need square brackets. 
            }
            
            console.log("computed path: ", computedXPath + dynamicXPath.suffix)
            return {xpath:computedXPath + dynamicXPath.suffix, html: child.outerHTML}
        })
    
        console.log("Got ", sites.length, " query results!")

        return sites
}

function performInput(element, data ){
    /**
     * https://stackoverflow.com/questions/61190078/simulating-keypress-into-an-input-field-javascript
     */
    element.value = data
    element.dispatchEvent(
        new Event('input', {bubbles: true, cancelable: true})
    )

}

function performClick(element){
    /**
     * https://stackoverflow.com/questions/809057/how-do-i-programmatically-click-on-an-element-in-javascript
     */
    const clickEvent = new MouseEvent("click", {
        "view": window,
        "bubbles": true,
        "cancelable":false
    }) 

    element.dispatchEvent(clickEvent);
    
}

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

function initGuidanceSocket(){
    //Request socket config 
    window.postMessage({
        origin: 'guidance.js',
        type: 'GET_GUIDANCE_SOCKET_CONFIG'
    })
}

initGuidanceSocket();

function showPathComplete(){
    var sucessDiv = document.createElement("div")
    sucessDiv.innerHTML = `
    <h1 class="odo-success-text">Path Complete!</h1>
    `
    sucessDiv.setAttribute("class", "odo-path-success-container")
    document.body.appendChild(sucessDiv)
    console.log("[guidance.js] allegedly showing path complete")

    sucessDiv.setAttribute("class", "odo-path-success-container odo-path-success-animation")
    setTimeout(()=>{
        sucessDiv.remove()
    }, 4000) //time here should match animation length defined in 'guidanceStyles'
}




/**
 * Add guidance specific CSS to the page
 */
var guidanceStyles = `

    

    @keyframes slideFade {
        0% {
            transform: translateY(0%);
            opacity: 1;
        }
        100% {
            transform: translateY(-50%);
            opacity: 0;
        }
    }

    .odo-path-success-animation{
        animation: slideFade 4s linear;
        animation-fill-mode: forwards;
    }
    
    .odo-path-success-container{
        position: fixed;
        top: 50%;
        left: 25%;
        z-index: 9999;
    }

    .odo-success-text{
        font: 8rem "Fira Sans", sans-serif;
        color: #8ccc92;
    }

`

const sheet = new CSSStyleSheet();
sheet.replaceSync(guidanceStyles)
document.adoptedStyleSheets.push(sheet)

// var odoStyleSheet = document.createElement("stlye")
// odoStyleSheet.setAttribute("type", "text/css")
// odoStyleSheet.textContent = guidanceStyles
// document.head.appendChild(odoStyleSheet)


