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

                            case "selectOption":
                                
                                var targetElement = getElementByXpath(data.xpath)
                                
                                if(targetElement === undefined){
                                    console.log("Could not find element from which to select option")
                                }
                                handleAlternateXpath(targetElement, data)
                                .then(_=>performSelect(targetElement, data.value))
                                .catch(_=>handleUnresolvableXpath(data))
                                

                                break;
                            case "queryDom":
                                
                                console.log("Got queryDom command!")

                                let queryResults = await performDomQuery(data)
                            
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

                                let state = getUIControlState(data.xpath, data.uiControlType, data.editorId)
                                response = guidanceSocket.makePayload('EXECUTION_RESULT')
                                response['pathsRequestId'] = data.pathsRequestId
                                response['uiControlType'] = data.uiControlType
                                response['state'] = state

                                guidanceSocket.socket.send(JSON.stringify(response))
                                break;

                            /**
                             * Uncharted agents (e.g. OdoBot's Qwen3.8 agent) act on screenshot coordinates rather than xpaths. OdoBot sends the
                             * action of one model step as an 'uncharted_step', with the action under 'unchartedAction'. No EXECUTION_RESULT is expected.
                             */
                            case "uncharted_step":
                                await enqueueUnchartedWork(()=>performUnchartedStep(data))
                                break;
                            case "left_click":
                            case "double_click":
                            case "triple_click":
                            case "type":
                            case "key":
                            case "scroll":
                            case "hscroll":
                            case "wait":
                                await enqueueUnchartedWork(()=>performUnchartedAction(data))
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
                        //Same URL as _GUIDANCE_SOCKET_URL in constants.js, which this page script cannot load.
                        const socket = new WebSocket(`wss://${guidanceSocket.remoteHost}/?clientId=${encodeURIComponent(guidanceSocket.clientId)}&source=GuidanceSocket`)
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
    const noCSSClassesRegex = /\bclass=["']([^"']*)["']/gi
    const noCSSClasses = noSvgPaths.replaceAll(noCSSClassesRegex, "")
    const noAttributesExceptRegex = /(?<![\w-])(?!(?:value|type|option|placeholder|name|aria-label|id|action|alt|checked|for|form|href|title)\b)([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
    const noAttributesExcept = noCSSClasses.replaceAll(noAttributesExceptRegex, "")
    return noAttributesExcept
}

function getUIControlState(xpath, type, editorId){
    var targetElement = undefined

    //Handle the case where we're looking for the text state of a tinymce widget
    if(editorId !== undefined && typeof tinymce !== 'undefined'){
        targetElement = tinymce.editors.find(e=>e.id === editorId)

        if (targetElement === undefined && tinymce.activeEditor !== undefined){
            targetElement = tinymce.activeEditor
        }

        if(targetElement === undefined){
            console.log(`Could not find tinymce editor with id ${editorId}`)
            return undefined
        }
    }else{
        targetElement = getElementByXpath(xpath)
    }
    

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
            stateInfo.html = targetElement.outerHTML
            
            results.push(stateInfo)
            break;
        case "TEXT":
            stateInfo.value = targetElement.value
            results.push(stateInfo)
            break;
        case "TINY_MCE_EDITOR":
            stateInfo.value = targetElement.getContent({format: "text"})
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
                    _state.value = radioButton.value
                }
                
                _state.radioGroupName = radioGroupName
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

function hasScrollableParent(element) {
  let parent = element.parentElement;
  
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    const isScrollableType = overflowY === 'auto' || overflowY === 'scroll';
    const hasScrollableHeight = parent.scrollHeight > parent.clientHeight;
    
    if (isScrollableType && hasScrollableHeight) {
      return parent; // Found the active scrollable container
    }
    parent = parent.parentElement;
  }
  return undefined; 
}

function _scrollToEndOrMax(element, maxScrolls, resolve){
    if(element != undefined && maxScrolls > 0 && element.scrollHeight > element.clientHeight){
           
                let amountToScroll = element.scrollHeight - element.clientHeight
                element.scrollBy(0, amountToScroll)

                setTimeout(()=>{
                    _scrollToEndOrMax(element, maxScrolls-1, resolve)
                },1000)

            
    }else{
        resolve()
    }
}

function scrollToEndOrMax(element, maxScrolls){

    let done = new Promise((resolve, reject)=>{
        _scrollToEndOrMax(element, maxScrolls, resolve)
    })

    return done
    

}

async function resolveDynamicXpathSites(dynamicXPath){

    console.log("Looking for parent: ", dynamicXPath.prefix)
    let parentElement = getElementByXpath(dynamicXPath.prefix)

    if (parentElement == null){
        return []
    }

    //Collections of related elements sometimes load in a paginated fashion, attempt to detect this and include all elements if possible.
    let scrollableAncestor = hasScrollableParent(parentElement)
    await scrollToEndOrMax(scrollableAncestor, 10)

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
            let targetElementAtSuffixXpath = computedXPath + suffix

            let childResult = {xpath:computedXPath + suffix, html: captureCleanElementHTML(child)}

            let targetElementAtSuffix = getElementByXpath(targetElementAtSuffixXpath)
            if(targetElementAtSuffix != undefined){

                if(targetElementAtSuffix.tagName === 'INPUT' && targetElementAtSuffix.type === "checkbox"){
                    childResult.checked = targetElementAtSuffix.checked
                    childResult.checkboxHTML = captureCleanElementHTML(targetElementAtSuffix)
                }

            }

            return childResult
        })
    
        console.log("Got ", sites.length, " query results!")

        return sites
}

async function performDomQuery(msg){
    let dynamicXPaths = msg.xpath
    
    if(Array.isArray(dynamicXPaths)){
        //Handle the case where the queryDom instruction is an array of dynamic xpaths
        sites = []
        for (let dxpath of dynamicXPaths){
            sites = sites.concat(await resolveDynamicXpathSites(dxpath))
        }

        return sites

    }else{
        //Handle the case where the queryDom instruction contains a single dynamic xpath to resolve.
        return await resolveDynamicXpathSites(dynamicXPaths)
    }
}

/**
 * This is necessary to update input values of elements that are being watched by a react application. If we do not use the native value setter
 * react will 'revert' the value changes we try to make programatically.
 */
//https://stackoverflow.com/questions/61107351/simulate-change-event-to-enter-text-into-react-textarea-with-vanilla-js-script
function setNativeValue(element, value){
    if(element.nodeName === "INPUT"){
        var nativeInputValueSetter  = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        nativeInputValueSetter.call(element, value)
    } else if(element.nodeName === "TEXTAREA"){
        var nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set
        nativeTextAreaValueSetter.call(element, value)
    } else{
        element.value = value
    }
}

function performInput(element, data ){

    setNativeValue(element, data)

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

function performSelect(element, value){
    element.value = value
    element.dispatchEvent(new Event('change'))
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

/**
 * Uncharted agent actions.
 *
 * The contract for each action is documented on its class in OdoBot's ca.ualberta.odobot.guidance.instructions.uncharted package; the
 * 'action' field of an instruction is the name returned by its action() method. Pointer and scroll coordinates are pixels of the screenshot
 * the agent observed, which shows the viewport, usually at the device pixel ratio.
 */

const UNCHARTED_PIXELS_PER_NOTCH = 50 //CSS pixels scrolled per mouse-wheel notch of a scroll or hscroll action.
const UNCHARTED_ARROW_SCROLL_PIXELS = 40 //CSS pixels an arrow key scrolls when no editable element or select is focused.
const UNCHARTED_DEFAULT_WAIT_SECONDS = 2 //For a wait without a duration, as OSWorld's pause for WAIT.

const UNCHARTED_TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number'])

const UNCHARTED_FOCUSABLE_SELECTOR = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, iframe, frame, summary, ' +
    'audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])'
const UNCHARTED_BUTTON_SELECTOR = 'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]'
const UNCHARTED_LINK_SELECTOR = 'a[href], area[href]'

//OdoBot sends lower-case pyautogui key names as the model wrote them, aliases included.
const UNCHARTED_KEY_ALIASES = {
    control: 'ctrl', ctrlleft: 'ctrl', ctrlright: 'ctrl',
    altleft: 'alt', altright: 'alt', option: 'alt',
    shiftleft: 'shift', shiftright: 'shift',
    return: 'enter', escape: 'esc', del: 'delete', pgup: 'pageup', pgdn: 'pagedown', spacebar: 'space',
    arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right'
}

//pyautogui key name -> [KeyboardEvent.key, KeyboardEvent.code, keyCode, location]
const UNCHARTED_NAMED_KEYS = {
    enter: ['Enter', 'Enter', 13], tab: ['Tab', 'Tab', 9], esc: ['Escape', 'Escape', 27],
    backspace: ['Backspace', 'Backspace', 8], delete: ['Delete', 'Delete', 46], insert: ['Insert', 'Insert', 45], space: [' ', 'Space', 32],
    up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40], left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
    home: ['Home', 'Home', 36], end: ['End', 'End', 35], pageup: ['PageUp', 'PageUp', 33], pagedown: ['PageDown', 'PageDown', 34],
    shift: ['Shift', 'ShiftLeft', 16, 1], ctrl: ['Control', 'ControlLeft', 17, 1], alt: ['Alt', 'AltLeft', 18, 1],
    capslock: ['CapsLock', 'CapsLock', 20]
}

//Punctuation key -> [KeyboardEvent.code, keyCode] on a US layout.
const UNCHARTED_PUNCTUATION_KEYS = {
    '-': ['Minus', 189], '=': ['Equal', 187], '[': ['BracketLeft', 219], ']': ['BracketRight', 221], '\\': ['Backslash', 220],
    ';': ['Semicolon', 186], "'": ['Quote', 222], ',': ['Comma', 188], '.': ['Period', 190], '/': ['Slash', 191], '`': ['Backquote', 192]
}

const UNCHARTED_MODIFIER_FLAGS = {ctrl: 'ctrlKey', shift: 'shiftKey', alt: 'altKey'}

let unchartedQueue = Promise.resolve()

/**
 * Uncharted work runs one piece at a time in the order it was received, so a step never overlaps the previous one (e.g. during a wait).
 */
function enqueueUnchartedWork(work){
    unchartedQueue = unchartedQueue
        .then(work)
        .catch(err=>console.error('[guidance.js] Uncharted work failed', err))
    return unchartedQueue
}

function unchartedSleep(ms){
    return new Promise(resolve=>setTimeout(resolve, ms))
}

/**
 * A step holds exactly one action. OdoBot observes its result itself, once the page has settled.
 */
async function performUnchartedStep(step){
    console.log(`[guidance.js] Uncharted step ${step.step}: ${step.lowLevelInstruction}`)
    if(!step.unchartedAction){
        console.error(`[guidance.js] Uncharted step ${step.step} has no action`, step)
        return
    }
    await performUnchartedAction(step.unchartedAction)
}

async function performUnchartedAction(action){
    console.log('[guidance.js] Performing uncharted action', action)
    switch(action.action){
        case "left_click":
            performUnchartedClicks(action, 1)
            break;
        case "double_click":
            performUnchartedClicks(action, 2)
            break;
        case "triple_click":
            performUnchartedClicks(action, 3)
            break;
        case "type":
            performUnchartedType(action.text ?? '')
            break;
        case "key":
            performUnchartedKeyPress(action.keys ?? [])
            break;
        case "scroll":
            performUnchartedScroll(action, 'y')
            break;
        case "hscroll":
            performUnchartedScroll(action, 'x')
            break;
        case "wait":
            const seconds = Number.isFinite(action.seconds) ? Math.max(0, action.seconds) : UNCHARTED_DEFAULT_WAIT_SECONDS
            await unchartedSleep(seconds * 1000)
            break;
        default:
            console.warn(`[guidance.js] Unknown uncharted action: ${action.action}`)
    }
}

/**
 * Maps a screenshot coordinate to CSS pixels of the viewport.
 */
function unchartedViewportPoint(action){
    const scaleX = action.screenshotWidth ? window.innerWidth / action.screenshotWidth : 1
    const scaleY = action.screenshotHeight ? window.innerHeight / action.screenshotHeight : 1
    return {x: action.x * scaleX, y: action.y * scaleY}
}

/**
 * document.elementFromPoint, descending into same-origin iframes (e.g. TinyMCE) and open shadow roots.
 * @returns {{element: Element, clientX: number, clientY: number, view: Window}|null} the element, the point in the viewport of the element's
 * document, and that document's window.
 */
function unchartedElementFromPoint(x, y){
    let element = document.elementFromPoint(x, y)
    let view = window
    for(let depth = 0; element && depth < 32; depth++){
        if(element.shadowRoot){
            const inner = element.shadowRoot.elementFromPoint(x, y)
            if(inner && inner !== element){
                element = inner
                continue
            }
        }
        const frameDocument = (element.tagName === 'IFRAME' || element.tagName === 'FRAME') ? element.contentDocument : null //null for cross-origin frames
        if(frameDocument){
            const rect = element.getBoundingClientRect()
            const style = view.getComputedStyle(element)
            const innerX = x - rect.left - element.clientLeft - parseFloat(style.paddingLeft)
            const innerY = y - rect.top - element.clientTop - parseFloat(style.paddingTop)
            const inner = frameDocument.elementFromPoint(innerX, innerY)
            if(inner){
                element = inner
                x = innerX
                y = innerY
                view = frameDocument.defaultView
                continue
            }
        }
        break
    }
    return element ? {element, clientX: x, clientY: y, view} : null
}

/**
 * document.activeElement, descending into same-origin iframes and open shadow roots.
 */
function unchartedActiveElement(){
    let element = document.activeElement
    for(let depth = 0; element && depth < 32; depth++){
        if(element.shadowRoot?.activeElement){
            element = element.shadowRoot.activeElement
        }else if((element.tagName === 'IFRAME' || element.tagName === 'FRAME') && element.contentDocument?.activeElement){
            element = element.contentDocument.activeElement
        }else{
            break
        }
    }
    return element ?? document.body
}

/**
 * The parent element, or the host of a shadow root.
 */
function unchartedParent(element){
    return element.parentElement ?? element.getRootNode()?.host ?? null
}

function unchartedEditingHost(element){
    let host = element
    while(host.parentElement?.isContentEditable){
        host = host.parentElement
    }
    return host
}

/**
 * The element a click on the given element focuses: the element itself or its nearest focusable ancestor, or null.
 */
function unchartedFocusTarget(element){
    for(let current = element; current; current = unchartedParent(current)){
        if(current.isContentEditable){
            return unchartedEditingHost(current)
        }
        if(current.matches(UNCHARTED_FOCUSABLE_SELECTOR) && !current.matches(':disabled')){
            return current
        }
    }
    return null
}

function unchartedIsTextField(element){
    return element?.tagName === 'TEXTAREA' || (element?.tagName === 'INPUT' && UNCHARTED_TEXT_INPUT_TYPES.has(element.type))
}

function unchartedIsEditable(element){
    if(unchartedIsTextField(element)){
        return !element.readOnly && !element.disabled
    }
    return element?.isContentEditable === true
}

/**
 * @returns {{start: number, end: number, direction: string}|null} null for inputs without a selection API (e.g. email, number).
 */
function unchartedTextFieldSelection(field){
    try{
        if(field.selectionStart !== null){
            return {start: field.selectionStart, end: field.selectionEnd, direction: field.selectionDirection}
        }
    }catch(_){}
    return null
}

function unchartedSetSelection(field, start, end, direction){
    try{
        field.setSelectionRange(start, end, direction)
    }catch(_){
        //Inputs without a selection API.
    }
}

/**
 * LeftClick, DoubleClick and TripleClick: the click sequence count times (detail 1 to count). A double click is followed by dblclick, and a
 * triple click selects the text of the target, as synthetic clicks select nothing.
 */
function performUnchartedClicks(action, count){
    const point = unchartedViewportPoint(action)
    let hit = unchartedElementFromPoint(point.x, point.y)
    if(!hit){
        console.warn(`[guidance.js] No element at (${point.x}, ${point.y}) for ${action.action}`)
        return
    }

    for(let detail = 1; detail <= count; detail++){
        //The page may have replaced the element in response to the previous click.
        if(!hit.element.isConnected){
            hit = unchartedElementFromPoint(point.x, point.y) ?? hit
        }
        unchartedDispatchClick(hit, detail)
    }

    if(!hit.element.isConnected){
        hit = unchartedElementFromPoint(point.x, point.y) ?? hit
    }
    if(count === 2){
        hit.element.dispatchEvent(new hit.view.MouseEvent('dblclick', unchartedMouseInit(hit, 2, 0)))
    }
    if(count === 3){
        unchartedSelectContents(hit.element)
    }
}

function unchartedMouseInit(hit, detail, buttons){
    return {
        bubbles: true,
        cancelable: true, //See performClick, pages rely on cancelling clicks.
        composed: true,
        view: hit.view,
        detail: detail,
        clientX: hit.clientX,
        clientY: hit.clientY,
        button: 0,
        buttons: buttons
    }
}

/**
 * One left click: pointerdown, mousedown, pointerup, mouseup and click. Synthetic events do not move focus, so the target or its nearest
 * focusable ancestor is focused after mousedown, unless the page cancelled mousedown, which natively prevents the focus change.
 */
function unchartedDispatchClick(hit, detail){
    const {element, view} = hit
    const pointerInit = (buttons)=>({...unchartedMouseInit(hit, 0, buttons), pointerId: 1, pointerType: 'mouse', isPrimary: true})

    if(view.PointerEvent){
        element.dispatchEvent(new view.PointerEvent('pointerdown', pointerInit(1)))
    }
    const mousedownAllowed = element.dispatchEvent(new view.MouseEvent('mousedown', unchartedMouseInit(hit, detail, 1)))
    if(mousedownAllowed){
        unchartedFocusForClick(hit, detail)
    }
    if(view.PointerEvent){
        element.dispatchEvent(new view.PointerEvent('pointerup', pointerInit(0)))
    }
    element.dispatchEvent(new view.MouseEvent('mouseup', unchartedMouseInit(hit, detail, 0)))
    element.dispatchEvent(new view.MouseEvent('click', unchartedMouseInit(hit, detail, 0)))
}

function unchartedFocusForClick(hit, detail){
    const target = unchartedFocusTarget(hit.element)
    const previous = unchartedActiveElement()

    if(!target){
        //Clicking something that cannot take focus moves focus away from the focused element.
        if(previous && previous !== previous.ownerDocument.body){
            previous.blur()
        }
        return
    }

    if(target !== previous){
        target.focus({preventScroll: true})
    }
    if(detail === 1){
        unchartedPlaceCaret(target, hit)
    }
}

/**
 * A native click puts the caret of an editable element at the clicked point, where TypeText then inserts its text.
 */
function unchartedPlaceCaret(target, hit){
    if(!unchartedIsEditable(target)){
        return
    }

    const doc = target.ownerDocument
    let node = null
    let offset = 0
    if(doc.caretPositionFromPoint){
        const position = doc.caretPositionFromPoint(hit.clientX, hit.clientY)
        node = position?.offsetNode
        offset = position?.offset
    }else if(doc.caretRangeFromPoint){
        const range = doc.caretRangeFromPoint(hit.clientX, hit.clientY)
        node = range?.startContainer
        offset = range?.startOffset
    }

    if(unchartedIsTextField(target)){
        //Firefox reports points inside a text field as an offset into its value. Otherwise use the end of the text, where a click on the centre
        //of a field usually lands.
        const caret = node === target ? offset : target.value.length
        unchartedSetSelection(target, caret, caret)
        return
    }

    if(node && target.contains(node)){
        doc.defaultView.getSelection().collapse(node, offset)
    }
}

function unchartedSelectContents(element){
    if(element.tagName === 'INPUT' || element.tagName === 'TEXTAREA'){
        element.select()
        return
    }
    const host = element.isContentEditable ? unchartedEditingHost(element) : element
    const range = host.ownerDocument.createRange()
    range.selectNodeContents(host)
    const selection = host.ownerDocument.defaultView.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
}

/**
 * TypeText: types into the focused element. Each line break is an Enter key press between the text of the lines.
 */
function performUnchartedType(text){
    text.split('\n').forEach((line, index)=>{
        if(index > 0){
            performUnchartedKeyPress(['enter'])
        }
        if(line !== ''){
            unchartedTypeIntoFocused(line)
        }
    })
}

function unchartedTypeIntoFocused(text){
    const target = unchartedActiveElement()

    //Synthetic clicks cannot open the native option list of a select, so typing is how the agent picks an option.
    if(target.tagName === 'SELECT'){
        unchartedChooseOptionByText(target, text)
        return
    }

    if(!unchartedIsEditable(target)){
        console.warn('[guidance.js] Cannot type, the focused element is not editable', target)
        return
    }

    unchartedInsertText(target, text)
}

/**
 * Inserts text at the caret of a focused editable element, replacing the selection, with a single input event for the whole text.
 */
function unchartedInsertText(target, text){
    const doc = target.ownerDocument
    let inserted = false
    try{
        inserted = doc.execCommand('insertText', false, text)
    }catch(_){}
    if(inserted){
        return
    }

    if(unchartedIsTextField(target)){
        const selection = unchartedTextFieldSelection(target)
        if(selection){
            setNativeValue(target, target.value.slice(0, selection.start) + text + target.value.slice(selection.end))
            unchartedSetSelection(target, selection.start + text.length, selection.start + text.length)
        }else{
            //Without a selection API the caret is unknown, replace the value as performInput does.
            setNativeValue(target, text)
        }
    }else{
        const selection = doc.defaultView.getSelection()
        if(selection.rangeCount === 0){
            selection.selectAllChildren(target)
            selection.collapseToEnd()
        }
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const node = doc.createTextNode(text)
        range.insertNode(node)
        selection.collapse(node, node.length)
    }

    target.dispatchEvent(new doc.defaultView.InputEvent('input', {bubbles: true, inputType: 'insertText', data: text}))
}

function unchartedNormalizeLabel(text){
    return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Selects the first enabled option whose visible text matches the text, case-insensitively, preferring an exact match to a prefix match.
 */
function unchartedChooseOptionByText(select, text){
    const wanted = unchartedNormalizeLabel(text)
    if(wanted === ''){
        return
    }

    const options = [...select.options].filter(option=>!option.disabled)
    const option = options.find(option=>unchartedNormalizeLabel(option.text) === wanted)
        ?? options.find(option=>unchartedNormalizeLabel(option.text).startsWith(wanted))
    if(!option){
        console.warn(`[guidance.js] No option of the focused select matches '${text}'`, select)
        return
    }

    select.selectedIndex = option.index
    unchartedDispatchSelectEvents(select)
}

function unchartedDispatchSelectEvents(select){
    const view = select.ownerDocument.defaultView
    select.dispatchEvent(new view.Event('input', {bubbles: true}))
    select.dispatchEvent(new view.Event('change', {bubbles: true}))
}

function unchartedKeyName(name){
    const lower = String(name).toLowerCase()
    return UNCHARTED_KEY_ALIASES[lower] ?? lower
}

/**
 * KeyboardEvent key, code, keyCode and location for a pyautogui key name.
 */
function unchartedKeyInfo(name){
    const named = UNCHARTED_NAMED_KEYS[name]
    if(named){
        return {key: named[0], code: named[1], keyCode: named[2], location: named[3] ?? 0}
    }

    let match = /^f([1-9]|1[0-9]|2[0-4])$/.exec(name)
    if(match){
        return {key: `F${match[1]}`, code: `F${match[1]}`, keyCode: 111 + Number(match[1]), location: 0}
    }
    match = /^num([0-9])$/.exec(name)
    if(match){
        return {key: match[1], code: `Numpad${match[1]}`, keyCode: 96 + Number(match[1]), location: 3}
    }
    if(/^[a-z]$/.test(name)){
        return {key: name, code: `Key${name.toUpperCase()}`, keyCode: name.toUpperCase().charCodeAt(0), location: 0}
    }
    if(/^[0-9]$/.test(name)){
        return {key: name, code: `Digit${name}`, keyCode: name.charCodeAt(0), location: 0}
    }
    const punctuation = UNCHARTED_PUNCTUATION_KEYS[name]
    if(punctuation){
        return {key: name, code: punctuation[0], keyCode: punctuation[1], location: 0}
    }
    return {key: name, code: '', keyCode: 0, location: 0}
}

/**
 * Dispatches a keydown or keyup to the focused element (or the body).
 * @returns {boolean} false if the page cancelled the event.
 */
function unchartedDispatchKey(type, name, modifiers){
    const target = unchartedActiveElement()
    const view = target.ownerDocument.defaultView
    const info = unchartedKeyInfo(name)
    const key = modifiers.shiftKey && /^[a-z]$/.test(info.key) ? info.key.toUpperCase() : info.key

    const event = new view.KeyboardEvent(type, {
        key: key,
        code: info.code,
        location: info.location,
        keyCode: info.keyCode,
        which: info.keyCode,
        bubbles: true,
        cancelable: true,
        composed: true,
        view: view,
        ...modifiers
    })

    //Firefox ignores keyCode and which in the event init, but jQuery-era handlers (e.g. in Canvas) still read them.
    for(const property of ['keyCode', 'which']){
        if(event[property] !== info.keyCode){
            Object.defineProperty(event, property, {get: ()=>info.keyCode})
        }
    }

    return target.dispatchEvent(event)
}

/**
 * KeyPress: presses the keys in order and releases them in reverse order, so that the modifiers among them are held for the last key.
 * Synthetic key events have no default action, so when the last key's keydown is not cancelled its default action is performed here.
 */
function performUnchartedKeyPress(keys){
    const names = keys.map(unchartedKeyName)
    if(names.length === 0){
        return
    }

    const modifiers = {ctrlKey: false, shiftKey: false, altKey: false, metaKey: false}
    let defaultAllowed = true
    names.forEach(name=>{
        const flag = UNCHARTED_MODIFIER_FLAGS[name]
        if(flag){
            modifiers[flag] = true
        }
        defaultAllowed = unchartedDispatchKey('keydown', name, modifiers)
    })

    if(defaultAllowed){
        unchartedKeyDefault(names[names.length - 1], {...modifiers})
    }

    names.slice().reverse().forEach(name=>{
        const flag = UNCHARTED_MODIFIER_FLAGS[name]
        if(flag){
            modifiers[flag] = false
        }
        unchartedDispatchKey('keyup', name, modifiers)
    })
}

function unchartedKeyDefault(name, modifiers){
    const target = unchartedActiveElement()

    if(modifiers.altKey || modifiers.metaKey){
        return
    }
    if(modifiers.ctrlKey && !['a', 'left', 'right', 'up', 'down', 'home', 'end', 'backspace', 'delete'].includes(name)){
        return
    }

    switch(name){
        case 'enter':
            unchartedEnter(target)
            break;
        case 'tab':
            unchartedMoveFocus(target, modifiers.shiftKey)
            break;
        case 'backspace':
        case 'delete':
            if(unchartedIsEditable(target)){
                unchartedDelete(target, name === 'delete', modifiers.ctrlKey)
            }
            break;
        case 'space':
            if(target.matches(UNCHARTED_BUTTON_SELECTOR) || target.matches('input[type="checkbox"], input[type="radio"]')){
                performClick(target)
            }else if(unchartedIsEditable(target)){
                unchartedInsertText(target, ' ')
            }
            break;
        case 'up':
        case 'down':
        case 'left':
        case 'right':
        case 'home':
        case 'end':
            unchartedArrowKey(target, name, modifiers)
            break;
        case 'pageup':
        case 'pagedown':
            const direction = name === 'pageup' ? -1 : 1
            const scroller = unchartedScrollTarget(target, 'y', direction)
            const viewportHeight = scroller.window === scroller ? scroller.innerHeight : scroller.clientHeight
            unchartedScrollBy(scroller, 'y', direction * viewportHeight)
            break;
        case 'a':
            if(modifiers.ctrlKey){
                unchartedSelectAll(target)
            }
            break;
        //esc has no default action, pages close their own dialogs and menus.
    }
}

function unchartedEnter(target){
    if(target.tagName === 'TEXTAREA' || target.isContentEditable){
        if(unchartedIsEditable(target)){
            unchartedInsertLineBreak(target)
        }
        return
    }
    if(target.matches(UNCHARTED_BUTTON_SELECTOR) || target.matches(UNCHARTED_LINK_SELECTOR)){
        performClick(target)
        return
    }
    if(target.tagName === 'INPUT' && target.form){
        target.form.requestSubmit()
    }
}

function unchartedInsertLineBreak(target){
    if(target.tagName === 'TEXTAREA'){
        unchartedInsertText(target, '\n')
        return
    }
    const doc = target.ownerDocument
    for(const command of ['insertLineBreak', 'insertParagraph']){
        try{
            if(doc.execCommand(command, false)){
                return
            }
        }catch(_){}
    }
    console.warn('[guidance.js] Could not insert a line break', target)
}

/**
 * Backspace (backwards) and delete (forward): deletes the selection, otherwise the character (or with ctrl, the word) next to the caret.
 */
function unchartedDelete(target, forward, byWord){
    const doc = target.ownerDocument
    const selection = doc.defaultView.getSelection()

    if(byWord){
        const fieldSelection = unchartedIsTextField(target) ? unchartedTextFieldSelection(target) : null
        if(fieldSelection && fieldSelection.start === fieldSelection.end){
            const boundary = unchartedWordBoundary(target.value, fieldSelection.start, forward ? 1 : -1)
            unchartedSetSelection(target, Math.min(boundary, fieldSelection.start), Math.max(boundary, fieldSelection.start))
        }else if(!unchartedIsTextField(target) && selection.isCollapsed){
            selection.modify?.('extend', forward ? 'forward' : 'backward', 'word')
        }
    }

    let deleted = false
    try{
        deleted = doc.execCommand(forward ? 'forwardDelete' : 'delete', false)
    }catch(_){}
    if(deleted){
        return
    }

    if(unchartedIsTextField(target)){
        const value = target.value
        let {start, end} = unchartedTextFieldSelection(target) ?? {start: value.length, end: value.length}
        if(start === end){
            if(forward){
                end = Math.min(value.length, end + 1)
            }else{
                start = Math.max(0, start - 1)
            }
        }
        if(start === end){
            return
        }
        setNativeValue(target, value.slice(0, start) + value.slice(end))
        unchartedSetSelection(target, start, start)
    }else{
        if(selection.isCollapsed){
            selection.modify?.('extend', forward ? 'forward' : 'backward', 'character')
        }
        if(selection.isCollapsed){
            return
        }
        selection.deleteFromDocument()
    }

    target.dispatchEvent(new doc.defaultView.InputEvent('input', {bubbles: true, inputType: forward ? 'deleteContentForward' : 'deleteContentBackward'}))
}

/**
 * The tabbable elements of a document in sequential focus order: positive tabindex values first, then document order.
 */
function unchartedTabOrder(doc){
    const candidates = [...doc.querySelectorAll(UNCHARTED_FOCUSABLE_SELECTOR)].filter(element=>
        element.tabIndex >= 0 &&
        !element.matches(':disabled') &&
        !element.closest('[inert]') &&
        element.getClientRects().length > 0 &&
        doc.defaultView.getComputedStyle(element).visibility !== 'hidden'
    )

    //Only one radio button of a group is tabbable: the checked one, otherwise the first.
    const radioGroups = new Map()
    candidates.filter(element=>element.tagName === 'INPUT' && element.type === 'radio' && element.name).forEach(radio=>{
        if(!radioGroups.has(radio.name)){
            radioGroups.set(radio.name, [])
        }
        radioGroups.get(radio.name).push(radio)
    })
    const skipped = new Set()
    radioGroups.forEach(group=>{
        const kept = group.find(radio=>radio.checked) ?? group[0]
        group.filter(radio=>radio !== kept).forEach(radio=>skipped.add(radio))
    })

    const tabbable = candidates.filter(element=>!skipped.has(element))
    const positive = tabbable.filter(element=>element.tabIndex > 0).sort((a, b)=>a.tabIndex - b.tabIndex)
    return positive.concat(tabbable.filter(element=>element.tabIndex === 0))
}

function unchartedAdjacentInOrder(order, current, backwards){
    const index = order.indexOf(current)
    if(index >= 0){
        return order[index + (backwards ? -1 : 1)]
    }
    //The focused element is not tabbable (e.g. the body): continue from its position in the document.
    if(backwards){
        return order.filter(element=>current.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING).pop()
    }
    return order.find(element=>current.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
}

/**
 * Tab and shift+tab: focuses the next or previous element in sequential focus order. Leaving a frame continues in its parent document, and
 * leaving the top document wraps around.
 */
function unchartedMoveFocus(from, backwards){
    let current = from
    let doc = from.ownerDocument
    for(;;){
        const order = unchartedTabOrder(doc)
        const next = unchartedAdjacentInOrder(order, current, backwards)
        if(next){
            unchartedFocusSequentially(next, backwards)
            return
        }
        const frame = doc.defaultView.frameElement //null in the top window
        if(!frame){
            const wrapped = backwards ? order[order.length - 1] : order[0]
            if(wrapped){
                unchartedFocusSequentially(wrapped, backwards)
            }
            return
        }
        current = frame
        doc = frame.ownerDocument
    }
}

function unchartedFocusSequentially(element, backwards){
    //Tabbing onto a same-origin frame continues inside it.
    const frameDocument = (element.tagName === 'IFRAME' || element.tagName === 'FRAME') ? element.contentDocument : null
    if(frameDocument){
        const inner = unchartedTabOrder(frameDocument)
        if(inner.length > 0){
            unchartedFocusSequentially(backwards ? inner[inner.length - 1] : inner[0], backwards)
            return
        }
    }
    element.focus()
    //Tabbing into a text input selects its text.
    if(element.tagName === 'INPUT' && UNCHARTED_TEXT_INPUT_TYPES.has(element.type)){
        element.select()
    }
}

function unchartedSelectAll(target){
    if(unchartedIsTextField(target)){
        target.select()
        return
    }
    const doc = target.ownerDocument
    const selection = doc.defaultView.getSelection()
    if(target.isContentEditable){
        selection.selectAllChildren(unchartedEditingHost(target))
    }else if(doc.body){
        selection.selectAllChildren(doc.body)
    }
}

/**
 * Arrow keys, home and end: change the selected option of a select, move the caret of an editable element, otherwise scroll.
 */
function unchartedArrowKey(target, name, modifiers){
    if(target.tagName === 'SELECT'){
        unchartedStepOption(target, name)
        return
    }
    if(unchartedIsTextField(target)){
        unchartedMoveTextFieldCaret(target, name, modifiers)
        return
    }
    if(target.isContentEditable){
        unchartedMoveEditableCaret(target, name, modifiers)
        return
    }

    const axis = name === 'left' || name === 'right' ? 'x' : 'y'
    const direction = name === 'up' || name === 'left' || name === 'home' ? -1 : 1
    const scroller = unchartedScrollTarget(target, axis, direction)
    const distance = name === 'home' || name === 'end' ? unchartedScrollExtent(scroller, axis) : UNCHARTED_ARROW_SCROLL_PIXELS
    unchartedScrollBy(scroller, axis, direction * distance)
}

function unchartedStepOption(select, name){
    const enabled = [...select.options].filter(option=>!option.disabled).map(option=>option.index)
    const current = select.selectedIndex
    let next = undefined
    switch(name){
        case 'up':
        case 'left':
            next = enabled.filter(index=>index < current).pop()
            break;
        case 'down':
        case 'right':
            next = enabled.find(index=>index > current)
            break;
        case 'home':
            next = enabled[0]
            break;
        case 'end':
            next = enabled[enabled.length - 1]
            break;
    }
    if(next === undefined || next === current){
        return
    }
    select.selectedIndex = next
    unchartedDispatchSelectEvents(select)
}

function unchartedMoveTextFieldCaret(field, name, modifiers){
    const selection = unchartedTextFieldSelection(field)
    if(!selection){
        return
    }

    const value = field.value
    const multiline = field.tagName === 'TEXTAREA'
    const collapsed = selection.start === selection.end
    const anchor = selection.direction === 'backward' ? selection.end : selection.start
    const focus = selection.direction === 'backward' ? selection.start : selection.end

    let caret = focus
    switch(name){
        case 'left':
            if(!modifiers.shiftKey && !collapsed){
                caret = selection.start
            }else{
                caret = modifiers.ctrlKey ? unchartedWordBoundary(value, focus, -1) : Math.max(0, focus - 1)
            }
            break;
        case 'right':
            if(!modifiers.shiftKey && !collapsed){
                caret = selection.end
            }else{
                caret = modifiers.ctrlKey ? unchartedWordBoundary(value, focus, 1) : Math.min(value.length, focus + 1)
            }
            break;
        case 'home':
            caret = multiline && !modifiers.ctrlKey ? unchartedLineStart(value, focus) : 0
            break;
        case 'end':
            caret = multiline && !modifiers.ctrlKey ? unchartedLineEnd(value, focus) : value.length
            break;
        case 'up':
        case 'down':
            const direction = name === 'up' ? -1 : 1
            if(multiline){
                caret = unchartedVerticalCaret(value, focus, direction)
            }else{
                caret = direction < 0 ? 0 : value.length
            }
            break;
    }

    if(modifiers.shiftKey){
        unchartedSetSelection(field, Math.min(anchor, caret), Math.max(anchor, caret), caret < anchor ? 'backward' : 'forward')
    }else{
        unchartedSetSelection(field, caret, caret)
    }
}

function unchartedLineStart(value, position){
    return position <= 0 ? 0 : value.lastIndexOf('\n', position - 1) + 1
}

function unchartedLineEnd(value, position){
    const end = value.indexOf('\n', position)
    return end < 0 ? value.length : end
}

/**
 * The caret position on the previous (direction -1) or next (1) line of a textarea, keeping the column when that line is long enough.
 */
function unchartedVerticalCaret(value, position, direction){
    const lineStart = unchartedLineStart(value, position)
    const column = position - lineStart
    if(direction < 0){
        if(lineStart === 0){
            return 0
        }
        const previousStart = unchartedLineStart(value, lineStart - 1)
        return previousStart + Math.min(column, lineStart - 1 - previousStart)
    }
    const lineEnd = unchartedLineEnd(value, position)
    if(lineEnd === value.length){
        return value.length
    }
    const nextStart = lineEnd + 1
    return nextStart + Math.min(column, unchartedLineEnd(value, nextStart) - nextStart)
}

/**
 * ctrl+left and ctrl+right: the start of the previous word, or of the next one.
 */
function unchartedWordBoundary(value, position, direction){
    const isWord = character=>/[\p{L}\p{N}_]/u.test(character)
    let i = position
    if(direction > 0){
        while(i < value.length && isWord(value[i])) i++
        while(i < value.length && !isWord(value[i])) i++
    }else{
        while(i > 0 && !isWord(value[i - 1])) i--
        while(i > 0 && isWord(value[i - 1])) i--
    }
    return i
}

function unchartedMoveEditableCaret(target, name, modifiers){
    const host = unchartedEditingHost(target)
    const selection = target.ownerDocument.defaultView.getSelection()
    const backward = name === 'left' || name === 'up' || name === 'home'

    if(!modifiers.shiftKey && !selection.isCollapsed && (name === 'left' || name === 'right')){
        if(backward){
            selection.collapseToStart()
        }else{
            selection.collapseToEnd()
        }
        return
    }

    if(modifiers.ctrlKey && (name === 'home' || name === 'end')){
        const offset = backward ? 0 : host.childNodes.length
        if(modifiers.shiftKey){
            selection.extend(host, offset)
        }else{
            selection.collapse(host, offset)
        }
        return
    }

    let granularity = modifiers.ctrlKey ? 'word' : 'character'
    if(name === 'up' || name === 'down'){
        granularity = 'line'
    }else if(name === 'home' || name === 'end'){
        granularity = 'lineboundary'
    }
    selection.modify?.(modifiers.shiftKey ? 'extend' : 'move', backward ? 'backward' : 'forward', granularity)
}

/**
 * Scroll and HScroll: scrolls the nearest scrollable ancestor of the element at the point (the centre of the viewport when the action has no
 * coordinate), otherwise the window. Follows pyautogui: a positive amount scrolls up, or right for hscroll.
 */
function performUnchartedScroll(action, axis){
    const point = action.x != null && action.y != null
        ? unchartedViewportPoint(action)
        : {x: window.innerWidth / 2, y: window.innerHeight / 2}
    const pixels = action.amount * UNCHARTED_PIXELS_PER_NOTCH * (axis === 'y' ? -1 : 1)
    const hit = unchartedElementFromPoint(point.x, point.y)
    const scroller = hit ? unchartedScrollTarget(hit.element, axis, Math.sign(pixels)) : window
    unchartedScrollBy(scroller, axis, pixels)
}

/**
 * The element, or window, to scroll: the nearest ancestor of the element that can still scroll on the axis in the direction (-1 up or left,
 * 1 down or right), crossing shadow roots and same-origin frames, as a mouse wheel does. Falls back to the top window.
 */
function unchartedScrollTarget(element, axis, direction){
    let current = element
    while(current){
        const doc = current.ownerDocument
        const view = doc.defaultView
        if(current === doc.documentElement){
            if(unchartedCanScrollWindow(view, axis, direction)){
                return view
            }
            current = view.frameElement //null in the top window
            continue
        }
        if(unchartedCanScrollElement(current, axis, direction)){
            return current
        }
        current = unchartedParent(current)
    }
    return window
}

function unchartedCanScrollElement(element, axis, direction){
    const style = element.ownerDocument.defaultView.getComputedStyle(element)
    const overflow = axis === 'y' ? style.overflowY : style.overflowX
    if(!['auto', 'scroll', 'overlay'].includes(overflow)){
        return false
    }
    const position = axis === 'y' ? element.scrollTop : element.scrollLeft
    const max = axis === 'y' ? element.scrollHeight - element.clientHeight : element.scrollWidth - element.clientWidth
    return unchartedHasScrollRoom(position, max, direction)
}

function unchartedCanScrollWindow(view, axis, direction){
    const doc = view.document
    const overflowOf = style=>axis === 'y' ? style.overflowY : style.overflowX
    //The body's overflow applies to the viewport when the root element's is visible.
    let overflow = overflowOf(view.getComputedStyle(doc.documentElement))
    if(overflow === 'visible' && doc.body){
        overflow = overflowOf(view.getComputedStyle(doc.body))
    }
    if(overflow === 'hidden' || overflow === 'clip'){
        return false
    }
    const scrollingElement = doc.scrollingElement ?? doc.documentElement
    const position = axis === 'y' ? view.scrollY : view.scrollX
    const max = axis === 'y'
        ? scrollingElement.scrollHeight - scrollingElement.clientHeight
        : scrollingElement.scrollWidth - scrollingElement.clientWidth
    return unchartedHasScrollRoom(position, max, direction)
}

function unchartedHasScrollRoom(position, max, direction){
    return max > 0 && (direction < 0 ? position > 0 : position < max - 1)
}

function unchartedScrollBy(scroller, axis, pixels){
    scroller.scrollBy({left: axis === 'x' ? pixels : 0, top: axis === 'y' ? pixels : 0, behavior: 'instant'})
}

function unchartedScrollExtent(scroller, axis){
    const element = scroller.window === scroller
        ? (scroller.document.scrollingElement ?? scroller.document.documentElement)
        : scroller
    return axis === 'y' ? element.scrollHeight : element.scrollWidth
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




