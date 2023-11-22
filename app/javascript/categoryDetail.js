var categoryDetail = {};

categoryDetail.onLoad = function(location, refresh) {
    if (!refresh)
	PathHistory.GetPath();

    if (!detailsOnTop) {
	this.loadXml(location, refresh);
    }
};

categoryDetail.getCategoryName = function() {
    return decodeURIComponent(document.title.match(/[^\/]+\/([^\/]+)/)[1]);
};

categoryDetail.onUnload = function() {
};

categoryDetail.loadXml = function(location, refresh) {
    $('#content-scroll').hide();
    if (location.match(/category=/))
        url = location.match(/category=(.+)&(catThumb|history)/)[1];
    var postData = Channel.getPostData('categoryDetail', {refresh:refresh, url:url});
    var url = Channel.getUrl('categoryDetail', {refresh:refresh, location:url});
    var cbComplete = function(status) {
        if (refresh || myPos || !Channel.checkResume(location)) {
            if (refresh || myPos)
                Channel.markResumed();
            loadFinished(status, refresh);
        }
    };
    requestUrl(url,
               function(status, data) {
                   // Clear to avoid something with setPosition?
                   itemCounter = 0;
                   Channel.decodeCategoryDetail(data,
                                                {url:url,
                                                 requestedLocation:data.requestedLocation,
                                                 postData:postData,
                                                 location:location,
                                                 refresh:refresh,
                                                 is_related:(location.indexOf('related=1') != -1),
                                                 cbComplete:function(){cbComplete(status);}
                                                });
                   data = null;
               },
               {cbError:cbComplete,
                headers:Channel.getHeaders(),
                postData:postData
               });
};
