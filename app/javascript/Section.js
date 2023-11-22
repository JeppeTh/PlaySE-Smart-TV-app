var Section = {
    loaded: false
};

Section.onLoad = function(location, refresh) {
    if (!refresh) {
        if (getUrlParam(location,'keep_title')) {
            PathHistory.GetPath();
        } else {
            document.title = Channel.getSectionTitle(location);
	    Header.display(document.title);
        }
    }
    if (!detailsOnTop) {
	this.loadXml(location, refresh);	
    }
};

Section.loadXml = function(location, refresh) {
    $('#content-scroll').hide();
    var cbComplete = function(status){loadFinished(status, refresh);};
    var url = Channel.getUrl('section', {refresh:refresh, location:location});
    requestUrl(url,
               function(status, data) {
                   Channel.decodeSection(data, 
                                         {url:url, 
                                          refresh:refresh,
                                          requestedLocation:data.requestedLocation,
                                          is_related:(location.indexOf('related.html') != -1),
                                          cbComplete:function(){cbComplete(status);}
                                         });
                   data = null;
               },
               {cbError:function(status){cbComplete(status);},
                headers:Channel.getHeaders(),
                postData: Channel.getPostData('section', {refresh:refresh, location:location})
               });
};
