$('#back-to-menu-btn').button({
    icon: 'fa-solid fa-arrow-left',
    label: 'Back to Menu'
}).click(_=>{
    browser.action.setPopup({
        popup: '/popup/menu/menu.html'
    })
    window.location.href="/popup/menu/menu.html"
})
    
$('#guide-btn').button({
    label: 'GO'
})

$('#cancel-btn').button({
    label: 'Stop Guidance',
    class: 'hidden'
})

function showError(msg){
    $('#error-container').removeClass('hidden').addClass('visible')
    $('#error-msg').text(msg)
}

function clearError(){
    $('#error-msg').text('')
    $('#error-container').addClass('hidden').removeClass('visible')
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

function handleSelfSignedCertificateError(error, retryFunction){

    if(error.code === 'ERR_NETWORK'){

        //Hide the main frame
        $('#main-frame').addClass('hidden').removeClass('visible')

        const selfSignedLinkTarget = error.hostLink
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

            retryFunction && retryFunction()
                .then(
                    _=>{},
                    err=>handleSelfSignedCertificateError(err, retryFunction)
                )
            
        }, 20000) //20 seconds.


    }

    

}

