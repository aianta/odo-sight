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
