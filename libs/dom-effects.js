(function(){

    console.log("dom-effects ran!")

    const rootFields = [
        "outerHTML",
        "outerText"
    ]

    const nodeFields = [
        "async",
        "baseURI",
        "childElementCount",
        "className",
        "clientHeight",
        "clientLeft",
        "clientTop",
        "clientWidth",
        "id",
        "nodeName",
        "localName",
        "outerHTML",
        "innerHTML",
        "outerText",
        "textContent",
        "title",
        "type",
        "text"
    ]


    /**
     * https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
     * @param {*} element 
     * @returns true if hidden
     */
    const isHidden = function(element){
        //TODO: fix for elements with postion: fixed.
        return (element.offsetParent === null)
    }

    /**
     * Returns a filtered snapshot of the DOM 
     */
    const captureDOMSnapshot = function(){
        //document.querySelectorAll('*').forEach(node=>node.setAttribute('_odo_isHidden', isHidden(node)))

        const fullHtml = document.documentElement.outerHTML
        const scriptRegex = /<script[\s\S]*?>[\s\S]*?<\/script>/gi //https://stackoverflow.com/questions/16585635/how-to-find-script-tag-from-the-string-with-javascript-regular-expression
        const noScripts = fullHtml.replaceAll(scriptRegex, "") //Clear all scripts.
        const xmlCharacterDataRegex = /<!\[CDATA[\s\S]*\]\]>/gi 
        const noXMLCDATA = noScripts.replaceAll(xmlCharacterDataRegex, "") //Clear all XML character data
        const styleRegex = /<style[\s\S]*?>[\s\S]*?<\/style>/gi
        const noStyle = noXMLCDATA.replaceAll(styleRegex, "") //Clear all css styles
        const svgPathsRegex = /<path[\s\S]*?>[\s\S]*?<\/path>/gi
        const noSvgPaths = noStyle.replaceAll(svgPathsRegex, "") //Clear all paths inside SVGs

        let result = {
            outerHTML: noSvgPaths, 
            outerText: document.documentElement.outerText
        }

        return JSON.stringify(result)

    }

    // Generating XPath
    // https://stackoverflow.com/questions/3454526/how-to-calculate-the-xpath-position-of-an-element-using-javascript
    const getElementTreeXPath = function(element)
        {
            var paths = [];  // Use nodeName (instead of localName) 
            // so namespace prefix is included (if any).
            for (; element && element.nodeType == Node.ELEMENT_NODE; 
                element = element.parentNode)
            {
                var index = 0;
                var hasFollowingSiblings = false;
                for (var sibling = element.previousSibling; sibling; 
                    sibling = sibling.previousSibling)
                {
                    // Ignore document type declaration.
                    if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE)
                        continue;

                    if (sibling.nodeName == element.nodeName)
                        ++index;
                }

                for (var sibling = element.nextSibling; 
                    sibling && !hasFollowingSiblings;
                    sibling = sibling.nextSibling)
                {
                    if (sibling.nodeName == element.nodeName)
                        hasFollowingSiblings = true;
                }

                var tagName = (element.prefix ? element.prefix + ":" : "") 
                                + element.localName;
                var pathIndex = (index || hasFollowingSiblings ? "[" 
                        + (index + 1) + "]" : "");
                paths.splice(0, 0, tagName + pathIndex);
            }

            return paths.length ? "/" + paths.join("/") : null;
        };

    // Helper function that strips data from fields listed in nodeFields and returns them in an object
    const stripDataFromNode = function(node, index){
        const data = {}

        //Also report XPATH
        data.xpath = getElementTreeXPath(node)
        if (data.xpath === null){
            return data // Don't bother doing any extra work for null xpath nodes
        }

        for (const property in node){
            if (nodeFields.includes(property)){
                data[property] = node[property]
            }
        }

        return data
    }

    // Helper function that strips data from list of nodes and returns stripped data in a list.
    const stripDataFromNodes = function(nodes){
        const data = []
        nodes.forEach((node)=>{
            // Don't bother getting data for elements with null xpath
            const nodeData = stripDataFromNode(node)
            if (nodeData.xpath !== null){
                data.push(stripDataFromNode(node, data.length))
            }

        })
        return data
    }


    /* Following the documentation from: 
     * https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
     */


    
    const observerOptions = {
        childList: true,
        attributes: true,
        attributeFilter: ['style'],
        characterData: true,
        subtree: true
    }

    /**
     * Whether an added node is worth reporting: an element or text node that is attached to the page (pages often
     * build templates off-document before inserting them, and those additions can't be located in the page), not a
     * script or style element, and not inside another node added in the same batch (that node's HTML already
     * contains it).
     */
    const isReportableAddition = function(node, addedSet){
        if(!node.isConnected) return false
        if(node.localName === 'script' || node.localName === 'style') return false
        for(let parent = node.parentNode; parent; parent = parent.parentNode){
            if(addedSet.has(parent)) return false
        }
        return true
    }

    /**
     * One DOM_EFFECT per action ('remove', 'add', 'show', 'hide') per observer callback, rather than one per mutation
     * record, all sharing one page snapshot: the DOM can't change while a callback runs, so every record of a callback
     * would get the same snapshot anyway. A page that renders hundreds of nodes at once used to produce hundreds of
     * events, each with a full-page copy, in one burst.
     *
     * Each event lists its nodes in mutation order, so the first node (the one OdoBot maps) is the first, top-most
     * change of the batch.
     */
    const callback = (mutationList, observer) => {

        const removed = []
        const added = []
        const shown = []
        const hidden = []

        for (const mutation of mutationList){
            /**
             * Watch for changes in the style attribute of elements, specifically for the 'isHidden' property.
             * If 'isHidden' has changed since last we saw it, report a 'show' or 'hide'.
             */
            if (mutation.type === 'attributes' && isHidden(mutation.target) !== mutation.target.isHidden){
                const nowHidden = isHidden(mutation.target)
                ;(nowHidden? hidden : shown).push(mutation.target)
                mutation.target.isHidden = nowHidden
            }

            if (mutation.type === "childList"){
                mutation.addedNodes.forEach(node=>added.push(node))
                mutation.removedNodes.forEach(node=>removed.push(node))

                //Remember whether added elements are hidden, so later 'style' mutations can report 'show' and 'hide'.
                Array.from(mutation.addedNodes)
                    .filter(node=>node instanceof Element)
                    .forEach(element=>{
                        element.isHidden = isHidden(element)
                    })
            }
        }

        //Ensure LogUI is defined and active.
        if(!(window.LogUI && window.LogUI.isActive())){
            return
        }

        const addedSet = new Set(added)
        const batches = [
            ['remove', removed.filter(node=>node.localName !== 'script' && node.localName !== 'style')],
            ['add', added.filter(node=>isReportableAddition(node, addedSet))],
            ['show', shown],
            ['hide', hidden]
        ]

        let snapshot = null
        for(const [action, nodes] of batches){
            const nodeData = stripDataFromNodes(nodes)
            if(nodeData.length === 0){
                continue
            }

            const eventDetails = {
                name: 'DOM_EFFECT',
                action: action,
                nodes: nodeData
            }
            // If there's only one node, move the xpath field out into eventDetails for convenience
            if(nodeData.length === 1){
                eventDetails.xpath = nodeData[0].xpath
            }

            //One snapshot per callback, taken only when there is something to report.
            if(snapshot === null){
                snapshot = captureDOMSnapshot()
            }
            eventDetails.domSnapshot = snapshot

            //Stringify nodes before we send it
            eventDetails.nodes = JSON.stringify(eventDetails.nodes)

            window.LogUI.logCustomMessage(eventDetails)
        }
    }

    const observer = new MutationObserver(callback);

    //Try and set up 'old' isHidden values for as many elements as we can. 
    document.querySelectorAll('*').forEach(node=>{
        node.isHidden = node.offsetParent === null
    })

    /* Getting the root element on the page
     * https://developer.mozilla.org/en-US/docs/Web/API/Document/documentElement
     */
    observer.observe(document.documentElement, observerOptions)


})(window)