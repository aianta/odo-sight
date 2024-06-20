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
                case "GET_LOCAL_CONTEXT":
                    payload = await eventSocket.makePayload('LOCAL_CONTEXT')
                    payload['localContext'] = _cache
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()

                    _websocket.send(JSON.stringify(payload))
                    _cache = [] //Clear the cache/localContext
                    break
                case "PATH_COMPLETE":
                    
                    await stateManager.shouldTransmit(false)
                    await stateManager.clearActivePathsRequestId()
                    
                    payload = await eventSocket.makePayload("PATH_COMPLETE_ACK")                
                    _websocket.send(JSON.stringify(payload))

                    break
                case "START_TRANSMISSION":
                    _transmit = true
                    await stateManager.shouldTransmit(true)
                    
                    payload = await eventSocket.makePayload("TRANSMISSION_STARTED")
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()
                    


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
            _websocket.removeEventListener('open', eventSocket.onOpen)
            _websocket.removeEventListener('close', eventSocket.onClose)
            _websocket.removeEventListener('message', eventSocket.onMessage)
            _websocket.removeEventListener('error', eventSocket.onError)
            _websocket.close()
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
        })
        
    }

    _public.socketPersistence = function(){

        //If the reconnection logic hasn't been set up yet
        if(!_websocketReconnectionReference){
            
            //Set it up on an interval.
            _websocketReconnectionReference = setInterval(()=>{
                console.log(`[guidanceConnector.js] Checking WebSocket connection... websocket is: ${_websocket} readyState: ${_websocket.readyState}`)
                if(_websocket){ //If there is a non-null websocket object

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
                eventSocket.sendEvent(objectToSend)
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

GuidanceConnector.startEventSocket()
