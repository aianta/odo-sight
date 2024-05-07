if(!XMLHttpRequest.prototype.realFetch){
  XMLHttpRequest.prototype.realFetch = window.fetch
}

window.fetch = function(){

  const options = arguments[1]

  if(options !== undefined){

    console.log('Fetch Stacktrace')
    const stackTrace = Error().stack
    console.log(stackTrace)

    if(stackTrace.includes('Node.prototype.addEventListener')){
      options.headers['odo-sight-flag'] = 'true'
    }else{
      options.headers['odo-sight-flag'] = 'false'
    }
  }

  return XMLHttpRequest.prototype.realFetch.apply(this, arguments)
}


if(!XMLHttpRequest.prototype.realSend){//Deeply important, see 2nd stackoverflow post.
  XMLHttpRequest.prototype.realSend = XMLHttpRequest.prototype.send
}



XMLHttpRequest.prototype.send = function(body){
  console.log("Intercepted XMLHttpRequest! ")

  console.log(console.trace())

  console.log("Error stack trace!")
  //Get the stack at the current locaiton. For more details on the technique see:
  //https://stackoverflow.com/questions/43236925/print-current-stack-trace-in-javascript/57238353#57238353

  let  stackTrace = Error().stack
  console.log(stackTrace)

  if(stackTrace.includes('Node.prototype.addEventListener')){
    this.setRequestHeader("odo-sight-flag", "true")
  }else{
    this.setRequestHeader("odo-sight-flag", "false")
  }
  

  this.realSend(body)
}


/**
 * Event Listener Hijack for accurate cause-effect logging. 
 * Key concept: Need to make sure logging event handlers fire BEFORE any dom changes take place to get an accurate picture of the DOM at event time.
 * 
 * See relevant stack overflow threads:
 * https://stackoverflow.com/questions/446892/how-to-find-event-listeners-on-a-dom-node-in-javascript-or-in-debugging/6434924#6434924
 * https://stackoverflow.com/questions/77434759/hijacking-addeventlistener-results-in-too-much-recursion-when-adding-a-react-inv/77439399#77439399
 */


if(!Node.prototype.realAddEventListener){ //Deeply important, see 2nd stackoverflow post.
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

