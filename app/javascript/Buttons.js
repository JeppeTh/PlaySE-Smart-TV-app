var tvKey = new Common.API.TVKeyValue();

var index = 0; // list = 0, details = 1, player = 2, kanaler = 3, settings = 6, imeSearch = 7, blocked = 8, connection error = 9
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
            widgetAPI.blockNavigation(event);
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
	this.keyHandleForKanaler();
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
    animateCallbacked = 0;
    $('.content-holder').animate(
        {marginLeft: Buttons.getMargin()},
        {complete: function() {
            animateCallbacked = animateCallbacked+1;
            if (itemCounter && !hide && animateCallbacked == 2 && !$('#content-scroll').is(':visible')) {
                contentShow();
            }
        }
        }
    );
};

Buttons.getMargin = function() {
    var xaxis = 0;
    if(columnCounter > 0){
	xaxis = columnCounter - 1;
    }
    xaxis = (-xaxis * 262);
    return xaxis;
};

Buttons.refresh = function() {
    $('.content-holder').css({marginLeft: Buttons.getMargin()});
};

Buttons.keyHandleForExit = function() {
    var keyCode = event.keyCode;

    switch(keyCode) {
    case tvKey.KEY_RETURN:
	widgetAPI.blockNavigation(event);
        $('#exitBlock').hide();
        break;

    case tvKey.KEY_ENTER:
        widgetAPI.sendReturnEvent();
        break;
    }
};

Buttons.keyHandleForList = function() {
    if (Buttons.checkKey(true) == -1)
        return;

    var topItems = $('.topitem');
    var bottomItems = $('.bottomitem');
    var keyCode = event.keyCode;

    // Log('Key handled: ' + keyCode + ' lastKey=' + lastKey);
    if (!itemSelected) {
	itemSelected = topItems.eq(0).addClass('selected');
	columnCounter = 0;
    }
    switch(keyCode) {
    case tvKey.KEY_RIGHT:
        if (keyHeld) {

            itemSelected = nextInList(topItems, bottomItems, itemSelected, 4-(columnCounter%4));
        }
        else {
            itemSelected = nextInList(topItems, bottomItems, itemSelected, 1);
        }
	break;

    case tvKey.KEY_CH_UP:
    case tvKey.KEY_PANEL_CH_UP:
    case tvKey.KEY_FF:
    case tvKey.KEY_FF_:
        itemSelected = nextInList(topItems, bottomItems, itemSelected, 4);
	break;

    case tvKey.KEY_LEFT:
        if (keyHeld) {
            itemSelected = prevInList(topItems, bottomItems, itemSelected, 4-(columnCounter%4));
        }
        else {
            itemSelected = prevInList(topItems, bottomItems, itemSelected, 1);
        }
	break;

    case tvKey.KEY_CH_DOWN:
    case tvKey.KEY_PANEL_CH_DOWN:
    case tvKey.KEY_RW:
    case tvKey.KEY_REWIND_:
        itemSelected = prevInList(topItems, bottomItems, itemSelected, 4);
	break;

    case tvKey.KEY_DOWN:
	if(isTopRowSelected && bottomItems.length > columnCounter){
            isTopRowSelected = false;
	    itemSelected.removeClass('selected');
	    itemSelected = bottomItems.eq(columnCounter).addClass('selected');
	}
	break;

    case tvKey.KEY_UP:
	if (!isTopRowSelected) {
            isTopRowSelected = true;
	    itemSelected.removeClass('selected');
            itemSelected = topItems.eq(columnCounter).addClass('selected');
        }
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
    if (!myPos && columnCounter==0 && items.length > 0 && items[0].is_upcoming) {
        for (var i=1; i < items.length; i++) {
            if (!items[i].is_upcoming) {
                selectItemIndex(i);
                myPos = Channel.savePosition({col     : columnCounter,
                                              top     : isTopRowSelected,
                                              section : htmlSection
                                             });
                break;
            }
        }
    }
}

function selectItemIndex(i) {
    columnCounter = Math.floor(i/2);
    isTopRowSelected = (i % 2 == 0);
    if (items.length >= 8*(MAX_PAGES+1)) {
        htmlSection = getInitialSection();
        var orgColumnCounter = columnCounter;
        while (columnCounter >= htmlSection.load_next_column &&
               htmlSection.load_next_column > 0) {
            getNextSection();
            columnCounter = orgColumnCounter - htmlSection.index/2;
        }
    } else
        htmlSection = null;
    alert('i:' + i + ' col:' + columnCounter + ' top:' + isTopRowSelected + ' htmlSection:' + JSON.stringify(htmlSection));
}

function checkLoadNextSection(column, steps, noLoad) {
    var selected = null;
    if (htmlSection) {
        if (htmlSection.load_next_column != 0) {
            if ((column+steps) >= htmlSection.load_next_column) {
                selected = noLoad || loadNextSection();
            }
        } else if (column==0 && steps==0) {
            selected = noLoad || loadNextSection();
        }
    }

    if (selected) {
        if (!noLoad && detailsOnTop)
            refreshSectionInHistory();
        return {selected: selected,
                top     : $('.topitem'),
                bottom  : $('.bottomitem')
               };
    }

    return null;
}

function checkLoadPriorSection(column, steps, noLoad) {
    var selected = null;

    if (htmlSection) {
        if (htmlSection.load_prior_column > -1) {
            if ((column-steps) < htmlSection.load_prior_column) {
                selected = noLoad || loadPriorSection();
            }
        } else if (steps==0) {
            selected = noLoad || loadPriorSection();
        }
    }

    if (selected) {
        if (!noLoad && detailsOnTop)
            refreshSectionInHistory();
        return {selected: selected,
                top     : $('.topitem'),
                bottom  : $('.bottomitem')
               };
    }

    return null;
}

function nextInList(topItems, bottomItems, itemSelected, steps) {
    var nextLoaded = checkLoadNextSection(columnCounter, steps);
    if (nextLoaded) {
        itemSelected = nextLoaded.selected;
        topItems     = nextLoaded.top;
        bottomItems  = nextLoaded.bottom;
    }
    itemSelected.removeClass('selected');
    var next = itemSelected.next();
    while(--steps > 0 && next.length > 0){
        if ((next.next()).length > 0) {
            columnCounter++;
            itemSelected = next.addClass('selected');
            itemSelected.removeClass('selected');
            next = itemSelected.next();
        }
    }

    if (next.length > 0) {
        columnCounter++;
	itemSelected = next.addClass('selected');
    } else if (isTopRowSelected) {
	itemSelected = topItems.eq(0).addClass('selected');
	columnCounter = 0;
        isTopRowSelected = true;
    } else {
	itemSelected = bottomItems.eq(0).addClass('selected');
	columnCounter = 0;
        isTopRowSelected = false;
    }
    nextLoaded = checkLoadNextSection(columnCounter, 0);
    if (nextLoaded)
        return nextLoaded.selected;
    return itemSelected;
}

function prevInList(topItems, bottomItems, itemSelected, steps) {

    var priorLoaded = checkLoadPriorSection(columnCounter, steps);
    if (priorLoaded) {
        itemSelected = priorLoaded.selected;
        topItems     = priorLoaded.top;
        bottomItems  = priorLoaded.bottom;
    }

    itemSelected.removeClass('selected');
    var prev = itemSelected.prev();
    while(--steps > 0 && prev.length > 0){
        if ((prev.prev()).length > 0) {
            columnCounter--;
            itemSelected = prev.addClass('selected');
            itemSelected.removeClass('selected');
            prev = itemSelected.prev();
        }
    }

    if (prev.length > 0) {
        columnCounter--;
	itemSelected = prev.addClass('selected');
    } else {
        priorLoaded = checkLoadPriorSection(columnCounter, 0);
        if (priorLoaded) {
            itemSelected = priorLoaded.selected.removeClass('selected');
            topItems     = priorLoaded.top;
            bottomItems  = priorLoaded.bottom;
        }
        if (topItems.length > bottomItems.length || isTopRowSelected) {
	    itemSelected = topItems.last().addClass('selected');
	    columnCounter = topItems.length - 1;
            isTopRowSelected = true;
        } else {
	    itemSelected = bottomItems.last().addClass('selected');
	    columnCounter = bottomItems.length - 1;
            isTopRowSelected = false;
        }
    }
    return itemSelected;
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

Buttons.keyHandleForKanaler = function() {
    Log('keyHandleForKanaler!!!');
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
    case tvKey.KEY_VOL_DOWN:
	Log('VOL_DOWN');
	Audio.setRelativeVolume(1);
	break;
    case tvKey.KEY_PANEL_VOL_DOWN:
	Log('VOL_DOWN');
	Audio.setRelativeVolume(1);
	break;
    case tvKey.KEY_VOL_UP:
	Log('VOL_UP');
	Audio.setRelativeVolume(0);
	break;
    case tvKey.KEY_PANEL_VOL_UP:
	Log('VOL_UP');
	Audio.setRelativeVolume(0);
	break;
    case tvKey.KEY_RETURN:
	widgetAPI.blockNavigation(event);
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
        widgetAPI.blockNavigation(event);
	Player.showHelp();
	break;
    case tvKey.KEY_MUTE:
	Audio.toggleMute();
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
	widgetAPI.blockNavigation(event);
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
	widgetAPI.blockNavigation(event);
	Search.hide();
	Language.show();
	break;
    case tvKey.KEY_MUTE:
	Audio.uiToggleMute();
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

Buttons.changeChannel = function (channel) {
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
    setChannel(channel, newButton.attr('id'));
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
    var topItems = $('.topitem');
    var bottomItems = $('.bottomitem');
    var tmpItem;
    var tmpTopSelected = isTopRowSelected;
    var tmpColumnCounter = columnCounter;

    while (true) {
        if (checkLoadNextSection(tmpColumnCounter, 1, noLoad))
            return (noLoad) ? -1 : Buttons.findNextItem(play);
        // First go down if possible
        if(tmpTopSelected) {
            if (bottomItems.length > tmpColumnCounter) {
                tmpTopSelected = false;
                tmpItem = bottomItems.eq(tmpColumnCounter);
            } else if (!play && tmpColumnCounter != 0) {
                // Start from beginning unless playing
                tmpItem = topItems.eq(0);
                tmpColumnCounter = 0;
            } else {
                // There is no more item
                return -1;
            }
        } else {
            // Go Up and right
            tmpTopSelected = true;
            tmpItem = topItems.eq(tmpColumnCounter).next();
            if (tmpItem.length <= 0) {
                // Start from beginning unless playing
                if (!play && tmpColumnCounter != 0) {
                    tmpItem = topItems.eq(0);
                    tmpColumnCounter = 0;
                } else {
                    // There is no more item
                    return -1;
                }
            } else {
                tmpColumnCounter++;
            }
        }
        if (tmpColumnCounter == 0 && checkLoadNextSection(tmpColumnCounter, 0, noLoad)) {
            if (noLoad) return -1;
            topItems = $('.topitem');
            bottomItems = $('.bottomitem');
            tmpItem = topItems.eq(0);
        }
        if (tmpItem.find('.ilink').attr('href') != undefined &&
            (Buttons.isPlayable(tmpItem.find('.ilink').attr('href')) ||
             (tmpItem.find('.ilink').attr('href').search('(showList|categoryDetail).html\\?') != -1 && !play)) &&
            (!play || tmpItem.html().indexOf('not-yet-available') === -1)) {
            return {item:tmpItem, top:tmpTopSelected, col:tmpColumnCounter};
        }
    }
};

Buttons.findPriorItem = function(play, noLoad) {
    var topItems = $('.topitem');
    var bottomItems = $('.bottomitem');
    var tmpItem;
    var tmpTopSelected = isTopRowSelected;
    var tmpColumnCounter = columnCounter;

    while (true) {
        if (checkLoadPriorSection(tmpColumnCounter, 1, noLoad))
            return (noLoad) ? -1 : Buttons.findPriorItem(play);
        // First go up
        if(!tmpTopSelected) {
            // Go Up
            tmpTopSelected = true;
            tmpItem = topItems.eq(tmpColumnCounter);
        } else if (tmpColumnCounter == 0) {
            // At first Item - go to last item unless playing (or the only item).
            if (!play && topItems.length > 1) {
                if (checkLoadPriorSection(tmpColumnCounter, 0, noLoad)) {
                    if (noLoad) return -1;
                    topItems = $('.topitem');
                    bottomItems = $('.bottomitem');
                }
                if (topItems.length > bottomItems.length) {
	            tmpItem = topItems.last();
	            tmpColumnCounter = topItems.length - 1;
                    tmpTopSelected = true;
                } else {
	            tmpItem = bottomItems.last();
	            tmpColumnCounter = bottomItems.length - 1;
                    tmpTopSelected = false;
                }
            } else {
                return -1;
            }
        } else {
            // Go left and down
            tmpColumnCounter--;
            tmpTopSelected = false;
            tmpItem = bottomItems.eq(tmpColumnCounter);
        }
        if (tmpItem.find('.ilink').attr('href') != undefined &&
            (Buttons.isPlayable(tmpItem.find('.ilink').attr('href')) ||
             (tmpItem.find('.ilink').attr('href').search('(showList|categoryDetail).html\\?') != -1 && !play)) &&
            (!play || tmpItem.html().indexOf('not-yet-available') === -1)) {
            return {item:tmpItem, top:tmpTopSelected, col:tmpColumnCounter};
        }
    }
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
        columnCounter = tmpItem.col;
        isTopRowSelected = tmpItem.top;
        itemSelected = tmpItem.item;
        itemSelected.addClass('selected');
        this.sscroll(true);
        if (detailsOnTop) {
            // refresh History
            var oldPos = myHistory.pop();
            oldPos.pos.col=tmpItem.col;
            oldPos.pos.top=tmpItem.top;
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
