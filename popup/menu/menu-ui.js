$('#bot-mode-btn').button({
    icon: 'fa-solid fa-robot blue',
    label: 'Bot Mode'
}).click(_=>{
    switchToBotView()
})

function switchToBotView(){
    browser.action.setPopup({
        popup: '/popup/bot/bot.html'
    })
    window.location.href="/popup/bot/bot.html"
}

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

function connectionTest(){
    console.log('doing connection test')
    RealtimeDispatcher.testConnection()
    .then(_=>{
        console.log('connection test ok!')
        hideSelfSignedCertificateError()
    })
    .catch(err=>{
        handleSelfSignedCertificateError()
        console.log('connection test failed! ', err )
    }
)
}


function hideSelfSignedCertificateError(){
    //If the main frame was hidden, display it again.
    if($('#main-frame').hasClass('hidden')){
        $('#main-frame').removeClass('hidden').addClass('visible')
    }

    //If the self signed cert msg box is visible, hide it.
    if( $('#self-signed-ssl-msg-box').hasClass('visible')){
        $('#self-signed-ssl-msg-box')
            .removeClass('visible')
            .addClass('hidden')
    }
}

function handleSelfSignedCertificateError(){

    //Hide the main frame
    $('#main-frame').addClass('hidden').removeClass('visible')

    const selfSignedLinkTarget = "https://localhost:7080"
    //Generate the https link
    $('#self-signed-link')
        .attr('href', selfSignedLinkTarget)
        .attr('target', '_blank')
        .text(selfSignedLinkTarget)

    //Display the error message
    $('#self-signed-ssl-msg-box')
        .removeClass('hidden')
        .addClass('visible')

    //Set a time out to hide the error message and display the main frame
    setTimeout(()=>{

        testConnection()
        
    }, 2000) //20 seconds.

}

