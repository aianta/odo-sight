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