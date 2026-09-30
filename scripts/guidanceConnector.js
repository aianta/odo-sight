/*
    Dispatcher component from LogUI Client, hacked apart by Alexandru Ianta for use in odo-sight.
    The Local Dispatcher stores events locally in the extension's storage. It is used for passive recording 
    of recent user interaction events that are later used to locate the user in the odo-bot application model when 
    the user asks for help.  


    Original header comment below:
------------------------------------------------------------
    LogUI Client Library
    WebSocket-based Dispatcher

    A WebSocket-based dispatcher that communicates with a LogUI server implementation.

    @module: WebSocket-based Dispatcher
    @author: David Maxwell
    @date: 2021-03-08
*/


var GuidanceConnector = (function() {
    var _public = {};
    var _isActive = false;
    var _cacheSize = 2500 // The maximum number of stored events that can be in the cache before flushing.
    var _libraryLoadTimestamp = null;  // The time at which the dispatcher loads -- for measuring the beginning of a session more accurately.
    var _sessionID = null;
    var _sessionStartTimestamp = null;
    var _libraryStartTimestamp = null;
    var _cache = [];
    var _websocket = null;
    var _websocketReconnectionReference = null;
    var _guidanceHost = null;
    var _transmit = false;
    var _websocketReconnectionAttempts = 0;
    var _maxWebsocketReconnectionAttempts  = 10;
    var _websocketReconnectionAttemptDelay = 10000; //10 s


    _public.dispatcherType = 'guidance';

    /**
     * Captures the visible part of the active tab of the current window.
     * @returns {Promise<{screenshot: string, url: string}>} the screenshot as a base64 encoded PNG, and the tab's url as shown in the
     * address bar.
     */
    var _captureActiveTab = async function(){
        const currentWindow = await browser.windows.getCurrent({populate: true})
        const imageUrl = await browser.tabs.captureVisibleTab(currentWindow.id, {format: 'png'})
        const imageBytes = await fetch(imageUrl).then(response=>response.arrayBuffer())
        const activeTab = currentWindow.tabs.find(tab=>tab.active)
        return {
            screenshot: new Uint8Array(imageBytes).toBase64(),
            url: activeTab?.url
        }
    }

    /**
     * Whether an event gets a screenshot: interaction events, and TinyMCE edits, which LogUI sends as INPUT_CHANGE custom events.
     */
    var _hasScreenshot = function(objectToSend){
        if(objectToSend.eventType === 'interactionEvent'){
            return true
        }
        const details = objectToSend.eventDetails
        return objectToSend.eventType === 'customEvent' && details?.name === 'INPUT_CHANGE' && details?.source === 'tinyMCE'
    }

    var eventSocket = {
        
        makePayload: async function(type){
            return {
                clientId: await stateManager.clientId(),
                source: 'EventSocket',
                type: type
            }
        },
        notifyReconnected: async function(){
            const payload = await this.makePayload('NOTIFY_RECONNECT')
            _websocket.send(JSON.stringify(payload))
        },
        sendEvent: async function(event){
            console.log(`sending event: ${event}`)
            const payload = await this.makePayload('EVENT')
            payload['pathsRequestId'] = await stateManager.activePathsRequestId()
            payload['event'] = event
            _websocket.send(JSON.stringify(payload))
        },
        onOpen: async function(event){
            console.log(`[guidanceConnector.js] EventSocket connection established`)
            eventSocket.notifyReconnected()
        },
        onClose: async function(event){

            //TODO -> proper handling using error codes?
            //https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code



            if(await stateManager.boundDispatcher() === 'local'){ //If we're in bot mode, try to re-establish the connection.
                _public.socketPersistence()
            }
            
            


        },
        onMessage: async function(msg){
            console.log('[guidanceConnector.js] EventSocket got: ', msg)
            console.log(msg.data)
            const data = JSON.parse(msg.data)
            let payload = null
            switch(data.type){
                case "GET_SCREENSHOT":

                    payload = await eventSocket.makePayload('SCREENSHOT')

                    //OdoBot asks for a screenshot once the page has settled after an uncharted step.
                    _captureActiveTab()
                        .then(({screenshot, url})=>{
                            payload['screenshot'] = screenshot
                            payload['userLocation'] = url
                            _websocket.send(JSON.stringify(payload))
                        })
                        .catch(err=>console.error("[guidanceConnector.js] Failed to capture a screenshot", err))


                    break;
                case "PATH_COMPLETE":
                    
                    await stateManager.shouldTransmit(false)
                    await stateManager.clearActivePathsRequestId()
                    
                    payload = await eventSocket.makePayload("PATH_COMPLETE_ACK")                
                    _websocket.send(JSON.stringify(payload))

                    break
                case "START_TRANSMISSION":
                    /**
                     * To allow the server to initiate requests we need to be able to set the activePathsRequestId from
                     * a server given value. This has to happen before any event is sent, since sending an event reads it.
                     */
                    if(!await stateManager.exists('activePathsRequestId')){
                        await stateManager.activePathsRequestId(data['pathsRequestId'])
                    }

                    /**
                     * The first event the server receives after transmission starts is an Observation of the page. The tab is
                     * captured first. Then queueing the Observation, clearing the cache and switching transmission on happen in
                     * one synchronous step, so no event is sent ahead of the Observation.
                     */
                    const observation = await _captureActiveTab()
                        .then(({screenshot, url})=>_public.packageObservation(url, screenshot))
                        .catch(err=>{
                            console.error("[guidanceConnector.js] Failed to capture the tab for the Observation", err)
                            return _public.packageObservation(undefined, undefined)
                        })
                    const observationSent = eventSocket.sendEvent(observation)
                        .catch(err=>console.error("[guidanceConnector.js] Failed to send the Observation", err))
                    _cache = [] //Events recorded before transmission started are not sent.
                    _transmit = true
                    await stateManager.shouldTransmit(true)

                    payload = await eventSocket.makePayload("TRANSMISSION_STARTED")
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()

                    await observationSent

                    console.log("Sending transmission started confirmation!")

                    _websocket.send(JSON.stringify(payload))
                    break
                case "STOP_TRANSMISSION":
                    _transmit = false
                    await stateManager.shouldTransmit(false)

                    payload = await eventSocket.makePayload("TRANSMISSION_STOPPED")
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()
                    
                    _websocket.send(JSON.stringify(payload))
                    break
            }

        },
        onError: async function(error){
            console.error(error)
        },
        cleanup: function(){
            console.log('Event socket cleaning up')
            if(_websocket !== null){
                _websocket.removeEventListener('open', eventSocket.onOpen)
                _websocket.removeEventListener('close', eventSocket.onClose)
                _websocket.removeEventListener('message', eventSocket.onMessage)
                _websocket.removeEventListener('error', eventSocket.onError)
                _websocket.close()
            }
            
            //_websocket === null
        }
    }

    var _initWebsocket = function(){
        console.log('Initializing eventSocket!')
        stateManager.guidanceHost().then(host=>{
            _guidanceHost = host
            _websocket = new WebSocket(`wss://${_guidanceHost}`)
            _websocket.addEventListener('open', eventSocket.onOpen)
            _websocket.addEventListener('close', eventSocket.onClose)
            _websocket.addEventListener('message', eventSocket.onMessage)
            _websocket.addEventListener('error', eventSocket.onError)
            //eventSocket.notifyReconnected()
        }).catch((error)=>{
            console.log(error)
            console.log("Error establishing event websocket! Trying again!")
            //_initWebsocket()
        })
        
    }

    _public.socketPersistence = function(){

        //If the reconnection logic hasn't been set up yet
        if(!_websocketReconnectionReference){
            
            //Set it up on an interval.
            _websocketReconnectionReference = setInterval(()=>{
                console.log(`[guidanceConnector.js] Checking WebSocket connection...`)
                if(_websocket){ //If there is a non-null websocket object
                    
                    console.log(`websocket is: ${_websocket} readyState: ${_websocket.readyState}`)

                    switch(_websocket.readyState){
                        case 0:
                            return;
                        case 1:
                            console.log("[guidanceConnector.js] WebSocket connection re-established")
                            clearInterval(_websocketReconnectionReference)
                            _websocketReconnectionAttempts = 0
                            _websocketReconnectionReference = null;
                            return;
                        default:
                            console.log("[guidanceConnector.js] WebSocket connection to the server has failed; unable to reconnect.")
                            eventSocket.cleanup()       
                    }

                }

                _websocketReconnectionAttempts += 1;
                
                console.log(`(Re-)connection attempt: ${_websocketReconnectionAttempts}`)
                _initWebsocket()

            }, _websocketReconnectionAttemptDelay) //10s

        }

    }
    

    _public.startEventSocket = function(){
        _initWebsocket()
        _public.socketPersistence()
    }

    _public.stopEventSocket = function(){
        //Disable persistence first
        if(_websocketReconnectionReference !== null){
            clearInterval(_websocketReconnectionReference)
            _websocketReconnectionReference = null;
        }

        eventSocket.cleanup()
    }


    _public.init = function() {
        _cache = [];
        _isActive = true;

        const sessionData = {
            sessionID: crypto.randomUUID(),
            fresh: true,
            sessionStartTimestamp: Date.now(),
            libraryStartTimestamp: Date.now()
        }
        

        _sessionID = sessionData.sessionID;

        return stateManager.sessionId(sessionData.sessionID)
        .then(_=>stateManager.sessionData(sessionData)
        .then(_=>stateManager.sessionReady(true)))
        .then(_=>console.log(`Session data set up! ${sessionData}`))
        
    };

    _public.stop = async function() {
        _cache = [];
        _isActive = false;
        _sessionID = null;
        
    };

    _public.isActive = function() {
        return _isActive !== null && _isActive
    };

    _public.sendObject = function(objectToSend) {
        console.log('got send object')

        if(objectToSend.sessionID === _sessionID){

            if(_transmit){
                
                //Capture a screenshot for interaction events and TinyMCE edits.
                if(_hasScreenshot(objectToSend)){
                    _captureActiveTab()
                    .then(({screenshot})=>{
                        objectToSend.eventDetails.screenshot = screenshot
                    })
                    .catch(err=>console.error("[guidanceConnector.js] Failed to capture a screenshot, sending the event without one", err))
                    .then(()=>eventSocket.sendEvent(objectToSend))
                }else{
                    eventSocket.sendEvent(objectToSend)
                }

                
            }else{
                _cache.push(objectToSend);
                console.log("cache size: ", _cache.length)

                if (_cache.length >= _cacheSize) {
                    _cache.shift()
                }
            }

            return;
        }
      


        //throw Error('You cannot send a message when LogUI is not active.');
    };

    var _getMessageObject = function(messageType, payload) {
        return {
            sender: 'logUIClient',
            type: messageType,
            payload: payload,
        };
    };
    

    _public.packageCustomEvent = function(eventDetails){
        let packageObject = _public.getBasicPackageObject()

        packageObject.eventType = 'customEvent'
        packageObject.eventDetails = eventDetails
        if(_public._websocket !== null){ //Only send object if we have a websocket connection
            _public.sendObject(packageObject)
        }else{
            console.error("Failed to send: ")
            console.error(JSON.stringify(eventDetails, null, 4))
        }


    }

    /**
     * The Observation that tells the server what the page looked like when transmission started. OdoBot makes the observations of
     * uncharted steps itself, from GET_SCREENSHOT.
     * @param userLocation the url in the address bar.
     * @param screenshot a base64 encoded PNG of the visible part of the page.
     */
    _public.packageObservation = function(userLocation, screenshot){
        let packageObject = _public.getBasicPackageObject()

        packageObject.eventType = 'customEvent'
        packageObject.eventDetails = {
            name: 'OBSERVATION',
            trigger: 'START_TRANSMISSION',
            userLocation: userLocation,
            screenshot: screenshot
        }

        return packageObject
    }

    _public.getBasicPackageObject = function(){
        let currentTimestamp = new Date();
        let sessionStartTimestamp = _sessionStartTimestamp
        let libraryStartTimestamp = _libraryStartTimestamp
        
        return {
            eventType: null,
            eventDetails: {},
            sessionID: _sessionID,
            timestamps: {
                eventTimestamp: currentTimestamp,
                sinceSessionStartMillis: currentTimestamp - sessionStartTimestamp,
                sinceLogUILoadMillis: currentTimestamp - libraryStartTimestamp,
            }
            //applicationSpecificData: Config.applicationSpecificData.get(), TODO - consider supporting this feature in the future.
        }
    }

    _public.handleStateChange = function(changes){

        if ('guidanceMode' in changes && changes['guidanceMode'].newValue){
            _public.startEventSocket()
        }

        if ('guidanceMode' in changes && !changes['guidanceMode'].newValue){
            _public.stopEventSocket()
        }

        if('activePathsRequestId' in changes){
            console.log(changes)
            console.log("_websocket is: ", _websocket)
        }

        if('shouldRecord' in changes && changes['shouldRecord'].newValue){
            _public.init()
        
        }

        if('shouldTransmit' in changes && changes['shouldTransmit'].newValue){
            _transmit = true
        }

        
        if('shouldTransmit' in changes && !changes['shouldTransmit'].newValue){
            _transmit = false
        }

    }

    return _public;
})();


browser.storage.local.onChanged.addListener(GuidanceConnector.handleStateChange)

stateManager.guidanceMode()
    .then(_guidanceMode=>{
        if(_guidanceMode){
            GuidanceConnector.startEventSocket()
        }
    })
    .catch(err=>{
        console.log("[guidanceConnector.js] Tried to check 'guidanceMode' flag before it was defined.")
    })


