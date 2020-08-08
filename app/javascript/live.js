var live = {
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

live.loadXml = function(refresh) {
    $('#content-scroll').hide();
    var url = Channel.getUrl('live', {refresh:refresh});
    var cbComplete = function(status){loadFinished(status, refresh);};
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
//window.location = 'project.html?ilink=' + ilink;
