var tvKey = new Common.API.TVKeyValue();
var input = null;
var search_text = '';

var oldKeyHandle = 0;
var Search = {};

function Input(id) {
    function imeReady() {
        installFocusKeyCallbacks(id);
        document.getElementById(id).focus();
        Search.imeReady();
    }
    function installFocusKeyCallbacks(id) {
        document.getElementById(id).addEventListener(
            'keydown',
            function(event) {
                switch (event.keyCode) {
                case tvKey.KEY_ENTER:
                case 65376: // Done
                    onEnter();
                    break;

                case tvKey.KEY_RETURN:
                case tvKey.KEY_EXIT:
                case 65385: // Cancel
                    onReturn();
                    break;

                case tvKey.KEY_RED:
                    onRed();
                    break;

                default:
                    Log('Search Unhandled key:' + event.keyCode);
                }
            });

        // document.getElementById(id).addEventListener('focus', function() {
        //     Log(id + " is focused and ready to get user input.");
        // });
        // document.getElementById(id).addEventListener('blur', function() {
        //     Log(id + " is blurred.");
        // });
        // document.getElementById(id).addEventListener('change', function() {
        //     Log(id + " value is changed.");
        // });
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
    imeReady();
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

    if(Buttons.getKeyHandleID() !=7 ){
        Player.disableScreenSaver();
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
        Player.enableScreenSaver();
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
