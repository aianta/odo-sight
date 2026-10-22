/**
 * odoBotSocket.js holds messages while its socket is down, and tells OdoBot about any it had to drop.
 *
 * Run with `npm test`. It is loaded into a sandbox with a fake WebSocket that the tests open.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {loadScript, flush} = require('./sandbox')

/**
 * A WebSocket that stays connecting until the test opens it, and records what is sent over it.
 */
class FakeWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3
    static instances = []

    constructor(url){
        this.url = url
        this.readyState = FakeWebSocket.CONNECTING
        this.sent = []
        this.listeners = {}
        FakeWebSocket.instances.push(this)
    }

    addEventListener(type, listener){
        (this.listeners[type] ??= []).push(listener)
    }

    removeEventListener(type, listener){
        this.listeners[type] = (this.listeners[type] ?? []).filter(l=>l !== listener)
    }

    send(data){
        this.sent.push(JSON.parse(data))
    }

    close(){
        this.readyState = FakeWebSocket.CLOSED
    }

    open(){
        this.readyState = FakeWebSocket.OPEN
        ;(this.listeners.open ?? []).forEach(listener=>listener({}))
    }
}

/**
 * Load odoBotSocket.js with guidance mode on, and wait for it to create its socket.
 */
async function loadSocket(){
    FakeWebSocket.instances = []
    let ids = 0
    const loaded = loadScript('odoBotSocket.js', {globals: {
        WebSocket: FakeWebSocket,
        crypto: {randomUUID: ()=>`id-${++ids}`},
        _ODOBOT_PROTOCOL_VERSION: 3,
        _ODOBOT_SOCKET_URL: (host, clientId)=>`wss://${host}/?clientId=${clientId}&protocol=3`,
        stateManager: {
            guidanceMode: async ()=>true,
            guidanceHost: async ()=>'odobot:40000',
            clientId: async ()=>'client-1'
        }
    }})
    await flush()
    await flush()
    const socket = FakeWebSocket.instances[0]
    assert.ok(socket, 'no socket was created')
    return {OdoBotSocket: loaded.sandbox.OdoBotSocket, socket}
}

test('messages sent while the socket is connecting go out in order once it opens', async ()=>{
    const {OdoBotSocket, socket} = await loadSocket()

    OdoBotSocket.send('event', 'EVENT', {seq: 0})
    OdoBotSocket.send('event', 'EVENT', {seq: 1})
    assert.equal(socket.sent.length, 0)

    socket.open()

    assert.deepEqual(socket.sent.map(message=>message.seq), [0, 1])
    assert.ok(socket.sent.every(message=>message.v === 3 && message.channel === 'event'))
    assert.ok(socket.sent.every(message=>message.type !== 'EVENT_GAP'), 'a gap was reported when nothing was dropped')
})

test('messages dropped from a full outbox are reported before the rest go out', async ()=>{
    const {OdoBotSocket, socket} = await loadSocket()

    for(let seq = 0; seq < 1003; seq++){
        OdoBotSocket.send('event', 'EVENT', {seq: seq})
    }
    OdoBotSocket.send('guidance', 'EXECUTE_DONE', {replyTo: 'm1'})

    socket.open()

    const gap = socket.sent[0]
    assert.equal(gap.type, 'EVENT_GAP')
    assert.equal(gap.channel, 'event')
    assert.equal(gap.dropped, 4)
    assert.deepEqual(Object.assign({}, gap.droppedTypes), {'event/EVENT': 4})
    assert.equal(gap.reason, 'outbox-overflow')

    //The oldest were dropped; the rest keep their order.
    const flushed = socket.sent.slice(1)
    assert.equal(flushed.length, 1000)
    assert.equal(flushed[0].seq, 4)
    assert.equal(flushed[flushed.length - 1].type, 'EXECUTE_DONE')
})

test('a gap is reported once', async ()=>{
    const {OdoBotSocket, socket} = await loadSocket()
    for(let seq = 0; seq < 1001; seq++){
        OdoBotSocket.send('event', 'EVENT', {seq: seq})
    }
    socket.open()

    socket.open()

    assert.equal(socket.sent.filter(message=>message.type === 'EVENT_GAP').length, 1)
})
