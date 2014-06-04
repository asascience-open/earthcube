var pageSize = 10;
var searchStore;

var map;
var searchShadow;
var searchHilite;
var proj3857   = new OpenLayers.Projection("EPSG:3857");
var proj900913 = new OpenLayers.Projection("EPSG:900913");
var proj4326   = new OpenLayers.Projection("EPSG:4326");

function init() {
  searchStore = new Ext.data.Store({
    reader     : new Ext.data.JsonReader({
       idProperty    : 'id'
      ,root          : 'rows'
      ,totalProperty : 'results'
      ,fields        : [
         {name : 'id'}
        ,{name : 'title'}
        ,{name : 'when'}
        ,{name : 'where'}
        ,{name : 'online'}
        ,{name : 'wms'}
      ]
    })
    ,remoteSort : true
    ,baseParams : {start : 1}
    ,proxy      : new Ext.data.MemoryProxy()
    ,listeners  : {
      beforeload : function(sto,opt) {
        search(Ext.getCmp('searchPanel'),sto,Ext.getCmp('searchText').getValue(),opt.params ? opt.params.start : 1);
      }
      ,load : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow); 
      }
      ,clear : function(sto) {
        searchHilite.removeAllFeatures();
        syncMapWithResults(sto,searchShadow);
      }
    }
  });

  var searchPanel = {
     title           : 'Search'
    ,id              : 'searchPanel'
    ,layout          : 'fit'
    ,width           : 400
    ,region          : 'west'
    ,constrainHeader : true
    ,items           : new Ext.grid.GridPanel({
       store   : searchStore
      ,columns : [
        new Ext.grid.RowNumberer({
          renderer : function(v,p,record,rowIndex) {
            if (this.rowspan) {
              p.cellAttr = 'rowspan="'+this.rowspan+'"';
            }
            return rowIndex + 1 + record.store.baseParams.start - 1;
          }
        })
        ,{id : 'title',dataIndex : 'title',header : 'Description'}
        ,{id : 'when',dataIndex : 'when',header : 'When',width : 150,renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            var minT = o.start; 
            var maxT = o.end;
            if (minT != '' && maxT != '') {
              if (isoDateToDate(minT).format('mmm d, yyyy') == isoDateToDate(maxT).format('mmm d, yyyy')) {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy'));
              }
              else if (isoDateToDate(minT).format('yyyy') == isoDateToDate(maxT).format('yyyy')) {
                rows.push(isoDateToDate(minT).format('mmm d') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
              else {
                rows.push(isoDateToDate(minT).format('mmm d, yyyy') + ' - ' + isoDateToDate(maxT).format('mmm d, yyyy'));
              }
            }
          });
          return rows.join('<br>');
        }}
/*
        ,{id : 'where',dataIndex : 'where',header : 'Where',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.west + ',' + o.south + ',' + o.east + ',' + o.north);
          });
          return rows.join('<br>');
        }}
*/
/*
        ,{dataIndex : 'online',header : 'Protocol',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.protocol);
          });
          return rows.join('<br>');
        }}
*/
        ,{dataIndex : 'wms',header : 'WMS',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.name);
          });
          return rows.join('<br>');
        }}
/*
        ,{dataIndex : 'online',header : 'Name',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push(o.name);
          });
          return rows.join('<br>');
        }}
        ,{dataIndex : 'online',header : 'URL',renderer : function(val,p,rec) {
          var rows = [];
          _.each(val,function(o) {
            rows.push('<a target=_blank href="' + o.url + '">link</a>');
          });
          return rows.join('<br>');
        }}
*/
      ]
      ,autoExpandColumn : 'title'
      ,border           : false
      ,loadMask         : true
      ,tbar             : [new Ext.ux.form.SearchField({
         emptyText       : 'Enter keywords to find data.'
        ,id              : 'searchText'
        ,width           : 220
        ,border          : false
        ,wrapFocusClass  : ''
        ,disableSelection : true
        ,onTrigger1Click  : function() {
          if(this.hasSearch){
            this.reset();
            // force a reset for emptyText
            this.setRawValue(this.emptyText);
            this.el.addClass(this.emptyClass);
            this.triggers[0].hide();
            this.hasSearch = false;
            searchStore.removeAll();
          }
        }
        ,onTrigger2Click : function() {
          var v = this.getRawValue();
          if (v.length < 1) {
            this.onTrigger1Click();
            return;
          }
          searchStore.load();
          this.hasSearch = true;
          this.triggers[0].show();
        }
      })]
      ,bbar            : new Ext.PagingToolbar({
         pageSize    : pageSize
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
          if (row >= 0) {
            var rec = this.getStore().getAt(row);
            if (rec) {
              searchHilite.removeAllFeatures();
              searchHilite.addFeatures(makeFeatures(rec));
              searchHilite.redraw();
            }
          }
        }
        ,mouseout : function(e,t) {
          searchHilite.removeAllFeatures();
          searchHilite.redraw();
        }
      }
    })
  };

  var mapPanel = {
     html      : '<div id="map"></div>'
    ,region    : 'center'
    ,title     : 'Map'
    ,listeners : {
      afterrender : function(p) {
        initMap();
      }
      ,bodyresize : function(p,w,h) {
        var el = document.getElementById('map');
        if (el) {
          el.style.width  = w;
          el.style.height = h;
          map.updateSize();
        }
      }
    }
  };

  new Ext.Viewport({
     layout : 'border'
    ,title  : 'Map'
    ,layout : 'border'
    ,items  : [ 
       mapPanel
      ,searchPanel
    ]
  });
}

function search(cmp,sto,searchText,start) {
  cmp.getEl().mask('<table class="maskText"><tr><td>Loading...&nbsp;</td><td><img src="./lib/ext-3.4.1/resources/images/default/grid/loading.gif"></td></tr></table>');
  sto.removeAll();
  GIAPI.DAB('http://23.21.170.207/bcube-broker-tb-100/').discover(
    function(result) {
      var data = {
         results : 0
        ,rows    : []
      };
      var paginator = result[0];
      data.results = paginator.resultSet().size;
      var page = paginator.page();
      while (page.hasNext()) {
        var node = page.next();
        var report = node.report();
        data.rows.push({
           id     : report.id
          ,title  : report.description != 'none' ? report.description : report.title
          ,when   : report.when
          ,where  : report.where
          ,online : _.sortBy(report.online,function(o){return o.protocol.toLowerCase()})
          ,wms    : _.sortBy(node.olWMS_Layer(),function(o){return o.name.toLowerCase()})
        });
      }
      sto.setBaseParam('start',start ? start : 1);
      sto.loadData(data);
      cmp.getEl().unmask();
    }
    ,{
      what : searchText
    }
    ,{
       start    : start
      ,pageSize : pageSize
    }
  );
}

function initMap() {
  searchShadow = new OpenLayers.Layer.Vector(
     'Search shadow'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillColor     : '#0000ff'
          ,fillOpacity   : 0.02
          ,strokeWidth   : 1
          ,strokeColor   : '#0000ff'
          ,strokeOpacity : 0.2
        })
      )
    })}
  );

  searchHilite = new OpenLayers.Layer.Vector(
     'Search hilite'
    ,{styleMap : new OpenLayers.StyleMap({
      'default' : new OpenLayers.Style(
        OpenLayers.Util.applyDefaults({
           fillOpacity   : 0
          ,strokeWidth   : 2
          ,strokeColor   : '#ff0000'
          ,strokeOpacity : 0.75
          ,label         : "${title}"
          ,fontColor     : '#000000'
          ,fontSize      : '13px'
          ,fontFamily    : 'arial'
          ,fontWeight    : 'bold'
        })
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
/*
      new OpenLayers.Layer.Google('Google Terrain',{
         type          : google.maps.MapTypeId.TERRAIN
        ,projection    : proj900913
      })
*/
      ,searchShadow
      ,searchHilite
    ]
    ,controls : [new OpenLayers.Control.Navigation(),new OpenLayers.Control.MousePosition({displayProjection : proj4326})]
    ,center : new OpenLayers.LonLat(0,0)
    ,zoom   : 1
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
         type       : 'Feature'
        ,geometry   : g
        ,properties : {
          title : wordwrap(rec.get('title'),20,"\n")
        }
      }]
    });
    f[0].geometry.transform(proj4326,proj900913);
/*
    // change geometry from polygon to line
    if (f[0].geometry.getArea() == 0) {
      f[0].geometry = f[0].geometry.getVertices()[0];
    }
    else {
      var vertices = f[0].geometry.getVertices();
      vertices.push(vertices[0]);
      f[0].geometry = new OpenLayers.Geometry.LineString(vertices);
    }
*/
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

// http://james.padolsey.com/javascript/wordwrap-for-javascript/
function wordwrap(str,width,brk,cut) {
  brk = brk || '\n';
  width = width || 75;
  cut = cut || false;

  if (!str) { return str; }
 
  var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');
 
  return str.match( RegExp(regex, 'g') ).join( brk );
}
