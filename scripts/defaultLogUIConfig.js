const _defaultConfig = {
    logUIConfiguration: {
        endpoint: 'ws://localhost:8000/ws/endpoint/',
        authorisationToken: '',
        /* Verbose LogUI logs every event object to the console, and Firefox keeps every logged object alive for the
         * console, whether or not devtools are open. With full-page DOM snapshots in DOM_EFFECT events that held
         * gigabytes in the page during busy pages, so it stays off. */
        verbose: false
    },
    odoSettings: {
      captureSetContent: false
    },
    applicationSpecificData: {
        userID: 123,
    },
    browserEvents: {
      trackCursor: false,
      URLChanges: false,
      contextMenu: false,
      pageFocus: false,
      pageResize: false
    },
    trackingConfiguration: {
        /* Clicks on any element. LogUI logs a click once, for the innermost element on its path that a click group
         * tracks; with '*' that is the clicked element itself. */
        'element-clicks': {
          selector: '*',
          event: 'click',
          name: 'ELEMENT_CLICK',
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
        /* Clicks not to log: on elements whose interaction is captured as another event (data entry into inputs and
         * textareas, option selection in selects, the labels of such controls, typing in an inline TinyMCE editor).
         * These groups keep the elements tracked for click, so the nearest '*' ancestor does not log the click
         * instead, and LogUI skips groups with ignore: true. Submit and button inputs are left to '*'.
         * Each selector is more specific than '*', which is how LogUI picks these groups over it. LogUI's specificity
         * library throws on selectors containing a comma, so keep one selector per group. */
        'ignore-input-clicks': {
          selector: 'input:not([type="submit"]):not([type="button"])',
          event: 'click',
          ignore: true
        },
        'ignore-textarea-clicks': {
          selector: 'textarea',
          event: 'click',
          ignore: true
        },
        'ignore-select-clicks': {
          selector: 'select',
          event: 'click',
          ignore: true
        },
        'ignore-option-clicks': {
          selector: 'option',
          event: 'click',
          ignore: true
        },
        'ignore-optgroup-clicks': {
          selector: 'optgroup',
          event: 'click',
          ignore: true
        },
        /* Labels, and anything inside one. Clicking a label makes the browser click its control as well, and what the
         * control does with that (the text entered, the box checked, the option chosen) is captured as that control's
         * own event, so the label click would duplicate the interaction. A label with no control does nothing on click.
         * 'label *' includes links inside a label (e.g. a terms link in a consent checkbox's label); their clicks are
         * not logged either. */
        'ignore-label-clicks': {
          selector: 'label',
          event: 'click',
          ignore: true
        },
        'ignore-label-content-clicks': {
          selector: 'label *',
          event: 'click',
          ignore: true
        },
        'ignore-tinymce-body-clicks': {
          selector: '.mce-content-body',
          event: 'click',
          ignore: true
        },
        'ignore-tinymce-content-clicks': {
          selector: '.mce-content-body *',
          event: 'click',
          ignore: true
        },
        'select-data': {
          selector: 'select',
          event: 'change',
          name: 'SELECT',
          metadata: [
            {
              nameForLog: 'idAttribute',
              sourcer: 'elementAttribute',
              lookFor: 'id'
            }
          ]
        },
        'textarea-data': {
          selector: 'textarea',
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