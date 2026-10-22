/**
 * Passes the messages of the 'guidance' channel between OdoBot and guidance.js.
 *
 * guidance.js runs in the page, where page CSP can block connections to OdoBot. So it doesn't connect to OdoBot itself:
 * main.js, the content script next to it, opens a port to this relay once guidance.js has loaded, and the relay passes
 * messages between that port and OdoX's socket to OdoBot (odoBotSocket.js).
 *
 * Guidance messages go to the page in the active tab, the tab whose screenshots OdoBot gets. That page is the target.
 * While there is no target, e.g. while the page navigates, guidance messages are held:
 *  - OdoBot holds them, as it is told with PAGE_GONE and PAGE_READY when the target goes and comes.
 *  - The relay holds the ones that were already on their way when the target went, and delivers them to the next target
 *    before telling OdoBot it is ready, so they keep their order.
 */
var GuidanceRelay = (function(){
    var _public = {}

    var _ports = new Map() //The ports of the pages that are ready, by tab id.
    var _target = null //The page guidance messages go to: {tabId, port}, or null.
    var _buffer = [] //Guidance messages that arrived while there was no target.
    var _maxBufferSize = 1000

    var _updating = Promise.resolve() //Target updates run one at a time, see updateTarget().

    /**
     * Reset the relay when guidance mode is turned off: disconnect every page and drop the messages held for them.
     */
    _public.stop = function(){
        _ports.forEach(port=>port.disconnect())
        _ports.clear()
        _target = null
        _buffer = []
    }

    function onConnect(port){
        if(port.name !== _GUIDANCE_PORT_NAME){
            return
        }

        const tabId = port.sender?.tab?.id
        if(tabId === undefined){
            console.warn("[guidanceRelay.js] A guidance port without a tab connected, ignoring it.")
            port.disconnect()
            return
        }

        //A tab has one page, so a new port replaces any old one.
        const oldPort = _ports.get(tabId)
        if(oldPort !== undefined){
            oldPort.disconnect()
            if(_target !== null && _target.port === oldPort){
                _target = null
            }
        }

        _ports.set(tabId, port)
        port.onMessage.addListener(message=>onPageMessage(message))
        port.onDisconnect.addListener(()=>onPortGone(tabId, port))

        updateTarget()
    }

    /**
     * Tell OdoBot the target came or went. Only while the socket is open: when it drops OdoBot forgets the page, and
     * onSocketOpen() tells it the current state once it is back, so a queued PAGE_GONE or PAGE_READY would be stale.
     */
    function sendPageState(type, fields){
        if(OdoBotSocket.isOpen()){
            OdoBotSocket.send('guidance', type, fields)
        }
    }

    function onPortGone(tabId, port){
        if(_ports.get(tabId) === port){
            _ports.delete(tabId)
        }

        if(_target !== null && _target.port === port){
            _target = null
            sendPageState('PAGE_GONE', {tabId: tabId, reason: 'unload'})
        }

        updateTarget()
    }

    /**
     * Make the ready page in the active tab the target, if it isn't already.
     */
    function updateTarget(){
        _updating = _updating
            .then(()=>browser.tabs.query({active: true, lastFocusedWindow: true}))
            .then(tabs=>{
                const tabId = tabs[0]?.id
                const port = tabId === undefined? undefined : _ports.get(tabId)

                if(_target !== null && _target.port === port){
                    return
                }

                if(_target !== null){
                    sendPageState('PAGE_GONE', {tabId: _target.tabId, reason: 'tab-switch'})
                    _target = null
                }

                if(port !== undefined){
                    _target = {tabId: tabId, port: port}

                    //Deliver what arrived while there was no target before OdoBot sends anything it held.
                    const held = _buffer
                    _buffer = []
                    held.forEach(message=>port.postMessage(message))

                    sendPageState('PAGE_READY', {tabId: tabId, url: port.sender?.url})
                }
            })
            .catch(err=>console.error("[guidanceRelay.js] Failed to update the target page", err))
    }

    /**
     * A message from OdoBot for the page.
     */
    function onOdoBotMessage(message){
        if(_target !== null){
            _target.port.postMessage(message)
            return
        }

        console.log(`[guidanceRelay.js] No page is ready, holding ${message.type}`)
        _buffer.push(message)
        if(_buffer.length > _maxBufferSize){
            _buffer.shift()
        }
    }

    /**
     * A message from the page for OdoBot. Its id, replyTo and cause are kept.
     */
    function onPageMessage(message){
        if(message === null || typeof message !== 'object' || typeof message.type !== 'string'){
            console.warn("[guidanceRelay.js] Dropping a malformed message from the page", message)
            return
        }
        OdoBotSocket.send('guidance', message.type, message)
    }

    /**
     * OdoBot forgets whether the page is ready when the socket drops, so tell it again once the socket is back.
     */
    function onSocketOpen(){
        if(_target !== null){
            sendPageState('PAGE_READY', {tabId: _target.tabId, url: _target.port.sender?.url})
        }
    }

    browser.runtime.onConnect.addListener(onConnect)
    browser.tabs.onActivated.addListener(()=>updateTarget())
    browser.windows.onFocusChanged.addListener(()=>updateTarget())
    OdoBotSocket.on('guidance', onOdoBotMessage)
    OdoBotSocket.onOpen(onSocketOpen)

    return _public
})();


browser.storage.local.onChanged.addListener(changes=>{
    if('guidanceMode' in changes && !changes['guidanceMode'].newValue){
        GuidanceRelay.stop()
    }
})
