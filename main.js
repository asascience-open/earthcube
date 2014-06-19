var pageSize = 20;
var searchStore;
var dataAccess;

function resize() {
  var offset = 170;
  if ($('ul.nav li:last-child').hasClass('active')) {
    offset = 105;
  }
  $('#search-results, #map').height($(window).height() - offset);
  var cmp = Ext.getCmp('searchPanel');
  if (cmp && cmp.rendered) {
    cmp.setSize($('#search-results').width(),$('#search-results').height());
  }
}

window.onresize = function(e){
  resize();
};

function init() {
<<<<<<< HEAD
  $('#add-to-map-modal').modal({show: false});
  $('#download-modal').modal({show: false});
  $('#download-modal .btn-primary').on('click',function() {createDownloadLink()});
=======
  $('#add-to-map-modal, #download-modal, #link-modal').modal({show: false});
  $('#download-modal .btn-primary').on('click',function() {
    createDownloadLink();
  });
>>>>>>> ae03558c390a0ee45653da3d7971b1ef28d11c6f
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
  $('a[title="Search"').on('click',function() {
    searchStore.load();
  });
  $('a[title="Clear search"').on('click',function() {
    $('#search').val('');
    $('#search').focus();
  });
  $('a[title="Back"]').on('click',function() {
    Ext.getCmp('searchResultsPagingToolbar').movePrevious();
  });
  $('a[title="Forward"]').on('click',function() {
    Ext.getCmp('searchResultsPagingToolbar').moveNext();
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
    ,autoLoad   : true
    ,listeners  : {
      beforeload : function(sto,opt) {
        search(
           Ext.getCmp('searchPanel')
          ,sto
          ,$('#search').val()
          ,opt.params ? opt.params.start : 1
          ,false
          ,false
          ,false
        );
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
          if (rec.get('node') && rec.get('node').isAccessible()) {
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
    })
  });
}

function search(cmp,sto,searchText,start,searchBbox,searchBeginDate,searchEndDate) {
  cmp.getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="./lib/ext-3.4.1/resources/images/default/grid/loading.gif"></td></tr></table>');
  sto.removeAll();
  var constraints = {what : searchText};
  if (searchBbox && searchBbox == 'mapExtent') {
    var bbox = map.getExtent().transform(proj3857,proj4326).toArray();
    constraints.where = {
       'west'  : Math.max(bbox[0],-180)
      ,'south' : Math.max(bbox[1],-90)
      ,'east'  : Math.min(bbox[2],180)
      ,'north' : Math.min(bbox[3],90)
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
  GIAPI.DAB('http://23.21.170.207/bcube-broker-tb-101-beta2/').discover(
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
             id     : report.id
            ,title  : report.title
            ,descr  : report.description != 'none' ? report.description : ''
            ,when   : report.when
            ,where  : report.where
            ,online : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
            ,wms    : _.pluck(_.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()}),'name')
            ,vec    : _.sortBy(node.has_olVector_Layer(),function(o){return o.toLowerCase()})
            ,node   : node.isAccessible() ? node : false
          });
        }
      }
      sto.setBaseParam('start',start ? start : 1);
      sto.loadData(data);
      cmp.getEl().unmask();
    }
    ,constraints
    ,{
       start           : start
      ,pageSize        : pageSize
      ,spatialRelation : 'OVERLAPS'
    }
  );
}

function showDownloadModal(reportId) {
  $('#download-modal').data('reportId',reportId);
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    var node = searchStore.getAt(searchIdx).get('node');
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
        alert('download error');
        return;
      }

      // Try to find the first combo for 4326 that will work and set the defaults.
      var rec = _.find(dataAccess,function(o){return /epsg:4326/i.test(o.crs)});
      if (!rec) {
        rec = dataAccess[0];
      }
      $('#name option').filter(function() {return $(this).html() == rec.name}).prop('selected',true);
      $('#crs option').filter(function() {return $(this).html() == rec.crs}).prop('selected',true);
      $('#rasterFormat option').filter(function() {return $(this).html() == rec.rasterFormat}).prop('selected',true);
      $('.selectpicker').selectpicker('refresh');

      // Assume top-down (name -> crs -> rasterFormat) heirarchy.
      $('#name').change(function() {
        var rec = _.findWhere(dataAccess,{name : $(this).val()});
        $('#crs option').filter(function() {return $(this).html() == rec.crs}).prop('selected',true);
        $('#rasterFormat option').filter(function() {return $(this).html() == rec.rasterFormat}).prop('selected',true);
        $('.selectpicker').selectpicker('refresh');
        syncDownloadOptions();
      });
      $('#crs').change(function() {
        var rec = _.findWhere(dataAccess,{name : $('#name').val(),crs : $(this).val()});
        $('#rasterFormat option').filter(function() {return $(this).html() == rec.rasterFormat}).prop('selected',true);
        $('.selectpicker').selectpicker('refresh');
        syncDownloadOptions();
      });

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
    }
    else if (options['resolution']) {
      delete options['resolution'][o];
    }
  });
 
  var idx = searchStore.findExact('id',$('#download-modal').data('reportId'));
  if (idx >= 0) {
    searchStore.getAt(idx).get('node').accessLink(function(resp) {
      alert(resp);
    },options);
  }
}

function addToMapModal(reportId) {
  var searchIdx = searchStore.findExact('id',reportId);
  if (searchIdx >= 0) {
    var rec = searchStore.getAt(searchIdx);
    var wms = [];
    _.each(rec.get('wms'),function(o) {
      var params = [rec.get('id'),o];
      wms.push('<a title="Add layer to map" href="javascript:addWms(\'' + params.join("','") + '\')">' + o + '</a>');
    });
    var vec = [];
    _.each(rec.get('vec'),function(o) {
      var params = [rec.get('id'),o];
      vec.push('<a title="Add layer to map" href="javascript:addVec(\'' + params.join("','") + '\')">' + o + '</a>');
    });
    $('#add-to-map-modal ul').html('<li>' + wms.concat(vec).join('</li><li>') + '</li>');
    $('#add-to-map-modal').modal('show');
  }
}

function addWms(p) {
  alert(p[0]);
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
