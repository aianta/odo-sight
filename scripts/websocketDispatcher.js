/*
    Dispatcher component from LogUI Client, hacked apart by Alexandru Ianta for use in odo-sight.

    Original header comment below:
------------------------------------------------------------
    LogUI Client Library
    WebSocket-based Dispatcher

    A WebSocket-based dispatcher that communicates with a LogUI server implementation.

    @module: WebSocket-based Dispatcher
    @author: David Maxwell
    @date: 2021-03-08
*/


var LogUIDispatcher = (function() {
    var _public = {};
    var _isActive = false;
    var _websocket = null;
    var _websocketReconnectionAttempts = 0;  // The total number of attempts that have been made to reconnect when the connection drops.
    var _maxWebsocketReconnectionAttempts = 10; // The maximum number of times we should try to reconnect.
    var _reconnectAttemptDelay = 5000 // The delay (in ms) we should wait between reconnect attempts.
    var _cacheSize = 10 // The maximum number of stored events that can be in the cache before flushing.
    var _websocketSuccessfulReconnections = 0;  // The total number of times there has been a successful (re)connection.
    var _websocketReconnectionReference = null;  // A reference to the reconnection routine when attempting to reconnect.
    var _libraryLoadTimestamp = null;  // The time at which the dispatcher loads -- for measuring the beginning of a session more accurately.
    var _maximumCacheSize = 1000;  // When no connection is present, this is the cache size we shut down LogUI at.
    var _sessionID = null;
    var _sessionStartTimestamp = null;
    var _libraryStartTimestamp = null;
    var _cache = null;
    var _endpoint = null;
    var _authToken = null;

    _public.dispatcherType = 'websocket';


    _public.init = function(endpoint, authToken) {


        _endpoint = endpoint;
        _authToken = authToken;
        //Config.getConfigProperty('endpoint');

        // We may restart the dispatcher in the same context.
        // There may still be a timer active from the previous iteration.
        // If so, we cancel it.
        if (_websocketReconnectionReference) {
            clearInterval(_websocketReconnectionReference);
            _websocketReconnectionReference = null;
        }

        //Start websocket connection and clear cache
        _initWebsocket();
        _cache = [];

        _isActive = true;
        return true;
    };

    _public.stop = async function() {
        _flushCache();
        _tidyWebsocket();

        _websocketReconnectionAttempts = 0;
        _websocketSuccessfulReconnections = 0;
        _libraryLoadTimestamp = null;

        if (_websocketReconnectionReference) {
            clearInterval(_websocketReconnectionReference);
        }

        _cache = null;
        _isActive = false;
        _sessionID = null;
        stateManager.clearSessionId()
    };

    _public.isActive = function() {
        return _websocket !== null
    };

    _public.sendObject = function(objectToSend) {
        if (_public.isActive()) {
            _cache.push(objectToSend);


            if (_cache.length >= _cacheSize) {
                _flushCache();
            }

            return;
        }

        throw Error('You cannot send a message when LogUI is not active.');
    };

    var _initWebsocket = function() {
        _websocket = new WebSocket(_endpoint);

        _websocket.addEventListener('close', _callbacks.onClose);
        _websocket.addEventListener('error', _callbacks.onError);
        _websocket.addEventListener('message', _callbacks.onMessage);
        _websocket.addEventListener('open', _callbacks.onOpen);
    };

    var _tidyWebsocket = function() {
        if (_websocket) {
            console.log(`[LogUI Websocket Dispatcher] The connection to the server is being closed.`)

            _websocket.removeEventListener('close', _callbacks.onClose);
            _websocket.removeEventListener('error', _callbacks.onError);
            _websocket.removeEventListener('message', _callbacks.onMessage);
            _websocket.removeEventListener('open', _callbacks.onOpen);
    
            _websocket.close();
            _websocket = null;
        }
    };

    var _attemptReconnect = function() {
        if (_websocket && !_websocketReconnectionReference) {
            _tidyWebsocket();

            _websocketReconnectionReference = setInterval(() => {
                if (_isActive) {
                    if (_websocket) {
                        switch (_websocket.readyState) {
                            case 0:
                                return;
                            case 1:
                                console.log(`[LogUI Websocket Dispatcher] The connection to the server has been (re-)established.`)
                                clearInterval(_websocketReconnectionReference);
                                _websocketReconnectionAttempts = 0;
                                _websocketReconnectionReference = null;

                                return;
                            default:
                                console.error(`[LogUI Websocket Dispatcher] The connection to the server has failed; we are unable to restart.`)
                                _tidyWebsocket();
                                return;
                        }
                    }

                    // Counter incremented here to consider the first attempt.
                    _websocketReconnectionAttempts += 1;

                    if (_websocketReconnectionAttempts == _maxWebsocketReconnectionAttempts) {
                        console.log(`[LogUI Websocket Dispatcher] We've maxed out the number of permissible reconnection attempts. We must stop here.`)

                        clearInterval(_websocketReconnectionReference);
                        throw Error('LogUI attempted to reconnect to the server but failed to do so. LogUI is now stopping. Any events not sent to the server will be lost.');

                    }
                    
                    console.warn(`[LogUI Websocket Dispatcher] (Re-)connection attempt ${_websocketReconnectionAttempts} of ${_maxWebsocketReconnectionAttempts}`)
                    _initWebsocket();
                }
                else {
                    // Here, the instance of LogUI has already been stopped.
                    // So just silently clear the timer -- and reset the referene back to null.
                    clearInterval(_websocketReconnectionReference);
                    _websocketReconnectionReference = null;

                }
            }, _reconnectAttemptDelay);
        }

    };

    var _callbacks = {
        onClose: async function(event) {

            console.error(`[LogUI Websocket Dispatcher] The connection to the server has been closed.`)
            let errorMessage = 'Something went wrong with the connection to the LogUI server.'

            switch (event.code) {
                case 4001:
                    errorMessage = 'A bad message was sent to the LogUI server. LogUI is shutting down.';
                    break;
                case 4002:
                    errorMessage = 'The client sent a bad application handshake to the server. LogUI is shutting down.';
                    break;
                case 4003:
                    errorMessage = 'The LogUI server being connected to does not support version 0.5.4a of the client. LogUI is shutting down.';
                    break;
                case 4004:
                    errorMessage = 'A bad authentication token was provided to the LogUI server. LogUI is shutting down.';
                    break;
                case 4005:
                    errorMessage = 'The LogUI server did not recognise the domain that this client is being started from. LogUI is shutting down.';
                    break;
                case 4006:
                    errorMessage = 'The LogUI client sent an invalid session ID to the server. LogUI is shutting down.';
                    _sessionID = null;
                    stateManager.sessionId(null)
                    break;
                case 4007:
                    errorMessage = 'The LogUI server is not accepting new connections for this application at present.';
                    break;
                default:
                    errorMessage = `${errorMessage} The recorded error code was ${event.code}. LogUI is shutting down.`;
                    break;
            }

            switch (event.code) {
                case 1000:
                    console.log('clean connection closure!');
                    break;
                case 1006:
                    _attemptReconnect();
                    break;
                default:
                    //root.dispatchEvent(new Event('logUIShutdownRequest'));
                    throw Error(errorMessage);
            }
        },

        onError: function(event) { },

        onMessage: async function(receivedMessage) {
            let messageObject = JSON.parse(receivedMessage.data);

            switch (messageObject.type) {
                case 'handshakeSuccess':
                    //Helpers.console(`The handshake was successful. Hurray! The server is listening.`, 'Dispatcher', false);
                    console.log(`[LogUI Websocket Dispatcher] The handshake was successful. Hurray! The server is listening.`)
                    _sessionID = messageObject.payload.sessionID
                    
                    await stateManager.sessionId(_sessionID)

                    //Prepare session data object to send to odo sight dispatcher.
                    const sessionData = {
                        sessionID: _sessionID,
                        fresh: true
                    }

                    if (messageObject.payload.newSessionCreated) {
                        //Config.sessionData.setTimestamps(new Date(messageObject.payload.clientStartTimestamp), new Date(messageObject.payload.clientStartTimestamp));
                        sessionData['sessionStartTimestamp'] = messageObject.payload.clientStartTimestamp
                        sessionData['libraryStartTimestamp'] = messageObject.payload.clientStartTimestamp
                    }else {
                        //Config.sessionData.setTimestamps(new Date(messageObject.payload.clientStartTimestamp), new Date());
                        sessionData['sessionStartTimestamp'] = messageObject.payload.clientStartTimestamp
                        sessionData['libraryStartTimestamp'] = Date.now()
                        

                        if (_cache.length >= _cacheSize) {
                            _flushCache();
                        }
                    }

                    _sessionStartTimestamp = new Date(sessionData['sessionStartTimestamp'])
                    _libraryStartTimestamp = new Date(sessionData['libraryStartTimestamp'])

                    stateManager.sessionData(sessionData).then(_=>stateManager.sessionReady(true))
                

                    break;
            }
        },

        onOpen: function(event) {
            _websocketSuccessfulReconnections += 1;
            console.log(`[LogUI Websocket Dispatcher] The connection to the server has been established.`)

            stateManager.pageOrigin().then((origin)=>{
                let payload = {
                    clientVersion: '0.5.4a', //Forked LogUI client version.
                    authorisationToken: _authToken,
                    pageOrigin: origin, 
                    userAgent: 'Odo-sight',
                    clientTimestamp: new Date(),
                };
    
                if (_sessionID) {
                    payload.sessionID = _sessionID;
                }
                
                console.log(JSON.stringify(payload, null, 4))

                console.log(`[LogUI Websocket Dispatcher] The LogUI handshake has been sent.`)
                _websocket.send(JSON.stringify(_getMessageObject('handshake', payload)));
            })

            
        },

    };

    var _getMessageObject = function(messageType, payload) {
        return {
            sender: 'logUIClient',
            type: messageType,
            payload: payload,
        };
    };

    var _flushCache = function() {
        if (!_websocket || _websocket.readyState != 1) {
            if (_cache.length >= _maximumCacheSize) {
                console.warn(`[LogUI Websocket Dispatcher] The cache has grown too large, with no connection to clear it. LogUI will now stop; any cached events will be lost.`)
                
                //TODO: send shutdown request to odosight dispatcher. 
                stateManager.eventCacheOverflow(true)
            }

            return;
        }

        let payload = {
            length: _cache.length,
            items: _cache,
        };

        _websocket.send(JSON.stringify(_getMessageObject('logEvents', payload)));

        console.log(`[LogUI Websocket Dispatcher] Cache flushed.`)

        _cache = [];
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
        if('shouldTrace' in changes && changes['shouldTrace'].newValue){
            Promise.all([
                stateManager.endpoint(),
                stateManager.flightAuthToken()
            ]).then((values)=>{
                const endpoint = values[0]
                const authToken = values[1]
                _public.init(endpoint, authToken)
            })

        }
    }

    return _public;
})();


browser.storage.local.onChanged.addListener(LogUIDispatcher.handleStateChange)