
function saveOptions(e){
    e.preventDefault();
    
    try{
        let configValue = JSON.parse(document.querySelector('#logui-client-config').value)
        stateManager.logUIConfig(configValue)
    }catch(error){
        console.error(error)
    }



    stateManager.username(document.querySelector("#logui-server-username").value)
    stateManager.password(document.querySelector('#logui-server-password').value)
    stateManager.endpoint(document.querySelector('#logui-server-endpoint').value)



}

function loadOptions(){

    stateManager.username().then((username)=>{document.querySelector("#logui-server-username").value = username},_=>{document.querySelector("#logui-server-username").value = ''})
    stateManager.password().then((password)=>{document.querySelector('#logui-server-password').value = password},_=>{document.querySelector('#logui-server-password').value = ''})
    stateManager.endpoint().then((endpoint)=>{document.querySelector('#logui-server-endpoint').value = endpoint},_=>{document.querySelector('#logui-server-endpoint').value = ''})
    stateManager.logUIConfig().then((config)=>{document.querySelector('#logui-client-config').value = JSON.stringify(config, null, 4)})

    
}

document.addEventListener('DOMContentLoaded', loadOptions)
document.querySelector("form").addEventListener("submit", saveOptions);