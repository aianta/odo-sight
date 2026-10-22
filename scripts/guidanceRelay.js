/**
 * Passes the messages of the 'guidance' channel between OdoBot and guidance.js.
 *
 * guidance.js runs in the page, where page CSP can block connections to OdoBot. So it doesn't connect to OdoBot itself:
 * main.js, the content script next to it, opens a port to this relay once guidance.js has loaded, and the relay passes
 * messages between that port and OdoX's socket to OdoBot (odoBotSocket.js).
 *
 * Every page that connects gets a pageId. Guidance messages go to the page in the active tab, the tab whose screenshots
 * OdoBot gets. That page is the target, and OdoBot is told its pageId with PAGE_READY, and that it is gone with PAGE_GONE.
 *
 * OdoBot addresses each message to a page by its pageId. The relay never holds messages: a message for the target is
 * delivered to it, and a message for any other page, e.g. one that went away while the message was on its way, is
 * answered with NOT_DELIVERED. OdoBot decides what to do then; it is the only place guidance messages wait.
 *
 * Messages from a page are stamped with its pageId, and only the types a page sends are passed on.
 *
 * The page answers every EXECUTE once it has run it. If the page goes away first, e.g. because the EXECUTE navigated,
 * the relay answers for it with EXECUTE_DONE {status: 'page-gone'}, so OdoBot always hears back about a delivered EXECUTE.
 */
var GuidanceRelay = (function(){
    var _public = {}

    var _ports = new Map() //The pages that are ready, by tab id: {port, pageId, outstanding}.
    var _target = null //The page guidance messages go to: {tabId, port, pageId, outstanding}, or null.

    var _updating = Promise.resolve() //Target updates run one at a time, see updateTarget().

    /**
     * The message types a page sends to OdoBot. Anything else from a page is dropped: a page must not be able to report
     * page state or answer for the relay.
     */
    var _PAGE_MESSAGE_TYPES = new Set([
        'EXECUTE_DONE',
        'EXECUTION_RESULT',
        'REGISTER_ALTERNATE_XPATH',
        'UNRESOLVABLE_XPATH',
        'PATH_COMPLETE_ACK',
        'NAVIGATION_OPTIONS_SHOW_RESULT',
        'CLEAR_NAVIGATION_OPTIONS_RESULT'
    ])

    /**
     * Reset the relay when guidance mode is turned off: disconnect every page.
     */
    _public.stop = function(){
        _ports.forEach(({port})=>port.disconnect())
        _ports.clear()
        _target = null
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

        //A tab has one page, so a new port replaces any old one. Disconnecting it from here doesn't fire its
        //onDisconnect, so its outstanding EXECUTEs are answered here.
        const old = _ports.get(tabId)
        if(old !== undefined){
            old.port.disconnect()
            answerOutstanding(old)
            if(_target !== null && _target.port === old.port){
                _target = null
            }
        }

        //outstanding: the EXECUTE messages delivered to the page that it hasn't answered yet, by id.
        const page = {port: port, pageId: crypto.randomUUID(), outstanding: new Map()}
        _ports.set(tabId, page)
        port.onMessage.addListener(message=>onPageMessage(page, message))
        port.onDisconnect.addListener(()=>onPortGone(tabId, page))

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

    /**
     * The page went away before answering some EXECUTEs, most likely because one of them navigated. Answer them for it.
     */
    function answerOutstanding(page){
        page.outstanding.forEach(execute=>{
            OdoBotSocket.reply(execute, 'EXECUTE_DONE', {status: 'page-gone', pageId: page.pageId})
        })
        page.outstanding.clear()
    }

    function onPortGone(tabId, page){
        if(_ports.get(tabId) === page){
            _ports.delete(tabId)
        }

        answerOutstanding(page)

        if(_target !== null && _target.port === page.port){
            _target = null
            sendPageState('PAGE_GONE', {tabId: tabId, pageId: page.pageId, reason: 'unload'})
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
                const page = tabId === undefined? undefined : _ports.get(tabId)

                if(_target !== null && page !== undefined && _target.port === page.port){
                    return
                }

                if(_target !== null){
                    sendPageState('PAGE_GONE', {tabId: _target.tabId, pageId: _target.pageId, reason: 'tab-switch'})
                    _target = null
                }

                if(page !== undefined){
                    _target = {tabId: tabId, port: page.port, pageId: page.pageId, outstanding: page.outstanding}
                    sendPageState('PAGE_READY', {tabId: tabId, pageId: page.pageId, url: page.port.sender?.url})
                }
            })
            .catch(err=>console.error("[guidanceRelay.js] Failed to update the target page", err))
    }

    /**
     * A message from OdoBot for a page. It is delivered only if it is addressed to the target.
     */
    function onOdoBotMessage(message){
        if(_target !== null && message.pageId === _target.pageId){
            if(message.type === 'EXECUTE'){
                _target.outstanding.set(message.id, message)
            }
            _target.port.postMessage(message)
            return
        }

        const reason = message.pageId === undefined? 'unaddressed' : (_target === null? 'no-page' : 'other-page')
        console.log(`[guidanceRelay.js] Could not deliver ${message.type} for page ${message.pageId} (${reason})`)
        OdoBotSocket.reply(message, 'NOT_DELIVERED', {pageId: message.pageId, reason: reason})
    }

    /**
     * A message from a page for OdoBot. Its id, replyTo and cause are kept, and it is stamped with the page's pageId.
     */
    function onPageMessage(page, message){
        if(message === null || typeof message !== 'object' || typeof message.type !== 'string'){
            console.warn("[guidanceRelay.js] Dropping a malformed message from the page", message)
            return
        }
        if(!_PAGE_MESSAGE_TYPES.has(message.type)){
            console.warn(`[guidanceRelay.js] Dropping a ${message.type} from the page, which pages don't send`)
            return
        }
        if(message.replyTo !== undefined){
            page.outstanding.delete(message.replyTo)
        }
        OdoBotSocket.send('guidance', message.type, Object.assign({}, message, {pageId: page.pageId}))
    }

    /**
     * OdoBot forgets the page when the socket drops, so tell it again once the socket is back.
     */
    function onSocketOpen(){
        if(_target !== null){
            sendPageState('PAGE_READY', {tabId: _target.tabId, pageId: _target.pageId, url: _target.port.sender?.url})
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
