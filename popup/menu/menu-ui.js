$('#bot-mode-btn').button({
    icon: 'fa-solid fa-robot blue',
    label: 'Bot Mode'
}).click(_=>{
    browser.action.setPopup({
        popup: '/popup/bot/bot.html'
    })
    window.location.href="/popup/bot/bot.html"
})


$('#sight-mode-btn').button({
    icon: 'fa-solid fa-eye blue',
    label: 'Sight Mode'
}).click(_=>{
    browser.action.setPopup({
        popup: '/popup/sight/controls.html'
    })
    window.location.href="/popup/sight/controls.html"
})

stateManager.set('shouldRecord', false)