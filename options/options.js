
//Setup default logUI config if the current state is just an empty object
stateManager.logUIConfig().then((currentConfig)=>{
    if(Object.keys(currentConfig).length === 0){ //Check if the current config object is empty.
        //If so, save the default logUI config.
        stateManager.logUIConfig(_defaultConfig).then(_=>loadOptions())
        
    }
})


function saveOptions(e){
    e.preventDefault();

    //Hide exisiting errors, hopefully they've been fixed.
    document.querySelector('.error-box').classList.remove('visible')
    document.querySelector('.error-box').classList.add('hidden')


    
    try{
        let configValue = JSON.parse(document.querySelector('#logui-client-config').value)
        stateManager.logUIConfig(configValue)
    }catch(error){
        console.error(error)
        showLogUIConfigError(error)
    }



    stateManager.username(document.querySelector("#logui-server-username").value)
    stateManager.password(document.querySelector('#logui-server-password').value)
    stateManager.endpoint(document.querySelector('#logui-server-endpoint').value)
    stateManager.targetHost(document.querySelector('#target-host').value)



}

function loadOptions(){

    stateManager.username().then((username)=>{document.querySelector("#logui-server-username").value = username},_=>{document.querySelector("#logui-server-username").value = ''})
    stateManager.password().then((password)=>{document.querySelector('#logui-server-password').value = password},_=>{document.querySelector('#logui-server-password').value = ''})
    stateManager.endpoint().then((endpoint)=>{document.querySelector('#logui-server-endpoint').value = endpoint},_=>{document.querySelector('#logui-server-endpoint').value = ''})
    stateManager.logUIConfig().then((config)=>{document.querySelector('#logui-client-config').value = JSON.stringify(config, null, 4)})
    stateManager.targetHost().then((targetHost)=>{document.querySelector('#target-host').value = targetHost},_=>{document.querySelector('#target-host').value = ''})
    
}

function showLogUIConfigError(message){
    document.querySelector('#config-value-error-msg').innerHTML = message

    document.querySelector(".error-box").classList.remove('hidden')
    document.querySelector(".error-box").classList.add('visible')
}


document.addEventListener('DOMContentLoaded', loadOptions)
document.querySelector("form").addEventListener("submit", saveOptions);