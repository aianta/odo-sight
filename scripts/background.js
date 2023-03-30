console.log("backround.js says hi")
browser.runtime.onMessage.addListener(
    (data, sender)=>{
        console.log("woah got message from:", sender)
    
        if(sender.url.includes("devtools.html")){
            console.log("Passing data from devtools to content script!")
            //Get the tab id to send to
            browser.storage.local.get(['tab_destination'], (result)=>{
                console.log("browser storage result", result)
                if(!result || result === undefined || result === {}){
                    console.log("tab_destination not yet set!")
                    return 
                }
                let tab_destination = result.tab_destination

                //Send message to content script
                browser.tabs.sendMessage(tab_destination, data)
            })


        }else{
            console.log('saving tabId of content script with LogUI instance.')
            
            //This is a message from the content script
            browser.storage.local.set({tab_destination: sender.tab.id})

        }

    }
)