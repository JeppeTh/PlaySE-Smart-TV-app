var seqNo = 0;
var clockOffset = 0;
var setClockOffsetTimer = null;
var checkOffsetCounter = 5;
var dateOffset = 0;
var setDateOffsetTimer = null;
var isTopRowSelected = true;
var columnCounter = 0;
var itemCounter = 0;
var htmlSection = null;
var items = [];
var thumbsLoaded = [];
var myLocation = "index.html";
var myRefreshLocation = null;
var myHistory = [];
var myPos = null;
var loadingTimer = 0;
var detailsOnTop = false;
var dateFormat = 0;
var imgCounter = 0;
var MAX_PAGES = 3
// reload on 3rd column on last "original page"
var LOAD_NEXT_COLUMN  = Math.floor((8*(MAX_PAGES-1))/2)+2;
var LOAD_PRIOR_COLUMN = 2;
var THUMBS_PER_PAGE   = 8;

checkSetTmpChannel = function(location) {
    var tmpChannel = location.match(/[?&]tmp_channel_id=([^&]+)/);
    if (tmpChannel) {
        setTmpChannel(tmpChannel[1])
    }
}

checkClrTmpChannel = function(location) {
    if (location.match(/[?&]tmp_channel_clr=([^&]+)/))
        Channel.clearTmp()
}

setChannel = function(newChannel, newId) {
    if (Channel.set(newChannel, newId)) {
        initChannel();
    }
}

initChannel = function() {
    myLocation = null;
    setLocation(Channel.getStartPage(), undefined);
    myHistory = []; 
    Language.setLang();
}

setTmpChannel = function(newId) {
    var newChannel = eval($(".channel-content").find("#"+newId).attr("channel"))
    if (!newChannel)
        newChannel = eval(newId)
    Channel.setTmp(newChannel, newId)
    Channel.login()
}

getDeviceYear = function() {
    var pluginNNavi = document.getElementById("pluginObjectNNavi");
    var firmwareVersion = pluginNNavi.GetFirmware();

    if (firmwareVersion === "") {
        // emulator
        return 666;
    }

    // Log("JTDEBUG getDeviceYear: " + Number(firmwareVersion.substr(10, 4)))
    return Number(firmwareVersion.substr(10, 4));
};

deleteAllCookies = function (name) {
    var cookies = document.cookie.match(/([^; ]+=[^; ]+)/g);
    if (name) {
        var regexp = new RegExp("(\\b" + name + "\\b=[^; ]+)", "g");
        cookies = document.cookie.match(regexp);
    }
    for (var i=0; cookies && i<cookies.length; i++)
    {
        deleteCookie(cookies[i]);
    }
    if (cookies)
        Log("All cookies deleted (name=" + name + "): " + document.cookie);
    // else
    //     Log("No cookies to delete (name=" + name + "): " + document.cookie);
};

deleteCookie = function(cookie) {
    // Log("Deleting " + cookie + " from " + document.cookie);
    document.cookie = cookie  + "; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    // Log("Done " + document.cookie);
}

getCookie = function (name) {
    var regexp = new RegExp("\\b" + name + "\\b=([^; ]+)");
    var cookie = document.cookie.match(regexp);
    if (cookie)
        return unescape(cookie[1])
    else
        return null
};

setCookie = function(cName,value,exdays)
{
    value = escape(value) + "; path=/; domain=127.0.0.1";
    var exdate=getCurrentDate();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = value + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    // Log("Setting " + cName + "=" + c_value);
    document.cookie=cName + "=" + c_value;
};

addCookiePath = function(cookie, url) {
    return cookie + "; path=/; domain=" + url.match(/https?:\/\/([^:\/]+)/)[1];
};

String.prototype.trim = function () {
    return this.replace(/^\s*/, "").replace(/\s*$/, "");
};

// Copied
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
	return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
}

loadingStart = function() {
    if (isEmulator) return;
    try {
        if (loadingTimer == 0) {
            loadingTimer = window.setTimeout(function () {
                $('#loading').sfLoading('show');
            }, 500);
        }
    } catch(err) {
        return;
    }
};

loadingStop = function() {
    try {
        clearTimeout(loadingTimer);
        loadingTimer = 0;
        $('#loading').sfLoading('hide');  
    } catch(err) {
        return;
    }
};

refreshLocation = function(entry)
{
    myRefreshLocation = entry.loc;
    checkClrTmpChannel(myRefreshLocation)
    Language.fixAButton();
    Language.fixBButton();
    dispatch(myRefreshLocation, true);
};

// Methods for "restoring" item position during "history.back"
replaceLocation = function(newlocation) {
    setLocation(newlocation, undefined, true);
};

setLocation = function(location, oldPos, skipHistory)
{
    if (location == myLocation)
        return;

    alert("location:" + location)

    if (oldPos == undefined) {
        myPos = null;
        if (myLocation && !skipHistory) {
            myHistory.push(
                {
                    loc: myLocation,
                    pos: Channel.savePosition({col     : columnCounter,
                                               top     : isTopRowSelected,
                                               section : htmlSection
                                              })
                }
            );
        }
        detailsOnTop = false;
    } else {
        myPos = oldPos;
    }

    checkSetTmpChannel(location)
    checkClrTmpChannel(location)

    var isDetails = location.match(/details.html/);
    myLocation = location;
    myRefreshLocation = null;
    Buttons.setKeyHandleID(0); // default

    if (isDetails) {
        if (oldPos == undefined) {
            detailsOnTop = true;
        } else {
            detailsOnTop = false;
        }
    } else {
        Language.fixAButton();
        Language.fixBButton();
    }
    if ((isDetails && !detailsOnTop) || !detailsOnTop)
    {
        itemSelected = null;
        itemCounter = 0;
        columnCounter = 0;
        isTopRowSelected = true;
    }
    resetHtml(oldPos, isDetails);
    loadingStart();
    dispatch(myLocation);

    if (detailsOnTop && oldPos) {
        restorePosition();
        detailsOnTop = false;
    }
    // window.location = location;
};

dispatch = function(NewLocation, Refresh) {

    if (!Refresh && $(".slider-error").is(':visible'))
        ConnectionError.show(true);

    switch (NewLocation.match(/([a-zA-Z]+)\.html/)[1])
    {
    case "details":
        Details.onLoad(Refresh);
        break;

    case "index":
        Main.onLoad(Refresh);
        break;

    case "live":
        live.onLoad(Refresh);
        break;

    case "categories":
        Categories.onLoad(Refresh);
        break;

    case "categoryDetail":
        categoryDetail.onLoad(NewLocation, Refresh);
        break;

    case "showList":
        showList.onLoad(Refresh);
        break;

    case "SearchList":
        SearchList.onLoad(Refresh);
        break;

    default:
        Section.onLoad(NewLocation, Refresh);
        break;
    }
};

resetHtml = function(oldPos, isDetails)
{
    // Delete and hide details
    $(".content").hide();
    $('#projdetails').html("");
    // Delete and show list
    if ((isDetails && !detailsOnTop) || !detailsOnTop) {
        $('#topRow').html("");
        $('#bottomRow').html("");
        $('.content-holder').css("marginLeft", "0");
        items = [];
        thumbsLoaded = [];
        htmlSection = (oldPos) ? oldPos.section : null;
    }
    $("#content-scroll").hide();
    $(".slider-body").show();
};

goBack = function(location)
{
    if (myHistory.length > 0) {
        oldLocation = myHistory.pop(),
        setLocation(oldLocation.loc, oldLocation.pos);
    }
    // history.go(-1);
};

refreshSectionInHistory = function() {
    oldLocation = myHistory.pop();
    oldLocation.pos.section = htmlSection;
    myHistory.push(oldLocation);
};

restorePosition = function() 
{
    if (myPos) {
        setPosition(myPos);
    }
    if (myRefreshLocation) {
        detailsOnTop = true;
    } else {
        loadingStop();
    }
    return myPos;
};

fetchPriorLocation = function() 
{
    refreshLocation(myHistory[myHistory.length-1]);
};

getLocation = function (refresh)
{
    if (refresh)
        return myRefreshLocation;
    return myLocation;
};

getOldLocation = function() {
    if (myHistory.length > 0)
        return myHistory[myHistory.length-1].loc
    else
        return null
};

getIndexLocation = function() {
    var myNewLocation = (myRefreshLocation) ? myRefreshLocation : myLocation;
    if (myNewLocation.match(/details.html/))
        myNewLocation = getOldLocation();
    return myNewLocation;
}

getIndex = function(MaxIndex, IndexToSkip) {
    var thisLocation = getIndexLocation();
    var anyIndex = thisLocation.match(/\?tab_index=([0-9]+)/);
    var nextIndex;
    if (!anyIndex) {
        currentIndex = 0;
    } else {
        currentIndex = +anyIndex[1];
        anyIndex     = true;
    }
    var nextIndex = (currentIndex == MaxIndex) ? 0 : currentIndex+1;
    if (IndexToSkip && nextIndex==IndexToSkip)
       nextIndex = nextIndex+1;
    return {current:currentIndex, next:nextIndex, any:anyIndex}
};

getNextIndexLocation = function(MaxIndex, IndexToSkip) {
    var thisLocation = getIndexLocation();
    var NextIndex = getIndex(MaxIndex, IndexToSkip).next;
    if (NextIndex == 0) {
        return thisLocation.replace(/\?tab_index=[0-9]+/, "")
    } else {
        return thisLocation.replace(/\.html(\?tab_index=[0-9]+)?/, ".html?tab_index=" + NextIndex)
    }
};

setPosition = function(pos)
{
    if (getItemCounter() == 0) {
        Log("setPosition without items?");
        return;
    }
    if (itemSelected) {
        itemSelected.removeClass('selected');
    } else {
        $('.topitem').eq(0).removeClass('selected');
    }
    if (pos.top) itemSelected = $('.topitem').eq(pos.col).addClass('selected');
    else         itemSelected = $('.bottomitem').eq(pos.col).addClass('selected');
    columnCounter    = pos.col;
    isTopRowSelected = pos.top;
    var newPos = Channel.checkPosition(pos)
    if (newPos == pos)
        // Log("Position set to "  + columnCounter + " " + isTopRowSelected);
        Buttons.sscroll();
    else
        setPosition(newPos)
};

getCurrentDate = function() {
    try {
        var pluginTime = document.getElementById("pluginTime").GetEpochTime();
        if (pluginTime && pluginTime > 0) {
            return new Date(pluginTime*1000 + clockOffset);
        }
    } catch(err) {
        // Log("pluginTime failed:" + err);
    }
    return new Date();
}

setOffsets = function() {
    // Retry once a minute in case of failure
    window.clearTimeout(setClockOffsetTimer);
    setClockOffsetTimer = window.setTimeout(setOffsets, 60*1000);
    httpRequest("http://www.frokenur.com/",
                {cb:function(status, data) {
                    // Get the Date
                    var actualDate = data.match(/>[ \t]*[^0-9<]+([0-9]+[^0-9<]+[0-9]+)[ \t]*</)[1];
                    // Time is generated from other url - continue
                    var clockUrl = data.split(/iframe src="/).pop().match(/([^"]+)"/)[1];
                    httpRequest(clockUrl,
                                {cb:function(status,data) {setClockOffset(actualDate, data)},
                                 no_log:true
                                });
                },
                 no_log:true
                });
    setDateOffset();
};

setClockOffset = function (actualDate, clockData) {
    var months = [/^jan/i, /^feb/i, /^mar/i, /^apr/i, /^ma[^r]/i, /^jun/i, /^jul/i, /^aug/i, /^sep/i, /^o/i, /^nov/i, /^dec/i];
    var actualTime = clockData.match(/>([0-9]+:[0-9]+:[0-9]+)</)[1];
    var actualDay = +actualDate.match(/^([0-9]+)[^0-9<]/)[1];
    var actualYear = actualDate.match(/[^0-9<]+([0-9]+)$/)[1];
    var actualMonth = actualDate.match(/[0-9 \t]+([^0-9<]+)[0-9]/)[1];
    for (var i=0; i< months.length; i++) {
        new RegExp( + "[\\-. 	]*","i");
        if (actualMonth.match(months[i])) {
            actualMonth = i+1;
            break;
        }
    }
    var oldClockOffset = clockOffset;
    clockOffset = 0;
    var now = getCurrentDate();
    // Log("original date:" + now);
    // Log("actual :" + (actualYear+" "+actualMonth+" "+actualDay+" "+actualTime) + " meaning:" + makeDate(actualYear, actualMonth, actualDay, actualTime));

    var newClockOffset = makeDate(actualYear, actualMonth, actualDay, actualTime) - now;
    // Only care about minutes
    newClockOffset = Math.round(newClockOffset/60/1000)*60*1000;
    if (newClockOffset != oldClockOffset && checkOffsetCounter != 5) {
        Log("Clock Offset was changed!!!");
        checkOffsetCounter = 0;
    }
    clockOffset = newClockOffset;
    checkOffsetCounter = checkOffsetCounter - 1;
    if (checkOffsetCounter >= 0) {
        window.setTimeout(setOffsets, 10*1000);
    } else {
        Log("Clock Offset (hours):" + clockOffset/3600/1000);
        // Log("new date:" + getCurrentDate());
    }
    window.clearTimeout(setClockOffsetTimer)
}

setDateOffset = function () {
    // Retry once a minute in case of failure
    window.clearTimeout(setDateOffsetTimer);
    setDateOffsetTimer = window.setTimeout(setDateOffset, 60*1000);
    httpRequest("http://www.svtplay.se/kanaler",
                {cb:function(status,data) {
                    dateOffset = 0;
                    data = Svt.decodeJson({responseText:data}).channelsPage.schedule;
                    for (var key in data) {
                        if (data[key].publishingTime) {
                            data = data[key].publishingTime;
                            break;
                        }
                    }
                    var actualData = data.match(/([0-9\-]+)T([0-9]+).([0-9]+)/);
                    var actualSeconds = actualData[2]*3600 + actualData[3]*60;
                    var actualDateString = actualData[1].replace(/-/g, "")
                    var tsDate = timeToDate(data)
                    var tsSeconds = tsDate.getHours()*3600 + tsDate.getMinutes()*60 + tsDate.getSeconds();
                    var tsDateString = dateToString(tsDate);
                    if (actualDateString > tsDateString) {
                        // Add 24 hours to actual
                        actualSeconds = actualSeconds + 24*3600;
                    } else if (tsDateString > actualDateString) {
                        // Add 24 hours to ts
                        tsSeconds = tsSeconds + 24*3600
                    }
                    dateOffset = Math.round((actualSeconds-tsSeconds)/3600)*3600*1000;
                    if (checkOffsetCounter == -1) {
                        Log("dateOffset (hours):" + dateOffset/3600/1000 + " actualDate:" + actualDateString + " tsDate:" + tsDateString + " tsDate:" + tsDate + " data:" + data + " starttime:" + actualData[0]);
                    }
	            window.clearTimeout(setDateOffsetTimer);
                },
                 no_log:true
                })
};

makeDate = function (year, month, day, time) {
    var separator = (dateFormat == 1) ? "/" : " ";
    return new Date(year+separator+month+separator+day+" "+time)
}

checkDateFormat = function() {
    if (isNaN(new Date("2016 07 25 22:00:00 +0200")))
        dateFormat = 1;
    else
        dateFormat = 0;
    Log("dateFormat:" + dateFormat);
}

timeToDate = function(timeString) {
    if (+timeString != timeString){
        timeString = timeString.replace(/(:[0-9]+)\.[0-9]+/,"$1")
        if (dateFormat == 1)
            timeString = timeString.replace(/-/g,"/").replace("T", " ").replace(/\+([0-9]+):([0-9]+)/,"+$1$2").replace("Z", "+0000")
        else
            timeString = timeString.replace(/-/g," ").replace("T", " ").replace(/\+/," +").replace("Z", " +00:00")
    }
    var date = new Date(timeString);
    return new Date(date.getTime() + dateOffset);
}

dateToHuman = function (date) {
    if (date && (date instanceof Date)) {
        var separator = (dateFormat == 1) ? '/' : " ";
        var days_diff = new Date(dateToString(date,separator))-new Date(dateToString(getCurrentDate(),separator));
        days_diff = days_diff/1000/3600/24;
        if (days_diff == -1)
            date = ((Language.getisSwedish()) ? "Igår " : "Yesterday ") + dateToClock(date);
        else if (days_diff == 0)
            date = dateToClock(date)
        else if (days_diff == 1)
            date = ((Language.getisSwedish()) ? "Imorgon " : "Tomorrow ") + dateToClock(date)
        else
            date = dateToFullString(date);
    } else if (date == undefined)
        return "";
    return date
}

dateToFullString = function (Date) {
    return dateToString(Date,"-") + " " + dateToClock(Date);
}

dateToString = function (Date,separator) {
    var Day = Date.getDate()
    Day = Day < 10 ?  "0" + Day : "" + Day;
    var Month = Date.getMonth()+1;
    Month = Month < 10 ?  "0" + Month : "" + Month;
    if (separator)
        return Date.getFullYear() + separator + Month + separator + Day;
    else
        return Date.getFullYear() + Month + Day;
}

dateToClock = function(Date) {
    if (Date)
        return msToClock(Date.getTime())
    else
        return Date
}

getClock = function() 
{
    return msToClock(getCurrentDate().getTime());
}

msToClock = function (ts)
{
    var time = new Date(+ts);
    var hour = time.getHours();
    var minutes = time.getMinutes();
    if (hour < 10) hour = "0" + hour;
    if (minutes < 10) minutes = "0" + minutes;
    return hour + ":" + minutes;
};

requestUrl = function(url, cbSucces, extra) {
    // Log("requesting url:" + url);
    if (!extra) extra = {};

    if (url.cached) {
        window.setTimeout(function(){callUrlCallBack(url, cbSucces, "success")},50)
        return
    }

    var requestedLocation = {url:url, loc:myLocation, refLoc:myRefreshLocation, channel:Channel.getName()};
    var retrying = false;
    var cache = (extra.no_cache) ? false : true;

    if (extra.cookie) {
        extra.cookie = addCookiePath(extra.cookie, url);
        Log("Adding " + extra.cookie + " to " + document.cookie);
        document.cookie = extra.cookie;
        // Log("Added " + document.cookie);
    }
    $.support.cors = true;
    $.ajax(
        {
            type: 'GET',
            url: url,
            tryCount : 0,
            retryLimit : 3,
	    timeout: 15000,
            cache: cache,
            beforeSend: function (request)
            {
                if (extra.headers) {
                    for (var i=0;i<extra.headers.length;i++) {
                        if (extra.headers[i].key.match(/user-agent/i))
                            extra.ua = null;
                        request.setRequestHeader(extra.headers[i].key, extra.headers[i].value);
                    }
                }
                if (deviceYear == 2014 && extra.cookie) {
                    extra.cookie = extra.cookie.replace(/ *;.*/,"")
                    Log("Sending " + extra.cookie + " in Headers.");
                    request.setRequestHeader("Cookie", extra.cookie)
                }
            },
            success: function(data, status, xhr)
            {
                Log('Success:' + this.url);
                retrying = false;
                data = null;
                callUrlCallBack(requestedLocation, cbSucces, status, xhr)
                xhr.destroy();
                xhr = null;
                if (extra.cookie)
                    deleteCookie(extra.cookie);
            },
            error: function(xhr, textStatus, errorThrown)
            {
                retrying = false;
                if (isRequestStillValid(requestedLocation)) {
                    Log('Failure:' + this.url + " status:" + textStatus + " error:" + errorThrown);
                    this.tryCount++;
          	    if ((textStatus == 'timeout' || xhr.status == 1015) && 
                        this.tryCount <= this.retryLimit) {
                        //try again
                        retrying = true;
                        return $.ajax(this);
                    } else {
                        if (!extra.dont_show_errors)
        	            ConnectionError.show();
                        callUrlCallBack(requestedLocation, extra.cbError, textStatus, xhr, errorThrown);
        	    }
                }
                if (extra.cookie)
                    deleteCookie(extra.cookie)
            },
            complete: function(xhr, status)
            {
                if (retrying)
                    return;
                callUrlCallBack(requestedLocation, extra.cbComplete, status, xhr);
                if (extra.callLoadFinished && isRequestStillValid(requestedLocation))
                    loadFinished(status, extra.refresh);
            }
        }
    );
};

callUrlCallBack = function(requestedLocation,cb,status,xhr, errorThrown) {
    if (cb && (requestedLocation.cached || isRequestStillValid(requestedLocation))) {
        cb(status, xhr, errorThrown);
    } else if (cb)
        Log("Url skipped: " + requestedLocation.url + " Skipped:" + requestedLocation.loc + " " + requestedLocation.refLoc + " " + requestedLocation.channel + " New:" + myLocation + " " +  myRefreshLocation);
};

isRequestStillValid = function (request) {
    return (request.loc == myLocation && request.refLoc == myRefreshLocation && request.channel==Channel.getName());
}

addUrlParam = function(url, key, value) {
    url = url.replace(/[?&]$/,"");
    url = (url.match(/\?/)) ? url+"&" : url+"?";
    return url + key + "=" + encodeURIComponent(value)
};

httpRequest = function(url, extra) {
    if (!extra) extra = {};
    var xhr = new XMLHttpRequest();
    var location = null, timer = null;
    if (extra.timeout || extra.timeout === 0) {
        timer = window.setTimeout(function() {
            xhr.abort();
            xhr.destroy();
            handleHttpResult(url, timer, extra, {status:"timeout"});
            timer=-1;
        }, extra.timeout);
    }
    xhr.onreadystatechange = function () {
        // Log("xhr.readyState: "+ xhr.readyState);
        if (!extra.sync && xhr.readyState == 4) {
            handleHttpResult(url, timer, extra, 
                             {data:     xhr.responseText,
                              status:   xhr.status,
                              location: xhr.getResponseHeader('location'),
                              xhr     : xhr
                             });
            xhr.destroy();
            xhr = null;
        }
    }
    if (extra.no_cache) {
        url = addUrlParam(url, "_", new Date().getTime())
        alert("no cache url:" + url)
    }
    if (extra.params) {
        alert("POST Request params: "+ extra.params)
        xhr.open("POST", url, !extra.sync);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    } else
        xhr.open("GET", url, !extra.sync);
    if (extra.headers) {
        for (var i=0;i<extra.headers.length;i++)
            xhr.setRequestHeader(extra.headers[i].key, extra.headers[i].value);
    }
    xhr.send(extra.params);
    if (extra.sync) {
        var result = {data:     xhr.responseText,
                      status:   xhr.status,
                      location: xhr.getResponseHeader('location'),
                      xhr     : xhr
                     };
        result = handleHttpResult(url, timer, extra, result);
        xhr.destroy();
        xhr = null;
        return result
    }
};

handleHttpResult = function(url, timer, extra, result) {

    if (timer == -1) {
        if (!extra.logging)
            Log('httpRequest:' + url + " aborted by timeout")
        // else
        //     alert('httpRequest:' + url + " aborted by timeout")
        return
    }
    window.clearTimeout(timer);

    if (extra.params)
        alert(result.xhr.getAllResponseHeaders())
    if (result.status == 200) {
        if (!extra.no_log)
            Log('Success:' + url);
    } else {
        if (!extra.logging)
            Log('Failure:' + url + " status:" + result.status);
        // else
        //     alert('Failure:' + url + " status:" + result.status);
    }
    if (extra.cb) {
        extra.cb(result.status, result.data, result.xhr)
    }
    if (extra.sync) {
        result.success = (result.status == 200);
        if (result.status != 302)
            result.location = null;
        return result
    }
}

httpLoop = function(urls, urlCallback, cbComplete, extra) {
    runHttpLoop(urls, urlCallback, cbComplete, extra, "", 1)
};

runHttpLoop = function(urls, urlCallback, cbComplete, extra, totalData, i) {
    if (!extra) extra = {};
    extra.cb =
        function(status,data) {
            try {
                data = urlCallback(urls[0], data, status, totalData);
            } catch (err) {
                Log("runHttpLoop: callback failed: " + err);
                throw err
            }
            if (data == -1) {
                Log("httpLoop aborted")
                return -1
            } else {
                alert("data.length:" + data.length);
            }

            totalData = totalData + data;
            if (urls.length > 1) {
                var this_extra = extra;
                runHttpLoop(urls.slice(1), urlCallback, cbComplete, this_extra, totalData, i+1)
            } else {
                cbComplete(totalData)
            }
        };
    httpRequest(urls[0], extra);
}

getHistory = function(Name) {
    var Prefix = document.title ;
    if (myRefreshLocation) {
        if (myRefreshLocation.match(/.+&history=/))
            Prefix = myRefreshLocation.replace(/.+&history=/, "");
        else
            Prefix = Prefix.replace(/\/[^\/]+\/$/, "");
    } else if (htmlSection && detailsOnTop) {
        Prefix = Prefix.replace(/\/[^\/]+\/$/, "")
    }
    return Prefix.replace(/\/$/,"") + '/' + encodeURIComponent(Name) + '/';
}

getItemCounter = function() {
    if (htmlSection)
        return items.length;
    else
        return itemCounter;
}

loadFinished = function(status, refresh) {
    fixCss();
    finaliseHtml();
    if (status == "success") {
        Log("itemCounter:" + getItemCounter())
        if (!restorePosition() && !refresh)
            contentShow();
    } else {
        if (!refresh)
            contentShow();
    }
}

contentShow = function() {
    waitForImages(function() {$("#content-scroll").show()}, 20);
}

waitForImages = function(callback, retries) {
    alert("imgCounter:" + imgCounter);
    if (retries > 0 && imgCounter > 0)
        window.setTimeout(function(){waitForImages(callback, retries--)}, 100)
    else
        callback();
}

fixCss = function() {
    if (deviceYear >= 2014) {
        $('#footer-clock').css({"bottom":"16px"});
        $('.confirmExit').css({"padding":"6px 10px"});
    } else if (deviceYear > 2011) {
        $('.confirmExit').css({"padding":"10px", "padding-bottom":"5px"});
    };
};

seasonToHtml = function(Name, Thumb, Link, Season, Variant) {
    showToHtml(Name, 
               Thumb, 
               Link, 
               makeSeasonLinkPrefix(Name, Season, Variant)
              );
};

makeSeasonLinkPrefix = function(Name, Season, Variant) {
    LinkPrefix = '<a href="showList.html?'
    if (!Season && Season != 0)
        Season="1";
    LinkPrefix += 'season=' + Season + "&title=" + encodeURIComponent(Name)
    if (Variant)
        LinkPrefix += "&variant=" + Variant;
    return LinkPrefix + "&name="
}

// Replace Current Location with the only Season existing
callTheOnlySeason = function(Name, Link, Location) {
    LinkPrefix = makeSeasonLinkPrefix(Name, "0")
    // Must keep the show name
    var ShowName = Location.match(/[?&](show_name=[^&]+)/)
    if (ShowName)
        LinkPrefix = LinkPrefix.replace(/([&?])name=/, "$1" + ShowName[1] + "&name=")
    replaceLocation(LinkPrefix + Link + "&history=" + getHistory(Name));
}

clipToHtml = function(Thumb, Link) {
    showToHtml("Klipp", Thumb, Link, '<a href="showList.html?clips=1&title=Klipp&name=');
};

categoryToHtml = function(Name, Thumb, LargeThumb, Link, UrlParams) {
    toHtml({name:        Name,
            link:        fixCategoryLink(Name, LargeThumb, Link),
            link_prefix: makeCategoryLinkPrefix(UrlParams),
            thumb:       Thumb,
            description: "",
            duration:    ""
           });
};

showToHtml = function(Name, Thumb, Link, LinkPrefix) {
    if (!LinkPrefix)
        LinkPrefix = makeShowLinkPrefix()

    toHtml({name: Name,
            link: Link,
            link_prefix: LinkPrefix,
            thumb: Thumb,
            description: "",
            duration:""
           });
};

makeLinkPrefix = function(Link, Key, UrlParams) {
    if (UrlParams)
        UrlParams = UrlParams + "&" + Key + "=";
    else
        UrlParams = Key + "=";
    return '<a href="' + Link + '?' + UrlParams;
};

makeCategoryLinkPrefix = function(UrlParams) {
    return makeLinkPrefix("categoryDetail.html", "category", UrlParams);
};

makeShowLinkPrefix = function(UrlParams) {
    return makeLinkPrefix("showList.html", "name", UrlParams)
};

makeCategoryLink = function(Name, Thumb, Url) {
    return makeLink(makeCategoryLinkPrefix(), Name, fixCategoryLink(Name,Thumb,Url));
}

fixCategoryLink = function(Name, Thumb, Url) {
    return Url +"&catThumb=" + encodeURIComponent(Thumb) +
        "&catName=" + encodeURIComponent(Name);
}

makeShowLink = function(Name, Url) {
    return makeLink(makeShowLinkPrefix(), Name, Url);
}

itemToLink = function(Item, UrlParams) {

    var myTitle=null;
    if (Item.link_prefix.match(/\?ilink/) && Item.show) {
        var showRegexp = new RegExp(Item.show + "[\\-. 	]*","i");
        if (Item.season && Item.episode) {
            myTitle = Item.show + ".s" + Item.season + "e" + Item.episode + ".";
            myTitle = myTitle + Item.name.replace(/s[0-9]+e[0-9]+[\-. 	]*/i,"").replace(showRegexp, "");
            if (myTitle.match(/e[0-9]+\.$/i))
                myTitle = myTitle + "Avsnitt " + Item.episode;
        } else if (!Item.name.match(showRegexp))
            myTitle = Item.show + " - " + Item.name;
        if (myTitle) {
            myTitle = myTitle.replace(/\bs[^.s]+song\b\s*[0-9]+\s*-\s*/i,"");
            myTitle = "mytitle=" + escape(myTitle);
            Item.link_prefix = Item.link_prefix.replace(/ilink/, myTitle + "&ilink"); 
        }
    }

    return makeLink(Item.link_prefix,Item.name,Item.link, UrlParams)
};

makeLink = function(LinkPrefix, Name, Url, UrlParams) {
    if (UrlParams)
        LinkPrefix = LinkPrefix.replace(/\?/, "?" + UrlParams + "&")

    return LinkPrefix + Url + '&history=' + getHistory(Name);
};

toHtml = function(Item) {
    // Item.name = "" + (items.length+1)
    items.push(Item)
    if (items.length <= 8*MAX_PAGES)
        itemToHtml(Item)
};

itemToHtml = function(Item, OnlyReturn) {
    var IsTop
    var html;
    var IsLiveText;
    var Background="";

    if(itemCounter % 2 == 0){
	if(itemCounter > 0 || htmlSection){
	    html = '<div class="scroll-content-item topitem">';
	}
	else{
	    html = '<div class="scroll-content-item selected topitem">';
	}
    }
    else{
	html = '<div class="scroll-content-item bottomitem">';
    }
    if ((Item.is_live && Item.is_running) || Item.is_channel) {
        IsLiveText = " is-live";
    } else {
        IsLiveText = (Item.is_live) ? " not-yet-available" : "";
    }

    if (Item.background)
        Background = " data-background='" + Item.background + "'";

    html += '<div class="scroll-item-img">';
    html += itemToLink(Item) + '" class="ilink" data-length="' + Item.duration + '"' + Background + IsLiveText + '/>';
    if (Item.thumb) {
        html += '<img class="image" src="' + Item.thumb + '" alt="' + Item.name + '"/>';
    }
    var itemsIndex = items.indexOf(Item);
    if (Item.thumb && itemCounter < THUMBS_PER_PAGE) {
        imgCounter = (itemCounter == 0) ? 0 : imgCounter+1;
        loadImage(Item.thumb,
                  function(){if (imgCounter > 0) imgCounter--},
                  2000
                 );
    } else {
        loadImage(Item.thumb)
    }
    thumbsLoaded[itemsIndex] = 1;
    Item.starttime = dateToHuman(Item.starttime);
    if (Item.is_live && !Item.is_running) {
	html += '<div class="topoverlay">LIVE';
	html += '<div class="bottomoverlay">' + Item.starttime + '</div></div>';
    }
    else if (Item.is_live){
	html += '<div class="topoverlayred">LIVE';
        if (Item.starttime)
	    html += '<div class="bottomoverlayred">' + Item.starttime + '</div>';
        html += '</div>'
    }
    html += '</div><div class="scroll-item-border"/>';
    Item.name = Item.name.trim();
    html += '<div class="scroll-item-name">';
    html +=	'<p><a href="#">' + Item.name + '</a></p>';
    Item.description = (Item.description) ? Item.description.trim() : "";
    html += '<span class="item-date"';
    if (Item.name.length > 2*LINE_LENGTH)
        Item.description = "";
    else if (Item.name.length > LINE_LENGTH)
        html += ' style=" max-height:11px;"';
    html += '>' + Item.description + '</span>';
    html += '</div>';
    html += '</div>';
 
    if (OnlyReturn)
        return {top:itemCounter++ % 2 == 0, html:html}

    if(itemCounter % 2 == 0){
        $('#topRow').append($(html));
    }
    else{
        $('#bottomRow').append($(html));
    }
    html = null;
    itemCounter++;
};

finaliseHtml = function() {
    if (htmlSection) {
        loadSection();
    } else {
        if (items.length > 8*MAX_PAGES) {
            if (items.length < 8*(MAX_PAGES+1)) {
                for (var i=8*MAX_PAGES; i<items.length; i++)
                    itemToHtml(items[i])
            } else {
                htmlSection = getInitialSection();
                preloadAdjacentSectionThumbs();
                alert("loaded from:" + htmlSection.index + " to:" + itemCounter)
                alert("Section itemCounter:" + itemCounter);
                alert(JSON.stringify(htmlSection))
            }
        }
    }
    if (!htmlSection) {
        items = [];
        thumbsLoaded = [];
    }
};

loadSection = function(maxIndex) {
    if (!maxIndex) maxIndex = getMaxIndex();
    itemCounter = 0
    var topHtml="", bottomHtml="", result;
    alert("loading from:" + htmlSection.index + " to:" + maxIndex)
    for (var i=htmlSection.index; i<items.length && i<maxIndex; i++) {
        result = itemToHtml(items[i], true);
        if (result.top)
            topHtml += result.html;
        else
            bottomHtml += result.html;
    }
    $('#topRow').html(topHtml);
    $('#bottomRow').html(bottomHtml);
    preloadAdjacentSectionThumbs();
    return maxIndex;
}

preloadAdjacentSectionThumbs = function() {
    // First load next section thumbs
    var startIndex = htmlSection.index+(8*MAX_PAGES);
    if (startIndex > items.length)
        // We're at last page - load initial instead.
        startIndex = 0;
    var endIndex   = startIndex + (8*MAX_PAGES);
    for (var i=startIndex; i < items.length && i < endIndex; i++) {
        // alert("pre-loading 1 index:" + i);
        if (!thumbsLoaded[i]) {
            loadImage(items[i].thumb)
            thumbsLoaded[i]=1
        }
    }

    // Load prior section thumbs
    endIndex = htmlSection.index-1;
    if (endIndex < 0) {
        // We're at initial page - load last section instead.
        endIndex = items.length-1
    }
    startIndex = endIndex - (8*MAX_PAGES);
    if (endIndex == (items.length-1))
        startIndex = startIndex - (items.length % 8);
    if (startIndex < 0) startIndex = 0;
    for (var i=endIndex; i >= 0 && i >= startIndex; i--) {
        // alert("pre-loading 2 index:" + i);
        if (!thumbsLoaded[i]) {
            loadImage(items[i].thumb)
            thumbsLoaded[i]=1;
        }
    }
}

getInitialSection = function() {
    return {index:0, load_next_column:LOAD_NEXT_COLUMN, load_prior_column:-1}
}

getMaxIndex = function() {
    var maxIndex = htmlSection.index+(8*MAX_PAGES);
    if  (items.length-maxIndex < 8)
        maxIndex = items.length;
    return maxIndex
}

getNextSection = function() {
    if (htmlSection.load_next_column > 0) {
        // We need to keep 2 pages
        htmlSection.index = htmlSection.index+(8*(MAX_PAGES-2));
    } else {
        htmlSection.index = 0;
    }
    var maxIndex = getMaxIndex();
    if (htmlSection.load_next_column > 0) {
        if (maxIndex >= items.length)
            htmlSection.load_next_column = 0;
        htmlSection.load_prior_column=LOAD_PRIOR_COLUMN;
    } else {
        htmlSection.load_next_column=LOAD_NEXT_COLUMN;
        htmlSection.load_prior_column=-1;
    }
    return maxIndex
}

loadNextSection = function() {
    var maxIndex = getNextSection();
    loadSection(maxIndex)
    if (htmlSection.load_next_column > 0 ||
        maxIndex >= items.length) 
    {
        // Check if we're gonna be on second or first page. Depends on which page we're on now.
        if (columnCounter >= 4*(MAX_PAGES-1))
            columnCounter = (columnCounter % 4) + 4
        else
            // We're on second page - we will be on first page now
            columnCounter = (columnCounter % 4)
        Buttons.refresh();
    } else {
        columnCounter = 0;
    }
    alert("Section itemCounter:" + itemCounter);
    alert(JSON.stringify(htmlSection))
    preloadAdjacentSectionThumbs()
    if (isTopRowSelected)
        return itemSelected = $('.topitem').eq(columnCounter).addClass('selected');
    else
        return itemSelected = $('.bottomitem').eq(columnCounter).addClass('selected')
};

loadPriorSection = function() {
    var maxIndex = htmlSection.index+(8*MAX_PAGES)
    if (htmlSection.load_prior_column > -1) {
        // We need to keep 2 pages
        htmlSection.index = htmlSection.index-(8*(MAX_PAGES-2));
        maxIndex = htmlSection.index+(8*MAX_PAGES)
    } else {
        htmlSection.index = items.length-(8*MAX_PAGES);
        htmlSection.index = htmlSection.index - (htmlSection.index % 8)
        maxIndex = items.length
    }
    if (htmlSection.index < 0) {
        htmlSection.index = 0;
    }
    loadSection(maxIndex)
    if (htmlSection.load_prior_column > -1) {
        // Check if we're gonna be on next last or last page. Depends on which page we're on now.
        if (columnCounter >= 4)
            columnCounter = (columnCounter % 4) + (4*(MAX_PAGES-1))
        else
            // We're on second page - we will be on next last page
            columnCounter = (columnCounter % 4) + (4*(MAX_PAGES-2));
        if (htmlSection.index == 0)
            htmlSection.load_prior_column = -1;
        htmlSection.load_next_column=LOAD_NEXT_COLUMN;
        Buttons.refresh();
    } else {
        columnCounter = $('.topitem').length-1;
        htmlSection.load_prior_column=LOAD_PRIOR_COLUMN;
        htmlSection.load_next_column=0;
    }
    alert("Section itemCounter:" + itemCounter);
    alert(JSON.stringify(htmlSection))
    preloadAdjacentSectionThumbs();
    if (isTopRowSelected  || ((columnCounter+1) > $('.bottomitem').length)) {
        isTopRowSelected = true;
        return itemSelected = $('.topitem').eq(columnCounter).addClass('selected');
    } else
        return itemSelected = $('.bottomitem').eq(columnCounter).addClass('selected')
}

setClock = function(id, callback) {
    var time = getCurrentDate();
    id.html(msToClock(time.getTime()));
    return window.setTimeout(callback, (60-time.getSeconds())*1000);
}

slideToggle = function(id, timer, callback) {
    if (deviceYear < 2011) {
        if (id.is(':visible'))
            id.hide();
        else
            id.show();
        if (callback) {
            window.setTimeout(callback, timer);
        }
    } else
        id.slideToggle(timer, callback);
}

loadImage = function (image, callback, timeout) {
    var thisTimeout = null;
    // if (alt)
    //     return callback();
    // alert("image:" + image + " noretry:" + noretry);
    if (image) {
        var img = document.createElement("img");
        if (timeout) {
            thisTimeout = window.setTimeout(function () {
                img.onload=img.onerror=img.onabort = null;
                if (isEmulator)
                    alert("IMG TIMEOUT: " + image)
                else
                    Log("IMG TIMEOUT")
                callback()
            }, timeout);
        }
        if (callback) {
            img.onload = img.onerror = img.onabort = function() {
                window.clearTimeout(thisTimeout);
                // alert("READY")
                callback()
            }
        }
        img.src = image;
    } else if (callback)
        callback();
};

RedirectIfEmulator = function(url) {
    if (isEmulator) {
        return Redirect(url)
    }
    return url
}

Redirect = function(url, no_log) {
    var redirectUrl = url;
    return redirectUrl
}


Log = function (msg, timeout) 
{
    // httpRequest("http://<LOGSERVER>/log?msg='[" + curWidget.name + "] " + seqNo++ % 10 + " : " + msg + "'", null, {no_log:true, logging:true, timeout:((timeout) ? 100: null)});
    // alert(msg);
};
