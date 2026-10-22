/**
 * guidanceRelay.js addresses guidance messages to pages by pageId, and never holds them.
 *
 * Run with `npm test`. The relay is a background script, so it is loaded into a sandbox with stubs for the browser
 * APIs and for OdoBotSocket.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {loadScript, flush} = require('./sandbox')

/**
 * A runtime port from a page's main.js.
 */
function fakePort(tabId, url = `http://site/${tabId}`){
    const onMessage = []
    const onDisconnect = []
    const port = {
        name: 'guidance',
        sender: {tab: {id: tabId}, url: url},
        posted: [],
        disconnected: false,
        onMessage: {addListener: listener=>onMessage.push(listener)},
        onDisconnect: {addListener: listener=>onDisconnect.push(listener)},
        postMessage: message=>port.posted.push(message),
        disconnect: ()=>{port.disconnected = true},
        /** The page sends a message. */
        fromPage: message=>onMessage.forEach(listener=>listener(message)),
        /** The page goes away, e.g. it navigates. */
        gone: ()=>onDisconnect.forEach(listener=>listener())
    }
    return port
}

/**
 * Load the relay with tab `activeTabId` active.
 */
function loadRelay(activeTabId = 1){
    const relay = loadScript('guidanceRelay.js', {activeTabId})
    relay.connect = port=>relay.listeners.connect.forEach(listener=>listener(port))
    relay.fromOdoBot = message=>relay.handlers.guidance(Object.assign({channel: 'guidance'}, message))
    relay.sentOfType = type=>relay.sent.filter(message=>message.type === type)
    return relay
}

test('a page in the active tab becomes the target, and OdoBot is told its pageId', async ()=>{
    const relay = loadRelay(1)
    relay.connect(fakePort(1))
    await flush()

    const ready = relay.sentOfType('PAGE_READY')
    assert.equal(ready.length, 1)
    assert.equal(ready[0].pageId, 'page-1')
    assert.equal(ready[0].tabId, 1)
})

test('a message addressed to the target is delivered to it', async ()=>{
    const relay = loadRelay(1)
    const port = fakePort(1)
    relay.connect(port)
    await flush()

    relay.fromOdoBot({type: 'EXECUTE', id: 'm1', pageId: 'page-1'})

    assert.equal(port.posted.length, 1)
    assert.equal(port.posted[0].id, 'm1')
    assert.equal(relay.sentOfType('NOT_DELIVERED').length, 0)
})

test('a message addressed to another page is answered with NOT_DELIVERED', async ()=>{
    const relay = loadRelay(1)
    const port = fakePort(1)
    relay.connect(port)
    await flush()

    relay.fromOdoBot({type: 'EXECUTE', id: 'm1', pageId: 'page-9'})

    assert.equal(port.posted.length, 0)
    const notDelivered = relay.sentOfType('NOT_DELIVERED')
    assert.equal(notDelivered.length, 1)
    assert.equal(notDelivered[0].replyTo, 'm1')
    assert.equal(notDelivered[0].reason, 'other-page')
    assert.equal(notDelivered[0].channel, 'guidance')
})

test('a message without a pageId is not delivered', async ()=>{
    const relay = loadRelay(1)
    const port = fakePort(1)
    relay.connect(port)
    await flush()

    relay.fromOdoBot({type: 'EXECUTE', id: 'm1'})

    assert.equal(port.posted.length, 0)
    assert.equal(relay.sentOfType('NOT_DELIVERED')[0].reason, 'unaddressed')
})

test('nothing is held for the next page once the target is gone', async ()=>{
    const relay = loadRelay(1)
    const first = fakePort(1)
    relay.connect(first)
    await flush()

    first.gone()
    await flush()
    const gone = relay.sentOfType('PAGE_GONE')
    assert.equal(gone.length, 1)
    assert.equal(gone[0].pageId, 'page-1')
    assert.equal(gone[0].reason, 'unload')

    //A message on its way when the page went is rejected, not kept for the next page.
    relay.fromOdoBot({type: 'EXECUTE', id: 'm1', pageId: 'page-1'})
    assert.equal(relay.sentOfType('NOT_DELIVERED')[0].reason, 'no-page')

    const second = fakePort(1)
    relay.connect(second)
    await flush()
    assert.equal(relay.sentOfType('PAGE_READY')[1].pageId, 'page-2')
    assert.equal(second.posted.length, 0, 'the next page got a message meant for the one before')
})

test('a page in a background tab is not the target', async ()=>{
    const relay = loadRelay(1)
    const background = fakePort(2)
    relay.connect(background)
    await flush()

    assert.equal(relay.sentOfType('PAGE_READY').length, 0)
    relay.fromOdoBot({type: 'EXECUTE', id: 'm1', pageId: 'page-1'})
    assert.equal(background.posted.length, 0)
    assert.equal(relay.sentOfType('NOT_DELIVERED')[0].reason, 'no-page')
})

test('messages from a page are stamped with its pageId', async ()=>{
    const relay = loadRelay(1)
    const port = fakePort(1)
    relay.connect(port)
    await flush()

    port.fromPage({type: 'REGISTER_ALTERNATE_XPATH', id: 'r1', cause: 'm1', alternateXpath: '/html/body'})

    const registration = relay.sentOfType('REGISTER_ALTERNATE_XPATH')[0]
    assert.equal(registration.pageId, 'page-1')
    assert.equal(registration.id, 'r1')
    assert.equal(registration.cause, 'm1')
    assert.equal(registration.channel, 'guidance')
})

test('a page cannot send the messages only the relay sends', async ()=>{
    const relay = loadRelay(1)
    const port = fakePort(1)
    relay.connect(port)
    await flush()
    const before = relay.sent.length

    port.fromPage({type: 'PAGE_READY', pageId: 'forged'})
    port.fromPage({type: 'PAGE_GONE', pageId: 'page-1'})
    port.fromPage({type: 'NOT_DELIVERED', replyTo: 'm1'})
    port.fromPage({nonsense: true})

    assert.equal(relay.sent.length, before)
})

test('the relay tells OdoBot its page again when the socket reopens', async ()=>{
    const relay = loadRelay(1)
    relay.connect(fakePort(1))
    await flush()

    relay.openCallbacks.forEach(callback=>callback())

    const ready = relay.sentOfType('PAGE_READY')
    assert.equal(ready.length, 2)
    assert.equal(ready[1].pageId, 'page-1')
})
