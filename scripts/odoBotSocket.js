/**
 * OdoX's only connection to OdoBot. It lives in the background, where page CSP doesn't apply, and is open while
 * 'guidanceMode' is on.
 *
 * Every message, both ways, is a flat JSON object:
 *   v        the protocol version, _ODOBOT_PROTOCOL_VERSION.
 *   channel  'event' (handled by guidanceConnector.js) or 'guidance' (passed to and from the page by guidanceRelay.js).
 *   type     the message type, e.g. EXECUTE or TRANSMISSION_STARTED.
 *   id       unique per message, set by its sender.
 *   replyTo  on a reply, the id of the message it answers.
 *   cause    on guidance feedback OdoX sends unasked, e.g. UNRESOLVABLE_XPATH, the id of the EXECUTE it is about.
 *   pageId   on guidance messages, the page a message from OdoBot is addressed to, or the page a message to OdoBot came
 *            from. guidanceRelay.js answers a message for a page that isn't the target with NOT_DELIVERED.
 * plus the fields of the message type.
 *
 * Messages sent while the socket is down wait for it to open, unless guidance mode is off, in which case they are
 * dropped.
 */
var OdoBotSocket = (function(){
    var _public = {}

    var _socket = null
    var _enabled = false //Whether the socket should be open, i.e. 'guidanceMode'.
    var _connecting = false //Whether a socket is being created, see connect().
    var _reconnectionReference = null
    var _reconnectionDelay = 10000 //10 s

    var _handlers = new Map() //Message handlers, by channel.
    var _openCallbacks = []

    var _outbox = [] //Messages waiting for the socket to open.
    var _maxOutboxSize = 1000 //When the outbox is full, the oldest message is dropped.

    function isOpen(){
        return _socket !== null && _socket.readyState === WebSocket.OPEN
    }

    function isOpenOrConnecting(){
        return _socket !== null && (_socket.readyState === WebSocket.CONNECTING || _socket.readyState === WebSocket.OPEN)
    }

    /**
     * Send a message to OdoBot.
     * @param {string} channel 'event' or 'guidance'.
     * @param {string} type the message type.
     * @param {object} fields the message's fields. An id among them is kept, otherwise one is assigned.
     * @returns the message as sent.
     */
    _public.send = function(channel, type, fields = {}){
        const message = Object.assign({}, fields, {v: _ODOBOT_PROTOCOL_VERSION, channel: channel, type: type})
        if(message.id === undefined || message.id === null){
            message.id = crypto.randomUUID()
        }

        if(!_enabled){
            console.debug(`[odoBotSocket.js] Guidance mode is off, dropping ${channel} message ${type}`)
            return message
        }

        if(isOpen()){
            _socket.send(JSON.stringify(message))
        }else{
            _outbox.push(message)
            if(_outbox.length > _maxOutboxSize){
                _outbox.shift()
            }
        }
        return message
    }

    /**
     * Answer a message from OdoBot, on the channel it came on.
     */
    _public.reply = function(request, type, fields = {}){
        return _public.send(request.channel, type, Object.assign({}, fields, {replyTo: request.id}))
    }

    /**
     * Handle the messages OdoBot sends on a channel. A channel has one handler.
     */
    _public.on = function(channel, handler){
        _handlers.set(channel, handler)
    }

    /**
     * Run a callback whenever the socket (re)opens, before the messages that waited for it are sent.
     */
    _public.onOpen = function(callback){
        _openCallbacks.push(callback)
    }

    _public.isOpen = isOpen

    /**
     * Open the socket and keep it open until stop(). Does nothing if it is already open or opening.
     */
    _public.start = function(){
        _enabled = true
        connect()
    }

    /**
     * Close the socket, stop reconnecting and drop the messages waiting for it. Safe in any state.
     */
    _public.stop = function(){
        _enabled = false
        _outbox = []

        if(_reconnectionReference !== null){
            clearTimeout(_reconnectionReference)
            _reconnectionReference = null
        }

        if(_socket !== null){
            const socket = _socket
            _socket = null
            //Remove the listeners first, so closing doesn't schedule a reconnection.
            socket.removeEventListener('open', onOpen)
            socket.removeEventListener('close', onClose)
            socket.removeEventListener('message', onMessage)
            socket.removeEventListener('error', onError)
            if(socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN){
                socket.close()
            }
        }
    }

    function connect(){
        if(!_enabled || _connecting || isOpenOrConnecting()){
            return
        }
        _connecting = true

        Promise.all([
            stateManager.guidanceHost(),
            stateManager.clientId()
        ]).then(([host, clientId])=>{
            //Guidance mode may have been turned off while the host was read.
            if(!_enabled || isOpenOrConnecting()){
                return
            }
            const socket = new WebSocket(_ODOBOT_SOCKET_URL(host, clientId))
            socket.addEventListener('open', onOpen)
            socket.addEventListener('close', onClose)
            socket.addEventListener('message', onMessage)
            socket.addEventListener('error', onError)
            _socket = socket
        }).catch(err=>{
            console.error("[odoBotSocket.js] Could not open the socket to OdoBot", err)
            scheduleReconnection()
        }).finally(()=>{
            _connecting = false
        })
    }

    function scheduleReconnection(){
        if(!_enabled || _reconnectionReference !== null){
            return
        }
        _reconnectionReference = setTimeout(()=>{
            _reconnectionReference = null
            console.log("[odoBotSocket.js] Reconnecting to OdoBot...")
            connect()
        }, _reconnectionDelay)
    }

    function onOpen(){
        console.log("[odoBotSocket.js] Connected to OdoBot")

        _openCallbacks.forEach(callback=>{
            try{
                callback()
            }catch(err){
                console.error("[odoBotSocket.js] Socket open callback failed", err)
            }
        })

        const waiting = _outbox
        _outbox = []
        waiting.forEach(message=>_socket.send(JSON.stringify(message)))
    }

    function onClose(event){
        console.log(`[odoBotSocket.js] Connection to OdoBot closed (${event.code})`)
        _socket = null
        scheduleReconnection()
    }

    function onError(error){
        console.error("[odoBotSocket.js] Socket error", error)
    }

    function onMessage(msg){
        let message
        try{
            message = JSON.parse(msg.data)
        }catch(err){
            console.error("[odoBotSocket.js] OdoBot sent a message that isn't JSON", msg.data)
            return
        }

        const handler = _handlers.get(message.channel)
        if(handler === undefined){
            console.warn(`[odoBotSocket.js] No handler for channel ${message.channel}, dropping ${message.type}`)
            return
        }

        try{
            Promise.resolve(handler(message))
                .catch(err=>console.error(`[odoBotSocket.js] Failed to handle ${message.channel} message ${message.type}`, err))
        }catch(err){
            console.error(`[odoBotSocket.js] Failed to handle ${message.channel} message ${message.type}`, err)
        }
    }

    return _public
})();


browser.storage.local.onChanged.addListener(changes=>{
    if('guidanceMode' in changes){
        if(changes['guidanceMode'].newValue){
            OdoBotSocket.start()
        }else{
            OdoBotSocket.stop()
        }
    }
})

stateManager.guidanceMode()
    .then(_guidanceMode=>{
        if(_guidanceMode){
            OdoBotSocket.start()
        }
    })
    .catch(err=>{
        console.log("[odoBotSocket.js] Tried to check 'guidanceMode' flag before it was defined.")
    })
