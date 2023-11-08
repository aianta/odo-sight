

/**
 * Event Listener Hijack for accurate cause-effect logging. 
 * Key concept: Need to make sure logging event handlers fire BEFORE any dom changes take place to get an accurate picture of the DOM at event time.
 * 
 * See relevant stack overflow threads:
 * https://stackoverflow.com/questions/446892/how-to-find-event-listeners-on-a-dom-node-in-javascript-or-in-debugging/6434924#6434924
 * https://stackoverflow.com/questions/77434759/hijacking-addeventlistener-results-in-too-much-recursion-when-adding-a-react-inv/77439399#77439399
 */


if(!Node.prototype.realAddEventListener){ //Deeply important, see 2nd stackover flow post.
    Node.prototype.realAddEventListener = Node.prototype.addEventListener
}

Node.prototype.addEventListener = function(a,b,c){
    console.log('modified addEventListenerInvoked!')
    
    this.realAddEventListener(a,b,c)
    
    if(!this.lastListenerInfo){
        this.lastListenerInfo = new Array()
    };
    this.lastListenerInfo.push({a:a, b:b, c:c})

    let logUIIndex = this.lastListenerInfo.findIndex(listener=>listener.b.toString().startsWith('function (browserEvent) {'))

    let logUIListener = this.lastListenerInfo[logUIIndex]

    if(logUIIndex !== -1 || logUIIndex === 0){
        let newLastListenerInfo = []
        //If we do have a LogUI handler here that's not already in first place. Let's ensure it executes first by:
        //removing all other listeners, adding the logUI listener, then adding the other listeners back.
        let otherListeners = this.lastListenerInfo.filter(listener=>!listener.b.toString().startsWith('function (browserEvent) {'))
        for (let listener of otherListeners){
          this.removeEventListener(listener.a, listener.b, listener.c)
        }
        this.realAddEventListener(logUIListener.a, logUIListener.b, logUIListener.c)
        newLastListenerInfo.push({a:logUIListener.a, b:logUIListener.b, c:logUIListener.c})
        
        for (let listener of otherListeners){
          this.realAddEventListener(listener.a, listener.b, listener.c)
          newLastListenerInfo.push({a:listener.a, b:listener.b, c:listener.c})
        }
        this.lastListenerInfo = newLastListenerInfo
    }

}

