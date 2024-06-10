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
    var _guidanceHost = null;
    var _transmit = false;


    _public.dispatcherType = 'guidance';

    var eventSocket = {
        makePayload: function(type){
            return {
                source: 'EventSocket',
                type: type
            }
        },
        notifyReconnected: async function(){
            const payload = this.makePayload('NOTIFY_RECONNECT')
            payload['pathsRequestId'] = await stateManager.activePathsRequestId()
            _websocket.send(JSON.stringify(payload))
        },
        sendEvent: async function(event){
            const payload = this.makePayload('EVENT')
            payload['pathsRequestId'] = await stateManager.activePathsRequestId()
            payload['event'] = event
            _websocket.send(JSON.stringify(payload))
        },
        onOpen: async function(event){
            console.log(`[guidanceConnector.js] EventSocket connection established`)
            eventSocket.notifyReconnected()
        },
        onClose: async function(event){},
        onMessage: async function(msg){
            console.log('[guidanceConnector.js] EventSocket got: ', msg)
            console.log(msg.data)
            const data = JSON.parse(msg.data)
            let payload = null
            switch(data.type){
                case "GET_LOCAL_CONTEXT":
                    payload = eventSocket.makePayload('LOCAL_CONTEXT')
                    payload['localContext'] = _cache
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()

                    _websocket.send(JSON.stringify(payload))
                    _cache = [] //Clear the cache/localContext
                    break
                case "START_TRANSMISSION":
                    _transmit = true
                    await stateManager.shouldTransmit(true)
                    
                    payload = eventSocket.makePayload("TRANSMISSION_STARTED")
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()
                    


                    _websocket.send(JSON.stringify(payload))
                    break
                case "STOP_TRANSMISSION":
                    _transmit = false
                    await stateManager.shouldTransmit(false)

                    payload = eventSocket.makePayload("TRANSMISSION_STOPPED")
                    payload['pathsRequestId'] = await stateManager.activePathsRequestId()
                    
                    _websocket.send(JSON.stringify(payload))
                    break
            }

        },
        onError: async function(error){},
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

    

    _public.startEventSocket = function(){
        _initWebsocket()
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

        if('activePathsRequestId' in changes && changes['activePathsRequestId'].newValue){
            _initWebsocket()
        }

        if('activePathsRequestId' in changes && !changes['activePathsRequestId'].newValue && _websocket !== null){
            eventSocket.cleanup()
        }
    }

    return _public;
})();


browser.storage.local.onChanged.addListener(GuidanceConnector.handleStateChange)
stateManager.exists('activePathsRequestId').then(exists=>{
    if(exists){
        GuidanceConnector.startEventSocket()
    }
});