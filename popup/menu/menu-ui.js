$('#bot-mode-btn').button({
    icon: 'fa-solid fa-robot blue',
    label: 'Bot Mode'
}).click(_=>{
    switchToBotView()
})

$('#screenshot-btn').button({
    icon: 'fa-solid fa-camera',
    label: 'Screenshot'
}).click(_=>{
    browser.windows.getCurrent().then(currentWindow=>{
        browser.tabs.captureVisibleTab(
            currentWindow.id,
            {
                format: 'png',
                scale: 2
            }
        ).then(image=>{
            console.log(typeof image)
            return fetch(image).then(response=>response.arrayBuffer())
        }).then(buffer=>{
            console.log(`Size: ${(buffer.byteLength/1024).toFixed(2)} KB`)
            browser.clipboard.setImageData(buffer, "png")
        })
        .catch(err=>{
            console.log(err)
        })
    })
    
})

$('#bot-mode-btn').button({
    icon: 'fa-solid fa-robot blue',
    label: 'Bot Mode'
}).click(_=>{
    switchToBotView()
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


function switchToBotView(){
    browser.action.setPopup({
        popup: '/popup/bot/bot.html'
    })
    window.location.href="/popup/bot/bot.html"
    //Enable Guidance Mode
    stateManager.guidanceMode(true)
}