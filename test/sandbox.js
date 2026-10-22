/**
 * Loads one of OdoX's background scripts into a sandbox for tests, with stubs for the browser APIs and OdoBotSocket.
 */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

/**
 * @param {string} script the file name in scripts/.
 * @param {object} options activeTabId: the tab browser.tabs.query reports active. globals: more globals for the script,
 * which replace the stubs here.
 * @returns the sandbox, plus what the script registered: listeners (by event), handlers (OdoBotSocket.on, by channel),
 * openCallbacks (OdoBotSocket.onOpen), and sent (every message it sent through OdoBotSocket, in order).
 */
function loadScript(script, {activeTabId = 1, globals = {}} = {}){
    const listeners = {connect: [], activated: [], focusChanged: [], storageChanged: []}
    const handlers = {}
    const openCallbacks = []
    const sent = []
    let pages = 0

    const OdoBotSocket = {
        on: (channel, handler)=>{handlers[channel] = handler},
        onOpen: callback=>openCallbacks.push(callback),
        isOpen: ()=>true,
        send: (channel, type, fields = {})=>{
            const message = Object.assign({}, fields, {channel: channel, type: type})
            sent.push(message)
            return message
        },
        reply: (request, type, fields = {})=>OdoBotSocket.send(request.channel, type, Object.assign({}, fields, {replyTo: request.id}))
    }

    const sandbox = {
        console: {log(){}, debug(){}, warn(){}, error(){}},
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        _GUIDANCE_PORT_NAME: 'guidance',
        crypto: {randomUUID: ()=>`page-${++pages}`},
        browser: {
            runtime: {onConnect: {addListener: listener=>listeners.connect.push(listener)}},
            tabs: {
                onActivated: {addListener: listener=>listeners.activated.push(listener)},
                query: async ()=>[{id: activeTabId}]
            },
            windows: {onFocusChanged: {addListener: listener=>listeners.focusChanged.push(listener)}},
            storage: {local: {onChanged: {addListener: listener=>listeners.storageChanged.push(listener)}}}
        },
        OdoBotSocket: OdoBotSocket
    }
    Object.assign(sandbox, globals)

    vm.createContext(sandbox)
    const file = path.join(__dirname, '..', 'scripts', script)
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, {filename: file})

    return {sandbox, listeners, handlers, openCallbacks, sent}
}

/**
 * Load guidance.js, which runs in the page, with stubs for the page.
 * @returns the sandbox, plus fromOdoBot(message), which hands guidance.js a message as main.js does, and toOdoBot, every
 * message guidance.js sent to OdoBot, in order.
 */
function loadPageScript(script = 'guidance.js'){
    const listeners = []
    const toOdoBot = []

    const window = {
        addEventListener: (type, listener)=>{
            if(type === 'message'){
                listeners.push(listener)
            }
        },
        postMessage: data=>{
            if(data?.origin === 'guidance.js' && data.type === 'GUIDANCE_MESSAGE'){
                toOdoBot.push(data.message)
            }
        }
    }

    const sandbox = {
        console: {log(){}, debug(){}, warn(){}, error(){}},
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        window: window,
        crypto: {getRandomValues: bytes=>require('node:crypto').getRandomValues(bytes)},
        document: {adoptedStyleSheets: []},
        CSSStyleSheet: class { replaceSync(){} }
    }

    vm.createContext(sandbox)
    const file = path.join(__dirname, '..', 'scripts', script)
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, {filename: file})

    const fromOdoBot = message=>listeners.forEach(listener=>listener({
        source: window,
        data: {origin: 'main.js', type: 'GUIDANCE_MESSAGE', message: message}
    }))

    return {sandbox, fromOdoBot, toOdoBot}
}

/**
 * Let pending promise callbacks and timers run.
 */
function flush(){
    return new Promise(resolve=>setTimeout(resolve, 0))
}

/**
 * Wait until the condition holds, or fail after a second.
 */
async function until(condition){
    const deadline = Date.now() + 1000
    while(!condition()){
        if(Date.now() > deadline){
            throw new Error('timed out waiting')
        }
        await new Promise(resolve=>setTimeout(resolve, 5))
    }
}

module.exports = {loadScript, loadPageScript, flush, until}
