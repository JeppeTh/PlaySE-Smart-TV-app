var widgetAPI = new Common.API.Widget();
var pluginAPI = new Common.API.Plugin();
var MAX_WIDTH   = 960;
var MAX_HEIGHT  = 540;
var LINE_LENGTH = 45;
var THUMB_WIDTH = 240;
var THUMB_HEIGHT = 135;
var DETAILS_THUMB_FACTOR = 600/THUMB_WIDTH;
var BACKGROUND_THUMB_FACTOR = MAX_WIDTH/THUMB_WIDTH;
var recommendedLinks = [];
var isEmulator = false;
var deviceYear  = null;
var Main = {
    loaded         : false,
    clockTimer     : null
};

Main.onLoad = function(refresh) {
    Config.init();
    Channel.init();
    Language.fixAButton();
    if (!refresh) {
        document.title = Channel.getMainTitle();
	Header.display(document.title);
    }
    if (!this.loaded) {
        $('#page-cover').hide();
        var model = document.getElementById('pluginObjectDEVICE').GetRealModel();
        isEmulator = (model === 'VALENCIA' || model === 'SDK' || !model);
        if (!isEmulator)
            // Cache Viasat since slow
            httpRequest(Viasat.getMainUrl());
        deviceYear = getDeviceYear();
        if (deviceYear > 2011)
            LINE_LENGTH = 36;
        Log('Model:' + model +  ' DeviceYear:' + deviceYear + ' IsEmulator:' + isEmulator + ' curWidget:' + curWidget.name + ' Cookies:' + document.cookie);
        loadingStart();
        Main.setClock();
        checkDateFormat();
        this.loaded = true;
	Audio.init();
	Audio.showMuteFooter();
	Search.init();
	Language.init();
	ConnectionError.init();
	widgetAPI.sendReadyEvent();
        pluginAPI.registIMEKey();
	Language.setLang();
	Resolution.displayRes();
        Player.enableScreenSaver();
        setOffsets();
        fixCss();
	this.loadXml(refresh);	
	// Enable key event processing
	Buttons.enableKeys();
    } else if (!detailsOnTop) {
	this.loadXml(refresh);	
    }
};

Main.onUnload = function() {
	Player.remove();
};

Main.setClock = function() {
    window.clearTimeout(Main.clockTimer);
    Main.clockTimer = setClock($('#footer-clock'), Main.setClock);
};

Main.loadXml = function(refresh){
    $('#content-scroll').hide();
    Channel.login(
        function() {
            var url = Channel.getUrl('main', {refresh:refresh});
            var cbComplete = function(status){loadFinished(status, refresh);};
            requestUrl(url,
                       function(status, data) {
                           Channel.decodeMain(data, 
                                              {url:url, 
                                               refresh:refresh,
                                               cbComplete:function(){cbComplete(status);}
                                              });
                           data = null;
                       },
                       {cbError:function(status){cbComplete(status);},
                        headers:Channel.getHeaders()
                       });
        }
    );
};
