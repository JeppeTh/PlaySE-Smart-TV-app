var showList = {
};

showList.onLoad = function(refresh) {
    if (!refresh)
	PathHistory.GetPath();
    if (!detailsOnTop)
	this.loadXml(refresh);
//	widgetAPI.sendReadyEvent();
};

showList.onUnload = function() {
    Player.remove();
};


showList.getUrl=function(location){
    location = location.match(/[?&]name=(.+)&history=/);
    return (location) ? location[1] : '';
};

showList.loadXml = function(refresh) {
    $('#content-scroll').hide();
    var location = getLocation(refresh);
    var url = this.getUrl(location);
    var season   = getUrlParam(location, 'season');
    season = (isNaN(+season)) ? season : +season;
    var variant = getUrlParam(location, 'variant');
    var user_data = getUrlParam(location, 'user_data');
    var cbComplete = function(status) {
        if (refresh || myPos || !Channel.checkResume(location)) {
            if (refresh || myPos)
                Channel.markResumed();
            loadFinished(status, refresh);
        }
    };
    requestUrl(url,
               function(status, data) {
                   Channel.decodeShowList(data, 
                                          {url:url, 
                                           loc:location,
                                           refresh:refresh,
                                           strip_show:true,
                                           is_clips:(location.indexOf('clips=1') != -1),
                                           season:season,
                                           variant:variant,
                                           user_data:user_data,
                                           cbComplete:function(){cbComplete(status);}
                                          });
                   data = null;
               },
               {cbError:cbComplete,
                headers:Channel.getHeaders()
               }
              );
};
//window.location = 'project.html?ilink=' + ilink + '&history=' + historyPath + iname + '/';
