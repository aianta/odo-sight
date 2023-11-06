

/**
 * Event Listener Hijack for accurate cause-effect logging. 
 * Key concept: Need to make sure logging event handlers fire BEFORE any dom changes take place.
 */

// function reportIn(e){
//     var a = this.lastListenerInfo[this.lastListenerInfo.length-1]
//     console.log(`reportIn this = ${this.toString()} a = ${a.toString()}`)
//     console.log('reportIn')
//     // console.log(a)
//   }
  
Node.prototype.realAddEventListener = Node.prototype.addEventListener;

Node.prototype.addEventListener = function(a,b,c){
//    console.log(`Node.prototype.addEventListener this = ${this.toString()} a = ${a.toString()} b = ${b.toString()}`)
//    this.realAddEventListener(a, reportIn, c)
    this.realAddEventListener(a,b,c)
    
    if(!this.lastListenerInfo){
        this.lastListenerInfo = new Array()
    };
    this.lastListenerInfo.push({a:a, b:b, c:c})

    // this.lastListenerInfo.forEach(listener=>console.log(""+listener.b.toString()))
    let logUIIndex = this.lastListenerInfo.findIndex(listener=>listener.b.toString().startsWith('function (browserEvent) {'))
    // console.log('logUIIndex: ' + logUIIndex)
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
