var live = {
    refresh_timer : null
};

live.onLoad = function(refresh) {
    if (!refresh) {
        document.title = Channel.getLiveTitle();
	Header.display(document.title);
    }
    if (!detailsOnTop)
	this.loadXml(refresh);
//	widgetAPI.sendReadyEvent();
};

live.loadXml = function(refresh, oldPos) {
    $('#content-scroll').hide();
    var url = Channel.getUrl('live', {refresh:refresh});
    var cbComplete = function(status){
        if (oldPos) myPos = oldPos;
        loadFinished(status, refresh);
        live.startRefresh();
    };
    requestUrl(url,
               function(status, data) {
                   Channel.decodeLive(data,
                                      {url:url,
                                       refresh:refresh,
                                       cbComplete:function(){cbComplete(status);}
                                      });
                   data = null;
               },
               {cbError:cbComplete,
                headers:Channel.getHeaders(),
                no_cache:true
               });
};

live.onUnload = function() {
    Player.remove();
};

live.startRefresh = function() {
    window.clearTimeout(live.refresh_timer);
    if (Channel.useLiveRefresh())
        live.refresh_timer = window.setTimeout(live.refresh, 60*1000);
};

live.refresh = function() {
    var refresh = detailsOnTop;
    if (getIndexLocation().match(/live.html/)) {
        var oldPos = {col     : columnCounter,
                      top     : isTopRowSelected,
                      section : htmlSection
                     };
        $('#topRow').html('');
        $('#bottomRow').html('');
        items = [];
        live.loadXml(refresh, oldPos);
        // Keep htmlSection
    }
};

//window.location = 'project.html?ilink=' + ilink;
