/**
 * guidanceConnector.js observes the active tab with a screenshot and the page's DOM snapshot, taken together.
 *
 * Run with `npm test`. The connector is a background script, so it is loaded into a sandbox with stubs for the browser
 * APIs, stateManager and OdoBotSocket.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {loadScript, until} = require('./sandbox')

const PNG_BYTES = [137, 80, 78, 71]
const SNAPSHOT = JSON.stringify({outerHTML: '<html><body>page</body></html>', outerText: 'page'})

/**
 * Load the connector with tab 7 active at `url`, whose page answers GET_DOM_SNAPSHOT with `pageReply`.
 */
function loadConnector({pageReply = async ()=>({domSnapshot: SNAPSHOT})} = {}){
    const domRequests = []
    const state = {}
    const browser = {
        windows: {getCurrent: async ()=>({id: 3, tabs: [{id: 6, active: false, url: 'http://site/other'}, {id: 7, active: true, url: 'http://site/page'}]})},
        tabs: {
            captureVisibleTab: async (windowId)=>{
                assert.equal(windowId, 3)
                return 'data:image/png;base64,iVBORw=='
            },
            sendMessage: (tabId, message, options)=>{
                domRequests.push({tabId, message, options})
                return pageReply()
            }
        },
        storage: {local: {onChanged: {addListener(){}}}}
    }
    const stateManager = {
        exists: async key=>key in state,
        activePathsRequestId: async (value)=>{
            if(value !== undefined){
                state.activePathsRequestId = value
            }
            return state.activePathsRequestId
        },
        shouldTransmit: async ()=>{},
        clearActivePathsRequestId: async ()=>{}
    }
    class Uint8ArrayWithBase64 extends Uint8Array {
        toBase64(){
            return Buffer.from(this).toString('base64')
        }
    }
    const connector = loadScript('guidanceConnector.js', {globals: {
        browser: browser,
        stateManager: stateManager,
        fetch: async ()=>({arrayBuffer: async ()=>new Uint8Array(PNG_BYTES).buffer}),
        Uint8Array: Uint8ArrayWithBase64
    }})
    connector.domRequests = domRequests
    connector.fromOdoBot = message=>connector.handlers.event(Object.assign({channel: 'event'}, message))
    connector.sentOfType = type=>connector.sent.filter(message=>message.type === type)
    return connector
}

test('a screenshot reply carries the page\'s DOM snapshot, taken from the active tab\'s top frame', async ()=>{
    const connector = loadConnector()
    connector.fromOdoBot({type: 'GET_SCREENSHOT', id: 'shot-1'})
    await until(()=>connector.sentOfType('SCREENSHOT').length === 1)

    const reply = connector.sentOfType('SCREENSHOT')[0]
    assert.equal(reply.replyTo, 'shot-1')
    assert.equal(reply.screenshot, Buffer.from(PNG_BYTES).toString('base64'))
    assert.equal(reply.userLocation, 'http://site/page')
    assert.equal(reply.domSnapshot, SNAPSHOT)

    assert.equal(connector.domRequests.length, 1)
    assert.equal(connector.domRequests[0].tabId, 7)
    assert.equal(connector.domRequests[0].message.type, 'GET_DOM_SNAPSHOT')
    assert.equal(connector.domRequests[0].options.frameId, 0)
})

test('a page that can\'t give its DOM snapshot still gets observed, without one', async ()=>{
    const connector = loadConnector({pageReply: async ()=>{throw new Error('Could not establish connection. Receiving end does not exist.')}})
    connector.fromOdoBot({type: 'GET_SCREENSHOT', id: 'shot-1'})
    await until(()=>connector.sentOfType('SCREENSHOT').length === 1)

    const reply = connector.sentOfType('SCREENSHOT')[0]
    assert.equal(reply.screenshot, Buffer.from(PNG_BYTES).toString('base64'))
    assert.equal(reply.domSnapshot, null)
})

test('the Observation that starts a transmission carries the page\'s DOM snapshot', async ()=>{
    const connector = loadConnector()
    connector.fromOdoBot({type: 'START_TRANSMISSION', id: 'start-1', pathsRequestId: 'paths-1'})
    await until(()=>connector.sentOfType('TRANSMISSION_STARTED').length === 1)

    const first = connector.sentOfType('EVENT')[0]
    assert.equal(first.seq, 0)
    const details = first.event.eventDetails
    assert.equal(details.name, 'OBSERVATION')
    assert.equal(details.trigger, 'START_TRANSMISSION')
    assert.equal(details.userLocation, 'http://site/page')
    assert.equal(details.screenshot, Buffer.from(PNG_BYTES).toString('base64'))
    assert.equal(details.domSnapshot, SNAPSHOT)
})
