var tvKey = new Common.API.TVKeyValue();

var index = 0; // list=0, details=1, player=2, highlights=3, settings=6, imeSearch=7, blocked=8, connection error=9
var lastKey = 0;
var keyHeld = false;
var keyHeldCounter = 0;
var keyTs;
var keyTimer;
var itemSelected;
var resButton = ['#resauto', '#res1', '#res2', '#res3', '#res4', '#res5', '#res6'];
var reslButton = ['#reslauto', '#resl1', '#resl2', '#resl3', '#resl4', '#resl5', '#resl6'];
var langButton = ['#english', '#swedish'];
var channelButton = ['#svt', '#pluto', '#tv4', '#dplay', '#history'];
var menuId = 0;
var menu = [{id:'.language-content .title', button:langButton},
            {id:'.res-content .title', button:resButton},
            {id:'.res-live-content .title', button:reslButton},
            {id:'.channel-content .title', button:channelButton}
           ];
var animateCallbacked = 0;

var Buttons = {
};

Buttons.checkKey = function(limit) {

    var newTs = new Date();
    if (event.keyCode == lastKey) {
        var keyDiff = (keyTs) ? (newTs-keyTs) : 6666;
        // Log('keyDiff:' + keyDiff + ' limit:' + limit);
        if (limit && keyDiff < 600) {
            // Log('ignoring, key repeat too quick.');
            event.preventDefault(event);
            return -1;
        }
        if (keyHeld) {
            keyHeldCounter++;
        } else if (!limit || keyHeld === 0) {
            // Log('enableKeyHeld');
            keyHeld = true;
        } else {
            // Log('first key repeat');
            keyHeld = 0;
        }
    }
    keyTs = newTs;

    return 0;
};

Buttons.keyDown = function() {
    // Log('Key Down: ' + event.keyCode + ' index:' + index);

    if (event.keyCode != lastKey)
        Buttons.clearKey();

    Buttons.restartKeyTimer();

    if (Player.restartScreenSaver()) {
        // Screensaver was active ignore key
        switch (event.keyCode) {
        case tvKey.KEY_RETURN:
	    event.preventDefault(event);
        }
        return;
    }

    // Log('index:' + index + ' exit:' + $('#exitBlock').is(':visible') + ' error:' + $('.slider-error').is(':visible'));
    if(index == 2){
	this.keyHandleForPlayer();
    }
    else if($('#exitBlock').is(':visible')) {
        this.keyHandleForExit();
    }
    else if ($('.slider-error').is(':visible') || index == 9) {
	this.keyHandleForConnectionError();
    }
    else if(index == 0){
	this.keyHandleForList();
    }
    else if(index == 1) {
	this.keyHandleForDetails();
    }
    else if(index == 3){
	this.keyHandleForHighlights();
    }
    else if(index == 6){
	this.keyHandleForSettings();
    }
    else if(index == 7){
	this.keyHandleForImeSearch();
    }
    else if(index == 8){
	this.keyHandleForGeofilter();
    }
    lastKey = event.keyCode;
};

Buttons.setKeyHandleID = function(iid){
	index = iid;
};

Buttons.getKeyHandleID = function(){
	return index;
};

Buttons.enableKeys = function() {
    var supportedKeys = tizen.tvinputdevice.getSupportedKeys();
    // alert(supportedKeys);
    for(var i = 0; i < supportedKeys.length; i++) {
        // alert(supportedKeys[i].name);
        // alert(supportedKeys[i].code);
        switch (supportedKeys[i].code) {
        case tvKey.KEY_1:
        case tvKey.KEY_2:
        case tvKey.KEY_3:
        case tvKey.KEY_4:
        case tvKey.KEY_5:
        case tvKey.KEY_6:
        case tvKey.KEY_7:
        case tvKey.KEY_8:
        case tvKey.KEY_9:
        case tvKey.KEY_0:
        case tvKey.KEY_CH_UP:
        case tvKey.KEY_CH_DOWN:
        case tvKey.KEY_FF:
        case tvKey.KEY_RW:
        case tvKey.KEY_PAUSE:
        case tvKey.KEY_PLAY:
        case tvKey.KEY_STOP:
        case tvKey.KEY_INFO:
        case tvKey.KEY_TOOLS:
        case tvKey.KEY_GUIDE:
        case tvKey.KEY_ASPECT:
        case tvKey.KEY_SUBTITLE:
        case tvKey.KEY_SUB_TITLE:
        // case tvKey.KEY_LEFT:
        // case tvKey.KEY_RIGHT:
        // case tvKey.KEY_UP:
        // case tvKey.KEY_DOWN:
        // case tvKey.KEY_ENTER:
        // case tvKey.KEY_BACK:
        case tvKey.KEY_RED:
        case tvKey.KEY_GREEN:
        case tvKey.KEY_YELLOW:
        case tvKey.KEY_BLUE:

            tizen.tvinputdevice.registerKey(supportedKeys[i].name);
            break;

        default:
            // Skip key...
            break;
        }
    }
    document.getElementById('anchor').focus();
};

Buttons.clearKey = function() {
    // Log('clearKey');
    lastKey = 0;
    keyHeld = false;
    keyHeldCounter = 0;
};

Buttons.restartKeyTimer = function() {
    window.clearTimeout(keyTimer);
    keyTimer = window.setTimeout(this.clearKey, 400);
};

Buttons.sscroll = function(hide) {
    // alert('Buttons.sscroll:' + itemCounter + ' margin:' + Buttons.getMargin()); 
    preloadItem(itemSelected);
    $('.content-holder').animate(
        {marginTop: Buttons.getMargin()},
        {complete: function() {
             if (itemCounter && !hide && !$('#content-scroll').is(':visible')) {
                 contentShow();
             }
        }}
    );
};

Buttons.getMargin = function() {
    pageIndex = Math.floor(itemIndex/15);
    return pageIndex*-923;
};

Buttons.refresh = function() {
    $('.content-holder').css({marginTop: Buttons.getMargin()});
};

Buttons.keyHandleForExit = function() {
    var keyCode = event.keyCode;

    switch(keyCode) {
    case tvKey.KEY_RETURN:
	event.preventDefault(event);
        $('#exitBlock').hide();
        break;

    case tvKey.KEY_ENTER:
        tizen.application.getCurrentApplication().hide();
        $('#exitBlock').hide();
        break;
    }
};

Buttons.keyHandleForList = function() {
    if (Buttons.checkKey(true) == -1)
        return;
    
    var itemList = $('.itemlist');
    var keyCode = event.keyCode;

    // Log('Key handled: ' + keyCode + ' lastKey=' + lastKey);
    if (!itemSelected) {
	itemSelected = itemList.eq(0).addClass('selected');
        itemIndex = 0;
    }
    switch(keyCode) {
	case tvKey.KEY_RIGHT:
        itemSelected = nextInList(itemList, itemSelected, 1);
	break;

	case tvKey.KEY_CH_UP:
        case tvKey.KEY_PANEL_CH_UP:
	case tvKey.KEY_FF:
        case tvKey.KEY_FF_:
        itemSelected = nextInList(itemList, itemSelected, 15);
	break;

	case tvKey.KEY_LEFT:
        itemSelected = prevInList(itemList, itemSelected, 1);
	break;

        case tvKey.KEY_CH_DOWN:
        case tvKey.KEY_PANEL_CH_DOWN:
	case tvKey.KEY_RW:
        case tvKey.KEY_REWIND_:
        itemSelected = prevInList(itemList, itemSelected, 15);
	break;

	case tvKey.KEY_DOWN:
        if (keyHeld)
            itemSelected = nextInList(itemList, itemSelected, 15);
        else
            itemSelected = nextInList(itemList, itemSelected, 5);
        break;

	case tvKey.KEY_UP:
        if (keyHeld)
            itemSelected = prevInList(itemList, itemSelected, 15);
        else
            itemSelected = prevInList(itemList, itemSelected, 5);
	break;
	case tvKey.KEY_INFO:
	case tvKey.KEY_ENTER:
	case tvKey.KEY_PANEL_ENTER:
        case tvKey.KEY_PLAY:
	var ilink = itemSelected.find('.ilink').attr('href');
        if (ilink != undefined) {
            if (ilink.match('upcoming.html'))
                return;

            if (Buttons.isPlayable(ilink)) {
                if (keyCode != tvKey.KEY_INFO) {
                    Buttons.playItem();
                    return;
                }
            } else if (keyCode == tvKey.KEY_INFO && Buttons.hasDetails(ilink)) {
                // Info of show/category.
                ilink = 'details.html?' + ilink;
            } else if (keyCode == tvKey.KEY_INFO) {
                // Info of non-episode/show, not relevant.
                return;
            }
	    return setLocation(ilink);
        } else {
	    itemSelected.removeClass('selected');
            itemSelected = false;
        }
	break;

        default:
            this.handleMenuKeys(keyCode);
            return;

    }
    this.sscroll();
};

function skipUpcoming() {
    if (!myPos && itemIndex==0 && items.length > 0 && items[0].is_upcoming) {
        for (var i=1; i < items.length; i++) {
            if (!items[i].is_upcoming) {
                selectItemIndex(i);
                myPos = Channel.savePosition({index   : itemIndex,
                                              section : htmlSection
                                             });
                break;
            }
        }
    }
}

function selectItemIndex(i) {
    itemIndex = i;
    if (items.length >= 15*(MAX_PAGES+1)) {
        htmlSection = getInitialSection();
        while (itemIndex >= htmlSection.load_next && htmlSection.load_next > 0) {
            getNextSection();
            itemIndex = i - htmlSection.index;
        }
    } else
        htmlSection = null;
    alert('i:' + i + ' itemIndex:' + itemIndex + ' htmlSection:' + JSON.stringify(htmlSection));
}

function checkLoadNextSection(index, steps, noLoad) {
    var reloaded = false;
    if (htmlSection) {
        if (htmlSection.load_next && (index+steps) >= htmlSection.load_next) {
            !noLoad && loadNextSection();
            reloaded = true;
        } else if (index==0 && steps==0) {
            !noLoad && loadNextSection();
            reloaded = true;
        }
    }

    if (!noLoad && reloaded) {
        if (detailsOnTop)
            refreshSectionInHistory();
    }

    return reloaded;
}

function checkLoadPriorSection(index, steps, noLoad) {
    var reloaded = false;

    if (htmlSection) {
        if (index == 0 && steps==0) {
            !noLoad && loadPriorSection();
            reloaded = true;
        } else if (index > 0 && index-steps < 0) {
            !noLoad && loadPriorSection();
            reloaded = true;
        }
    }

    if (!noLoad && reloaded) {
        if (detailsOnTop)
            refreshSectionInHistory();
    }

    return reloaded;
}

function nextInList(itemList, itemSelected, steps) {
    var maxIndex = itemList.length-1;
    var actualMaxIndex = (htmlSection) ? items.length-1-htmlSection.index : maxIndex;
    // alert('nextInList itemIndex:' + itemIndex + ' maxIndex:' + maxIndex);
    if (steps == 1) {
        if ((itemIndex % 5) == 4 || !(itemSelected.next()).length) {
            return movePrev(itemSelected, (itemIndex % 5));
        } else {
            return moveNext(itemSelected, steps);
        }
    } else if (steps == 5 || steps == 15) {
        // Next Line
        if ((itemIndex + steps) <= actualMaxIndex)
            return moveNext(itemSelected, steps);
        else if (Math.floor(itemIndex/5) != Math.floor(maxIndex/5))
            // Not on same line - swith to last item
            return moveNext(itemSelected, maxIndex-itemIndex);
        else if (itemIndex > 4) {
            // We're on same and last line, move to first line instead
            return moveNext(itemSelected, 0, itemIndex%5);
        } else
            return itemSelected;
    } else {
        return moveNext(itemSelected, steps);
    }
}

function moveNext(itemSelected, steps, newItemIndex) {
    return moveToItem(itemSelected, steps, newItemIndex);
}

function moveToItem(itemSelected, steps, newItemIndex) {
    itemSelected.removeClass('selected');
    if (htmlSection) {
        if (htmlSection.load_next==0 && steps==0) {
            loadNextSection(true);
        } else if (htmlSection.index==0 && steps==0) {
            loadPriorSection(true);
        } else if (htmlSection.load_next && (itemIndex+steps) >= htmlSection.load_next) {
            loadNextSection();
        } else if (itemIndex+steps < 0) {
            loadPriorSection();
        }
    } else if (steps == 0 && newItemIndex >= 0)
        itemIndex = newItemIndex;
    itemIndex = itemIndex+steps;
    itemSelected = $('.itemlist').eq(itemIndex);
    return itemSelected.addClass('selected');
}

function prevInList(itemList, itemSelected, steps) {
    // alert("itemIndex:" + itemIndex + " itemList:" + itemList.length);
    var maxIndex = itemList.length-1;
    var actualIndex = (htmlSection) ? htmlSection.index+itemIndex : itemIndex;
    if (steps == 1 && (itemIndex % 5) == 0) {
        return moveNext(itemSelected, Math.min(4, maxIndex-itemIndex));
    } else if (steps == 5 || steps == 15) {
        // Previous Line        
        if ((actualIndex - steps) >= 0)
            return movePrev(itemSelected, steps); 
        else if (maxIndex > 4) {
            // We're on first line, move to last line instead
            var newItemIndex = GetLastRowIndex(itemIndex%5, maxIndex);
            return movePrev(itemSelected, 0, newItemIndex);
        }
        else
            return itemSelected;
    
    } else {
        return movePrev(itemSelected, steps);
    }
}

function movePrev(itemSelected, steps, newItemIndex) {
    return moveToItem(itemSelected, -steps, newItemIndex);
}

Buttons.keyHandleForDetails = function() {

    if (Buttons.checkKey(true) == -1)
        return;

    var keyCode = event.keyCode;
    switch(keyCode) {

    case tvKey.KEY_DOWN:
        if($('#extraButton').is(':visible')) {
	    $('#extraButton').addClass('selected');
	    $('#playButton').removeClass('selected');
	    $('#enterShowButton').removeClass('selected');
        }
	break;

    case tvKey.KEY_UP:
        if($('#extraButton').is(':visible') &&
           !$('#notStartedButton').is(':visible')) {
	    $('#extraButton').removeClass('selected');
            if ($('#playButton').is(':visible'))
                $('#playButton').addClass('selected');
            else if ($('#enterShowButton').is(':visible'))
                $('#enterShowButton').addClass('selected');
        }
        break;

    case tvKey.KEY_ENTER:
    case tvKey.KEY_PANEL_ENTER:
	if ($('#enterShowButton').hasClass('selected')) {
	    setLocation(itemSelected.find('.ilink').attr('href'));
	} else if ($('#playButton').hasClass('selected')) {
	    Details.startPlayer();
	} else if ($('#extraButton').hasClass('selected')) {
            setLocation($('#extraButton').attr('href'));
        }
	break;

    case tvKey.KEY_PLAY:
        if($('#playButton').is(':visible')) {
            Details.startPlayer();
        }
	break;

    case tvKey.KEY_INFO:
	goBack();
	break;

    case tvKey.KEY_CH_UP:
    case tvKey.KEY_PANEL_CH_UP:
    case tvKey.KEY_FF_:
    case tvKey.KEY_RIGHT:
	this.showNextItem(1);
	break;

    case tvKey.KEY_CH_DOWN:
    case tvKey.KEY_PANEL_CH_DOWN:
    case tvKey.KEY_REWIND_:
    case tvKey.KEY_LEFT:
	this.showNextItem(-1);
	break;
    }
    this.handleMenuKeys(keyCode);
};

Buttons.keyHandleForSettings = function() {
    var keyCode = event.keyCode;

    var selected = -1;
    var checked  = -1;
    var button = menu[menuId].button;
    for(var i = 0; i < button.length; i++){
	if($(button[i]).hasClass('selected')){
	    selected = i;
	}
	if($(button[i]).hasClass('checked'))
            checked = i;
    }

    switch(keyCode) {
    case tvKey.KEY_RIGHT:
    case tvKey.KEY_LEFT:
        var newSelected = (keyCode == tvKey.KEY_RIGHT) ? selected+1 : selected-1;
        if (newSelected >= 0 && newSelected < button.length) {
            if (selected != -1) {
	        $(button[selected]).removeClass('selected');
	        $(button[selected]).addClass('unselected');
            }
            selected = newSelected;
	    $(button[selected]).addClass('selected');
	    $(button[selected]).removeClass('unselected');
        }
	break;

    case tvKey.KEY_DOWN:
    case tvKey.KEY_UP:
        var newMenuId = (keyCode == tvKey.KEY_DOWN) ? menuId+1 : menuId-1;
        if (newMenuId  >= 0 && newMenuId < menu.length) {
            if (selected != -1) {
	        $(button[selected]).removeClass('selected');
	        $(button[selected]).addClass('unselected');
            }
            $(menu[menuId].id).removeClass('stitle');
	    menuId=newMenuId;
            $(menu[menuId].id).addClass('stitle');

            if (selected != -1) {
                button = menu[menuId].button;
                if (selected < button.length)
                    $(button[selected]).addClass('selected');
                else
                    $(button[button.length-1]).addClass('selected');
            }
        }
	break;

    case tvKey.KEY_ENTER:
    case tvKey.KEY_PANEL_ENTER:
        if (selected != -1) {
            if (checked != -1)
                $(button[checked]).removeClass('checked');
            $(button[selected]).addClass('checked');
            $(button[selected]).addClass('selected');
            switch (menuId) {
            case 0:
	        if(selected == 1)
	            Language.setLanguage('Swedish');
                else
                    Language.setLanguage('English');
	        Language.setLang();
                break;
            case 1:
                Resolution.setRes(selected);
                break;
            case 2:
                Resolution.setLiveRes(selected);
                break;
            case 3:
                Language.hide();
                Channel.setUnCheckedChannelText($(button[checked]));
                setChannel(eval($(button[selected]).attr('channel')),
                           $(button[selected]).attr('id'));
                Channel.setCheckedChannelText($(button[selected]));
                break;
            }
        }
	break;

    }
    this.handleMenuKeys(keyCode);
};

Buttons.keyHandleForImeSearch = function() {
};

Buttons.keyHandleForPlayer = function() {
    Buttons.checkKey();
    var keyCode = event.keyCode;

    var longMinutes = Math.floor(keyHeldCounter/10) + 1;

    switch(keyCode) {
    case tvKey.KEY_RIGHT:
        Player.skipLongForwardVideo(longMinutes);
	break;
    case tvKey.KEY_LEFT:
        Player.skipLongBackwardVideo(longMinutes);
	break;
    case tvKey.KEY_RW:
	Player.skipBackwardVideo();
	break;
    case tvKey.KEY_PAUSE:
	Player.togglePause();
	break;
    case tvKey.KEY_ENTER:
	Player.keyEnter();
	break;
    case tvKey.KEY_FF:
	Player.skipForwardVideo();
	break;
    case tvKey.KEY_CH_UP:
    case tvKey.KEY_PANEL_CH_UP:
    case tvKey.KEY_FF_:
	this.playNextItem(1);
	break;
    case tvKey.KEY_CH_DOWN:
    case tvKey.KEY_PANEL_CH_DOWN:
    case tvKey.KEY_REWIND_:
	this.playNextItem(-1);
	break;
    case tvKey.KEY_PLAY:
	Player.resumeVideo();
	break;
    case tvKey.KEY_STOP:
	Player.stopVideo();
	break;
    case tvKey.KEY_RETURN:
	event.preventDefault(event);
        Player.keyReturn();
	break;
    case tvKey.KEY_EXIT:
        //Internet/Smart Hub
    case tvKey.KEY_INFOLINK:
    case tvKey.KEY_HOME:
    case tvKey.KEY_12:
	Player.stopVideo();
	// Terminated by force
	break;
    case tvKey.KEY_INFO:
	Player.showDetails();
	break;
    case tvKey.KEY_TOOLS:
    case tvKey.KEY_GUIDE:
        event.preventDefault(event);
	Player.showHelp();
	break;
    case tvKey.KEY_RED:
	Player.toggleRepeat();
	break;
    case tvKey.KEY_GREEN:
    case tvKey.KEY_MTS:
	Player.toggleAudio();
	break;
    case tvKey.KEY_BLUE:
    case tvKey.KEY_ASPECT:
    case tvKey.KEY_CALLER_ID:
    case tvKey.KEY_D_VIEW_MODE:
	Player.toggleAspectRatio();
	break;
    case tvKey.KEY_YELLOW:
    case tvKey.KEY_SUBTITLE:
    case tvKey.KEY_SUB_TITLE:
	Subtitles.toggle();
	break;

    case tvKey.KEY_UP:
        if (Player.showHighlights()) {
            return Buttons.setKeyHandleID(3);
        }
    case tvKey.KEY_DOWN:
        if (Player.isZoomAspect()) {
            Player.changeZoom(keyCode == tvKey.KEY_UP);
        } else {
	    Subtitles.move(keyCode == tvKey.KEY_UP);
        }
	break;

    case tvKey.KEY_2:
    case tvKey.KEY_8:
	Subtitles.size(keyCode == tvKey.KEY_2);
	break;

    case tvKey.KEY_4:
    case tvKey.KEY_6:
	Subtitles.separate(keyCode == tvKey.KEY_6);
	break;
    default:
        Log('Unhandled key:' + keyCode);
    }
};

Buttons.keyHandleForHighlights = function() {
    Buttons.checkKey();
    switch(event.keyCode) {
    case tvKey.KEY_RIGHT:
        Player.nextHighlight();
	break;
    case tvKey.KEY_LEFT:
        Player.previousHighlight();
	break;
    case tvKey.KEY_PAUSE:
	Player.togglePause();
	break;
    case tvKey.KEY_ENTER:
    case tvKey.KEY_PLAY:
	Player.selectHighlight();
	break;
    case tvKey.KEY_STOP:
    case tvKey.KEY_EXIT:
        //Internet/Smart Hub
    case tvKey.KEY_INFOLINK:
    case tvKey.KEY_HOME:
    case tvKey.KEY_12:
	Player.stopVideo();
	// Terminated by force
	break;
    case tvKey.KEY_INFO:
        Player.exitHighlights();
	Player.showDetails();
	break;
    case tvKey.KEY_TOOLS:
	event.preventDefault(event);
        Player.exitHighlights();
	Player.showHelp();
	break;
    case tvKey.KEY_RETURN:
	event.preventDefault(event);
    case tvKey.KEY_DOWN:
        Player.exitHighlights();
	break;
    default:
        Log('Unhandled key:' + event.keyCode);
    }
};

Buttons.keyHandleForGeofilter = function() {
	var keyCode = event.keyCode;
	switch(keyCode) {

		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
	                history.go(-1);
			break;

	}
	this.handleMenuKeys(keyCode);

};

Buttons.keyHandleForConnectionError = function() {
	var keyCode = event.keyCode;
	switch(keyCode) {

		case tvKey.KEY_ENTER:
		case tvKey.KEY_PANEL_ENTER:
			// location.reload(true);
			break;
	}
	this.handleMenuKeys(keyCode);

};

Buttons.handleMenuKeys = function(keyCode){
    switch(keyCode) {
    case tvKey.KEY_RED:
        Channel.keyRed();
	break;
    case tvKey.KEY_GREEN:
        Channel.keyGreen();
	break;
    case tvKey.KEY_YELLOW:
        Channel.keyYellow();
	break;
    case tvKey.KEY_BLUE:
	Channel.keyBlue();
	break;
    case tvKey.KEY_RETURN:
	event.preventDefault(event);
	// var urlpath = myLocation;
	// var ifound = urlpath.indexOf('index.html');
	if(index == 6 || $('.slider-language').is(':visible')){
	    Language.hide();
	}
	else if(index == 9 || $('.slider-error').is(':visible')) {
            ConnectionError.show(true);
        }
        else if(myHistory.length > 0) {
	    // else if(ifound < 0){
	    goBack();
	}
	else{
            $('#exitBlock').show();
	}
	break;
    case tvKey.KEY_EXIT:
    case tvKey.KEY_INFOLINK:
    case tvKey.KEY_HOME:
    case tvKey.KEY_MENU:
    case tvKey.KEY_PANEL_MENU:
    case tvKey.KEY_12:
    case tvKey.KEY_DISC_MENU:
	// Terminated by force
	break;
    case tvKey.KEY_TOOLS:
    case tvKey.KEY_GUIDE:
	event.preventDefault(event);
	Search.hide();
	Language.show();
	break;
    case tvKey.KEY_0:
        Buttons.changeChannel(History);
        break;
    case tvKey.KEY_1:
        Buttons.changeChannel(Svt);
        break;
    case tvKey.KEY_2:
        Buttons.changeChannel(Svt);
        break;
    case tvKey.KEY_3:
    case tvKey.KEY_6:
    case tvKey.KEY_8:
        Buttons.changeChannel(Pluto);
        break;
    case tvKey.KEY_4:
        Buttons.changeChannel(Tv4);
        break;
    case tvKey.KEY_5:
    case tvKey.KEY_9:
        Buttons.changeChannel(Dplay);
        break;
    }
};

Buttons.changeChannel = function (channel, preview) {
    var oldButton, newButton;
    for(var i=0; i < channelButton.length; i++) {
        if ($(channelButton[i]).hasClass('checked')) {
            oldButton = $(channelButton[i]);
        } else if (eval($(channelButton[i]).attr('channel')) == channel) {
            newButton = $(channelButton[i]);
        }
    }
    if (!newButton)
        newButton = oldButton;

    Language.hide();
    oldButton.removeClass('checked');
    Channel.setUnCheckedChannelText(oldButton);
    setChannel(channel, newButton.attr('id'), preview);
    Channel.setCheckedChannelText(newButton);
    newButton.addClass('checked');
};

Buttons.playItem = function() {
    var duration     = itemSelected.find('.ilink').attr('data-length');
    var isLive       = (itemSelected.find('.ilink').attr('is-live') != null);
    var notAvailable = (itemSelected.find('.ilink').attr('not-yet-available') != null);
    var start        = 0;
    var itemLink     = itemSelected.find('.ilink').attr('href');

    if (notAvailable) {
        // Not available yet
        return -1;
    }
    if (isLive) {
        if (itemSelected.html().indexOf('bottomoverlay') == -1) {
            start = itemSelected.find('a').text().match(/([0-9][0-9][:.][0-9]+)-[0-9]/);
            start = (start) ? start[1] : 0;
        } else if (itemSelected.html().indexOf('bottomoverlayred') != -1) {
            start = itemSelected.html().match(/bottomoverlayred">[^<]*([0-9][0-9][:.][0-9]+)</);
            start = (start) ? start[1] : 0;
        }
    }
    // Log('isLive:' + isLive + ' start:' + start);
    if (duration.search(/[hsekmin]/) == -1) {
        duration = duration + ' sek';
    }
    Player.setDuration(duration);
    Player.setNowPlaying(itemSelected.find('a').text());
    Player.startPlayer(Buttons.getLinkUrl(itemLink), isLive, start);
    preloadAdjacentItems(true);
    return 0;
};

Buttons.findNextItem = function(play, noLoad) {

    var itemList = $('.itemlist');
    var tmpItemIndex = itemIndex;
    var tmpItem;

    while (true) {
        if (checkLoadNextSection(tmpItemIndex, 1, noLoad))
            return (noLoad) ? -1 : Buttons.findNextItem(play);
        tmpItemIndex = tmpItemIndex+1;
        if (tmpItemIndex < itemList.length)
            tmpItem = itemList.eq(tmpItemIndex);
        else if (!play) {
            tmpItemIndex = 0;
            tmpItem = itemList.eq(tmpItemIndex);
        }
        else
            // There is no more item
            return -1;

        if (tmpItemIndex == 0 && checkLoadNextSection(tmpItemIndex, 0, noLoad)) {
            if (noLoad) return -1;
            itemList = $('.itemlist');
            tmpItem = itemList.eq(tmpItemIndex);
        }

        if (tmpItem.find('.ilink').attr('href') != undefined && 
            (Buttons.isPlayable(tmpItem.find('.ilink').attr('href')) ||
             (tmpItem.find('.ilink').attr('href').search('(showList|categoryDetail).html\\?') != -1 && !play)) &&
            (!play || tmpItem.html().indexOf('not-yet-available') === -1)) {
            return {item:tmpItem, index:tmpItemIndex};
        }
    }
};

Buttons.findPriorItem = function(play, noLoad) {

    var itemList = $('.itemlist');
    var tmpItemIndex = itemIndex;
    var tmpItem;

    while (true) {
        if (checkLoadPriorSection(tmpItemIndex, 1, noLoad))
            return (noLoad) ? -1 : Buttons.findPriorItem(play);
        tmpItemIndex = tmpItemIndex-1;
        if (tmpItemIndex >= 0)
            tmpItem = itemList.eq(tmpItemIndex);
        else if (!play) {
            if (checkLoadPriorSection(0, 0, noLoad)) {
                if (noLoad) return -1;
                itemList = $('.itemlist');
            }
            tmpItemIndex = itemList.length-1;
            tmpItem = itemList.eq(tmpItemIndex);
        }
        else
            // There is no more item
            return -1;
        if (tmpItem.find('.ilink').attr('href') != undefined && 
            (Buttons.isPlayable(tmpItem.find('.ilink').attr('href')) ||
             (tmpItem.find('.ilink').attr('href').search('(showList|categoryDetail).html\\?') != -1 && !play)) &&
            (!play || tmpItem.html().indexOf('not-yet-available') === -1)) {
            return {item:tmpItem, index:tmpItemIndex};
        }
    }
};

Buttons.hasNextItem = function(direction, play) {
    if (direction == 1)
        return this.findNextItem(play, true) != -1;
    else
        return this.findPriorItem(play, true) != -1;
};

Buttons.runNextItem = function(direction, play) {
    var tmpItem;
    if (direction == 1)
        tmpItem = this.findNextItem(play);
    else
        tmpItem = this.findPriorItem(play);
    if (tmpItem != -1) {
        // Start by stopping playback to avoid history storing info about wrong item.
        if (play)
            Player.stopVideo(true);
        itemSelected.removeClass('selected');
        itemIndex = tmpItem.index;
        itemSelected = tmpItem.item;
        itemSelected.addClass('selected');
        this.sscroll(true);
        if (detailsOnTop) {
            // refresh History
            var oldPos = myHistory.pop();
            oldPos.pos.index = tmpItem.index;
            oldPos.pos = Channel.savePosition(oldPos.pos);
            myHistory.push(oldPos);
        }
        if (myLocation.match(/details.html/)) {
            // refresh Details
            myLocation = itemSelected.find('.ilink').attr('href');
            if (myLocation.search('(showList|categoryDetail).html\\?') != -1) {
                // Info of category/show.
                myLocation = 'details.html?' + myLocation;
            }
            Details.refresh(play);
        }
        if (play)
            this.playItem();

    } else {
        // Log('No more items');
        return -1;
    }
};

Buttons.playNextItem = function(direction) {
    return this.runNextItem(direction, true);
};

Buttons.showNextItem = function(direction) {
    if (this.runNextItem(direction, false) != -1)
        loadingStart();
};

Buttons.hasDetails = function(Link) {
    return !Link.match('upcoming.html') && Buttons.isPlayable(Link) ||
        Link.match('categoryDetail.html') ||
        Link.match(/showList.html\?((show_name|tmp_channel_id)=[^&]+&)*name=/);
}

Buttons.isPlayable = function(Link) {
    return Link.search('details.html\\?') != -1;
};

Buttons.getLinkUrl = function(Link) {
    return Link.match(/ilink=(.+)&history/)[1];
};
