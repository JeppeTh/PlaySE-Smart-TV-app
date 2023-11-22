var SearchList = {

};

SearchList.onLoad = function(refresh) {
    if (!detailsOnTop || refresh) {
        this.setPath(this.getQuery(refresh), undefined, refresh);
	this.loadXml(refresh);
    } else {
        this.setPath(this.getQuery(refresh), getItemCounter(), refresh);
    }
//	widgetAPI.sendReadyEvent();
};

SearchList.onUnload = function() {
    Player.remove();
};

SearchList.getQuery = function(refresh){
    var url = getLocation(refresh);
    if (url.indexOf('=')>0) {
        return url.substring(url.indexOf('=')+1, url.length);
    }
    return '';
};

SearchList.setPath = function(query, count, refresh) {
    document.title = 'Sökning: ' + query;
    if (refresh)
        return;
    Header.display('');
    var title = document.title;
    if (count != undefined)
        title = title + '/' + count + '/';
    Header.display(title);
};

SearchList.loadXml = function(refresh) {
    $('#content-scroll').hide();
    var parentThis = this;
    var query      = SearchList.getQuery(refresh);
    var cbComplete = function(status){SearchList.finish(query, status, refresh);};
    var url = Channel.getUrl('searchList', {refresh:refresh, query:query});
    requestUrl(url,
               function(status, data) {
                   Channel.decodeSearchList(data,
                                            {url:url,
                                             refresh:refresh,
                                             query:query,
                                             cbComplete:function(){cbComplete(status);}
                                            });
                   data = null;
               },
               {cbError:cbComplete,
                headers:Channel.getHeaders(),
                postData:Channel.getPostData('searchList', {refresh:refresh, query:query})
               });
};

SearchList.finish = function(query, status, refresh) {
    loadFinished(status, refresh);
    SearchList.setPath(query, getItemCounter(), refresh);
};
