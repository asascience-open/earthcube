var pageSize = 20;
var searchStore;
var dataAccess;

var map;
var mapView;
var proj3857 = new OpenLayers.Projection("EPSG:3857");
var proj4326 = new OpenLayers.Projection("EPSG:4326");

var searchShadow;
var searchHilite;

function resize() {
  var offset = 170;
  if ($('ul.nav li:last-child').hasClass('active')) {
    offset = 105;
  }
  $('#search-results').height($(window).height() - offset);
  var cmp = Ext.getCmp('searchPanel');
  if (cmp && cmp.rendered) {
    cmp.setSize($('#search-results').width(),$('#search-results').height());
  }
  if ($('#search-results').is(':visible')) {
    $('#date-slider').dateRangeSlider('resize');
    $('#map').height($(window).height() - offset - 2);
    Ext.defer(function(){map && map.updateSize()},10);
  }
  else {
    $('#mapView').height($(window).height() - offset - 2);
    Ext.defer(function(){mapView && mapView.updateSize()},10);
  }
}

window.onresize = function(e){
  resize();
};

function init() {
  initMap();

  $('#restrict').change(function() {
    searchStore.load();
  });

  $('#add-to-map-modal, #download-modal, #link-modal').modal({show: false});
  $('#download-modal .btn-primary').on('click',function() {
    createDownloadLink();
  });
  $('#use-map-boundaries').on('click',function() {
    var bbox = map.getExtent().transform(proj3857,proj4326).toArray();
    $('#west').val(Math.max(bbox[0],-180));
    $('#south').val(Math.max(bbox[1],-90));
    $('#east').val(Math.min(bbox[2],180));
    $('#north').val(Math.min(bbox[3],90));
  });
  $('.selectpicker').selectpicker();

  $('#search').val('temperature');
  $('#search').keypress(function(e) {
    if (e.keyCode == 13) {
      searchStore.load();
    }
  });
  $('a[title="Search"]').on('click',function() {
    searchStore.load();
  });
  $('a[title="Clear search"]').on('click',function() {
    $('#search').val('');
    $('#search').focus();
  });
  $('a[title="Back"]').on('click',function() {
    Ext.getCmp('searchResultsPagingToolbar').movePrevious();
  });
  $('a[title="Forward"]').on('click',function() {
    Ext.getCmp('searchResultsPagingToolbar').moveNext();
  });

  $('#date-slider').dateRangeSlider({
    bounds : {
       min : new Date(2012,0,1)
      ,max : new Date(Date.now())
    }
    ,defaultValues : {
       min : new Date(2012,0,1)
      ,max : new Date(Date.now())
    }
  });
  $('#date-slider').bind('valuesChanged',function(e,data){
    searchStore.load();
  });

  $('ul.nav li:first-child a').on('click', function(e){
    e.preventDefault();
    if ($(this).hasClass('active'))
      return false;
    else {
      $('#mapView').hide();
      $('#map').show();
      $('#map-col').removeClass('col-md-9').addClass('col-md-4');
      $('#search-row, #search-results').show();
      $('#map-view-col').hide();
      $('li.active').removeClass('active');
      $(this).parent().addClass('active');
      resize();
    }
  });

  $('ul.nav li:last-child a').on('click', function(e){
    e.preventDefault();
    if ($(this).hasClass('active'))
      return false;
    else {
      $('#map').hide();
      $('#mapView').show();
      $('#search-row, #search-results').hide();
      $('#map-view-col').show();
      $('#map-col').removeClass('col-md-4').addClass('col-md-9');
      $('li.active').removeClass('active');
      $(this).parent().addClass('active');
      resize();
    }
  });

  $('#show-hide-assets a').on('click', function(e){
    e.preventDefault();
    if ($(this).text() == "Turn all assets off") {
      $('#asset-list input[type="checkbox"]').each(function(i){
        $(this).prop('checked') ? $(this).trigger('click') : false;
      });
    }
    else {
      $('#asset-list input[type="checkbox"]').each(function(i){
        !$(this).prop('checked') ? $(this).trigger('click') : false;
      });
    }
  });

  searchStore = new Ext.data.Store({
    reader     : new Ext.data.JsonReader({
       idProperty    : 'id'
      ,root          : 'rows'
      ,totalProperty : 'results'
      ,fields        : [
         {name : 'id'}
        ,{name : 'title'}
        ,{name : 'descr'}
        ,{name : 'when'}
        ,{name : 'where'}
        ,{name : 'online'}
        ,{name : 'wms'}
        ,{name : 'vec'}
        ,{name : 'node'}
      ]
    })
    ,remoteSort : true
    ,baseParams : {start : 1}
    ,proxy      : new Ext.data.MemoryProxy()
    ,listeners  : {
      beforeload : function(sto,opt) {
        search(
           Ext.getCmp('searchPanel')
          ,sto
          ,$('#search').val()
          ,opt.params ? opt.params.start : 1
          ,$('#restrict').prop('checked') ? map.getExtent().transform(proj3857,proj4326).toArray() : false
          ,$('#date-slider').dateRangeSlider('min')
          ,$('#date-slider').dateRangeSlider('max')
        );
      }
      ,load : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow); 
        searchShadow.setVisibility(true);
      }
      ,clear : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow);
      }
    }
  });

  new Ext.Panel({
     id              : 'searchPanel'
    ,renderTo        : 'search-results'
    ,layout          : 'fit'
    ,border          : false
    ,region          : 'center'
    ,listeners       : {afterrender : function(){resize()}}
    ,items           : new Ext.grid.GridPanel({
       disableSelection : true
      ,store            : searchStore
      ,hideHeaders      : true
      ,cls              : 'searchResults'
      ,viewConfig       : {
        getRowClass : function(rec,idx) {return 'searchRow'}
      }
      ,columns          : [
        {id : 'title',dataIndex : 'title',header : 'Description',renderer : function(val,p,rec) {
          var title = val;

          val = rec.get('when');
          var when = [];
          _.each(val,function(o) {
            var minT = o.start;
            var maxT = o.end;
            if (minT != '' && maxT != '') {
              if (isoDateToDate(minT).format('mmm d, yyyy') == isoDateToDate(maxT).format('mmm d, yyyy')) {
                when.push(isoDateToDate(minT).format('mmm d, yyyy'));
              }
              else if (isoDateToDate(minT).format('yyyy') == isoDateToDate(maxT).format('yyyy')) {
                if (isoDateToDate(minT).format('mmm') == isoDateToDate(maxT).format('mmm')) {
                  when.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('d, yyyy'));
                }
                else {
                  when.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
                }
              }
              else {
                when.push(isoDateToDate(minT).format('mmm d, yyyy') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
            }
          });

          var download = '';
          if (rec.get('node') && (rec.get('node').isAccessible() || rec.get('node').isSimplyAccessible())) {
            var params = [rec.get('id')];
            download = '<a href="javascript:showDownloadModal(\'' + params.join("','") + '\')" title="Download data"><img src="img/download_data.png" title="Download data">Download</a>';
          }

          var addToMap = '';
          if (rec.get('wms').concat(rec.get('vec')).length > 0) {
            var params = [rec.get('id')];
            addToMap = '<a href="javascript:addToMapModal(\'' + params.join("','") + '\')" title="Add to map"><img src="img/add_to_map.png" title="Add to map">Add to Map</a>';
          }

          var timeSpan = '';
          if (when.length > 0) {
            timeSpan = '<input type="text" value="' + when[0] + '" name="dateTime" disabled="true">' + '<a><img src="img/time.png">Time Range</a>';
          }

          return '<div class="searchRowText">'
              + '<div class="title">' + ellipse(title,60) + '</div>' 
              + '<div class="content">' + rec.get('descr') + '</div>'
              + '<div class="buttons">'
                + download
                + addToMap
                + timeSpan
              + '</div>'
            + '</div>';
 
        }}
      ]
      ,autoExpandColumn : 'title'
      ,border           : false
      ,loadMask         : true
      ,enableHdMenu     : false
      ,bbar            : new Ext.PagingToolbar({
         pageSize    : pageSize
        ,hidden      : true
        ,store       : searchStore
        ,id          : 'searchResultsPagingToolbar'
        ,displayInfo : true
        ,displayMsg  : 'Displaying results {0} - {1} of {2}'
        ,emptyMsg    : 'No results to display'
        // override the following because start is 1-based instead of extjs's 0-based default
        ,moveFirst   : function() {
          this.doLoad(1);
        }
        ,onLoad      : function(store, r, o){
          if (!this.rendered){
            this.dsLoaded = [store, r, o];
            return;
          }
          var p = this.getParams();
          this.cursor = (o.params && o.params[p.start]) ? o.params[p.start] : store.baseParams.start ? store.baseParams.start : 1;
          var d = this.getPageData(), ap = d.activePage, ps = d.pages;

          this.afterTextItem.setText(String.format(this.afterPageText, d.pages));
          this.inputItem.setValue(ap);
          this.first.setDisabled(ap == 1);
          this.prev.setDisabled(ap == 1);
          this.next.setDisabled(ap == ps);
          this.last.setDisabled(ap == ps);
          $('a[title="Back"] img').attr('src','img/back_arrow_' + (ap == 1 ? 'grey' : 'blue') + '.png');
          $('a[title="Forward"] img').attr('src','img/forward_arrow_' + (ap == ps ? 'grey' : 'blue') + '.png');
          this.refresh.enable();
          this.updateInfo();
          this.fireEvent('change', this, d);
        }
        ,updateInfo  : function(){
          if (this.displayItem){
            var count = this.store.getCount();
            var msg = count == 0 ?
              this.emptyMsg :
              String.format(
                this.displayMsg,
                this.cursor, this.cursor+count - 1, this.store.getTotalCount()
              );
            this.displayItem.setText(msg);
            $('#pagination p').html(msg);
          }
        }
        ,getPageData : function(){
          var total = this.store.getTotalCount();
          return {
            total : total,
            activePage : Math.ceil((this.cursor+this.pageSize - 1)/this.pageSize),
            pages :  total < this.pageSize ? 1 : Math.ceil(total/this.pageSize)
          };
        }
      })
      ,listeners : {
        mouseover : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchShadow.setVisibility(true);
            searchHilite.removeAllFeatures();
            var rec = this.getStore().getAt(row);
            if (rec) {
              searchHilite.addFeatures(makeFeatures(rec));
            }
            searchHilite.redraw();
          }
        }
        ,mouseout : function(e,t) {
          var row = this.getView().findRowIndex(t);
          if (_.isNumber(row)) {
            searchHilite.removeAllFeatures();
            searchHilite.redraw();
          }
        }
      }
    })
  });
}

function search(cmp,sto,searchText,start,searchBbox,searchBeginDate,searchEndDate) {
  cmp.getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="./lib/ext-3.4.1/resources/images/default/grid/loading.gif"></td></tr></table>');
  sto.removeAll();
  var constraints = {what : searchText};
  if (searchBbox) {
    constraints.where = {
       'west'  : Math.max(searchBbox[0],-180)
      ,'south' : Math.max(searchBbox[1],-90)
      ,'east'  : Math.min(searchBbox[2],180)
      ,'north' : Math.min(searchBbox[3],90)
    };
  }
  if (searchBeginDate || searchEndDate) {
    constraints.when = {};
    if (searchBeginDate) {
      constraints.when.from = searchBeginDate.format('yyyy-mm-dd');
    }
    if (searchEndDate) {
      constraints.when.to = searchEndDate.format('yyyy-mm-dd');
    }
  }
  console && console.dir(constraints);
  var gidab = GIAPI.DAB('http://bcube.geodab.eu/bcube-broker/');
  gidab.sources(
    function(result) {
      $('#search').attr('title','Enter a string to search the following source(s): ' + _.sortBy(_.pluck(result,'_title'),function(o){return o.toLowerCase()}).join(', ') + '.');
    }
  );
  gidab.discover(
    function(result) {
      var data = {
         results : 0
        ,rows    : []
      };
      var paginator = result[0];
      data.results = paginator.resultSet().size;
      var page = paginator.page();
      if (page) {
        while (page.hasNext()) {
          var node = page.next();
          var report = node.report();
          data.rows.push({
             id     : Ext.id()
            ,title  : report.title
            ,descr  : report.description != 'none' ? report.description : ''
            ,when   : report.when
            ,where  : report.where
            ,online : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
            ,wms    : _.pluck(_.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()}),'name')
            ,vec    : _.sortBy(node.has_olVector_Layer(),function(o){return o.toLowerCase()})
            ,node   : node.isAccessible() || node.isSimplyAccessible() ? node : false
          });
        }
      }
      if (data.results == 0) {
        gidab.node(searchText,function(node) {
          if (node) {
            var report = node.report();
            data.results++;
            data.rows.push({
               id     : Ext.id()
              ,title  : report.title
              ,descr  : report.description != 'none' ? report.description : ''
              ,when   : report.when
              ,where  : report.where
              ,online : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
              ,wms    : _.pluck(_.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()}),'name')
              ,vec    : _.sortBy(node.has_olVector_Layer(),function(o){return o.toLowerCase()})
              ,node   : node.isAccessible() || node.isSimplyAccessible() ? node : false
            });
          }
          sto.setBaseParam('start',start ? start : 1);
          sto.loadData(data);
          cmp.getEl().unmask();
        });
      }
      else {
        sto.setBaseParam('start',start ? start : 1);
        sto.loadData(data);
        cmp.getEl().unmask();
      }
    }
    ,constraints
    ,{
       start           : start
      ,pageSize        : pageSize
      ,spatialRelation : 'OVERLAPS'
    }
  );
}

function showDownloadModal(reportId,node) {
  $('#download-modal').data('reportId',reportId);
  var searchIdx = searchStore.findExact('id',reportId);
  if (node || searchIdx >= 0) {
    var node = node ? node : searchStore.getAt(searchIdx).get('node');
    var dl = node.isSimplyAccessible() ? node.simpleAccessLinks() : [];
    // CHANGEME.  For now, go straight to the 1st download link if cannot build a custom one.
    if (!node.isAccessible() && !_.isEmpty(_.compact(dl))) {
      window.open(dl[0]); 
    }
    node.accessOptions(function(resp) {
      // If we get here, we are assuming that there is at least one form of dataAccess.
      dataAccess = [];
      _.each(resp,function(accessOptions) {
        _.each(_.sortBy(accessOptions.validOptions,function(o){return (/epsg:4326/i.test(o.crs.toLowerCase()) ? 'a' : o.crs.toLowerCase())  + o.name.toLowerCase() + o.rasterFormat.toLowerCase()}),function(o) {
          dataAccess.push({
             accessOptions : accessOptions.defaultOptions
            ,name          : o.name
            ,crs           : o.crs
            ,linkage       : o.linkage
            ,protocol      : o.protocol
            ,rasterFormat  : o.rasterFormat
            ,resampling    : o.resampling
            ,subsetting    : o.subsetting
          });
        });
      });
      $('#name').html(
        '<option>' + _.uniq(_.sortBy(_.pluck(dataAccess,'name'),function(o){return o.toLowerCase()}),true).join('</option><option>') + '</option>'
      );
      $('#crs').html(
        '<option>' + _.uniq(_.sortBy(_.pluck(dataAccess,'crs'),function(o){return o.toLowerCase()}),true).join('</option><option>') + '</option>'
      );
      $('#rasterFormat').html(
        '<option>' + _.uniq(_.sortBy(_.pluck(dataAccess,'rasterFormat'),function(o){return o.toLowerCase()}),true).join('</option><option>') + '</option>'
      );

      if (dataAccess.length == 0) {
        $('#link-modal .modal-title').html('Error');
        $('#link-modal .modal-body ul').html('<li>Sorry, but there was an error accessing the data.</li>');
        $('#link-modal').modal('show');
        return;
      }

      // Assume top-down (name -> crs -> rasterFormat) heirarchy.
      $('#name').change(function() {
        var defaultOpt;
        var options =_.uniq(_.sortBy(_.pluck(
          _.filter(dataAccess,function(o) {
            o.name == $('#name').val() ? defaultOpt = o.accessOptions.crs : false;
            return o.name == $('#name').val();
          })
          ,'crs'
        ),function(o){return o.toLowerCase()}),true);
        $('#crs').html(
          '<option>' + options.join('</option><option>') + '</option>'
        );
        $('#crs option').filter(function() {return $(this).html() == defaultOpt}).prop('selected',true);
        $('#crs').trigger('change');
        syncDownloadOptions();
      });
      $('#crs').change(function() {
        var defaultOpt;
        var options =_.uniq(_.sortBy(_.pluck(
          _.filter(dataAccess,function(o) {
            $('#name').val() && o.crs == $('#crs').val() ? defaultOpt = o.accessOptions.rasterFormat : false;
            return o.name == $('#name').val() && o.crs == $('#crs').val();
          })
          ,'rasterFormat'
        ),function(o){return o.toLowerCase()}),true);
        $('#rasterFormat').html(
          '<option>' + options.join('</option><option>') + '</option>'
        );
        $('#rasterFormat option').filter(function() {return $(this).html() == defaultOpt}).prop('selected',true);
        $('.selectpicker').selectpicker('refresh');
        syncDownloadOptions();
      });

      $('#name option:first').prop('selected',true);
      $('#name').trigger('change');

      syncDownloadOptions();
      $('#download-modal').modal('show');
    },true);
  }
}

function syncDownloadOptions() {
  var rec = _.findWhere(dataAccess,{
     name         : $('#name').val()
    ,crs          : $('#crs').val()
    ,rasterFormat : $('#rasterFormat').val()
  });
  _.each(['west','south','east','north','from','to'],function(o) {
    $('#' + o).prop('disabled',!rec.subsetting);
  });
  _.each(['lonResolution','latResolution'],function(o) {
    $('#' + o).prop('disabled',!rec.resampling);
  });
  _.each(['west','south','east','north'],function(o) {
    $('#' + o).val(rec.accessOptions.spatialSubset ? rec.accessOptions.spatialSubset[o] : '');
  });
  _.each(['from','to'],function(o) {
    $('#' + o).val(rec.accessOptions.temporalSubset ? rec.accessOptions.temporalSubset[o] : '');
  });
  _.each(['lonResolution','latResolution'],function(o) {
    $('#' + o).val(rec.accessOptions.resolution ? rec.accessOptions.resolution[o] : '');
  });
}

function createDownloadLink() {
  var rec = _.findWhere(dataAccess,{
     name         : $('#name').val()
    ,crs          : $('#crs').val()
    ,rasterFormat : $('#rasterFormat').val()
  });

  var errors = [];

  var options = rec.accessOptions;
  _.each(['name','crs','rasterFormat'],function(o) {
    options[o] = $('#' + o).val();
  });

  _.each(['west','south','east','north'],function(o) {
    var val = $('#' + o).val();
    if (!_.isEmpty(val) && !$('#' + o).prop('disabled')) {
      if (!options['spatialSubset']) {
        options['spatialSubset'] = {};
      }
      options['spatialSubset'][o] = val;
      if (!$.isNumeric(val)) {
        errors.push(o + ' is not a valid number.');
      }
    }
    else if (options['spatialSubset']) {
      delete options['spatialSubset'][o];
    }
  });

  _.each(['from','to'],function(o) {
    var val = $('#' + o).val();
    if (!_.isEmpty(val) && !$('#' + o).prop('disabled')) {
      if (!options['temporalSubset']) {
        options['temporalSubset'] = {};
      }
      options['temporalSubset'][o] = val;
    }
    else if (options['temporalSubset']) {
      delete options['temporalSubset'][o];
    }
  });
 
  _.each(['lonResolution','latResolution'],function(o) {
    var val = $('#' + o).val();
    if (!_.isEmpty(val) && !$('#' + o).prop('disabled')) {
      if (!options['resolution']) {
        options['resolution'] = {};
      }
      options['resolution'][o] = val;
      if (!$.isNumeric(val)) {
        errors.push(o + ' is not a valid number.');
      }
    }
    else if (options['resolution']) {
      delete options['resolution'][o];
    }
  });

  if (errors.length > 0) {
    $('#link-modal .modal-title').html('Error');
    $('#link-modal .modal-body ul').html('<li>There was a problem with one or more of your input parameters.  Please try again.</li>');
    $('#link-modal').modal('show');
  }
  else {
    var idx = searchStore.findExact('id',$('#download-modal').data('reportId'));
    if (idx >= 0) {
      searchStore.getAt(idx).get('node').accessLink(function(resp) {
        $('#link-modal .modal-title').html('Download Link');
        $('#link-modal .modal-body ul').html('<li>This <a target=_blank href="' + resp + '">Download Link</a> may be opened directly and is suitable for bookmarking.</li>');
        $('#link-modal').modal('show');
      },options);
    }
  }
}

function addToMapModal(reportId) {
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    var rec = searchStore.getAt(searchIdx);
    var wms = [];
    var single = [];
    _.each(rec.get('wms'),function(o) {
      var params = [rec.get('id'),o];
      single = params.slice(0);
      wms.push('<a title="Add layer to map" href="javascript:addWms(\'' + params.join("','") + '\')">' + o + '</a>');
    });
    var vec = [];
    _.each(rec.get('vec'),function(o) {
      var params = [rec.get('id'),o];
      single = params.slice(0);
      vec.push('<a title="Add layer to map" href="javascript:addVec(\'' + params.join("','") + '\')">' + o + '</a>');
    });
    var all = wms.concat(vec);
    if (all.length == 1) {
      vec.length > 0 ? addVec(single[0],single[1]) : addWms(single[0],single[1]);
    }
    else {
      $('#add-to-map-modal ul').html('<li>' + all.join('</li><li>') + '</li>');
      $('#add-to-map-modal').modal('show');
    }
  }
}

function addWms(reportId,lyrName) {
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    if (_.findWhere(mapView.layers,{reportId : reportId,name : lyrName})) {
      $('#link-modal .modal-title').html('Error');
      $('#link-modal .modal-body ul').html('<li>Sorry, but this layer has already been added to your map.</li>');
      $('#link-modal').modal('show');
      return false;
    }
    else {
      $('#add-to-map-modal').modal('hide');
      $('ul.nav li:last-child a').trigger('click');
      var lyr = _.findWhere(searchStore.getAt(searchIdx).get('node').olWMS_Layer(),{name : lyrName});
      lyr.reportId = reportId;
      var rec = searchStore.getAt(searchIdx);
      if (!lyr.attributes) {
        lyr.attributes = {};
      }
      lyr.attributes.lyrId       = lyr.id;
      lyr.attributes.reportTitle = rec.get('title');
      lyr.attributes.where       = rec.get('where');
      lyr.attributes.node        = rec.get('node');

      var bounds = new OpenLayers.Bounds();
      _.each(lyr.attributes.where,function(o) {
        bounds.extend(new OpenLayers.Bounds(o.west,o.south,o.east,o.north));
      });
      bounds.transform(proj4326,proj3857);
      mapView.zoomToExtent(bounds);

      lyr.events.register('loadstart',this,function(e) {
        $('#asset-list ul li div a').filterByData('reportId',e.object.reportId).filterByData('name',e.object.name).show();
      });
      lyr.events.register('loadend',this,function(e) {
        $('#asset-list ul li div a').filterByData('reportId',e.object.reportId).filterByData('name',e.object.name).hide();
      });

      mapView.addLayer(lyr);
    }
  }
}

function addVec(reportId,lyrName) {
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    // check to see if it's been added already
    if (_.findWhere(mapView.layers,{reportId : reportId,name : lyrName})) {
      $('#link-modal .modal-title').html('Error');
      $('#link-modal .modal-body ul').html('<li>Sorry, but this layer has already been added to your map.</li>');
      $('#link-modal').modal('show');
    }
    else {
      $('#add-to-map-modal').modal('hide');
      $('ul.nav li:last-child a').trigger('click');
      searchStore.getAt(searchIdx).get('node').olVector_Layer(function(resp) {
        var lyr = _.findWhere(resp,{name : lyrName});

        lyr.projection = proj4326;
        lyr.styleMap   = new OpenLayers.StyleMap({
          'default' : new OpenLayers.Style(
            OpenLayers.Util.applyDefaults({
               fillOpacity   : 0
              ,strokeWidth   : 3
              ,strokeColor   : '#ff0000'
              ,strokeOpacity : 1
            })
          )
        });

        var rec = searchStore.getAt(searchIdx);
        lyr.reportId = reportId;
        if (!lyr.attributes) {
          lyr.attributes = {};
        }
        lyr.attributes.lyrId       = lyr.id;
        lyr.attributes.reportTitle = rec.get('title');;
        lyr.attributes.where       = rec.get('where');
        lyr.attributes.node        = rec.get('node');

        var bounds = new OpenLayers.Bounds();
        _.each(lyr.attributes.where,function(o) {
          bounds.extend(new OpenLayers.Bounds(o.west,o.south,o.east,o.north));
        });
        bounds.transform(proj4326,proj3857);
        mapView.zoomToExtent(bounds);

        lyr.events.register('loadstart',this,function(e) {
          $('#asset-list ul li div a').filterByData('reportId',e.object.reportId).filterByData('name',e.object.name).show();
        });
        lyr.events.register('loadend',this,function(e) {
          $('#asset-list ul li div a').filterByData('reportId',e.object.reportId).filterByData('name',e.object.name).hide();
        });

        mapView.addLayer(lyr);
      },true);
    }
  }
}

function initMap() {
  searchShadow = new OpenLayers.Layer.Vector(
     'Search shadow'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillOpacity   : 0
          ,strokeWidth   : '${getStrokeWidth}'
          ,strokeColor   : '#888888'
          ,strokeOpacity : 1
        })
        ,{
          context : {
            getStrokeWidth : function(f) {
              // Thicken up border if the bbox is tiny compared to the map.
              return (f.geometry.getArea() / map.getExtent().toGeometry().getArea()) < 0.0001 ? 5 : 1;
            }
          }
        }
      )
    })}
  );

  searchHilite = new OpenLayers.Layer.Vector(
     'Search hilite'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillOpacity   : 0.45
          ,fillColor     : '#ffffff'
          ,strokeWidth   : '${getStrokeWidth}'
          ,strokeColor   : '#0000ff'
          ,strokeOpacity : 1
        })
        ,{
          context : {
            getStrokeWidth : function(f) {
              // Thicken up border if the bbox is tiny compared to the map.
              return (f.geometry.getArea() / map.getExtent().toGeometry().getArea()) < 0.0001 ? 5 : 1;
            }
          }
        }
      )
    })}
  );

  map = new OpenLayers.Map('map',{
    layers            : [
      new OpenLayers.Layer.XYZ(
         'ESRI Ocean'
        ,'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/${z}/${y}/${x}.jpg'
        ,{
           sphericalMercator : true
          ,isBaseLayer       : true
          ,wrapDateLine      : true
        }
      )
      ,searchShadow
      ,searchHilite
    ]
    ,controls          : [
       new OpenLayers.Control.Navigation()
      ,new OpenLayers.Control.ZoomPanel()
      ,new OpenLayers.Control.Graticule({
         labelFormat     : 'dms'
        ,layerName       : 'grid'
        ,labelSymbolizer : {
           fontColor   : "#666"
          ,fontSize    : "10px"
          ,fontFamily  : "tahoma,helvetica,sans-serif"
        }
        ,lineSymbolizer  : {
           strokeWidth     : 0.40
          ,strokeOpacity   : 0.90
          ,strokeColor     : "#999999"
          ,strokeDashstyle : "dash"
        }
      })
    ]
    ,projection        : proj3857
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
  });
  Ext.defer(function(){map.setCenter(new OpenLayers.LonLat(0,0).transform(proj4326,proj3857),1)},1000);

  map.events.register('moveend',this,function(e) {
    $('#restrict').prop('checked') && searchStore.load();
  });

  mapView = new OpenLayers.Map('mapView',{
    layers            : [
      new OpenLayers.Layer.XYZ(
         'ESRI Ocean'
        ,'http://services.arcgisonline.com/ArcGIS/rest/services/Ocean_Basemap/MapServer/tile/${z}/${y}/${x}.jpg'
        ,{
           sphericalMercator : true
          ,isBaseLayer       : true
          ,wrapDateLine      : true
        }
      )
    ]
    ,controls          : [
       new OpenLayers.Control.Navigation()
      ,new OpenLayers.Control.ZoomPanel()
      ,new OpenLayers.Control.Graticule({
         labelFormat     : 'dms'
        ,layerName       : 'grid'
        ,labelSymbolizer : {
           fontColor   : "#666"
          ,fontSize    : "10px"
          ,fontFamily  : "tahoma,helvetica,sans-serif"
        }
        ,lineSymbolizer  : {
           strokeWidth     : 0.40
          ,strokeOpacity   : 0.90
          ,strokeColor     : "#999999"
          ,strokeDashstyle : "dash"
        }
      })
    ]
    ,projection        : proj3857
    ,displayProjection : proj4326
    ,units             : 'm'
    ,maxExtent         : new OpenLayers.Bounds(-20037508,-20037508,20037508,20037508.34)
    ,center            : new OpenLayers.LonLat(0,0)
    ,zoom              : 2
  });

  mapView.events.register('addlayer',map,function(e) {
    $('#asset-list ul').append(
      '<li>'
        + '<div class="checkbox">'
          + '<label><input data-reportId="' + e.layer.reportId + '" checked type="checkbox">' + e.layer.name + '</label>'
          + '<a href="javascript:void(0)"><img src="img/view_data.png" alt="Zoom-to data" title="Zoom to data" /></a>'
          + '<a href="javascript:void(0)"><img src="img/download_data.png" alt="Download data" title="Download data" /></a>'
          + '<a href="javascript:void(0)"><img src="img/loading.gif" alt="Loading" title="Loading"/></a>'
        + '</div>'
      + '</li>'
    );
    $('#asset-list ul li div input').last().change(function() {
      _.findWhere(mapView.layers,{reportId : e.layer.reportId,name : e.layer.name}).setVisibility($(this).is(":checked"));
    });
    $('#asset-list ul li div').last().find('a').click(function() {
      var lyr = _.findWhere(mapView.layers,{reportId : e.layer.reportId,name : e.layer.name});
      if (/zoom/i.test($(this).find('img').attr('title'))) {
        var bounds = new OpenLayers.Bounds();
        _.each(lyr.attributes.where,function(o) {
          bounds.extend(new OpenLayers.Bounds(o.west,o.south,o.east,o.north));
        });
        bounds.transform(proj4326,proj3857);
        mapView.zoomToExtent(bounds);
      }
      else if (/download/i.test($(this).find('img').attr('title'))) {
        showDownloadModal(e.layer.reportId,e.layer.attributes.node);
      }
    });
    $('#asset-list ul li div a').last().data('reportId',e.layer.reportId);
    $('#asset-list ul li div a').last().data('name',e.layer.name);
  });

}

function syncMapWithResults(sto,lyr) {
  var features = [];
  sto.each(function(rec) {
    features = features.concat(makeFeatures(rec));
  });
  lyr.removeFeatures(lyr.features);
  lyr.addFeatures(features);
  lyr.redraw();
}

function makeFeatures(rec) {
  var features = [];
  _.each(rec.get('where'),function(o) {
    o.west = o.west <= -179 ? -178 : o.west;
    o.south = o.south <= -89 ? -88 : o.south;
    o.east = o.east >= 179 ? 178 : o.east;
    o.north = o.north >= 89 ? 88 : o.north;
    var g = {
       type        : 'Polygon'
      ,coordinates : [[
         [o.west,o.south]
        ,[o.east,o.south]
        ,[o.east,o.north]
        ,[o.west,o.north]
        ,[o.west,o.south]
      ]]
    };
    var geojson = new OpenLayers.Format.GeoJSON();
    var f       = geojson.read({
       type     : 'FeatureCollection'
      ,features : [{
         type     : 'Feature'
        ,geometry : g
      }]
    });
    f[0].geometry.transform(proj4326,proj3857);
    features.push(f[0]);
  });
  return features;
}

function isoDateToDate(s) {
  // 2010-01-01T00:00:00Z
  s = s.replace("\n",'');
  var p = s.split('T');
  if (p.length == 2) {
    var ymd = p[0].split('-');
    var hm = p[1].split(':');
    return new Date(
       ymd[0]
      ,ymd[1] - 1
      ,ymd[2]
      ,hm[0]
      ,hm[1]
    );
  }
  else {
    return false;
  }
}

function ellipse(str,length) {
  return str.substr(0,length) + (str.length > length ? '...' : '');
}

$.fn.filterByData = function(prop,val) {
  return this.filter(
    function() { return $(this).data(prop)==val; }
  );
}
