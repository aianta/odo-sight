/**
 * guidance.js answers every EXECUTE exactly once: with its EXECUTION_RESULT, or with EXECUTE_DONE once it has run.
 *
 * Run with `npm test`. guidance.js runs in the page, so it is loaded into a sandbox with stubs for the page.
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const {loadPageScript, until} = require('./sandbox')

function doneFor(page, id){
    return page.toOdoBot.filter(message=>message.type === 'EXECUTE_DONE' && message.replyTo === id)
}

test('a wait is reported done once it has waited', async ()=>{
    const page = loadPageScript()
    const sent = Date.now()

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1,
        unchartedAction: {action: 'wait', seconds: 0.1}})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.ok(Date.now() - sent >= 95, 'reported done before the wait was over')
    assert.equal(doneFor(page, 'm1')[0].status, 'ok')
})

test('uncharted steps run one after another, and each is reported done once', async ()=>{
    const page = loadPageScript()

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1, unchartedAction: {action: 'wait', seconds: 0.1}})
    page.fromOdoBot({type: 'EXECUTE', id: 'm2', action: 'uncharted_step', step: 2, unchartedAction: {action: 'wait', seconds: 0}})

    await until(()=>doneFor(page, 'm2').length === 1)
    const done = page.toOdoBot.filter(message=>message.type === 'EXECUTE_DONE').map(message=>message.replyTo)
    assert.deepEqual(done, ['m1', 'm2'])
})

test('a step without an action is reported failed', async ()=>{
    const page = loadPageScript()

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.equal(doneFor(page, 'm1')[0].status, 'failed')
    assert.match(doneFor(page, 'm1')[0].reason, /no action/)
})

test('an unknown uncharted action is reported failed', async ()=>{
    const page = loadPageScript()

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1, unchartedAction: {action: 'drag'}})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.equal(doneFor(page, 'm1')[0].status, 'failed')
    assert.match(doneFor(page, 'm1')[0].reason, /drag/)
})

test('an unknown instruction is reported failed', async ()=>{
    const page = loadPageScript()

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'teleport'})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.equal(doneFor(page, 'm1')[0].status, 'failed')
})

/**
 * A minimal element for describing targets: the parts of the DOM unchartedDescribeTarget and getElementTreeXPath read.
 */
function fakeElement(page, tag, {attributes = {}, text = '', focusable = false, parent = null} = {}){
    const element = {
        nodeType: 1,
        nodeName: tag.toUpperCase(),
        tagName: tag.toUpperCase(),
        localName: tag,
        prefix: null,
        id: attributes.id ?? '',
        textContent: text,
        outerHTML: `<${tag}>${text}</${tag}>`,
        isContentEditable: false,
        shadowRoot: null,
        previousSibling: null,
        nextSibling: null,
        parentElement: parent,
        parentNode: parent,
        ownerDocument: page.sandbox.document,
        getAttribute: name=>attributes[name] ?? null,
        getRootNode: ()=>page.sandbox.document,
        matches: selector=>focusable && selector !== ':disabled'
    }
    return element
}

function loadPageWithDom(){
    const page = loadPageScript()
    page.sandbox.Node = {ELEMENT_NODE: 1, DOCUMENT_TYPE_NODE: 10}
    return page
}

test('a click is aimed at the element under the pointer, with the element a click on it focuses', ()=>{
    const page = loadPageWithDom()
    const link = fakeElement(page, 'a', {attributes: {href: '/orders', class: 'nav'}, focusable: true})
    const span = fakeElement(page, 'span', {text: '  My   orders ', parent: link})
    page.sandbox.document.elementFromPoint = ()=>span

    const target = page.sandbox.unchartedActionTarget({action: 'left_click', x: 10, y: 20})

    assert.equal(target.tagName, 'span')
    assert.equal(target.via, 'point')
    assert.equal(target.text, 'My orders')
    assert.equal(target.xpath, '/a/span')
    assert.equal(target.inFrame, false)
    assert.equal(target.focusTarget.tagName, 'a')
    assert.equal(target.focusTarget.href, '/orders')
    assert.equal(target.focusTarget.className, 'nav')
})

test('typing and key presses are aimed at the focused element', ()=>{
    const page = loadPageWithDom()
    const input = fakeElement(page, 'input', {attributes: {type: 'search', name: 'q'}, focusable: true})
    page.sandbox.document.activeElement = input

    const target = page.sandbox.unchartedActionTarget({action: 'type', text: 'shoes'})

    assert.equal(target.tagName, 'input')
    assert.equal(target.via, 'focus')
    assert.equal(target.type, 'search')
    assert.equal(target.name, 'q')
    assert.equal(target.focusTarget, undefined)
    assert.equal(page.sandbox.unchartedActionTarget({action: 'key', keys: ['enter']}).tagName, 'input')
})

test('a long outerHTML is truncated', ()=>{
    const page = loadPageWithDom()
    const div = fakeElement(page, 'div')
    div.outerHTML = 'x'.repeat(5000)
    page.sandbox.document.elementFromPoint = ()=>div

    const target = page.sandbox.unchartedActionTarget({action: 'left_click', x: 1, y: 1})

    assert.equal(target.outerHTML.length, 2000)
    assert.equal(target.outerHTMLTruncated, true)
})

test('a target that cannot be described is reported as an error', ()=>{
    const page = loadPageWithDom()
    page.sandbox.document.elementFromPoint = ()=>{ throw new Error('boom') }

    assert.deepEqual({...page.sandbox.unchartedActionTarget({action: 'left_click', x: 1, y: 1})}, {error: 'boom'})
})

test('scrolls and waits have no target, and their EXECUTE_DONE carries none', async ()=>{
    const page = loadPageWithDom()
    assert.equal(page.sandbox.unchartedActionTarget({action: 'scroll', amount: -3}), null)

    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1, unchartedAction: {action: 'wait', seconds: 0}})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.equal(doneFor(page, 'm1')[0].status, 'ok')
    assert.equal('target' in doneFor(page, 'm1')[0], false)
})

test("a step's EXECUTE_DONE carries its target", async ()=>{
    const page = loadPageWithDom()
    page.sandbox.document.activeElement = fakeElement(page, 'textarea', {attributes: {name: 'comment'}, focusable: true})

    //A key press without keys presses nothing, so the step runs without a real page.
    page.fromOdoBot({type: 'EXECUTE', id: 'm1', action: 'uncharted_step', step: 1, unchartedAction: {action: 'key', keys: []}})

    await until(()=>doneFor(page, 'm1').length === 1)
    assert.equal(doneFor(page, 'm1')[0].status, 'ok')
    assert.equal(doneFor(page, 'm1')[0].target.tagName, 'textarea')
    assert.equal(doneFor(page, 'm1')[0].target.name, 'comment')
})
