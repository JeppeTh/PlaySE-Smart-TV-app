var tvKey = new Common.API.TVKeyValue();
var input = null;
var search_text = '';

var oldKeyHandle = 0;
var Search = {};

function Input(id) {
    function imeReady() {
        installFocusKeyCallbacks();
        installStatusCallbacks();
        // document.getElementById(id).focus()
        Search.imeReady();
    }
    var self = this;
    var ime = new IMEShell(id, imeReady, 'sv');
    var element = document.getElementById( id );
    function installFocusKeyCallbacks() {
        ime.setEnterFunc(onEnter);
        ime.setKeyFunc(tvKey.KEY_RETURN, onReturn);
        ime.setKeyFunc(tvKey.KEY_EXIT, onReturn);
        ime.setKeyFunc(tvKey.KEY_RED,  onRed);
    }

    function installStatusCallbacks() {
        // ime.setKeySetFunc('12key'); 
        if (deviceYear > 2011)
            ime.setKeypadPos(467, 187);
        else {
            ime.setKeypadPos(467, 210);
            ime.setWordBoxPos(387, 153);
        }
        // ime.setKeypadPos(350, 169);
        // ime.setQWERTYPos(215, 169);
    }

    function onEnter() {
        Search.imeShow(0);
	setLocation('SearchList.html?sok=' + $('#ime_write').val());
    }

    function onReturn() {
        Search.imeShow();
	return true;
    }

    function onRed() {
        ime.setString('');
        return true;
    }
}

Search.init = function() {
	var ime_html = '<div class="imesearch-content">';
	ime_html += '<div class="input_bg">';
        ime_html += '    <form id="searchForm" onSubmit="return false;">';
	ime_html += '        <input id="ime_write" type="text" class="footer_input" maxlength="256" />';
	ime_html += '    </form>';
	ime_html += '</div>';
	ime_html += '</div>';
	$('.slider-imesearch').html(ime_html);
    return true;
};

Search.imeShow = function(slideDuration) {
    if (slideDuration == undefined)
        // Default value
        slideDuration = 500;

    if(Buttons.getKeyHandleID()!=7){
        oldKeyHandle = Buttons.getKeyHandleID();
        Buttons.setKeyHandleID(7);
        slideToggle($('.slider-imesearch'), slideDuration, function() {
            // Position of input box gets messed up in case focus is called too soon (at least in 2012 simulator).
            if (Buttons.getKeyHandleID() == 7)
                document.getElementById('ime_write').focus();
        });

        // pluginAPI.registIMEKey()
        if(input == null) {
            if (search_text) {
	        $('#ime_write').val(search_text);
            }

            try {
                input = new Input('ime_write');
            }
            catch(err) {
                Search.imeShow();
            }
        }
        else {
            Search.imeReady();
        }
    }
    else{
        slideToggle($('.slider-imesearch'), slideDuration, function() {});
        document.getElementById('ime_write').blur();
        document.body.focus();
        Buttons.setKeyHandleID(oldKeyHandle); 
        Buttons.enableKeys();
    }
};

Search.imeReady = function() {
    // document.getElementById('ime_write').focus();
};

Search.hide = function() {
    if (Buttons.getKeyHandleID()==7){
        Search.imeShow();
    }
};
