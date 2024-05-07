const _defaultConfig = {
    logUIConfiguration: {
        endpoint: 'ws://localhost:8000/ws/endpoint/',
        authorisationToken: '',
        verbose: true
    },
    applicationSpecificData: {
        userID: 123,
    },
    browserEvents: {
      trackCursor: false,
      URLChanges: true,
      contextMenu: false,
      pageFocus: false,
      pageResize: false
    },
    trackingConfiguration: {
        'page-load':{
          selector: 'html',
          event: 'load',
          name: 'PAGE_LOAD'
        },
        'list-item-clicks': {
          selector: 'li',
          event: 'click',
          name: 'LIST_ITEM_CLICK',
          metadata: [
            {
              nameForLog: 'idAttribute',
              sourcer: 'elementAttribute',
              lookFor: 'id'
            },
            {
              nameForLog: 'className',
              sourcer: 'elementProperty',
              lookFor: 'className'
            },
            {
              nameForLog: 'baseURI',
              sourcer: 'elementProperty',
              lookFor: 'baseURI'
            },
            {
              nameForLog: 'nodeName',
              sourcer: 'elementProperty',
              lookFor: 'nodeName'
            }
          ]
        },
        'link-clicks':{
          selector: 'a',
          event: 'click',
          name: 'LINK_CLICK', 
          metadata: [
            {
              nameForLog: 'idAttribute',
              sourcer: 'elementAttribute',
              lookFor: 'id'
            },
            {
              nameForLog: 'className',
              sourcer: 'elementProperty',
              lookFor: 'className'
            },
            {
              nameForLog: 'baseURI',
              sourcer: 'elementProperty',
              lookFor: 'baseURI'
            },
            {
              nameForLog: 'nodeName',
              sourcer: 'elementProperty',
              lookFor: 'nodeName'
            }
          ]
        },
        'table-data-clicks': {
          selector: 'td', 
          event: 'click',
          name: 'TD_CLICK',
          metadata: [
            {
              nameForLog: 'idAttribute',
              sourcer: 'elementAttribute',
              lookFor: 'id'
            },
            {
              nameForLog: 'className',
              sourcer: 'elementProperty',
              lookFor: 'className'
            },
            {
              nameForLog: 'baseURI',
              sourcer: 'elementProperty',
              lookFor: 'baseURI'
            },
            {
              nameForLog: 'nodeName',
              sourcer: 'elementProperty',
              lookFor: 'nodeName'
            }
          ]
        },
        'button-clicks': {
          selector: 'button',
          event: 'click',
          name: "BTN_CLICK",
          metadata: [
            {
              nameForLog: 'idAttribute',
              sourcer: 'elementAttribute',
              lookFor: 'id'
            },
            {
              nameForLog: 'buttonText',
              sourcer: 'elementProperty',
              lookFor: 'innerText'
            },{
              nameForLog: 'outerHTML',
              sourcer: 'elementProperty',
              lookFor: 'outerHTML'
            }
          ]
        },
        'input-data': {
            selector: 'input',
            event: 'input',
            name: 'INPUT_CHANGE',
            metadata: [
              {
                nameForLog: 'idAttribute',
                sourcer: 'elementAttribute',
                lookFor: 'id'
              },
              {
                nameForLog: 'fieldValue',
                sourcer: 'elementProperty',
                lookFor: 'value'
              },
              {
                nameForLog: 'outerHTML',
                sourcer: 'elementProperty',
                lookFor: 'outerHTML'
              }
            ]
        }
    },
}