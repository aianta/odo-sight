console.log('hello from guidance script')

const highlightedElements = new Map();

const guidanceSocket = {
    socket: undefined,
    clientId: undefined, 
    reconnectionReference: null,
    reconnectionAttempts : 0,
    promises: new Map(),
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
            
            let response = undefined; 

            switch(data.type){
                case "ALTERNATE_XPATH_CONFIRMED":
                    //Look up a promise waiting for this confirmation.
                    let promiseKey = "REGISTER_ALTERNATE_XPATH,"+ data.alternateXpath

                    let resolve = guidanceSocket.promises.get(promiseKey)

                    if(resolve !== undefined && resolve !== null){
                        resolve()
                    }

                    //Remove/Clean-up the promise entry
                    guidanceSocket.promises.delete(promiseKey)


                    break;
                case "PATH_COMPLETE":
                    clearHighlighting(); 
                    showPathComplete();
                    response = guidanceSocket.makePayload("PATH_COMPLETE_ACK")
                    guidanceSocket.socket.send(JSON.stringify(response))
                    break;
                case "CLEAR_NAVIGATION_OPTIONS":
                    clearHighlighting();
                    
                    response = guidanceSocket.makePayload("CLEAR_NAVIGATION_OPTIONS_RESULT")
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

                
                    response = guidanceSocket.makePayload('NAVIGATION_OPTIONS_SHOW_RESULT')
                    response['pathsRequestId'] = data.pathsRequestId
                    guidanceSocket.socket.send(JSON.stringify(response))

                    break;
                case "EXECUTE":
                    
                    switch(data.action){
                        
                        case "input":
                            
                            //TinyMCE input commands will specify an editor id.
                            if (data.editorId !== undefined){
                                performInputTinymce(data.editorId, data.data)
                            }else{
                                //Otherwise we're looking for an input element at a specific xpath to enter info into.
                                const inputXpath = data.xpath
                                var targetElement = getElementByXpath(inputXpath)

                                if(targetElement === undefined){
                                    console.log("Could not find element to enter data into")
                                }

                                handleAlternateXpath(targetElement, data)
                                    .then(_=>performInput(targetElement, data.data))
                                    .catch(_=>handleUnresolvableXpath(data))
                            }

                            

                            break;
                        case "queryDom":
                            
                            console.log("Got queryDom command!")
                            let queryResults = performDomQuery(data)
                            
                            response = guidanceSocket.makePayload('EXECUTION_RESULT')
                            response['pathsRequestId'] = data.pathsRequestId
                            response['queryResults'] = queryResults
                            response['sourceNodeId'] = data.sourceNodeId

                            guidanceSocket.socket.send(JSON.stringify(response))

                            break;
                        case "click":
                            console.log("Got click command to execute!")
                            var clickXpath = data.xpath

                            if (clickXpath.endsWith('/svg')){
                                console.log(`Original Xpath to click ends in /svg: ${clickXpath}`)
                                clickXpath = clickXpath.substring(0, clickXpath.length - "/svg".length)
                                console.log(`Adjusted xpath: ${clickXpath}`)
                            }

                            var targetElement = getElementByXpath(clickXpath)

                            if(targetElement === undefined){
                                console.log("Could not find element to click!")
                                return
                            }

                            handleAlternateXpath(targetElement, data)
                            .then(_=>{
                                console.log("Performing click on target element")
                                performClick(targetElement)
                            })
                            .catch(_=>handleUnresolvableXpath(data))

                            break;
                        case "getDOMSnapshot":

                            response = guidanceSocket.makePayload('EXECUTION_RESULT')
                            response['domSnapshot'] = captureDOMSnapshot()
                            
                            guidanceSocket.socket.send(JSON.stringify(response))
                            break;

                        case "getUIControlState":

                            let state = getUIControlState(data.xpath, data.uiControlType)
                            response = guidanceSocket.makePayload('UI_CONTROL_STATE')
                            response['pathsRequestId'] = data.pathsRequestId
                            response['state'] = state

                            guidanceSocket.socket.send(JSON.stringify(response))
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
        if(guidanceSocket.reconnectionReference){
            clearInterval(guidanceSocket.reconnectionReference)
            guidanceSocket.reconnectionReference = null;
        }

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
            case "GUIDANCE_SOCKET_START":
                initGuidanceSocket();
                
                break;
            case "GUIDANCE_SOCKET_STOP":
                guidanceSocket.shutdown()
                break;
        }
    }
})

/**
 * Returns a filtered snapshot of the DOM 
 */
const captureDOMSnapshot = function(){
        //document.querySelectorAll('*').forEach(node=>node.setAttribute('_odo_isHidden', isHidden(node)))

        const fullHtml = document.documentElement.outerHTML
        const scriptRegex = /<script[\s\S]*?>[\s\S]*?<\/script>/gi //https://stackoverflow.com/questions/16585635/how-to-find-script-tag-from-the-string-with-javascript-regular-expression
        const noScripts = fullHtml.replaceAll(scriptRegex, "") //Clear all scripts.
        const xmlCharacterDataRegex = /<!\[CDATA[\s\S]*\]\]>/gi 
        const noXMLCDATA = noScripts.replaceAll(xmlCharacterDataRegex, "") //Clear all XML character data
        const styleRegex = /<style[\s\S]*?>[\s\S]*?<\/style>/gi
        const noStyle = noXMLCDATA.replaceAll(styleRegex, "") //Clear all css styles
        const svgPathsRegex = /<path[\s\S]*?>[\s\S]*?<\/path>/gi
        const noSvgPaths = noStyle.replaceAll(svgPathsRegex, "") //Clear all paths inside SVGs

        return noSvgPaths

    }

const captureCleanElementHTML = function(element){
    const fullHtml = element.outerHTML
    const svgPathsRegex = /<path[\s\S]*?>[\s\S]*?<\/path>/gi
    const noSvgPaths = fullHtml.replaceAll(svgPathsRegex, "") //Clear all paths inside SVGs
    return noSvgPaths
}

function getUIControlState(xpath, type){

    const targetElement = getElementByXpath(xpath)

    function blankStateInfo(xpath, type){
        return {
            xpath:xpath,
            type: type
        }
    }

    let results = []

    let stateInfo = blankStateInfo(xpath, type)
    if(targetElement.id){
        stateInfo.id = targetElement.id
    }

    switch(type){
        case "CHECKBOX":
            stateInfo.checked = targetElement.checked
            
            results.push(stateInfo)
            break;
        case "TEXT":
            stateInfo.value = targetElement.value
            results.push(stateInfo)
            break;
        case "RADIO_BUTTON":
            // For radio buttons, report the state of all the related buttons in the group. 
            
            // Get the name of the radio group
            radioGroupName = targetElement.name

            // Find all radio buttons in this group on the page
            document.querySelectorAll(`input[name="${radioGroupName}"][type="radio"]`).forEach(radioButton=>{
                let _state = blankStateInfo(getElementTreeXPath(radioButton), "RADIO_BUTTON")
                _state.checked = radioButton.checked

                if(radioButton.id){
                    _state.id = radioButton.id
                }

                if(radioButton.value){
                    _state.value = value
                }

                results.push(_state)
            })

            break;
        case "SELECT":
            stateInfo.value = targetElement.value
            stateInfo.options = []

            for (let child of targetElement.children){
                let _option = {
                    value: child.value,
                    text: child.innerText
                }
                stateInfo.options.push(_option)
            }
            results.push(stateInfo)
            break;
        case "INPUT_COMBO_BOX":
            stateInfo.value = targetElement.value
            results.push(stateInfo)
            break;
    }

    return results;

}

function handleUnresolvableXpath(instructionData){
    request = guidanceSocket.makePayload("UNRESOLVABLE_XPATH")
    request['pathsRequestId'] = instructionData.pathsRequestId
    request['sourceNodeId'] = instructionData.sourceNodeId
    request['xpath'] = instructionData.xpath

    guidanceSocket.socket.send(JSON.stringify(request))
}

/**
 * Sometimes the xpath we actually interact with is not the same as the xpath
 * the server told us to interact with, in those cases we need to register the new
 * xpath before we perform the interaction so that the server can pick up on the
 * fact that we are still following their instructions. 
 * @param {*} targetElement 
 * @param {*} instructionData 
 * @returns 
 */
function handleAlternateXpath(targetElement, instructionData){

    var {promise, resolve, reject} = Promise.withResolvers()
    if(targetElement === null){
        reject("Target Element was null.")
        return promise
    }

    const serverXpath = instructionData.xpath
    const pathsRequestId = instructionData.pathsRequestId
    const sourceNodeId = instructionData.sourceNodeId
    const elementXpath = getElementTreeXPath(targetElement)

    
    if (elementXpath !== serverXpath){
        request = guidanceSocket.makePayload("REGISTER_ALTERNATE_XPATH")
        request['pathsRequestId'] = pathsRequestId
        request['sourceNodeId'] = sourceNodeId
        request['alternateXpath'] = elementXpath

        //Register a promise for this request, so that we can resolve it when a response is recieved in the onMessage() function.
        guidanceSocket.promises.set("REGISTER_ALTERNATE_XPATH," + elementXpath, resolve)

        guidanceSocket.socket.send(JSON.stringify(request))
    }else{
        resolve()
    }

    return promise;
    
}

function resolveDynamicXpathSites(dynamicXPath){

    console.log("Looking for parent: ", dynamicXPath.prefix)
    let parentElement = getElementByXpath(dynamicXPath.prefix)

    let sites = [...parentElement.childNodes].filter(child=>child.localName === dynamicXPath.dynamicTag)
        .map((child, index)=>{
            let computedXPath = `${dynamicXPath.prefix}/${dynamicXPath.dynamicTag}`
            
            if(index !== 0){
                computedXPath = computedXPath + `[${index+1}]` //Xpaths are 1-indexed, so if the index is 0, the xpath index is 1, and we don't need square brackets. 
            }
            
            let suffix = undefined;

            if(Array.isArray(dynamicXPath.suffix)){
                suffix = dynamicXPath.suffix[0] //Use the first option. 
            }else{
                suffix = dynamicXPath.suffix
            }
            
            if(suffix !== undefined){
                //Append the '/' if it is missing to ensure the returned xpaths are valid.
                suffix = suffix.startsWith("/")?suffix:"/"+ suffix;
            }else{
                suffix = ""
            }
            

            console.log("computed path: ", computedXPath + suffix)
            return {xpath:computedXPath + suffix, html: captureCleanElementHTML(child)}
        })
    
        console.log("Got ", sites.length, " query results!")

        return sites
}

function performDomQuery(msg){
    let dynamicXPaths = msg.xpath
    
    if(Array.isArray(dynamicXPaths)){
        //Handle the case where the queryDom instruction is an array of dynamic xpaths
        sites = []
        for (let dxpath of dynamicXPaths){
            sites = sites.concat(resolveDynamicXpathSites(dxpath))
        }

        return sites

    }else{
        //Handle the case where the queryDom instruction contains a single dynamic xpath to resolve.
        return resolveDynamicXpathSites(dynamicXPaths)
    }
}

function performInput(element, data ){

    /**
     * This is necessary to update input values of elements that are being watched by a react application. If we do not use the native value setter
     * react will 'revert' the value changes we try to make programatically. 
     */
    //https://stackoverflow.com/questions/61107351/simulate-change-event-to-enter-text-into-react-textarea-with-vanilla-js-script
    if(element.nodeName === "INPUT"){
        var nativeInputValueSetter  = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        nativeInputValueSetter.call(element, data)
    } else if(element.nodeName === "TEXTAREA"){
        var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set
        nativeTextAreaValueSetter.call(element, data)
    } else{
        element.value = data
    }
    
    /**
     * https://stackoverflow.com/questions/61190078/simulating-keypress-into-an-input-field-javascript
     */
    element.dispatchEvent(
        new Event('input', {bubbles: true, cancelable: false})
    )

}

function performInputTinymce(editorId, data){

    if (typeof tinymce !== 'undefined'){
        targetEditor = tinymce.editors.find(editor=>editor.id === editorId)

        //Try and fallback on the active editor.
        if (targetEditor === undefined && tinymce.activeEditor !== undefined){
            targetEditor = tinymce.activeEditor
        }

        if (targetEditor === undefined){
            console.log(`Could not find tinymce editor with id ${editorId}`)
            return
        }

        targetEditor.setContent(data)

    }else{
        console.log("Could not find instance of tinymce to perform requested input. ")
    }

}

function performClick(element){
    /**
     * https://stackoverflow.com/questions/809057/how-do-i-programmatically-click-on-an-element-in-javascript
     */
    const clickEvent = new MouseEvent("click", {
        "view": window,
        "bubbles": true,
        /**
         * It is important that performed clicks are cancelable. 
         * According to: https://developer.mozilla.org/en-US/docs/Web/API/Event/cancelable
         * Most events originating from user interactions are cancelable. This allows event handlers to call 'preventDefault()' on
         * the event. 
         * 
         * This is a reasonably common paradigm in UI design, and shows up in Canvas. When you click the edit module button from the 
         * course home screen you are clicking an <a> tag to the module page of the course. However there is a JQuery component that
         * preventDefaults() this navigation and instead displays a module edit popup. This is what was captured in the traces. 
         * 
         * If cancelable was set to false, the bot would be forced to navigate to the module section thus bringing it off path. 
         * 
         */
        "cancelable":true 
    }) 

    element.dispatchEvent(clickEvent);
    
}

// Generating XPath
// https://stackoverflow.com/questions/3454526/how-to-calculate-the-xpath-position-of-an-element-using-javascript
const getElementTreeXPath = function(element)
    {
        var paths = [];  // Use nodeName (instead of localName) 
        // so namespace prefix is included (if any).
        for (; element && element.nodeType == Node.ELEMENT_NODE; 
            element = element.parentNode)
        {
            var index = 0;
            var hasFollowingSiblings = false;
            for (var sibling = element.previousSibling; sibling; 
                sibling = sibling.previousSibling)
            {
                // Ignore document type declaration.
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                    continue;

                if (sibling.nodeName == element.nodeName)
                    ++index;
            }

            for (var sibling = element.nextSibling; 
                sibling && !hasFollowingSiblings;
                sibling = sibling.nextSibling)
            {
                if (sibling.nodeName == element.nodeName)
                    hasFollowingSiblings = true;
            }

            var tagName = (element.prefix ? element.prefix + ":" : "") 
                            + element.localName;
            var pathIndex = (index || hasFollowingSiblings ? "[" 
                    + (index + 1) + "]" : "");
            paths.splice(0, 0, tagName + pathIndex);
        }

        return paths.length ? "/" + paths.join("/") : null;
    };

/*
    Another get element by xpath  function, with a simpler recovery approach that prioritizes xpath candidates that differ minimally from the indices in the original xpath. 
*/
function getElementByXpathV2(path){
    console.log(`looking for ${path}`)
    var result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    if (result == null){

        var alternate_candidates = []
        //https://stackoverflow.com/questions/2295657/return-positions-of-a-regex-match-in-javascript
        //Should it be a + instead of a * here? hmmmm....
        var index_re = /(?<=\[)[0-9]*(?=\])/dg
        while((match = index_re.exec(path)) != null){
            let xpathElementIndex = parseInt(match[0])
            let starting_index = match.indices[0][0]
            let ending_index = match.indices[0][1]

            //starting_index - 1 because the match starts at the number [number] and we need to account for the '['
            let xpath_leading_up_to_match = path.substring(0,starting_index-1)
            let element_at_partial_xpath = document.evaluate(xpath_leading_up_to_match, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
            if(element_at_partial_xpath != null && element_at_partial_xpath.parentElement != null){
                let parent = element_at_partial_xpath.parentElement
                let numChildren = parent.children.length
                let cursor = 1
                while(cursor <= numChildren){
                    let candidate = path.substring(0,starting_index)
                    candidate += cursor
                    candidate += path.substring(ending_index)
                    let indexDelta = Math.abs(xpathElementIndex - cursor);
                    let something = document.evaluate(candidate, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    console.log(`candidate xpath: ${[candidate, indexDelta]}`)
                    if(something != null){ 
                        console.log(`candidate xpath: ${[candidate, indexDelta]}`)
                        console.log(something)
                    }
                    
                    //An index delta of 0, suggests there is no change between the candidate and the original xpath, so no point in including such a candidate.
                    if(indexDelta > 0 && something != null){
                        alternate_candidates.push([candidate, indexDelta])
                    }
                    
                    cursor++
                }

            }
        }

        alternate_candidates.sort((a,b)=>a[1]-b[1])
        
        while(result == null && alternate_candidates.length !== 0){
            result = document.evaluate(alternate_candidates.shift()[0], document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        }
    }

    return result;
}

/**
 * https://stackoverflow.com/questions/10596417/is-there-a-way-to-get-element-by-xpath-using-javascript-in-selenium-webdriver
 * 
 * @param {string} path 
 * @returns 
 */
function getElementByXpath(path) {
    var result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

    //Fallback/Recovery logic.
    //The idea is to start truncating the xpath until we start finding elements.
    //And then try combinations of the original xpath with different indices on parents.
    //For example for the path: /html/body/div[4]/div[2]/div/div[2]/div[1]/div/div/div[5]/div/div/
    //We would want to try paths like: 
    // /html/body/div[4]/div[2]/div/div[2]/div[1]/div/div/div[1]/div/div/
    // /html/body/div[4]/div[2]/div/div[2]/div[1]/div/div/div[2]/div/div/
    // /html/body/div[4]/div[2]/div/div[2]/div[1]/div/div/div[3]/div/div/
    // /html/body/div[4]/div[2]/div/div[2]/div[1]/div/div/div[...]/div/div/

    if (result == null){

        //First try a simpler recovery mechanism
        result = getElementByXpathV2(path)
        if(result != null){
            return result
        }

        to_try = [] //Build up a list of xpaths to try.
        path_components = path.split("/")


        
        var index = 1
        while(path_components.length - index >= 3 ){ //xpaths will tend to start with /html/body, if we get to those it's kind of a lost cause.
            var temp = path_components.slice(0,path_components.length-index).join("/")
            console.log(`temp: ${temp}`)
            var element = document.evaluate(temp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if(element != null && element.parentElement != null && element.parentElement.children.length > 1){

                var child_index = 0
                while(child_index < element.parentElement.children.length){
                    var candidate_xpath = path_components.slice(0, path_components.length - index - 1)
                    var child = element.parentElement.querySelector(`:nth-child(${child_index + 1})`)
                    var tagName = (child.prefix ? child.prefix + ":" : "") 
                                    + child.localName;
                    candidate_xpath.push(tagName + "["+(child_index + 1)+"]")
                    candidate_xpath = candidate_xpath.concat(path_components.slice(path_components.length - index + 1))
                    console.log(`candidate xpath: ${candidate_xpath.join("/")}`)
                    to_try.push(candidate_xpath.join("/"))
                    child_index++
                }
            }
            index++
        }

        //Also try assembling candidate xpaths by exploiting hopefully similar sub-structures towards the leaves of the DOM
        var sub_structure_path = ""
        for(i = path_components.length -1; i >= 0; i--){
            let curr = path_components[i]
            if (curr == "body" || curr == "html"){
                break;
            }
            sub_structure_path = "/"+ curr + sub_structure_path
            
            let sub_structure_candidate_xpath = "/" + sub_structure_path
            console.log(sub_structure_candidate_xpath)
            //Test to see if this resolves to a single elememnt
            let matches = document.evaluate(sub_structure_candidate_xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength 
            if(matches == 1){
                to_try.push(sub_structure_candidate_xpath)
            }
        }

        console.log(`Given xpath could not be found, computed ${to_try.length} alternate candidates to try.`)
        console.log(to_try)

        for(alternate_xpath of to_try){
            console.log(`Trying ${alternate_xpath}`)
            result = document.evaluate(alternate_xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            console.log(`Result: ${result}`)
            if (result != null){
                return result;
            }
        }
        
        console.log(`Could not find element @ xpath ${path} or any alternate xpath`)
    }

    return result
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




