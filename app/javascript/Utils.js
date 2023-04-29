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
var myLocation = 'index.html';
var myRefreshLocation = null;
var myHistory = [];
var myPos = null;
var loadingTimer = 0;
var detailsOnTop = false;
var dateFormat = 0;
var imgCounter = 0;
var MAX_PAGES = 3;
// reload on 3rd column on last "original page"
var LOAD_NEXT_COLUMN  = Math.floor((8*(MAX_PAGES-1))/2)+2;
var LOAD_PRIOR_COLUMN = 2;
var THUMBS_PER_PAGE   = 8;

function checkSetTmpChannel(location) {
    var tmpChannel = location.match(/[?&]tmp_channel_id=([^&]+)/);
    if (tmpChannel) {
        setTmpChannel(tmpChannel[1]);
    }
}

function checkClrTmpChannel(location) {
    if (location.match(/[?&]tmp_channel_clr=([^&]+)/))
        Channel.clearTmp();
}

function setChannel(newChannel, newId) {
    if (Channel.set(newChannel, newId)) {
        initChannel();
    }
}

function initChannel() {
    myLocation = null;
    setLocation(Channel.getStartPage(), undefined);
    myHistory = []; 
    Language.setLang();
}

function setTmpChannel(newId) {
    var newChannel = eval($('.channel-content').find('#'+newId).attr('channel'));
    if (!newChannel)
        newChannel = eval(newId);
    Channel.setTmp(newChannel, newId);
    Channel.login();
}

function getDeviceYear() {
    var pluginNNavi = document.getElementById('pluginObjectNNavi');
    var version = pluginNNavi.GetFirmware();
    version = version && version.match(/INFOLINK([0-9]+)/);
    if (version)
        return +version[1];
    else
        // emulator
        return 666;
}

function deleteAllCookies(name) {
    var cookies = document.cookie.match(/([^; ]+=[^; ]+)/g);
    if (name) {
        var regexp = new RegExp('(\\b' + name + '\\b=[^; ]+)', 'g');
        cookies = document.cookie.match(regexp);
    }
    for (var i=0; cookies && i<cookies.length; i++) {
        deleteCookie(cookies[i]);
    }
    if (cookies)
        Log('All cookies deleted (name=' + name + '): ' + document.cookie);
    // else
    //     Log('No cookies to delete (name=' + name + '): ' + document.cookie);
}

function deleteCookie(cookie) {
    // Log('Deleting ' + cookie + ' from ' + document.cookie);
    document.cookie = cookie  + '; expires=Thu, 01 Jan 1970 00:00:01 GMT';
    // Log('Done ' + document.cookie);
}

function getCookie(name) {
    var regexp = new RegExp('\\b' + name + '\\b=([^; ]+)');
    var cookie = document.cookie.match(regexp);
    if (cookie)
        return unescape(cookie[1]);
    else
        return null;
}

function setCookie(cName,value,exdays) {
    value = escape(value) + '; path=/; domain=127.0.0.1';
    var exdate=getCurrentDate();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value = value + ((exdays==null) ? '' : '; expires='+exdate.toUTCString());
    // Log('Setting ' + cName + '=' + c_value);
    document.cookie=cName + '=' + c_value;
}

function addCookiePath(cookie, url) {
    return cookie + '; path=/; domain=' + url.match(/https?:\/\/([^:\/]+)/)[1];
}

String.prototype.trim = function () {
    return this.replace(/^\s*/, '').replace(/\s*$/, '');
};

String.prototype.capitalize = function() {
    return this.replace(/^./,this[0].toUpperCase());
};

String.prototype.toHttp = function() {
    return this.replace(/^https:/,'http:');
};

// Copied
if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(search, pos) {
	return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
    };
}

function loadingStart() {
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
}

function loadingStop() {
    try {
        clearTimeout(loadingTimer);
        loadingTimer = 0;
        $('#loading').sfLoading('hide');  
    } catch(err) {
        return;
    }
}

function refreshLocation(entry) {
    myRefreshLocation = entry.loc;
    checkClrTmpChannel(myRefreshLocation);
    Language.fixButtons();
    dispatch(myRefreshLocation, true);
}

// Methods for 'restoring' item position during 'history.back'
function replaceLocation(newlocation) {
    setLocation(newlocation, undefined, true);
}

function setLocation(location, oldPos, skipHistory) {
    if (location == myLocation)
        return;

    alert('location:' + location);

    if (oldPos == undefined) {
        myPos = null;
        if (myLocation && !skipHistory) {
            myHistory.push( {
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

    checkSetTmpChannel(location);
    checkClrTmpChannel(location);

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
        Language.fixButtons();
    }
    if ((isDetails && !detailsOnTop) || !detailsOnTop) {
        itemSelected = null;
        itemCounter = 0;
        columnCounter = 0;
        isTopRowSelected = true;
    }
    resetHtml(oldPos, isDetails);
    loadingStart();

    if (getUrlParam(myLocation,"tmp_channel_id"))
        Channel.waitForLogin(function(){dispatch(myLocation);});
    else
        dispatch(myLocation);

    if (detailsOnTop && oldPos) {
        restorePosition();
        detailsOnTop = false;
    }
    // window.location = location;
}

function dispatch(NewLocation, Refresh) {

    if (!Refresh && $('.slider-error').is(':visible'))
        ConnectionError.show(true);

    switch (NewLocation.match(/([a-zA-Z]+)\.html/)[1]) {
    case 'details':
        Details.onLoad(Refresh);
        break;

    case 'index':
        Main.onLoad(Refresh);
        break;

    case 'live':
        live.onLoad(NewLocation, Refresh);
        break;

    case 'categories':
        Categories.onLoad(Refresh);
        break;

    case 'categoryDetail':
        categoryDetail.onLoad(NewLocation, Refresh);
        break;

    case 'showList':
        showList.onLoad(Refresh);
        break;

    case 'SearchList':
        SearchList.onLoad(Refresh);
        break;

    default:
        Section.onLoad(NewLocation, Refresh);
        break;
    }
}

function resetHtml(oldPos, isDetails) {
    // Delete and hide details
    $('.content').hide();
    $('#projdetails').html('');
    // Delete and show list
    if ((isDetails && !detailsOnTop) || !detailsOnTop) {
        $('#topRow').html('');
        $('#bottomRow').html('');
        $('.content-holder').css('marginLeft', '0');
        items = [];
        thumbsLoaded = [];
        htmlSection = (oldPos) ? oldPos.section : null;
    }
    $('#content-scroll').hide();
    $('.slider-body').show();
}

function goBack(location) {
    if (myHistory.length > 0) {
        var oldLocation = myHistory.pop();
        setLocation(oldLocation.loc, oldLocation.pos);
    }
    // history.go(-1);
}

function refreshSectionInHistory() {
    var oldLocation = myHistory.pop();
    oldLocation.pos.section = htmlSection;
    myHistory.push(oldLocation);
}

function restorePosition() {
    if (myPos) {
        setPosition(myPos);
    }
    if (myRefreshLocation) {
        detailsOnTop = true;
        myRefreshLocation = null;
    } else {
        loadingStop();
    }
    return myPos;
}

function fetchPriorLocation() {
    refreshLocation(myHistory[myHistory.length-1]);
}

function getLocation(refresh) {
    if (refresh)
        return myRefreshLocation;
    return myLocation;
}

function getOldLocation() {
    if (myHistory.length > 0)
        return myHistory[myHistory.length-1].loc;
    else
        return null;
}

function getIndexLocation() {
    var myNewLocation = (myRefreshLocation) ? myRefreshLocation : myLocation;
    if (myNewLocation.match(/details.html/))
        myNewLocation = getOldLocation();
    return myNewLocation;
}

function getIndex(MaxIndex, IndexToSkip) {
    var thisLocation = getIndexLocation();
    var anyIndex = thisLocation.match(/\?tab_index=([0-9]+)/);
    var nextIndex;
    var currentIndex = 0;
    if (anyIndex) {
        currentIndex = +anyIndex[1];
        anyIndex     = true;
    }
    nextIndex = (currentIndex == MaxIndex) ? 0 : currentIndex+1;
    if (IndexToSkip && nextIndex==IndexToSkip)
       nextIndex = nextIndex+1;
    return {current:currentIndex, next:nextIndex, any:anyIndex};
}

function getNextIndexLocation(MaxIndex, IndexToSkip) {
    var thisLocation = getIndexLocation();
    var NextIndex = getIndex(MaxIndex, IndexToSkip).next;
    if (NextIndex == 0) {
        return thisLocation.replace(/\?tab_index=[0-9]+/, '');
    } else {
        return thisLocation.replace(/\.html(\?tab_index=[0-9]+)?/, '.html?tab_index=' + NextIndex);
    }
}

function setPosition(pos) {
    if (getItemCounter() == 0) {
        Log('setPosition without items?');
        return;
    }
    if (itemSelected) {
        itemSelected.removeClass('selected');
    } else {
        $('.topitem').eq(0).removeClass('selected');
    }
    var row = (pos.top) ? $('.topitem') : $('.bottomitem');
    if (pos.col >= row.length) {
        Log('Position out of range: ' + pos.col + ' ' + row.length);
        pos.col = row.length - 1;
    }
    itemSelected = row.eq(pos.col).addClass('selected');
    columnCounter    = pos.col;
    isTopRowSelected = pos.top;
    var newPos = Channel.checkPosition(pos);
    if (newPos == pos)
        // Log('Position set to '  + columnCounter + ' ' + isTopRowSelected);
        Buttons.sscroll();
    else
        setPosition(newPos);
}

function getCurrentDate() {
    try {
        var pluginTime = document.getElementById('pluginTime').GetEpochTime();
        if (pluginTime && pluginTime > 0) {
            return new Date(pluginTime*1000 + clockOffset);
        }
    } catch(err) {
        // Log('pluginTime failed:' + err);
    }
    return new Date();
}

function setOffsets() {
    // Retry once a minute in case of failure
    window.clearTimeout(setClockOffsetTimer);
    setClockOffsetTimer = window.setTimeout(setOffsets, 60*1000);
    httpRequest('http://www.frokenur.com/',
                {cb:function(status, data) {
                    // Get the Date
                    var actualDate = data.match(/>[ \t]*[^0-9<]+([0-9]+[^0-9<]+[0-9]+)[ \t]*</)[1];
                    // Time is generated from other url - continue
                    var clockUrl = data.split(/iframe src="/).pop().match(/([^"]+)"/)[1];
                    httpRequest(clockUrl,
                                {cb:function(status,data) {setClockOffset(actualDate, data);},
                                 no_log:true
                                });
                },
                 no_log:true
                });
    setDateOffset();
}

function setClockOffset(actualDate, clockData) {
    var months = [/^jan/i, /^feb/i, /^mar/i, /^apr/i, /^ma[^r]/i, /^jun/i, /^jul/i, /^aug/i, /^sep/i, /^o/i, /^nov/i, /^dec/i];
    var actualTime = clockData.match(/>([0-9]+:[0-9]+:[0-9]+)</)[1];
    var actualDay = +actualDate.match(/^([0-9]+)[^0-9<]/)[1];
    var actualYear = actualDate.match(/[^0-9<]+([0-9]+)$/)[1];
    var actualMonth = actualDate.match(/[0-9 \t]+([^0-9<]+)[0-9]/)[1];
    for (var i=0; i< months.length; i++) {
        new RegExp( + '[\\-. 	]*','i');
        if (actualMonth.match(months[i])) {
            actualMonth = i+1;
            break;
        }
    }
    var oldClockOffset = clockOffset;
    clockOffset = 0;
    var now = getCurrentDate();
    // Log('original date:' + now);
    // Log('actual :' + (actualYear+' '+actualMonth+' '+actualDay+' '+actualTime) + ' meaning:' + makeDate(actualYear, actualMonth, actualDay, actualTime));

    var newClockOffset = makeDate(actualYear, actualMonth, actualDay, actualTime) - now;
    // Only care about minutes
    newClockOffset = Math.round(newClockOffset/60/1000)*60*1000;
    if (newClockOffset != oldClockOffset && checkOffsetCounter != 5) {
        Log('Clock Offset was changed!!!');
        checkOffsetCounter = 0;
    }
    clockOffset = newClockOffset;
    checkOffsetCounter = checkOffsetCounter - 1;
    if (checkOffsetCounter >= 0) {
        window.setTimeout(setOffsets, 10*1000);
    } else {
        Log('Clock Offset (hours):' + clockOffset/3600/1000);
        // Log('new date:' + getCurrentDate());
    }
    window.clearTimeout(setClockOffsetTimer);
}

function setDateOffset() {
    // Retry once a minute in case of failure
    window.clearTimeout(setDateOffsetTimer);
    setDateOffsetTimer = window.setTimeout(setDateOffset, 60*1000);
    Svt.requestDateString(function(data) {
        dateOffset = 0;
        var actualData = data.match(/([0-9\-]+)T([0-9]+).([0-9]+)/);
        var actualSeconds = actualData[2]*3600 + actualData[3]*60;
        var actualDateString = actualData[1].replace(/-/g, '');
        var tsDate = timeToDate(data);
        var tsSeconds = tsDate.getHours()*3600 + tsDate.getMinutes()*60 + tsDate.getSeconds();
        var tsDateString = dateToString(tsDate);
        if (actualDateString > tsDateString) {
            // Add 24 hours to actual
            actualSeconds = actualSeconds + 24*3600;
        } else if (tsDateString > actualDateString) {
            // Add 24 hours to ts
            tsSeconds = tsSeconds + 24*3600;
        }
        dateOffset = Math.round((actualSeconds-tsSeconds)/3600)*3600*1000;
        if (checkOffsetCounter == -1) {
            Log('dateOffset (hours):' + dateOffset/3600/1000 + ' actualDate:' + actualDateString + ' tsDate:' + tsDateString + ' tsDate:' + tsDate + ' data:' + data + ' start:' + actualData[0]);
        }
	window.clearTimeout(setDateOffsetTimer);
    });
}

function makeDate(year, month, day, time) {
    var separator = (dateFormat == 1) ? '/' : ' ';
    return new Date(year+separator+month+separator+day+' '+time);
}

function checkDateFormat() {
    if (isNaN(new Date('2016 07 25 22:00:00 +0200')))
        dateFormat = 1;
    else
        dateFormat = 0;
    Log('dateFormat:' + dateFormat);
}

function timeToDate(timeString) {
    if (+timeString != timeString){
        timeString = timeString.replace(/(:[0-9]+)\.[0-9]+/,'$1');
        if (dateFormat == 1)
            timeString = timeString.replace(/-/g,'/').replace('T', ' ').replace(/\+([0-9]+):([0-9]+)/,'+$1$2').replace('Z', '+0000');
        else
            timeString = timeString.replace(/-/g,' ').replace('T', ' ').replace(/\+/,' +').replace('Z', ' +00:00');
    }
    var date = new Date(timeString);
    return new Date(date.getTime() + dateOffset);
}

function dateToHuman(date) {
    if (date && (date instanceof Date)) {
        var separator = (dateFormat == 1) ? '/' : ' ';
        var days_diff = new Date(dateToString(date,separator))-new Date(dateToString(getCurrentDate(),separator));
        days_diff = days_diff/1000/3600/24;
        if (days_diff == -1)
            date = ((Language.getisSwedish()) ? 'Igår ' : 'Yesterday ') + dateToClock(date);
        else if (days_diff == 0)
            date = dateToClock(date);
        else if (days_diff == 1)
            date = ((Language.getisSwedish()) ? 'Imorgon ' : 'Tomorrow ') + dateToClock(date);
        else if (days_diff < 7 && days_diff > 1)
            date = getDay(date) + ' ' + dateToClock(date);
        else
            date = dateToFullString(date);
    } else if (date == undefined)
        return '';
    return date;
}

function getDay(Date) {
    if (!Date) return Date;
    var days = (Language.getisSwedish()) ?
        ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']:
        ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[Date.getDay()];
}

function dateToFullString(Date) {
    return dateToString(Date,'-') + ' ' + dateToClock(Date);
}

function dateToString(Date,separator) {
    var Day = Date.getDate();
    Day = Day < 10 ?  '0' + Day : '' + Day;
    var Month = Date.getMonth()+1;
    Month = Month < 10 ?  '0' + Month : '' + Month;
    if (separator)
        return Date.getFullYear() + separator + Month + separator + Day;
    else
        return Date.getFullYear() + Month + Day;
}

function dateToClock(Date) {
    if (Date)
        return msToClock(Date.getTime());
    else
        return Date;
}

function getClock() {
    return msToClock(getCurrentDate().getTime());
}

function msToClock(ts) {
    var time = new Date(+ts);
    var hour = time.getHours();
    var minutes = time.getMinutes();
    if (hour < 10) hour = '0' + hour;
    if (minutes < 10) minutes = '0' + minutes;
    return hour + ':' + minutes;
}

function requestUrl(url, cbSucces, extra) {
    // Log('requesting url:' + url);
    if (!extra) extra = {};

    if (url.cached) {
        window.setTimeout(function(){callUrlCallBack(url, cbSucces, 'success', url);},50);
        return;
    }

    if (Channel.redirectUrl(url,
                            function(newUrl) {
                                requestUrl(newUrl, cbSucces, extra);
                            }))
        return;

    var requestedLocation = {url:url, loc:myLocation, refLoc:myRefreshLocation, channel:Channel.getName()};
    var retrying = false;
    var cache = (extra.no_cache) ? false : true;

    if (extra.cookie) {
        extra.cookie = addCookiePath(extra.cookie, url);
        Log('Adding ' + extra.cookie + ' to ' + document.cookie);
        document.cookie = extra.cookie;
        // Log('Added ' + document.cookie);
    }
    $.support.cors = true;
    $.ajax( {
            type: 'GET',
            url: url,
            tryCount : 0,
            retryLimit : 3,
	    timeout: 15000,
            cache: cache,
            // withCredentials: true,
            beforeSend: function (request) {
                if (extra.headers) {
                    for (var i=0;i<extra.headers.length;i++) {
                        if (extra.headers[i].key.match(/user-agent/i))
                            extra.ua = null;
                        request.setRequestHeader(extra.headers[i].key, extra.headers[i].value);
                    }
                }
                if (deviceYear == 2014 && extra.cookie) {
                    extra.cookie = extra.cookie.replace(/ *;.*/,'');
                    Log('Sending ' + extra.cookie + ' in Headers.');
                    request.setRequestHeader('Cookie', extra.cookie);
                }
            },
            success: function(data, status, xhr) {
                if (xhr.status==0 && !xhr.responseText)
                    return this.error(xhr, 'no status', xhr.errorString);
                Log('Success:' + this.url);
                retrying = false;
                data = null;
                callUrlCallBack(requestedLocation, cbSucces, status, xhr, this.url);
                if (extra.cookie)
                    deleteCookie(extra.cookie);
            },
            error: function(xhr, textStatus, errorThrown) {
                retrying = false;
                if (isRequestStillValid(requestedLocation)) {
                    Log('Failure:' + this.url + ' status:' + textStatus + ' error:' + errorThrown);
                    this.tryCount++;
          	    if ((textStatus=='timeout' || xhr.status==1015 || xhr.status==502) &&
                        this.tryCount <= this.retryLimit) {
                        //try again
                        retrying = true;
                        return $.ajax(this);
                    } else {
                        if (!extra.dont_show_errors)
        	            ConnectionError.show();
                        callUrlCallBack(requestedLocation, extra.cbError, textStatus, xhr, this.url, errorThrown);
        	    }
                }
                if (extra.cookie)
                    deleteCookie(extra.cookie);
            },
            complete: function(xhr, status) {
                if (!retrying) {
                    callUrlCallBack(requestedLocation, extra.cbComplete, status, xhr, this.url);
                    if (extra.callLoadFinished && isRequestStillValid(requestedLocation))
                        loadFinished(status, extra.refresh);
                }
                xhr.destroy();
                xhr = null;
            }
        }
    );
}

function callUrlCallBack(requestedLocation, cb, status, xhr, url, errorThrown) {
    if (cb && (requestedLocation.cached || isRequestStillValid(requestedLocation))) {
        try {
            cb(status, xhr, url, errorThrown);
        } catch (err) {
            Log('callUrlCallBack failed: ' + err);
            Player.internalError(err);
        }
    } else if (cb)
        Log('Url skipped: ' + requestedLocation.url + ' Skipped:' + requestedLocation.loc + ' ' + requestedLocation.refLoc + ' ' + requestedLocation.channel + ' New:' + myLocation + ' ' +  myRefreshLocation);
}

function isRequestStillValid(request) {
    return (request.loc == myLocation && request.refLoc == myRefreshLocation && request.channel==Channel.getName());
}

function addUrlParam(url, key, value) {
    url = url.replace(/[?&]$/,'');
    url = (url.match(/\?/)) ? url+'&' : url+'?';
    return url + key + '=' + encodeURIComponent(value);
}

function getUrlParam(url, key, raw) {
    var Value = new RegExp('[?&]' + key + '=([^?&]+)');
    Value = url && url.match(Value);
    Value = Value && Value[1];
    if (Value) {
        if (raw)
            return Value;
        else
            return decodeURIComponent(Value);
    }
}

function removeUrlParam(url, key) {
    url = url.replace(new RegExp('\\?' + key + '=[^&]+&'), '?');
    url = url.replace(new RegExp('\\?' + key + '=[^&]+'), '');
    return url.replace(new RegExp('&' + key + '=[^&]+'), '');
}

function getUrlPrefix(url) {
    return url.replace(/[^\/]+(\?.+)?$/,'');
}

function httpRequest(url, extra) {

    if (Channel.redirectUrl(url,
                            function(newUrl) {httpRequest(newUrl, extra);}
                           ))
        // extra.sync not supported - should lead to an exception
        return;

    if (!extra) extra = {};
    var xhr = new XMLHttpRequest();
    var location = null, timer = null;
    if (extra.timeout || extra.timeout === 0) {
        timer = window.setTimeout(function() {
            handleHttpResult(url, timer, extra, {status:'timeout',xhr:xhr});
            timer = -1;
            xhr.abort();
        }, extra.timeout);
    }
    xhr.onreadystatechange = function () {
        // Log('xhr.readyState: '+ xhr.readyState);
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
    };
    if (extra.no_cache) {
        url = addUrlParam(url, '_', new Date().getTime());
        alert('no cache url:' + url);
    }
    if (extra.params) {
        // alert('POST Request params: '+ extra.params);
        xhr.open('POST', url, !extra.sync);
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    } else
        xhr.open('GET', url, !extra.sync);
    if (extra.headers) {
        for (var i=0;i<extra.headers.length;i++)
            xhr.setRequestHeader(extra.headers[i].key, extra.headers[i].value);
    }
    // xhr.withCredentials = true;
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
        return result;
    }
}

function handleHttpResult(url, timer, extra, result) {

    if (timer == -1) {
        if (!extra.logging)
            Log('httpRequest:' + url + ' aborted by timeout');
        // else
        //     alert('httpRequest:' + url + ' aborted by timeout')
        return;
    }
    window.clearTimeout(timer);

    // if (extra.params)
    //     alert(result.xhr.getAllResponseHeaders());
    if (isHttpStatusOk(result.status)) {
        if (!extra.no_log)
            Log('Success:' + url);
    } else {
        if (!extra.logging)
            Log('Failure:' + url + ' status:' + result.status + ' error:' + result.xhr.errorString);
        // else
        //     alert('Failure:' + url + ' status: + result.status);
    }
    if (extra.cb) {
        extra.cb(result.status, result.data, result.xhr, url);
    }
    if (extra.sync) {
        result.success = isHttpStatusOk(result.status);
        if (result.status != 302)
            result.location = null;
        return result;
    }
}

function isHttpStatusOk(status) {
    return (status==200 || status==206 || status==304);
}

function httpLoop(urls, urlCallback, cbComplete, extra) {
    runHttpLoop(urls, urlCallback, cbComplete, extra, '', 1);
}

function runHttpLoop(urls, urlCallback, cbComplete, extra, totalData, i) {
    if (!extra) extra = {};
    extra.cb =
        function(status,data) {
            try {
                data = urlCallback(urls[0], data, status, totalData);
            } catch (err) {
                Log('runHttpLoop: callback failed: ' + err);
                throw err;
            }
            if (data == -1) {
                Log('httpLoop aborted');
                return -1;
            } else {
                alert('data.length:' + data.length);
            }

            totalData = totalData + data;
            if (urls.length > 1) {
                var this_extra = extra;
                runHttpLoop(urls.slice(1), urlCallback, cbComplete, this_extra, totalData, i+1);
            } else {
                cbComplete(totalData);
            }
        };
    httpRequest(urls[0], extra);
}

function getHistory(Name,LinkPrefix) {
    var Prefix = document.title;
    if (!Prefix.match(/\//))
        // Encode the initial entry
        Prefix = encodeURIComponent(Prefix);
    if (myRefreshLocation) {
        if (myRefreshLocation.match(/.+&history=/)) {
            Prefix = getUrlParam(myRefreshLocation, 'history', true);
        } else {
            Prefix = Prefix.replace(/\/[^\/]+\/$/, '');
        }
    } else if ((detailsOnTop || myLocation.match(/details.html/)) &&
               (!LinkPrefix || !LinkPrefix.match(/categoryDetail.html/))) {
        Prefix = Prefix.replace(/\/[^\/]+\/$/, '');
    }
    return Prefix.replace(/\/$/,'') + '/' + encodeURIComponent(Name) + '/';
}

function getItemCounter() {
    if (htmlSection)
        return items.length;
    else
        return itemCounter;
}

function loadFinished(status, refresh) {
    // Do before clearing items
    skipUpcoming();
    fixCss();
    finaliseHtml();
    if (status == 'success') {
        Log('itemCounter:' + getItemCounter());
        if (!restorePosition() && !refresh)
            contentShow();
    } else {
        if (!refresh)
            contentShow();
    }
    if (!itemSelected && $('.topitem').eq(0).hasClass('selected'))
        itemSelected = $('.topitem').eq(0);
    preloadItem(itemSelected);
}

function contentShow() {
    waitForImages(function() {$('#content-scroll').show();}, 20);
}

function waitForImages(callback, retries) {
    alert('imgCounter:' + imgCounter);
    if (retries > 0 && imgCounter > 0)
        window.setTimeout(function(){waitForImages(callback, retries--);}, 100);
    else
        callback();
}

function fixCss() {
    if (deviceYear >= 2014) {
        $('#footer-clock').css({'bottom':'16px'});
        $('.confirmExit').css({'padding':'6px 10px'});
    } else if (deviceYear > 2011) {
        $('.confirmExit').css({'padding':'10px', 'padding-bottom':'5px'});
    }
}

function seasonToHtml(Name, Thumb, Link, Season, Variant, UserData) {
    showToHtml(Name,
               Thumb,
               Link,
               makeSeasonLinkPrefix(Name, Season, Variant, UserData)
              );
}

function makeSeasonLinkPrefix(Name, Season, Variant, UserData) {
    var LinkPrefix = '<a href="showList.html';
    if (!Season && Season != 0)
        Season='1';
    LinkPrefix = addUrlParam(LinkPrefix, 'season', Season);
    LinkPrefix = addUrlParam(LinkPrefix, 'title', Name);
    if (Variant)
        LinkPrefix = addUrlParam(LinkPrefix, 'variant', Variant);
    if (UserData)
        LinkPrefix = addUrlParam(LinkPrefix, 'user_data', UserData);
    return LinkPrefix + '&name=';
}

// Replace Current Location with the only Season existing
function callTheOnlySeason(Name, Link, Location, UserData) {
    var LinkPrefix = makeSeasonLinkPrefix(Name, '0', null, UserData);
    // Must keep the show name
    var ShowName = Location.match(/[?&](show_name=[^&]+)/);
    if (ShowName)
        LinkPrefix = LinkPrefix.replace(/([&?])name=/, '$1' + ShowName[1] + '&name=');
    replaceLocation(LinkPrefix + Link + '&history=' + getHistory(Name));
}

function clipToHtml(Thumb, Link) {
    showToHtml('Klipp', Thumb, Link, '<a href="showList.html?clips=1&title=Klipp&name=');
}

function categoryToHtml(Name, Thumb, LargeThumb, Link, UrlParams) {
    toHtml({name:        Name,
            link:        fixCategoryLink(Name, LargeThumb, Link),
            link_prefix: makeCategoryLinkPrefix(UrlParams),
            thumb:       Thumb,
            description: '',
            duration:    ''
           });
}

function showToHtml(Name, Thumb, Link, LinkPrefix, Label) {
    if (!LinkPrefix)
        LinkPrefix = makeShowLinkPrefix();

    toHtml({name: Name,
            link: Link,
            link_prefix: LinkPrefix,
            thumb: Thumb,
            description: '',
            duration:'',
            label: Label
           });
}

function makeLinkPrefix(Link, Key, UrlParams) {
    if (UrlParams)
        UrlParams = UrlParams + '&' + Key + '=';
    else
        UrlParams = Key + '=';
    return '<a href="' + Link + '?' + UrlParams;
}

function makeCategoryLinkPrefix(UrlParams) {
    return makeLinkPrefix('categoryDetail.html', 'category', UrlParams);
}

function makeShowLinkPrefix(UrlParams) {
    return makeLinkPrefix('showList.html', 'name', UrlParams);
}

function makeCategoryLink(Name, Thumb, Url) {
    return makeLink(makeCategoryLinkPrefix(), Name, fixCategoryLink(Name,Thumb,Url));
}

function fixCategoryLink(Name, Thumb, Url) {
    return Url +'&catThumb=' + encodeURIComponent(Thumb) +
        '&catName=' + encodeURIComponent(Name);
}

function makeShowLink(Name, Url) {
    return makeLink(makeShowLinkPrefix(), Name, Url);
}

function itemToLink(Item, UrlParams) {

    var myTitle=null;
    if (Item.link_prefix.match(/\?ilink/) && Item.show) {
        var showRegexp = new RegExp(Item.show + '[\\-. 	]*','i');
        if (Item.season && Item.episode) {
            myTitle = Item.show + '.s' + Item.season + 'e' + Item.episode + '.';
            myTitle = myTitle + Item.name.replace(/s[0-9]+e[0-9]+[\-. 	]*/i,'').replace(showRegexp, '');
            if (myTitle.match(/e[0-9]+\.$/i))
                myTitle = myTitle + 'Avsnitt ' + Item.episode;
        } else if (!Item.name.match(showRegexp))
            myTitle = Item.show + ' - ' + Item.name;
        if (myTitle) {
            myTitle = myTitle.replace(/\bs[^.s]+song\b\s*[0-9]+\s*-\s*/i,'');
            myTitle = 'mytitle=' + escape(myTitle);
            Item.link_prefix = Item.link_prefix.replace(/ilink/, myTitle + '&ilink'); 
        }
    }

    return makeLink(Item.link_prefix,Item.name,Item.link, UrlParams);
}

function makeLink(LinkPrefix, Name, Url, UrlParams) {
    if (UrlParams)
        LinkPrefix = LinkPrefix.replace(/\?/, '?' + UrlParams + '&');

    return LinkPrefix + Url + '&history=' + getHistory(Name,LinkPrefix);
}

function toHtml(Item) {
    // Item.name = '' + (items.length+1)
    items.push(Item);
    if (items.length <= 8*MAX_PAGES)
        itemToHtml(Item);
}

function itemToHtml(Item, OnlyReturn) {
    var IsTop;
    var html;
    var IsLiveText;
    var Background='';
    var Link = itemToLink(Item);
    var itemRow = (itemCounter % 2 == 0) ? ' topitem' : ' bottomitem';
    var borderStyle;
    var watched = Item.watched;

    if (Item.start && Item.duration) {
        if (Item.is_channel || Item.is_running) {
            watched = (getCurrentDate()-Item.start)/1000/Item.duration;
            watched = Math.round(watched*100);
            if (!isNaN(watched)) {
                itemRow += ' running';
                if (watched > 100) watched = 100;
                if (watched < 3) watched = 3;
            } else {
                watched = null
            }
        }
    }
    itemRow += (Item.watched) ? ' resumed' : '';
    if(itemCounter % 2 == 0) {
	if(itemCounter > 0 || htmlSection){
	    html = '<div class="scroll-content-item' + itemRow  + '">';
	}
	else{
	    html = '<div class="scroll-content-item selected' + itemRow  + '">';
	}
    }
    else{
	html = '<div class="scroll-content-item' + itemRow  + '">';
    }
    if ((Item.is_live && Item.is_running) || Item.is_channel) {
        IsLiveText = ' is-live';
    } else {
        IsLiveText = (Item.is_live || Item.is_upcoming) ? ' not-yet-available' : '';
    }

    if (Item.background)
        Background = ' data-background=\'' + Item.background + '\'';

    html += '<div class="scroll-item-img">';
    if (!(Item.is_live && !Item.is_running) && !Item.is_upcoming && Buttons.isPlayable(Link)) {
        if (deviceYear < 2012)
            html += '<div class="scroll-item-play-icon-old"><img class="play-icon-old" src="images/play.png"/></div>';
        else
            html += '<div class="scroll-item-play-icon"/>';
    }
    if (Item.label && Item.label != "")
        html += '<div class="scroll-item-label">' + Item.label + '</div>'
    html += Link + '" class="ilink" data-length="' + Item.duration + '"' + Background + IsLiveText + '/>';
    if (Item.thumb) {
        html += '<img class="image" src="' + Item.thumb + '" alt="' + Item.name + '"/>';
    }
    var itemsIndex = items.indexOf(Item);
    if (Item.thumb && itemCounter < THUMBS_PER_PAGE) {
        imgCounter = (itemCounter == 0) ? 0 : imgCounter+1;
        loadImage(Item.thumb,
                  function(){if (imgCounter > 0) imgCounter--;},
                  2000
                 );
    } else {
        loadImage(Item.thumb);
    }
    thumbsLoaded[itemsIndex] = 1;
    Item.start = dateToHuman(Item.start);
    if (Item.is_live && !Item.is_running) {
	html += '<div class="topoverlay">LIVE';
	html += '<div class="bottomoverlay">' + Item.start + '</div></div>';
    }
    else if (Item.is_live){
	html += '<div class="topoverlayred">LIVE';
        if (Item.start)
	    html += '<div class="bottomoverlayred">' + Item.start + '</div>';
        html += '</div>';
    } else if (Item.is_upcoming)
        html += '<div class="upcomingoverlay"><span>' + Item.start + '</span></div>';
    borderStyle = (watched) ? ' style="width:' + watched + '%;"' : '';
    html += '</div><div class="scroll-item-border"' + borderStyle + '/>';
    Item.name = Item.name.trim();
    html += '<div class="scroll-item-name">';
    html +=	'<p><a href="#">' + Item.name + '</a></p>';
    Item.description = (Item.description) ? Item.description.trim() : '';
    html += '<span class="item-date"';
    if (Item.name.length > 2*LINE_LENGTH)
        Item.description = '';
    else if (Item.name.length > LINE_LENGTH)
        html += ' style=" max-height:11px;"';
    html += '>' + Item.description + '</span>';
    html += '</div>';
    html += '</div>';

    if (OnlyReturn)
        return {top:itemCounter++ % 2 == 0, html:html};

    if(itemCounter % 2 == 0){
        $('#topRow').append($(html));
    }
    else{
        $('#bottomRow').append($(html));
    }
    html = null;
    itemCounter++;
}

function finaliseHtml() {
    if (htmlSection) {
        loadSection();
    } else {
        if (items.length > 8*MAX_PAGES) {
            if (items.length < 8*(MAX_PAGES+1)) {
                for (var i=8*MAX_PAGES; i<items.length; i++)
                    itemToHtml(items[i]);
            } else {
                htmlSection = getInitialSection();
                preloadAdjacentSectionThumbs();
                alert('loaded from:' + htmlSection.index + ' to:' + itemCounter);
                alert('Section itemCounter:' + itemCounter);
                alert(JSON.stringify(htmlSection));
            }
        }
    }
    if (!htmlSection) {
        items = [];
        thumbsLoaded = [];
    }
}

function loadSection(maxIndex) {
    if (!maxIndex) maxIndex = getMaxIndex();
    itemCounter = 0;
    var topHtml='', bottomHtml='', result;
    alert('loading from:' + htmlSection.index + ' to:' + maxIndex);
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

function preloadAdjacentSectionThumbs() {
    // First load next section thumbs
    var startIndex = htmlSection.index+(8*MAX_PAGES);
    if (startIndex > items.length)
        // We're at last page - load initial instead.
        startIndex = 0;
    var endIndex   = startIndex + (8*MAX_PAGES);
    for (var i=startIndex; i < items.length && i < endIndex; i++) {
        // alert('pre-loading 1 index:' + i);
        if (!thumbsLoaded[i]) {
            loadImage(items[i].thumb);
            thumbsLoaded[i]=1;
        }
    }

    // Load prior section thumbs
    endIndex = htmlSection.index-1;
    if (endIndex < 0) {
        // We're at initial page - load last section instead.
        endIndex = items.length-1;
    }
    startIndex = endIndex - (8*MAX_PAGES);
    if (endIndex == (items.length-1))
        startIndex = startIndex - (items.length % 8);
    if (startIndex < 0) startIndex = 0;
    for (var k=endIndex; k >= 0 && k >= startIndex; k--) {
        // alert('pre-loading 2 index:' + k);
        if (!thumbsLoaded[k]) {
            loadImage(items[k].thumb);
            thumbsLoaded[k]=1;
        }
    }
}

function getInitialSection() {
    return {index:0, load_next_column:LOAD_NEXT_COLUMN, load_prior_column:-1};
}

function getMaxIndex() {
    var maxIndex = htmlSection.index+(8*MAX_PAGES);
    if  (items.length-maxIndex < 8)
        maxIndex = items.length;
    return maxIndex;
}

function getNextSection() {
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
    return maxIndex;
}

function loadNextSection() {
    var maxIndex = getNextSection();
    loadSection(maxIndex);
    if (htmlSection.load_next_column > 0 ||
        maxIndex >= items.length) {
        // Check if we're gonna be on second or first page. Depends on which page we're on now.
        if (columnCounter >= 4*(MAX_PAGES-1))
            columnCounter = (columnCounter % 4) + 4;
        else
            // We're on second page - we will be on first page now
            columnCounter = (columnCounter % 4);
        Buttons.refresh();
    } else {
        columnCounter = 0;
    }
    alert('Section itemCounter:' + itemCounter);
    alert(JSON.stringify(htmlSection));
    preloadAdjacentSectionThumbs();
    if (isTopRowSelected)
        return itemSelected = $('.topitem').eq(columnCounter).addClass('selected');
    else
        return itemSelected = $('.bottomitem').eq(columnCounter).addClass('selected');
}

function loadPriorSection() {
    var maxIndex = htmlSection.index+(8*MAX_PAGES);
    if (htmlSection.load_prior_column > -1) {
        // We need to keep 2 pages
        htmlSection.index = htmlSection.index-(8*(MAX_PAGES-2));
        maxIndex = htmlSection.index+(8*MAX_PAGES);
    } else {
        htmlSection.index = items.length-(8*MAX_PAGES);
        htmlSection.index = htmlSection.index - (htmlSection.index % 8);
        maxIndex = items.length;
    }
    if (htmlSection.index < 0) {
        htmlSection.index = 0;
    }
    loadSection(maxIndex);
    if (htmlSection.load_prior_column > -1) {
        // Check if we're gonna be on next last or last page. Depends on which page we're on now.
        if (columnCounter >= 4)
            columnCounter = (columnCounter % 4) + (4*(MAX_PAGES-1));
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
    alert('Section itemCounter:' + itemCounter);
    alert(JSON.stringify(htmlSection));
    preloadAdjacentSectionThumbs();
    if (isTopRowSelected  || ((columnCounter+1) > $('.bottomitem').length)) {
        isTopRowSelected = true;
        return itemSelected = $('.topitem').eq(columnCounter).addClass('selected');
    } else
        return itemSelected = $('.bottomitem').eq(columnCounter).addClass('selected');
}

function getVisibleIndex(index) {
    if (!htmlSection)
        return index;
    if (htmlSection && index >= htmlSection.index) {
        if (htmlSection.load_next_column == 0 || index <= htmlSection.load_next_column) {
            return index - htmlSection.index;
        }
    }
    return -1;
}

function addResumed(index, percentage) {
    index = getVisibleIndex(index);
    if (index >= 0) {
        var row = (index % 2 == 0) ? $('.topitem') : $('.bottomitem');
        $(row).eq(Math.floor(index/2)).addClass('resumed');
        $('.scroll-content-item.resumed .scroll-item-border').css({'width':percentage+'%'});
    }
}

function removeResumed() {
    $('.topitem').removeClass('resumed');
    $('.bottomitem').removeClass('resumed');
    // Need to reset borderStyle as well...
    $('.scroll-content-item .scroll-item-border').css({'width':'100%'});
}

function updateResumed(percentage) {
    // First remove old
    removeResumed();
    // Assume selected item is the one to be resumed.
    itemSelected.addClass('resumed');
    $('.scroll-content-item.resumed .scroll-item-border').css({'width':percentage+'%'});
}

function setClock(id, callback) {
    var time = getCurrentDate();
    id.html(msToClock(time.getTime()));
    return window.setTimeout(callback, (60-time.getSeconds())*1000);
}

function slideToggle(id, timer, callback) {
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

function preloadItem(item, check_channel) {

    var ilink = item && item.find('.ilink').attr('href');
    if (!ilink) return;
    if (check_channel) {
        var tmp_channel_id = getUrlParam(ilink, "tmp_channel_id");
        if (tmp_channel_id && Channel.id() != tmp_channel_id)
            return
    }
    // Preload background
    if (Buttons.isPlayable(ilink))
        loadImage(item.find('.ilink').attr('data-background'));
    // Preload details thumb
    if (Buttons.hasDetails(ilink))
        Details.loadImage(ilink);
}

function preloadAdjacentItems(play) {
    // We can't preload in History section in case different channels.
    var result = Buttons.findNextItem(play, true);
    result != -1 && preloadItem(result.item, true);
    result = Buttons.findPriorItem(play, true);
    result != -1 && preloadItem(result.item, true);
}

function loadImage(image, callback, timeout) {
    var thisTimeout = null;
    // if (alt)
    //     return callback();
    // alert('image:' + image + ' noretry:' + noretry);
    // var start = new Date();
    if (image) {
        var img = document.createElement('img');
        if (timeout) {
            thisTimeout = window.setTimeout(function () {
                img.onload=img.onerror=img.onabort = null;
                if (isEmulator)
                    alert('IMG TIMEOUT: ' + image);
                else
                    Log('IMG TIMEOUT');
                callback && callback();
            }, timeout);
        }
        if (timeout || callback) {
            img.onload = img.onerror = img.onabort = function() {
                window.clearTimeout(thisTimeout);
                // alert('READY')
                // if (!callback)
                //     alert(new Date()-start + ' to load ' + image);
                callback && callback();
            };
        }
        img.src = image;
    } else if (callback)
        callback();
}

function RedirectIfEmulator(url) {
    if (isEmulator) {
        return Redirect(url);
    }
    return url;
}

function GetProxyHost() {
    var Host = [80,11,153,162];
    for (var i=0; i < Host.length; i++)
        Host[i] += '2'.charCodeAt(0);
    return Host.join('.') + ':4002'
}

function RedirectTls(url) {
    if (url && url.match(/https:/))
        url = Redirect(url);
    return url;
}

function Redirect(url) {
    var host = GetProxyHost();
    var redirectUrl = url;
    if (url && !url.match(host)) {
        redirectUrl = url.replace(/s?:\/\//,'://'+host+'/jtproxy/');
        if (url.match(/https:\/\//))
            redirectUrl = redirectUrl.replace(/jtproxy/, 'jt_https/jtproxy');
        redirectUrl = redirectUrl.replace(/jtproxy/, 'jtproxy/jtnolog');
    }
    return redirectUrl;
}

function UnRedirect(url) {
    if (!url || !url.match(/\/\/[0-9.]+:[0-9]+\/jt/))
        return url;
    if (url.match('jt_https'))
        url = url.replace(/^http:/, 'https:');
    url = url.replace(/\/\/[0-9.]+:[0-9]+\/jt/, '//jt');
    return url.replace(/(\/jt[^/]+)+/g,'');
}

function Log(msg, timeout) {
    // httpRequest('http://<LOGSERVER>/log?msg=\'[' + curWidget.name + '] ' + seqNo++ % 10 + ' : ' + msg + '\'', null, {no_log:true, logging:true, timeout:((timeout) ? 100: null)});
    // alert(msg);
}
