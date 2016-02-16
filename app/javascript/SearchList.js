var SearchList =
{

};

SearchList.onLoad = function(refresh)
{
    if (!detailsOnTop) {
        this.setPath(this.Geturl(refresh), undefined, refresh);
	this.loadXml(refresh);
    } else {
        this.setPath(this.Geturl(refresh), itemCounter, refresh);
    }
//	widgetAPI.sendReadyEvent();
};

SearchList.onUnload = function()
{
	Player.deinit();
};

SearchList.urldecode = function(str) {
   return decodeURIComponent((str+'').replace(/\+/g, '%20'));
};

SearchList.Geturl=function(refresh){
    var url = myLocation;
    if (refresh)
        url = myRefreshLocation;
    var name="";
    if (url.indexOf("=")>0)
    {
        name = url.substring(url.indexOf("=")+1,url.length);
    }
    return name;
};

SearchList.setPath = function(name, count, refresh) {
    document.title = "Sökning: " + name;
    if (refresh)
        return;
    Header.display('');
    var title = document.title;
    if (count != undefined)
        title = title + '/' + count + '/'
    Header.display(title);
};

SearchList.loadXml = function(refresh) {
    $("#content-scroll").hide();
    var parentThis = this;

    if (channel == "svt") {
        Svt.search(parentThis.Geturl(refresh), function() {SearchList.finish(parentThis,"success",refresh)});
    }else if (channel == "viasat") {
        Viasat.search(parentThis.Geturl(refresh), function() {SearchList.finish(parentThis,"success",refresh)});
    } else if (channel == "tv4") {
        Tv4.search(parentThis.Geturl(refresh), function() {SearchList.finish(parentThis,"success",refresh)});
    } else if (channel == "dplay") {
        Dplay.search(parentThis.Geturl(refresh), function() {SearchList.finish(parentThis,"success",refresh)});
    }
};

SearchList.finish = function(parent, status, refresh) {
    loadFinished(status, refresh);
    parent.setPath(parent.Geturl(refresh), itemCounter, refresh);
};
